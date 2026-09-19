"use client";

import React, { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Glass } from "@/components/ui/Glass";
import { createClient } from "@/lib/supabase/client";
import { IconoAlerta } from "@/components/iconos";

function EntrarContent() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/";
  const errorParam = searchParams.get("error");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(
    errorParam === "google"
      ? "No pudimos entrar con Google. Intenta de nuevo."
      : null
  );

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setErrorMsg(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
        queryParams: { prompt: "select_account" },
      },
    });

    if (error) {
      setErrorMsg("No pudimos entrar con Google. Intenta de nuevo.");
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[85vh] items-center justify-center px-4 py-24">
      <Glass
        variant="panel"
        className="w-full max-w-[420px] shadow-2xl p-7 sm:p-9 border border-[var(--line)] rounded-3xl"
      >
        {/* Marca / Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2.5 mb-5 hover:opacity-85 transition-opacity">
            <svg viewBox="0 0 30 18" className="h-6 w-10 overflow-visible" aria-hidden="true">
              <path
                d="M4 14 C 9 1.5, 21 1.5, 26 14"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                opacity="0.5"
              />
              <circle cx="4" cy="14" r="2.6" fill="currentColor" />
              <circle cx="26" cy="14" r="2.6" fill="var(--accent)" />
            </svg>
            <span className="text-2xl font-bold tracking-tight text-[var(--ink)]">Puente</span>
          </Link>
          <h1 className="text-2xl font-extrabold tracking-tight text-[var(--ink)]">
            Entra a Puente
          </h1>
          <p className="mt-2.5 text-sm text-[var(--ink-2)] leading-relaxed">
            Usa tu cuenta de Google. Si es tu primera vez, tu cuenta se crea en este mismo paso.
          </p>
        </div>

        {/* Mensaje de error si falla */}
        {errorMsg && (
          <div className="mb-6 flex items-start gap-2.5 rounded-2xl bg-red-500/10 p-3.5 text-xs sm:text-sm text-red-500 border border-red-500/20 animate-fade-in">
            <IconoAlerta size={18} className="flex-shrink-0 mt-0.5" />
            <p className="font-medium">{errorMsg}</p>
          </div>
        )}

        {/* Botón oficial de acceso con Google (Pautas oficiales de Google) */}
        <div className="space-y-5">
          <button
            onClick={handleGoogleSignIn}
            disabled={loading}
            type="button"
            className="flex w-full items-center justify-center gap-3.5 rounded-2xl border border-[var(--line)] bg-[var(--surface-solid)] px-5 py-3.5 text-sm font-semibold text-[var(--ink)] shadow-sm transition-all hover:bg-[var(--hover)] hover:border-[var(--glass-edge)] active:scale-[0.98] cursor-pointer disabled:opacity-60"
          >
            {/* Logo oficial multicolor de Google */}
            <svg className="h-5 w-5 flex-shrink-0" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                fill="#EA4335"
              />
            </svg>
            <span>{loading ? "Conectando con Google..." : "Continuar con Google"}</span>
          </button>

          {/* Texto de privacidad y términos */}
          <div className="text-center pt-2">
            <p className="text-xs text-[var(--ink-3)] leading-relaxed">
              Solo recibimos tu nombre, tu correo y tu foto. Nunca publicamos tu correo.
            </p>
            <div className="mt-3 flex items-center justify-center gap-4 text-xs font-medium text-[var(--ink-2)]">
              <Link href="/terminos" className="hover:text-[var(--accent)] transition-colors underline underline-offset-2">
                Términos
              </Link>
              <span>·</span>
              <Link href="/privacidad" className="hover:text-[var(--accent)] transition-colors underline underline-offset-2">
                Privacidad
              </Link>
            </div>
          </div>
        </div>
      </Glass>
    </div>
  );
}

export default function EntrarPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[70vh] items-center justify-center text-sm text-[var(--ink-2)]">
          Cargando...
        </div>
      }
    >
      <EntrarContent />
    </Suspense>
  );
}
