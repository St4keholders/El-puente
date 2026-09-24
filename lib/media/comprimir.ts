/**
 * Utilidades de compresión y procesamiento de medios en el navegador con HTML5 Canvas.
 * Reglas de PLAN.md Sección 7.2:
 * - Redibujar en canvas elimina metadatos EXIF y ubicación GPS (obligatorio).
 * - Foto de causa: Lado mayor 1600px, WebP 0.8 + miniatura 400px.
 * - Foto de perfil: Recorte cuadrado centrado 512x512px, WebP 0.85.
 * - Portada de video: Cuadro del segundo 1, 1280px, WebP.
 * - Validación de video: Max 60 segundos, max 25 MB.
 */

export interface ComprimidoCausa {
  fullBlob: Blob;
  fullFile: File;
  thumbBlob: Blob;
  thumbFile: File;
  width: number;
  height: number;
  bytes: number;
  previewUrl: string;
  thumbPreviewUrl: string;
}

export interface ComprimidoPerfil {
  blob: Blob;
  file: File;
  width: number;
  height: number;
  bytes: number;
  previewUrl: string;
}

export interface PortadaVideo {
  blob: Blob;
  file: File;
  width: number;
  height: number;
  bytes: number;
  previewUrl: string;
}

export interface InfoVideo {
  file: File;
  duration: number;
  width: number;
  height: number;
  bytes: number;
}

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("No se pudo leer el archivo de imagen."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Formato de imagen incompatible o corrupto."));
      img.onload = () => resolve(img);
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type = "image/webp",
  quality = 0.8
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) reject(new Error("No se pudo comprimir la imagen en canvas."));
        else resolve(blob);
      },
      type,
      quality
    );
  });
}

/**
 * Comprime una foto de causa:
 * - Lado mayor 1600 px (calidad 0.8 WebP)
 * - Miniatura de 400 px (calidad 0.8 WebP)
 */
export async function comprimirFotoCausa(
  file: File,
  baseName?: string
): Promise<ComprimidoCausa> {
  const img = await loadImageFromFile(file);
  const origW = img.naturalWidth || img.width;
  const origH = img.naturalHeight || img.height;

  // 1. Imagen completa: max 1600 px
  let targetW = origW;
  let targetH = origH;
  const maxDimFull = 1600;
  if (targetW > maxDimFull || targetH > maxDimFull) {
    if (targetW >= targetH) {
      targetH = Math.round((targetH * maxDimFull) / targetW);
      targetW = maxDimFull;
    } else {
      targetW = Math.round((targetW * maxDimFull) / targetH);
      targetH = maxDimFull;
    }
  }

  const canvasFull = document.createElement("canvas");
  canvasFull.width = targetW;
  canvasFull.height = targetH;
  const ctxFull = canvasFull.getContext("2d");
  if (!ctxFull) throw new Error("No se pudo inicializar contexto 2D de canvas.");
  ctxFull.drawImage(img, 0, 0, targetW, targetH);
  const fullBlob = await canvasToBlob(canvasFull, "image/webp", 0.8);

  // 2. Miniatura: max 400 px
  let thumbW = origW;
  let thumbH = origH;
  const maxDimThumb = 400;
  if (thumbW > maxDimThumb || thumbH > maxDimThumb) {
    if (thumbW >= thumbH) {
      thumbH = Math.round((thumbH * maxDimThumb) / thumbW);
      thumbW = maxDimThumb;
    } else {
      thumbW = Math.round((thumbW * maxDimThumb) / thumbH);
      thumbH = maxDimThumb;
    }
  }

  const canvasThumb = document.createElement("canvas");
  canvasThumb.width = thumbW;
  canvasThumb.height = thumbH;
  const ctxThumb = canvasThumb.getContext("2d");
  if (!ctxThumb) throw new Error("No se pudo inicializar contexto 2D de miniatura.");
  ctxThumb.drawImage(img, 0, 0, thumbW, thumbH);
  const thumbBlob = await canvasToBlob(canvasThumb, "image/webp", 0.8);

  const cleanBase =
    baseName || file.name.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9_-]/g, "_");

  const fullFile = new File([fullBlob], `${cleanBase}.webp`, { type: "image/webp" });
  const thumbFile = new File([thumbBlob], `${cleanBase}_400.webp`, { type: "image/webp" });

  return {
    fullBlob,
    fullFile,
    thumbBlob,
    thumbFile,
    width: targetW,
    height: targetH,
    bytes: fullBlob.size + thumbBlob.size,
    previewUrl: URL.createObjectURL(fullBlob),
    thumbPreviewUrl: URL.createObjectURL(thumbBlob),
  };
}

/**
 * Comprime foto de perfil:
 * - Recorte cuadrado centrado de 512x512 px, WebP calidad 0.85
 */
export async function comprimirFotoPerfil(
  file: File,
  fileName = "avatar.webp"
): Promise<ComprimidoPerfil> {
  const img = await loadImageFromFile(file);
  const origW = img.naturalWidth || img.width;
  const origH = img.naturalHeight || img.height;

  // Encontrar el cuadrado centrado
  const minDim = Math.min(origW, origH);
  const startX = Math.round((origW - minDim) / 2);
  const startY = Math.round((origH - minDim) / 2);

  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No se pudo inicializar contexto 2D.");

  ctx.drawImage(img, startX, startY, minDim, minDim, 0, 0, 512, 512);

  const blob = await canvasToBlob(canvas, "image/webp", 0.85);
  const processedFile = new File([blob], fileName, { type: "image/webp" });

  return {
    blob,
    file: processedFile,
    width: 512,
    height: 512,
    bytes: blob.size,
    previewUrl: URL.createObjectURL(blob),
  };
}

/**
 * Valida duración y peso de un video según PLAN.md 7.3:
 * - Máximo 60 segundos
 * - Máximo 25 MB
 */
export async function validarVideo(file: File): Promise<InfoVideo> {
  const maxBytes = 25 * 1024 * 1024; // 25 MB
  if (file.size > maxBytes) {
    throw new Error(
      `El video pesa ${(file.size / (1024 * 1024)).toFixed(1)} MB. El tamaño máximo permitido es 25 MB.`
    );
  }

  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    const objectUrl = URL.createObjectURL(file);

    video.onloadedmetadata = () => {
      const duration = Math.round(video.duration);
      const width = video.videoWidth || 1280;
      const height = video.videoHeight || 720;
      URL.revokeObjectURL(objectUrl);

      if (duration > 60) {
        return reject(
          new Error(
            `El video dura ${duration} segundos. La duración máxima permitida es 60 segundos.`
          )
        );
      }

      resolve({
        file,
        duration,
        width,
        height,
        bytes: file.size,
      });
    };

    video.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Formato de video incompatible o archivo corrupto."));
    };

    video.src = objectUrl;
  });
}

/**
 * Genera portada de video:
 * - Cuadro del segundo 1 (o duration/2 si dura menos de 1s)
 * - Lado mayor 1280 px, WebP
 */
export async function generarPortadaVideo(
  file: File,
  baseName?: string
): Promise<PortadaVideo> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "auto";
    video.muted = true;
    const objectUrl = URL.createObjectURL(file);

    video.onloadeddata = () => {
      const seekTime = video.duration > 1 ? 1 : video.duration / 2;
      video.currentTime = seekTime;
    };

    video.onseeked = async () => {
      try {
        const origW = video.videoWidth || 1280;
        const origH = video.videoHeight || 720;
        const maxDim = 1280;
        let targetW = origW;
        let targetH = origH;

        if (targetW > maxDim || targetH > maxDim) {
          if (targetW >= targetH) {
            targetH = Math.round((targetH * maxDim) / targetW);
            targetW = maxDim;
          } else {
            targetW = Math.round((targetW * maxDim) / targetH);
            targetH = maxDim;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("No se pudo crear contexto 2D para portada de video.");

        ctx.drawImage(video, 0, 0, targetW, targetH);
        URL.revokeObjectURL(objectUrl);

        const blob = await canvasToBlob(canvas, "image/webp", 0.82);
        const cleanBase =
          baseName || file.name.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9_-]/g, "_");
        const posterFile = new File([blob], `${cleanBase}_poster.webp`, {
          type: "image/webp",
        });

        resolve({
          blob,
          file: posterFile,
          width: targetW,
          height: targetH,
          bytes: blob.size,
          previewUrl: URL.createObjectURL(blob),
        });
      } catch (err) {
        URL.revokeObjectURL(objectUrl);
        reject(err);
      }
    };

    video.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("No se pudo procesar el video para obtener su portada."));
    };

    video.src = objectUrl;
  });
}

export interface ComprimidoComentario {
  file: File;
  width: number;
  height: number;
  bytes: number;
  previewUrl: string;
}

/**
 * Comprime una foto de comentario: lado mayor 1200 px, WebP 0.8.
 * Redibujar en canvas elimina los metadatos EXIF (incluida la ubicación GPS).
 */
export async function comprimirFotoComentario(file: File): Promise<ComprimidoComentario> {
  const img = await loadImageFromFile(file);
  let w = img.naturalWidth || img.width;
  let h = img.naturalHeight || img.height;
  const max = 1200;
  if (w > max || h > max) {
    if (w >= h) {
      h = Math.round((h * max) / w);
      w = max;
    } else {
      w = Math.round((w * max) / h);
      h = max;
    }
  }

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No se pudo inicializar contexto 2D de canvas.");
  ctx.drawImage(img, 0, 0, w, h);
  const blob = await canvasToBlob(canvas, "image/webp", 0.8);

  return {
    file: new File([blob], "comentario.webp", { type: "image/webp" }),
    width: w,
    height: h,
    bytes: blob.size,
    previewUrl: URL.createObjectURL(blob),
  };
}
