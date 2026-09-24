-- AJUSTES-BUGS-3 · Paso 6a: el feed ya no usa profiles.username.
-- feed_causes y feed_facets buscan por nombre y por ID público (p.public_id).
-- Debe aplicarse antes de 20260923000600_014b_eliminar_username.sql.

CREATE OR REPLACE FUNCTION public.feed_causes(p_status cause_status, p_q text DEFAULT NULL::text, p_country text DEFAULT NULL::text, p_category cause_category DEFAULT NULL::cause_category, p_following boolean DEFAULT false, p_cursor_ts timestamp with time zone DEFAULT NULL::timestamp with time zone, p_cursor_id uuid DEFAULT NULL::uuid, p_limit integer DEFAULT 10)
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

CREATE OR REPLACE FUNCTION public.feed_facets(p_status cause_status, p_q text DEFAULT NULL::text, p_country text DEFAULT NULL::text, p_category cause_category DEFAULT NULL::cause_category, p_following boolean DEFAULT false)
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
