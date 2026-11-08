-- 021_ejemplo_fuera_de_listas.sql
-- La causa de ejemplo del tutorial no aparece en el feed, los filtros ni el buscador.

create or replace function public.feed_causes(p_status cause_status, p_q text DEFAULT NULL::text, p_country text DEFAULT NULL::text, p_category cause_category DEFAULT NULL::cause_category, p_following boolean DEFAULT false, p_cursor_ts timestamp with time zone DEFAULT NULL::timestamp with time zone, p_cursor_id uuid DEFAULT NULL::uuid, p_limit integer DEFAULT 10)
 RETURNS SETOF causes
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select c.*
  from public.causes c
  join public.profiles p on p.id = c.author_id
  cross join lateral (
    select case p_status
      when 'activa'     then c.published_at
      when 'cerrada'    then c.closed_at
      when 'finalizada' then c.finalized_at
    end as sort_ts
  ) s
  where p_status in ('activa', 'cerrada', 'finalizada')
    and c.status = p_status
    and not c.is_example
    and (p_country is null or c.country_code = p_country)
    and (p_category is null or c.category = p_category)
    and (not p_following or exists (
          select 1 from public.follows f
          where f.follower_id = (select auth.uid()) and f.following_id = c.author_id))
    and (p_q is null or char_length(trim(p_q)) < 2 or
         public.f_unaccent(lower(concat_ws(' ', c.title, c.description, c.city, p.full_name, p.public_id)))
           like '%' || public.escape_like(public.f_unaccent(lower(trim(p_q)))) || '%')
    and (p_cursor_ts is null or (s.sort_ts, c.id) < (p_cursor_ts, p_cursor_id))
  order by s.sort_ts desc, c.id desc
  limit least(greatest(p_limit, 1), 30);
$function$;

create or replace function public.feed_facets(p_status cause_status, p_q text DEFAULT NULL::text, p_country text DEFAULT NULL::text, p_category cause_category DEFAULT NULL::cause_category, p_following boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  with base as (
    select c.*, p.full_name, p.public_id
    from public.causes c
    join public.profiles p on p.id = c.author_id
    where p_status in ('activa', 'cerrada', 'finalizada')
      and c.status = p_status
      and not c.is_example
      and (not p_following or exists (
            select 1 from public.follows f
            where f.follower_id = (select auth.uid()) and f.following_id = c.author_id))
      and (p_q is null or char_length(trim(p_q)) < 2 or
           public.f_unaccent(lower(concat_ws(' ', c.title, c.description, c.city, p.full_name, p.public_id)))
             like '%' || public.escape_like(public.f_unaccent(lower(trim(p_q)))) || '%')
  ),
  cat_counts as (
    select b.category, count(*)::int as total
    from base b
    where (p_country is null or b.country_code = p_country)
    group by b.category
  ),
  country_counts as (
    select b.country_code, count(*)::int as total
    from base b
    where (p_category is null or b.category = p_category)
      and b.country_code is not null
    group by b.country_code
  )
  select jsonb_build_object(
    'categories', coalesce((select jsonb_agg(jsonb_build_object('category', category, 'total', total)) from cat_counts), '[]'::jsonb),
    'countries', coalesce((select jsonb_agg(jsonb_build_object('country_code', country_code, 'total', total)) from country_counts), '[]'::jsonb)
  );
$function$;

create or replace function public.search_people_and_causes(q text, max_results integer DEFAULT 8)
 RETURNS TABLE(kind text, id uuid, label text, sublabel text, public_id text, country_code text, lat double precision, lng double precision, score integer)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  with t as (
    select public.f_unaccent(lower(btrim(q))) as nq,
           upper(btrim(q)) as uq
  )
  (
    select 'persona'::text,
           p.id,
           p.full_name,
           concat_ws(' · ', p.public_id, p.city),
           p.public_id,
           p.country_code,
           null::double precision,
           null::double precision,
           case
             when p.public_id in (t.uq, 'PNT-' || t.uq) then 3
             when public.f_unaccent(lower(p.full_name)) like public.escape_like(t.nq) || '%' then 2
             else 1
           end
      from public.profiles p, t
     where char_length(t.nq) >= 2
       and p.onboarding_completed_at is not null
       and (
         p.public_id in (t.uq, 'PNT-' || t.uq)
         or public.f_unaccent(lower(p.full_name)) like '%' || public.escape_like(t.nq) || '%'
       )
     order by 9 desc, p.full_name
     limit max_results
  )
  union all
  (
    select 'causa'::text,
           c.id,
           c.title,
           concat_ws(', ', c.city, c.country_code),
           null::text,
           c.country_code,
           c.lat::double precision,
           c.lng::double precision,
           case
             when public.f_unaccent(lower(c.title)) like public.escape_like(t.nq) || '%' then 2
             else 1
           end
      from public.causes c, t
     where char_length(t.nq) >= 2
       and c.status = 'activa'
       and not c.is_example
       and c.title is not null
       and public.f_unaccent(lower(c.title)) like '%' || public.escape_like(t.nq) || '%'
     order by 9 desc, c.published_at desc
     limit max_results
  )
$function$;
