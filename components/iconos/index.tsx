import React from "react";

/* ────────────────────────────────────────────────────────
   IconoBase – estilo idéntico a .illustration svg de Stakeholders:
   trazo sin relleno, puntas y uniones redondeadas, grosor fino
   ──────────────────────────────────────────────────────── */
interface IconoBaseProps {
  size?: number;
  children: React.ReactNode;
  className?: string;
  /** Override stroke-width (default 1.4) */
  strokeWidth?: number;
}

export function IconoBase({
  size = 20,
  children,
  className,
  strokeWidth = 1.4,
}: IconoBaseProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      {children}
    </svg>
  );
}

/* ─── Iconos funcionales ─────────────────────────────── */

interface IconoProps {
  size?: number;
  className?: string;
}

export const IconoBuscar = (p: IconoProps) => (
  <IconoBase {...p}>
    <circle cx="11" cy="11" r="6.5" />
    <line x1="16" y1="16" x2="20.5" y2="20.5" />
  </IconoBase>
);

export const IconoCerrar = (p: IconoProps) => (
  <IconoBase {...p}>
    <line x1="6" y1="6" x2="18" y2="18" />
    <line x1="18" y1="6" x2="6" y2="18" />
  </IconoBase>
);

export const IconoX = IconoCerrar;
export const IconoBuscador = IconoBuscar;



export const IconoSol = (p: IconoProps) => (
  <IconoBase {...p}>
    <circle cx="12" cy="12" r="4" />
    <line x1="12" y1="2" x2="12" y2="4.5" />
    <line x1="12" y1="19.5" x2="12" y2="22" />
    <line x1="4.22" y1="4.22" x2="5.99" y2="5.99" />
    <line x1="18.01" y1="18.01" x2="19.78" y2="19.78" />
    <line x1="2" y1="12" x2="4.5" y2="12" />
    <line x1="19.5" y1="12" x2="22" y2="12" />
    <line x1="4.22" y1="19.78" x2="5.99" y2="18.01" />
    <line x1="18.01" y1="5.99" x2="19.78" y2="4.22" />
  </IconoBase>
);

export const IconoLuna = (p: IconoProps) => (
  <IconoBase {...p}>
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </IconoBase>
);

export const IconoMenu = (p: IconoProps) => (
  <IconoBase {...p}>
    <circle cx="12" cy="5" r="1" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
    <circle cx="12" cy="19" r="1" fill="currentColor" stroke="none" />
  </IconoBase>
);

export const IconoMenuHorizontal = (p: IconoProps) => (
  <IconoBase {...p}>
    <circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
    <circle cx="19" cy="12" r="1" fill="currentColor" stroke="none" />
  </IconoBase>
);

export const IconoFlechaIzquierda = (p: IconoProps) => (
  <IconoBase {...p}>
    <polyline points="15 18 9 12 15 6" />
  </IconoBase>
);

export const IconoFlechaDerecha = (p: IconoProps) => (
  <IconoBase {...p}>
    <polyline points="9 6 15 12 9 18" />
  </IconoBase>
);

export const IconoFlechaAbajo = (p: IconoProps) => (
  <IconoBase {...p}>
    <polyline points="6 9 12 15 18 9" />
  </IconoBase>
);

export const IconoComentar = (p: IconoProps) => (
  <IconoBase {...p}>
    <path d="M5 6h14v9.5H10.5L6.5 19v-3.5H5z" />
  </IconoBase>
);

export const IconoGuardar = ({ className, ...p }: IconoProps & { className?: string }) => (
  <IconoBase className={className} {...p}>
    <path d="M7 4.5h10v15l-5-3.6-5 3.6z" />
  </IconoBase>
);

export const IconoCompartir = (p: IconoProps) => (
  <IconoBase {...p}>
    <path d="M12 14.5V4.5" />
    <path d="M8 8.5l4-4 4 4" />
    <path d="M6 12.5v6.5h12v-6.5" />
  </IconoBase>
);

export const IconoCopiar = (p: IconoProps) => (
  <IconoBase {...p}>
    <rect x="9" y="9" width="11" height="11" rx="2" />
    <path d="M5 15V5a2 2 0 0 1 2-2h10" />
  </IconoBase>
);

export const IconoCheck = (p: IconoProps) => (
  <IconoBase {...p}>
    <polyline points="4 12.5 9.5 18 20 6" />
  </IconoBase>
);

export const IconoVerificado = (p: IconoProps) => (
  <IconoBase {...p}>
    <path d="M12 2l2.4 3.6L18 4.5l-.6 3.9 3.6 1.6-2.8 2.8 1.3 3.8-3.8-.2L14 19.6 12 17l-2 2.6-1.7-3.2-3.8.2 1.3-3.8L3 9.9l3.6-1.5L6 4.5l3.6 1.1z" />
    <polyline points="9 12.5 11 14.5 15 10" />
  </IconoBase>
);

export const IconoFoto = (p: IconoProps) => (
  <IconoBase {...p}>
    <rect x="3.5" y="5" width="17" height="14" rx="2" />
    <circle cx="9" cy="10" r="1.6" />
    <path d="M4 17.5l5-4.5 4 3.5 3-2.5 4 3.5" />
  </IconoBase>
);

/* ─── Iconos adicionales para el proyecto ────────────── */

export const IconoUsuario = (p: IconoProps) => (
  <IconoBase {...p}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 20c0-3.3 3.6-6 8-6s8 2.7 8 6" />
  </IconoBase>
);

export const IconoUsuarios = (p: IconoProps) => (
  <IconoBase {...p}>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M2 20c0-3 3-5.5 7-5.5s7 2.5 7 5.5" />
    <circle cx="17.5" cy="8.5" r="2.5" />
    <path d="M18 14.5c2.5.5 4 2 4 4" />
  </IconoBase>
);

export const IconoGlobo = (p: IconoProps) => (
  <IconoBase {...p}>
    <circle cx="12" cy="12" r="9" />
    <ellipse cx="12" cy="12" rx="3.5" ry="9" />
    <line x1="3" y1="12" x2="21" y2="12" />
  </IconoBase>
);

export const IconoFiltro = (p: IconoProps) => (
  <IconoBase {...p}>
    <line x1="4" y1="6" x2="20" y2="6" />
    <line x1="7" y1="12" x2="17" y2="12" />
    <line x1="10" y1="18" x2="14" y2="18" />
  </IconoBase>
);
export const IconoFiltros = IconoFiltro;


export const IconoCargando = ({ className, ...p }: IconoProps & { className?: string }) => (
  <IconoBase className={className} {...p}>
    <path d="M12 2v4" />
    <path d="M12 18v4" />
    <path d="M4.93 4.93l2.83 2.83" />
    <path d="M16.24 16.24l2.83 2.83" />
    <path d="M2 12h4" />
    <path d="M18 12h4" />
    <path d="M4.93 19.07l2.83-2.83" />
    <path d="M16.24 7.76l2.83-2.83" />
  </IconoBase>
);

export const IconoRefrescar = (p: IconoProps) => (
  <IconoBase {...p}>
    <path d="M1 4v6h6" />
    <path d="M23 20v-6h-6" />
    <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10" />
    <path d="M3.51 15A9 9 0 0 0 18.36 18.36L23 14" />
  </IconoBase>
);

export const IconoAlerta = (p: IconoProps) => (
  <IconoBase {...p}>
    <circle cx="12" cy="12" r="9" />
    <line x1="12" y1="8" x2="12" y2="12.5" />
    <circle cx="12" cy="16" r="0.5" fill="currentColor" stroke="none" />
  </IconoBase>
);

export const IconoBrujula = (p: IconoProps) => (
  <IconoBase {...p}>
    <circle cx="12" cy="12" r="9" />
    <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88" fill="none" />
  </IconoBase>
);

export const IconoMas = (p: IconoProps) => (
  <IconoBase {...p}>
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </IconoBase>
);

export const IconoCandado = (p: IconoProps) => (
  <IconoBase {...p}>
    <rect x="5" y="11" width="14" height="9" rx="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </IconoBase>
);

export const IconoEstrellas = (p: IconoProps) => (
  <IconoBase {...p}>
    <path d="M12 3l1.5 3.5 3.5.5-2.5 2.5.5 3.5L12 11.5 8.5 13l.5-3.5L6.5 7l3.5-.5z" />
    <path d="M5 18l.8 1.7 1.7.3-1.2 1.2.2 1.8L5 22l-1.5 1 .2-1.8L2.5 20l1.7-.3z" />
    <path d="M19 16l.6 1.3 1.4.2-1 1 .2 1.5-1.2-.7-1.2.7.2-1.5-1-1 1.4-.2z" />
  </IconoBase>
);

export const IconoArchivo = (p: IconoProps) => (
  <IconoBase {...p}>
    <rect x="3" y="3" width="18" height="6" rx="1.5" />
    <path d="M3 9v9a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9" />
    <line x1="10" y1="14" x2="14" y2="14" />
  </IconoBase>
);

export const IconoCheckCirculo = (p: IconoProps) => (
  <IconoBase {...p}>
    <circle cx="12" cy="12" r="9" />
    <polyline points="9 12 11.5 14.5 16 9.5" />
  </IconoBase>
);

export const IconoAyuda = (p: IconoProps) => (
  <IconoBase {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 1.5-2.5 2-2.5 4" />
    <circle cx="12" cy="17" r="0.5" fill="currentColor" stroke="none" />
  </IconoBase>
);

export const IconoSalir = (p: IconoProps) => (
  <IconoBase {...p}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </IconoBase>
);

export const IconoAjustes = (p: IconoProps) => (
  <IconoBase {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </IconoBase>
);

export const IconoVolumen = (p: IconoProps) => (
  <IconoBase {...p}>
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19" fill="none" />
    <path d="M15.5 8.5a5 5 0 0 1 0 7" />
    <path d="M18.5 5.5a9 9 0 0 1 0 13" />
  </IconoBase>
);

export const IconoVolumenMudo = (p: IconoProps) => (
  <IconoBase {...p}>
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19" fill="none" />
    <line x1="23" y1="9" x2="17" y2="15" />
    <line x1="17" y1="9" x2="23" y2="15" />
  </IconoBase>
);

export const IconoCorazon = (p: IconoProps) => (
  <IconoBase {...p}>
    <path d="M12 21C12 21 4 15 4 9.5A4.5 4.5 0 0 1 12 6a4.5 4.5 0 0 1 8 3.5C20 15 12 21 12 21z" />
  </IconoBase>
);

export const IconoInicio = (p: IconoProps) => (
  <IconoBase {...p}>
    <path d="M3 12l9-8 9 8" />
    <path d="M5 10v9a1 1 0 0 0 1 1h4v-5h4v5h4a1 1 0 0 0 1-1v-9" />
  </IconoBase>
);

export const IconoMapa = (p: IconoProps) => (
  <IconoBase {...p}>
    <path d="M1 6v16l7-4 8 4 7-4V2l-7 4-8-4z" />
    <line x1="8" y1="2" x2="8" y2="18" />
    <line x1="16" y1="6" x2="16" y2="22" />
  </IconoBase>
);

export const IconoEnviar = (p: IconoProps) => (
  <IconoBase {...p}>
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9" fill="none" />
  </IconoBase>
);

export const IconoBasura = (p: IconoProps) => (
  <IconoBase {...p}>
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <line x1="10" y1="11" x2="10" y2="17" />
    <line x1="14" y1="11" x2="14" y2="17" />
  </IconoBase>
);

export const IconoEditar = (p: IconoProps) => (
  <IconoBase {...p}>
    <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z" />
  </IconoBase>
);

export const IconoRespuesta = (p: IconoProps) => (
  <IconoBase {...p}>
    <polyline points="9 10 4 15 9 20" />
    <path d="M20 4v7a4 4 0 0 1-4 4H4" />
  </IconoBase>
);

export const IconoCorreo = (p: IconoProps) => (
  <IconoBase {...p}>
    <rect x="2" y="4" width="20" height="16" rx="2" />
    <polyline points="22 6 12 13 2 6" />
  </IconoBase>
);

export const IconoEscudo = (p: IconoProps) => (
  <IconoBase {...p}>
    <path d="M12 2l8 4v5c0 5.25-3.5 10-8 12-4.5-2-8-6.75-8-12V6z" />
    <polyline points="9 12 11.5 14.5 16 9.5" />
  </IconoBase>
);

export const IconoTriangulo = (p: IconoProps) => (
  <IconoBase {...p}>
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <circle cx="12" cy="17" r="0.5" fill="currentColor" stroke="none" />
  </IconoBase>
);

export const IconoMarcador = (p: IconoProps) => (
  <IconoBase {...p}>
    <path d="M12 21c-4-4-8-7.5-8-11a8 8 0 1 1 16 0c0 3.5-4 7-8 11z" />
    <circle cx="12" cy="10" r="2.5" />
  </IconoBase>
);

export const IconoCalendario = (p: IconoProps) => (
  <IconoBase {...p}>
    <rect x="3" y="4" width="18" height="17" rx="2" />
    <line x1="3" y1="10" x2="21" y2="10" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="16" y1="2" x2="16" y2="6" />
  </IconoBase>
);

export const IconoDocumento = (p: IconoProps) => (
  <IconoBase {...p}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="8" y1="13" x2="16" y2="13" />
    <line x1="8" y1="17" x2="13" y2="17" />
  </IconoBase>
);

export const IconoEnlace = (p: IconoProps) => (
  <IconoBase {...p}>
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <polyline points="15 3 21 3 21 9" />
    <line x1="10" y1="14" x2="21" y2="3" />
  </IconoBase>
);

export const IconoMaximizar = (p: IconoProps) => (
  <IconoBase {...p}>
    <polyline points="15 3 21 3 21 9" />
    <polyline points="9 21 3 21 3 15" />
    <line x1="21" y1="3" x2="14" y2="10" />
    <line x1="3" y1="21" x2="10" y2="14" />
  </IconoBase>
);

export const IconoTarjeta = (p: IconoProps) => (
  <IconoBase {...p}>
    <rect x="1" y="4" width="22" height="16" rx="2" />
    <line x1="1" y1="10" x2="23" y2="10" />
  </IconoBase>
);

export const IconoBilletera = IconoTarjeta;

export const IconoCamara = (p: IconoProps) => (
  <IconoBase {...p}>
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
    <circle cx="12" cy="13" r="4" />
  </IconoBase>
);

export const IconoGuardarDisco = (p: IconoProps) => (
  <IconoBase {...p}>
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
    <polyline points="17 21 17 13 7 13 7 21" />
    <polyline points="7 3 7 8 15 8" />
  </IconoBase>
);

export const IconoSubir = (p: IconoProps) => (
  <IconoBase {...p}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </IconoBase>
);

export const IconoVideo = (p: IconoProps) => (
  <IconoBase {...p}>
    <polygon points="23 7 16 12 23 17 23 7" />
    <rect x="1" y="5" width="15" height="14" rx="2" />
  </IconoBase>
);

export const IconoFlechaArriba = (p: IconoProps) => (
  <IconoBase {...p}>
    <polyline points="18 15 12 9 6 15" />
  </IconoBase>
);

export const IconoInfo = (p: IconoProps) => (
  <IconoBase {...p}>
    <circle cx="12" cy="12" r="9" />
    <line x1="12" y1="16" x2="12" y2="12" />
    <circle cx="12" cy="8" r="0.5" fill="currentColor" stroke="none" />
  </IconoBase>
);

export const IconoOjo = (p: IconoProps) => (
  <IconoBase {...p}>
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </IconoBase>
);

export const IconoOjoTachado = (p: IconoProps) => (
  <IconoBase {...p}>
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </IconoBase>
);

export const IconoBorrar = IconoBasura;

export * from "./Ilustraciones";




