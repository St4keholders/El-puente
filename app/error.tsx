"use client";

import { useEffect } from "react";
import { IconoAlerta } from "@/components/iconos";

export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error("Error de página:", error.digest, error.message);
  }, [error]);

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center gap-4 px-4 pt-28">
      <IconoAlerta size={32} className="text-red-500" />
      <p className="text-text-secondary text-sm text-center max-w-sm">
        No pudimos cargar esta página. {error.digest ? `(Código ${error.digest})` : ""}
      </p>
      <button
        type="button"
        onClick={() => retry()}
        className="px-5 py-2.5 rounded-xl bg-accent text-white text-sm font-semibold hover:bg-accent/90 cursor-pointer"
      >
        Reintentar
      </button>
    </div>
  );
}
