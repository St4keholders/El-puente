/**
 * Client-side media processing and validation
 * Strictly implements PLAN.md sections 7.2 and 7.3
 */

export * from "@/lib/media/comprimir";

export interface ProcessedImage {
  file: File;
  blob: Blob;
  width: number;
  height: number;
  previewUrl: string;
}

export interface ValidatedVideo {
  file: File;
  duration: number;
  width: number;
  height: number;
  previewUrl: string;
}

export async function compressImageToWebP(
  file: File,
  maxDimension = 1600,
  quality = 0.8
): Promise<ProcessedImage> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("No se pudo leer la imagen"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Formato de imagen incompatible"));
      img.onload = () => {
        let { width, height } = img;

        // Maintain aspect ratio, max dimension 1600px
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          return reject(new Error("No se pudo inicializar canvas 2D"));
        }

        // Draw image onto canvas - this completely strips EXIF and GPS tags
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              return reject(new Error("Error al convertir imagen a WebP"));
            }

            const cleanName = file.name.replace(/\.[^/.]+$/, "") + ".webp";
            const processedFile = new File([blob], cleanName, { type: "image/webp" });
            const previewUrl = URL.createObjectURL(blob);

            resolve({
              file: processedFile,
              blob,
              width,
              height,
              previewUrl,
            });
          },
          "image/webp",
          quality
        );
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export async function validateVideo(
  file: File,
  maxSizeBytes = 25 * 1024 * 1024,
  maxDurationSeconds = 60
): Promise<ValidatedVideo> {
  if (file.size > maxSizeBytes) {
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

      if (duration > maxDurationSeconds) {
        URL.revokeObjectURL(objectUrl);
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
        previewUrl: objectUrl,
      });
    };

    video.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Formato de video incompatible o archivo corrupto."));
    };

    video.src = objectUrl;
  });
}
