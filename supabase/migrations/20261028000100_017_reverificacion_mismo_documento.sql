-- Migración 017: Reverificación con el mismo documento
-- Permite que la misma persona renueve o repita su verificación sin violar
-- el índice único de document_hash para verificaciones aprobadas.
-- Sus verificaciones aprobadas anteriores pasan a estado 'vencida'.

create or replace function public.procesar_verificacion_didit(
  p_event_id text,
  p_session_id text,
  p_user_id uuid,
  p_status text,
  p_full_name text default null::text,
  p_country text default null::text,
  p_document_hash text default null::text,
  p_decline_reason text default null::text
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_status public.verification_status;
  v_dup_user uuid;
  v_final_status public.verification_status;
  v_final_reason text := p_decline_reason;
  v_c record;
begin
  if p_event_id is not null then
    insert into public.didit_webhook_events (event_id, session_id, webhook_type)
    values (p_event_id, p_session_id, p_status)
    on conflict (event_id) do nothing;

    if not found then
      return jsonb_build_object('ok', true, 'duplicate', true);
    end if;
  end if;

  case lower(p_status)
    when 'approved' then v_status := 'aprobada';
    when 'declined' then v_status := 'rechazada';
    when 'in review', 'in_review' then v_status := 'en_revision';
    when 'expired', 'kyc expired' then v_status := 'vencida';
    when 'not started', 'in progress' then v_status := 'pendiente';
    else
      if p_status in ('pendiente', 'aprobada', 'rechazada', 'en_revision', 'vencida') then
        v_status := p_status::public.verification_status;
      else
        v_status := 'pendiente';
      end if;
  end case;

  v_final_status := v_status;

  if v_status = 'aprobada' and p_document_hash is not null then
    select user_id into v_dup_user
    from public.identity_verifications
    where document_hash = p_document_hash
      and status = 'aprobada'
      and user_id <> p_user_id
    limit 1;

    if v_dup_user is not null then
      v_final_status := 'en_revision';
      v_final_reason := 'Documento ya registrado en otra cuenta';
    end if;
  end if;

  -- La misma persona renueva o repite: sus aprobaciones anteriores pasan a vencida
  if v_final_status = 'aprobada' then
    update public.identity_verifications
       set status = 'vencida', updated_at = now()
     where user_id = p_user_id
       and status = 'aprobada'
       and provider_session_id <> p_session_id;
  end if;

  insert into public.identity_verifications (
    user_id,
    provider,
    provider_session_id,
    status,
    level,
    verified_full_name,
    document_country,
    document_hash,
    decline_reason,
    verified_at,
    expires_at,
    updated_at
  )
  values (
    p_user_id,
    'didit',
    p_session_id,
    v_final_status,
    1,
    p_full_name,
    p_country,
    p_document_hash,
    v_final_reason,
    case when v_final_status = 'aprobada' then now() else null end,
    case when v_final_status = 'aprobada' then now() + interval '24 months' else null end,
    now()
  )
  on conflict (provider_session_id) do update set
    status = excluded.status,
    verified_full_name = coalesce(excluded.verified_full_name, public.identity_verifications.verified_full_name),
    document_country = coalesce(excluded.document_country, public.identity_verifications.document_country),
    document_hash = coalesce(excluded.document_hash, public.identity_verifications.document_hash),
    decline_reason = excluded.decline_reason,
    verified_at = coalesce(excluded.verified_at, public.identity_verifications.verified_at),
    expires_at = coalesce(excluded.expires_at, public.identity_verifications.expires_at),
    updated_at = now();

  if v_final_status = 'aprobada' then
    update public.profiles
    set identity_verified = true,
        identity_verified_at = now()
    where id = p_user_id;

    for v_c in select id from public.causes where author_id = p_user_id loop
      perform public.revisar_titularidad(v_c.id);
    end loop;
  end if;

  return jsonb_build_object(
    'ok', true,
    'status', v_final_status,
    'session_id', p_session_id
  );
end $function$;

revoke all on function public.procesar_verificacion_didit(text, text, uuid, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.procesar_verificacion_didit(text, text, uuid, text, text, text, text, text) to service_role;
