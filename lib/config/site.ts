export const siteConfig = {
  name: "Puente",
  tagline: "Cada luz es una persona que necesita ayuda.",
  description: "Red social de ayuda directa de persona a persona. Sin comisiones, sin intermediarios.",
  url: process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000",
  disclaimer:
    "Puente no procesa donaciones. Verifica los datos antes de enviar dinero y reporta cualquier irregularidad.",
  legalNotice:
    "Puente es un espacio para conectar personas. No procesamos pagos ni verificamos que las donaciones se usen como se describe. Antes de donar, revisa el perfil, los comentarios y los resultados de causas anteriores de quien publica. Si algo no parece correcto, repórtalo.",
};

export type SiteConfig = typeof siteConfig;
