# Puente · AJUSTES-BUGS-5.md (solo Supabase)

> **Para el agente:** el código ya está arreglado en el pull request #1 de `St4keholders/El-puente` (rama `fix/verificacion-y-movil`). **No toques código de la app.** Este documento es solo para lo que se hace en Supabase con el **MCP de Supabase**: una migración pequeña y unas comprobaciones. Usa `apply_migration` para cambios de esquema y `execute_sql` solo para consultar.

---

## 1. Contexto

La verificación con Didit no llegaba a la base porque la app usaba la clave pública donde necesitaba la clave secreta, y porque la firma del webhook se calculaba mal. Eso ya está corregido en el código. Además, ahora la pantalla `/verificacion/resultado` le pregunta directamente a Didit si la verificación sigue pendiente, y guarda el resultado con la función `procesar_verificacion_didit`.

Falta un caso que **sí se resuelve en la base**.

---

## 2. Migración `017_reverificacion_mismo_documento`

### 2.1 El problema

En la migración 016 existe un índice único sobre `identity_verifications.document_hash` **solo para filas aprobadas**. La función `procesar_verificacion_didit` revisa si el documento ya está aprobado **en otra cuenta**, pero no contempla que **la misma persona** se verifique dos veces con su mismo documento:
- porque su verificación venció a los 24 meses y renueva;
- o porque terminó dos sesiones (por ejemplo, abrió el enlace dos veces).

En ese caso, la segunda aprobación choca con el índice único, la función falla y la persona queda sin verificar.

### 2.2 El arreglo

Dentro de `procesar_verificacion_didit`, **justo antes** del `insert … on conflict (provider_session_id)`, cuando el estado final sea `aprobada`:

```sql
-- La misma persona renueva o repite: sus aprobaciones anteriores pasan a vencida
if v_final_status = 'aprobada' then
  update public.identity_verifications
     set status = 'vencida', updated_at = now()
   where user_id = p_user_id
     and status = 'aprobada'
     and provider_session_id <> p_session_id;
end if;
```

**Reglas:**
- Reemplaza la función con `create or replace`, conservando **exactamente** la misma firma y el resto del cuerpo. Antes de aplicar, lee la versión actual con `pg_get_functiondef` y parte de ella.
- Al terminar, debe existir **una sola versión** de la función.
- Los permisos no cambian: `revoke` a `public`, `anon` y `authenticated`, y `grant execute` solo a `service_role`.

### 2.3 Verificación

Dentro de una transacción que termine en `rollback`, como `service_role`:
1. Llama a la función con un usuario de prueba, una sesión `s1`, estado `Approved` y un hash `h1` → queda `aprobada`.
2. Llámala de nuevo con el **mismo usuario**, sesión `s2`, `Approved` y el mismo `h1` → no falla; `s2` queda `aprobada` y `s1` pasa a `vencida`.
3. Llámala con **otro usuario**, sesión `s3`, `Approved` y el mismo `h1` → `s3` queda `en_revision` con el motivo "Documento ya registrado en otra cuenta".

Pega el resultado de cada paso.

---

## 3. Comprobaciones después del despliegue

Hazlas cuando la persona dueña del proyecto confirme que:
- agregó `SUPABASE_SECRET_KEY` en Vercel;
- fusionó el pull request #1;
- abrió `/verificacion/resultado` con su cuenta.

**3.1 La verificación quedó guardada:**
```sql
select p.id, p.full_name, p.identity_verified, p.identity_verified_at,
       v.status, v.provider_session_id, v.verified_at, v.expires_at,
       (v.verified_full_name is not null) as tiene_nombre,
       (v.document_hash is not null) as tiene_hash
from public.profiles p
left join public.identity_verifications v on v.user_id = p.id
order by v.created_at desc nulls last;
```
Debe aparecer su cuenta con `identity_verified = true`, `status = 'aprobada'`, nombre y hash.

**Nunca** imprimas el valor de `verified_full_name` ni de `document_hash` en el reporte: solo si existen.

**3.2 Los avisos de Didit entran:**
```sql
select event_id, session_id, webhook_type, created_at
from public.didit_webhook_events
order by created_at desc limit 10;
```
- Los que empiezan por `sync_` vienen del plan B.
- Los demás vienen del webhook.

Si solo hay `sync_`, el webhook sigue sin entrar: pídele a la persona que revise en la consola de Didit, **Webhooks → entregas**, qué código responden y repórtalo.

**3.3 Seguridad:** ejecuta `get_advisors` de seguridad y confirma que no hay advertencias nuevas.

---

## 4. Reporte final

- La migración aplicada y el resultado de los tres pasos de 2.3.
- El resultado de 3.1 (sin nombres ni hashes) y de 3.2.
- Las advertencias de `get_advisors`, si hay.
