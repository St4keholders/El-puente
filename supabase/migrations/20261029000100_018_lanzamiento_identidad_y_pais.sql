-- 018_lanzamiento_identidad_y_pais.sql
-- 1. Nombre verificado fijo (el nombre público pasa a ser "Nombres + inicial del apellido").
-- 2. Últimos 4 caracteres del documento (nunca el número completo).
-- 3. Solo se publica en el país del documento o en el país de conexión confirmado (6 h estable).
-- 4. Ajustes de seguridad: columnas sensibles de identity_verifications fuera del alcance del cliente.
--
-- Todo es aditivo: no reemplaza enforce_cause_status ni procesar_verificacion_didit.

-- ───────────── 1. Tabla de códigos ISO alfa-3 → alfa-2 ─────────────
create table if not exists public.paises_iso (
  a3 text primary key,
  a2 text not null check (a2 ~ '^[A-Z]{2}$')
);
alter table public.paises_iso enable row level security;
revoke all on public.paises_iso from public, anon, authenticated;

insert into public.paises_iso (a3, a2) values
  ('ABW', 'AW'),
  ('AFG', 'AF'),
  ('AGO', 'AO'),
  ('AIA', 'AI'),
  ('ALA', 'AX'),
  ('ALB', 'AL'),
  ('AND', 'AD'),
  ('ARE', 'AE'),
  ('ARG', 'AR'),
  ('ARM', 'AM'),
  ('ASM', 'AS'),
  ('ATA', 'AQ'),
  ('ATF', 'TF'),
  ('ATG', 'AG'),
  ('AUS', 'AU'),
  ('AUT', 'AT'),
  ('AZE', 'AZ'),
  ('BDI', 'BI'),
  ('BEL', 'BE'),
  ('BEN', 'BJ'),
  ('BES', 'BQ'),
  ('BFA', 'BF'),
  ('BGD', 'BD'),
  ('BGR', 'BG'),
  ('BHR', 'BH'),
  ('BHS', 'BS'),
  ('BIH', 'BA'),
  ('BLM', 'BL'),
  ('BLR', 'BY'),
  ('BLZ', 'BZ'),
  ('BMU', 'BM'),
  ('BOL', 'BO'),
  ('BRA', 'BR'),
  ('BRB', 'BB'),
  ('BRN', 'BN'),
  ('BTN', 'BT'),
  ('BVT', 'BV'),
  ('BWA', 'BW'),
  ('CAF', 'CF'),
  ('CAN', 'CA'),
  ('CCK', 'CC'),
  ('CHE', 'CH'),
  ('CHL', 'CL'),
  ('CHN', 'CN'),
  ('CIV', 'CI'),
  ('CMR', 'CM'),
  ('COD', 'CD'),
  ('COG', 'CG'),
  ('COK', 'CK'),
  ('COL', 'CO'),
  ('COM', 'KM'),
  ('CPV', 'CV'),
  ('CRI', 'CR'),
  ('CUB', 'CU'),
  ('CUW', 'CW'),
  ('CXR', 'CX'),
  ('CYM', 'KY'),
  ('CYP', 'CY'),
  ('CZE', 'CZ'),
  ('DEU', 'DE'),
  ('DJI', 'DJ'),
  ('DMA', 'DM'),
  ('DNK', 'DK'),
  ('DOM', 'DO'),
  ('DZA', 'DZ'),
  ('ECU', 'EC'),
  ('EGY', 'EG'),
  ('ERI', 'ER'),
  ('ESH', 'EH'),
  ('ESP', 'ES'),
  ('EST', 'EE'),
  ('ETH', 'ET'),
  ('FIN', 'FI'),
  ('FJI', 'FJ'),
  ('FLK', 'FK'),
  ('FRA', 'FR'),
  ('FRO', 'FO'),
  ('FSM', 'FM'),
  ('GAB', 'GA'),
  ('GBR', 'GB'),
  ('GEO', 'GE'),
  ('GGY', 'GG'),
  ('GHA', 'GH'),
  ('GIB', 'GI'),
  ('GIN', 'GN'),
  ('GLP', 'GP'),
  ('GMB', 'GM'),
  ('GNB', 'GW'),
  ('GNQ', 'GQ'),
  ('GRC', 'GR'),
  ('GRD', 'GD'),
  ('GRL', 'GL'),
  ('GTM', 'GT'),
  ('GUF', 'GF'),
  ('GUM', 'GU'),
  ('GUY', 'GY'),
  ('HKG', 'HK'),
  ('HMD', 'HM'),
  ('HND', 'HN'),
  ('HRV', 'HR'),
  ('HTI', 'HT'),
  ('HUN', 'HU'),
  ('IDN', 'ID'),
  ('IMN', 'IM'),
  ('IND', 'IN'),
  ('IOT', 'IO'),
  ('IRL', 'IE'),
  ('IRN', 'IR'),
  ('IRQ', 'IQ'),
  ('ISL', 'IS'),
  ('ISR', 'IL'),
  ('ITA', 'IT'),
  ('JAM', 'JM'),
  ('JEY', 'JE'),
  ('JOR', 'JO'),
  ('JPN', 'JP'),
  ('KAZ', 'KZ'),
  ('KEN', 'KE'),
  ('KGZ', 'KG'),
  ('KHM', 'KH'),
  ('KIR', 'KI'),
  ('KNA', 'KN'),
  ('KOR', 'KR'),
  ('KWT', 'KW'),
  ('LAO', 'LA'),
  ('LBN', 'LB'),
  ('LBR', 'LR'),
  ('LBY', 'LY'),
  ('LCA', 'LC'),
  ('LIE', 'LI'),
  ('LKA', 'LK'),
  ('LSO', 'LS'),
  ('LTU', 'LT'),
  ('LUX', 'LU'),
  ('LVA', 'LV'),
  ('MAC', 'MO'),
  ('MAF', 'MF'),
  ('MAR', 'MA'),
  ('MCO', 'MC'),
  ('MDA', 'MD'),
  ('MDG', 'MG'),
  ('MDV', 'MV'),
  ('MEX', 'MX'),
  ('MHL', 'MH'),
  ('MKD', 'MK'),
  ('MLI', 'ML'),
  ('MLT', 'MT'),
  ('MMR', 'MM'),
  ('MNE', 'ME'),
  ('MNG', 'MN'),
  ('MNP', 'MP'),
  ('MOZ', 'MZ'),
  ('MRT', 'MR'),
  ('MSR', 'MS'),
  ('MTQ', 'MQ'),
  ('MUS', 'MU'),
  ('MWI', 'MW'),
  ('MYS', 'MY'),
  ('MYT', 'YT'),
  ('NAM', 'NA'),
  ('NCL', 'NC'),
  ('NER', 'NE'),
  ('NFK', 'NF'),
  ('NGA', 'NG'),
  ('NIC', 'NI'),
  ('NIU', 'NU'),
  ('NLD', 'NL'),
  ('NOR', 'NO'),
  ('NPL', 'NP'),
  ('NRU', 'NR'),
  ('NZL', 'NZ'),
  ('OMN', 'OM'),
  ('PAK', 'PK'),
  ('PAN', 'PA'),
  ('PCN', 'PN'),
  ('PER', 'PE'),
  ('PHL', 'PH'),
  ('PLW', 'PW'),
  ('PNG', 'PG'),
  ('POL', 'PL'),
  ('PRI', 'PR'),
  ('PRK', 'KP'),
  ('PRT', 'PT'),
  ('PRY', 'PY'),
  ('PSE', 'PS'),
  ('PYF', 'PF'),
  ('QAT', 'QA'),
  ('REU', 'RE'),
  ('ROU', 'RO'),
  ('RUS', 'RU'),
  ('RWA', 'RW'),
  ('SAU', 'SA'),
  ('SDN', 'SD'),
  ('SEN', 'SN'),
  ('SGP', 'SG'),
  ('SGS', 'GS'),
  ('SHN', 'SH'),
  ('SJM', 'SJ'),
  ('SLB', 'SB'),
  ('SLE', 'SL'),
  ('SLV', 'SV'),
  ('SMR', 'SM'),
  ('SOM', 'SO'),
  ('SPM', 'PM'),
  ('SRB', 'RS'),
  ('SSD', 'SS'),
  ('STP', 'ST'),
  ('SUR', 'SR'),
  ('SVK', 'SK'),
  ('SVN', 'SI'),
  ('SWE', 'SE'),
  ('SWZ', 'SZ'),
  ('SXM', 'SX'),
  ('SYC', 'SC'),
  ('SYR', 'SY'),
  ('TCA', 'TC'),
  ('TCD', 'TD'),
  ('TGO', 'TG'),
  ('THA', 'TH'),
  ('TJK', 'TJ'),
  ('TKL', 'TK'),
  ('TKM', 'TM'),
  ('TLS', 'TL'),
  ('TON', 'TO'),
  ('TTO', 'TT'),
  ('TUN', 'TN'),
  ('TUR', 'TR'),
  ('TUV', 'TV'),
  ('TWN', 'TW'),
  ('TZA', 'TZ'),
  ('UGA', 'UG'),
  ('UKR', 'UA'),
  ('UMI', 'UM'),
  ('URY', 'UY'),
  ('USA', 'US'),
  ('UZB', 'UZ'),
  ('VAT', 'VA'),
  ('VCT', 'VC'),
  ('VEN', 'VE'),
  ('VGB', 'VG'),
  ('VIR', 'VI'),
  ('VNM', 'VN'),
  ('VUT', 'VU'),
  ('WLF', 'WF'),
  ('WSM', 'WS'),
  ('YEM', 'YE'),
  ('ZAF', 'ZA'),
  ('ZMB', 'ZM'),
  ('ZWE', 'ZW'),
  ('XKX', 'XK'),
  ('RKS', 'XK'),
  ('D', 'DE'),
  ('GBD', 'GB'),
  ('GBN', 'GB'),
  ('GBO', 'GB'),
  ('GBS', 'GB'),
  ('GBP', 'GB')
on conflict (a3) do update set a2 = excluded.a2;

create or replace function public.pais_iso2(p text)
returns text language sql stable set search_path = '' as $$
  select case
    when p is null then null
    when upper(btrim(p)) ~ '^[A-Z]{2}$' then upper(btrim(p))
    else (select a2 from public.paises_iso where a3 = upper(btrim(p)))
  end
$$;
revoke execute on function public.pais_iso2(text) from public, anon, authenticated;

-- ───────────── 2. Datos extra de identidad ─────────────
alter table public.identity_verifications
  add column if not exists document_last4 text,
  add column if not exists verified_given_names text,
  add column if not exists verified_last_names text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'identity_verifications_last4_chk') then
    alter table public.identity_verifications
      add constraint identity_verifications_last4_chk
      check (document_last4 is null or document_last4 ~ '^[0-9A-Z]{1,4}$');
  end if;
end $$;

-- Los países ya guardados en alfa-3 ("COL") pasan a alfa-2 ("CO")
update public.identity_verifications
   set document_country = public.pais_iso2(document_country)
 where document_country is not null
   and document_country !~ '^[A-Z]{2}$'
   and public.pais_iso2(document_country) is not null;

-- La persona dueña lee su verificación, pero no el hash del documento ni el id de sesión
revoke select on public.identity_verifications from anon, authenticated;
grant select (
  id, user_id, provider, status, level,
  verified_full_name, verified_given_names, verified_last_names,
  document_country, document_last4, decline_reason,
  created_at, verified_at, expires_at, updated_at
) on public.identity_verifications to authenticated;

-- ───────────── 3. Nombre fijo tras verificar ─────────────
create or replace function public.bloquear_nombre_verificado()
returns trigger language plpgsql set search_path = '' as $$
declare
  v_rol text := coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '');
begin
  if new.full_name is distinct from old.full_name
     and old.identity_verified
     and v_rol in ('anon', 'authenticated') then
    raise exception 'NOMBRE_VERIFICADO' using errcode = 'P0001';
  end if;
  return new;
end $$;
revoke execute on function public.bloquear_nombre_verificado() from public, anon, authenticated;

drop trigger if exists profiles_bloquear_nombre_verificado on public.profiles;
create trigger profiles_bloquear_nombre_verificado
  before update of full_name on public.profiles
  for each row execute function public.bloquear_nombre_verificado();

-- ───────────── 4. País de conexión (lo escribe solo el servidor) ─────────────
create table if not exists public.ubicacion_conexion (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  pais text not null check (pais ~ '^[A-Z0-9]{2}$'),
  desde timestamptz not null default now(),
  visto_en timestamptz not null default now()
);
alter table public.ubicacion_conexion enable row level security;
alter table public.ubicacion_conexion force row level security;
revoke all on public.ubicacion_conexion from public, anon, authenticated;
grant select on public.ubicacion_conexion to authenticated;

drop policy if exists "ubicacion_conexion_select_own" on public.ubicacion_conexion;
create policy "ubicacion_conexion_select_own" on public.ubicacion_conexion
  for select to authenticated
  using (user_id = (select auth.uid()));

-- Registra el país desde donde se conecta la persona. Si cambia, el reloj de 6 h vuelve a cero.
create or replace function public.registrar_conexion(p_user_id uuid, p_pais text)
returns table (pais text, desde timestamptz)
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare
  v_pais text := upper(coalesce(nullif(btrim(p_pais), ''), 'XX'));
begin
  if v_pais !~ '^[A-Z0-9]{2}$' then v_pais := 'XX'; end if;

  insert into public.ubicacion_conexion as u (user_id, pais, desde, visto_en)
  values (p_user_id, v_pais, now(), now())
  on conflict (user_id) do update set
    desde = case when u.pais = excluded.pais then u.desde else now() end,
    pais = excluded.pais,
    visto_en = now();

  return query
    select u.pais, u.desde from public.ubicacion_conexion u where u.user_id = p_user_id;
end $$;
revoke execute on function public.registrar_conexion(uuid, text) from public, anon, authenticated;
grant execute on function public.registrar_conexion(uuid, text) to service_role;

-- ───────────── 5. Regla de país al publicar ─────────────
create or replace function public.validar_pais_publicacion()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_rol text := coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '');
  v_doc text;
  v_pais text;
  v_desde timestamptz;
  v_visto timestamptz;
begin
  -- Solo aplica a lo que hace la persona desde la app (no al servidor ni al panel de Supabase)
  if v_rol not in ('anon', 'authenticated') then
    return new;
  end if;

  -- Desde el cliente las causas solo nacen como borrador
  if tg_op = 'INSERT' then
    if new.status <> 'borrador' then
      raise exception 'TRANSICION_INVALIDA' using errcode = 'P0001';
    end if;
    return new;
  end if;

  -- Revisa al publicar, y si alguien intenta mover de país una causa ya publicada
  if not (
    (old.status = 'borrador' and new.status = 'activa')
    or (new.status <> 'borrador' and new.country_code is distinct from old.country_code)
  ) then
    return new;
  end if;

  select public.pais_iso2(v.document_country) into v_doc
  from public.identity_verifications v
  where v.user_id = new.author_id
    and v.status = 'aprobada'
    and (v.expires_at is null or v.expires_at > now())
  order by v.verified_at desc nulls last, v.created_at desc
  limit 1;

  select u.pais, u.desde, u.visto_en into v_pais, v_desde, v_visto
  from public.ubicacion_conexion u
  where u.user_id = new.author_id;

  -- El servidor registra la conexión justo antes de publicar; sin registro reciente no se publica
  if v_pais is null or v_visto < now() - interval '30 minutes' then
    raise exception 'UBICACION_SIN_CONFIRMAR' using errcode = 'P0001';
  end if;

  -- Conectado desde el país del documento: publica ya, pero solo en ese país
  if v_doc is not null and v_pais = v_doc then
    if new.country_code = v_doc then
      return new;
    end if;
    raise exception 'PAIS_NO_PERMITIDO' using errcode = 'P0001';
  end if;

  -- Conectado desde otro país: hay que llevar 6 h seguidas en él
  if v_desde > now() - interval '6 hours' then
    raise exception 'UBICACION_EN_CONFIRMACION' using errcode = 'P0001';
  end if;

  if new.country_code = v_pais or (v_doc is not null and new.country_code = v_doc) then
    return new;
  end if;
  raise exception 'PAIS_NO_PERMITIDO' using errcode = 'P0001';
end $$;
revoke execute on function public.validar_pais_publicacion() from public, anon, authenticated;

drop trigger if exists causes_validar_pais_publicacion on public.causes;
create trigger causes_validar_pais_publicacion
  before insert or update on public.causes
  for each row execute function public.validar_pais_publicacion();
