import { Suspense } from "react";
import { EntrarClient } from "./EntrarClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function EntrarPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[70vh] items-center justify-center text-sm text-[var(--ink-2)]">
          Cargando...
        </div>
      }
    >
      <EntrarClient />
    </Suspense>
  );
}
