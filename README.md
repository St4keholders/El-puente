# Puente

Red comunitaria de ayuda directa: cada persona publica su causa y recibe el apoyo en sus propios medios. Puente no procesa pagos, no retiene fondos y no cobra comisiones.

Sitio: https://www.elpuentesh.org

## Tecnología

- Next.js 16 (App Router), desplegado en Vercel desde la rama `main`.
- Supabase: base de datos, autenticación con Google y almacenamiento de archivos. Las migraciones están en `supabase/migrations/`.
- Didit: verificación de identidad (documento, prueba de vida y coincidencia facial).

## Variables de entorno

Van en `.env.local` para trabajar en local y en Vercel (Production y Preview). Nunca se suben al repositorio.

| Variable | Tipo | Para qué |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Pública | URL del proyecto de Supabase |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Pública | Clave pública de Supabase |
| `NEXT_PUBLIC_SITE_URL` | Pública | Dominio del sitio |
| `SUPABASE_SECRET_KEY` | **Secreta** | Escrituras del servidor que saltan RLS (webhook de Didit, eliminar cuenta) |
| `DIDIT_API_KEY` | **Secreta** | Crear y consultar sesiones de verificación |
| `DIDIT_WEBHOOK_SECRET` | **Secreta** | Verificar la firma de los avisos de Didit |
| `VERIFICATION_PEPPER` | **Secreta** | Convertir el número de documento en una huella irreversible. No se cambia nunca |

## Desarrollo

```bash
npm install
npm run dev
```
