"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/lib/hooks/useUser";
import { signOutAction, deleteUserAccount } from "@/lib/actions/auth";
import {
  IconoAlerta,
  IconoBasura,
  IconoCargando,
  IconoCheck,
  IconoFlechaDerecha,
} from "@/components/iconos";

export default function CuentaYPrivacidadPage() {
  const router = useRouter();
  const { user, profile, loading: userLoading } = useUser();
  const supabase = createClient();

  // Sign out states
  const [signingOut, setSigningOut] = useState(false);
  const [signingOutGlobal, setSigningOutGlobal] = useState(false);
  const [showGlobalConfirm, setShowGlobalConfirm] = useState(false);

  // Delete account modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [confirmInput, setConfirmInput] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Standard sign out
  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn("Client signOut error:", err);
    }
    try {
      await signOutAction();
    } catch (err) {
      console.warn("Server signOutAction error:", err);
    }
    window.location.href = "/";
  };

  // Global sign out
  const handleSignOutGlobal = async () => {
    setSigningOutGlobal(true);
    try {
      await supabase.auth.signOut({ scope: "global" });
    } catch (err) {
      console.warn("Client global signOut error:", err);
    }
    try {
      await signOutAction();
    } catch (err) {
      console.warn("Server signOutAction error:", err);
    }
    window.location.href = "/";
  };

  // Delete account
  const handleDeleteAccount = async () => {
    if (!profile) return;
    if (confirmInput.trim().toLowerCase() !== profile.username.toLowerCase()) {
      setDeleteError("El nombre de usuario escrito no coincide.");
      return;
    }

    setDeleting(true);
    setDeleteError(null);

    try {
      const res = await deleteUserAccount(confirmInput);
      if (!res.success) {
        throw new Error(res.error || "No se pudo eliminar la cuenta.");
      }
      window.location.href = "/?cuenta_eliminada=1";
    } catch (err: any) {
      console.error("Error deleting account:", err);
      setDeleteError(err?.message || "Ocurrió un error al eliminar tu cuenta.");
      setDeleting(false);
    }
  };

  const email = user?.email || "Cargando...";
  const username = profile?.username || "";

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[var(--ink)]">Cuenta y privacidad</h1>
        <p className="text-sm text-[var(--ink-2)] mt-1">
          Transparencia absoluta sobre tus datos, control de sesiones y eliminación de cuenta.
        </p>
      </div>

      {/* 1. Cuenta vinculada */}
      <div className="p-6 rounded-2xl border border-[var(--line)] bg-[var(--surface-solid)]/70 backdrop-blur-md space-y-4">
        <h2 className="text-base font-semibold text-[var(--ink)]">Cuenta vinculada</h2>

        <div className="flex items-center gap-3 p-3.5 rounded-xl bg-[var(--field)] border border-[var(--line)]">
          <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center shadow-sm flex-shrink-0">
            {/* Google G Logo */}
            <svg width="20" height="20" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs text-[var(--ink-3)] font-medium">Entras con Google</div>
            <div className="text-sm font-semibold text-[var(--ink)] truncate">{email}</div>
          </div>
          <span className="text-[0.7rem] font-medium px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 whitespace-nowrap">
            Conectada
          </span>
        </div>

        <p className="text-xs text-[var(--ink-3)] leading-relaxed">
          Tu acceso a Puente se valida directamente con Google mediante autenticación segura sin contraseña. Nunca almacenamos contraseñas ni tokens de terceros.
        </p>
      </div>

      {/* 2. Qué datos guardamos */}
      <div className="p-6 rounded-2xl border border-[var(--line)] bg-[var(--surface-solid)]/70 backdrop-blur-md space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-[var(--ink)]">Qué datos guardamos</h2>
          <Link
            href="/privacidad"
            className="text-xs font-semibold text-[var(--accent)] hover:underline flex items-center gap-1"
          >
            <span>Política de privacidad</span>
            <IconoFlechaDerecha size={12} />
          </Link>
        </div>

        <div className="space-y-3">
          <div className="p-3.5 rounded-xl bg-[var(--field)] border border-[var(--line)] flex items-start gap-3">
            <span className="text-[0.7rem] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 mt-0.5 flex-shrink-0">
              Públicos
            </span>
            <div className="text-xs text-[var(--ink-2)] leading-relaxed">
              <strong className="text-[var(--ink)] font-semibold">
                Nombre completo, nombre de usuario (@{username || "usuario"}), foto, biografía, país y ciudad:
              </strong>{" "}
              visibles en tu perfil comunitario y al crear causas.
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-[var(--field)] border border-[var(--line)] flex items-start gap-3">
            <span className="text-[0.7rem] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/25 mt-0.5 flex-shrink-0">
              Privados
            </span>
            <div className="text-xs text-[var(--ink-2)] leading-relaxed">
              <strong className="text-[var(--ink)] font-semibold">Correo electrónico y teléfono de contacto:</strong>{" "}
              protegidos con seguridad por fila (RLS). Nadie más puede verlos. El teléfono solo se verifica para permitirte publicar causas y prevenir fraudes.
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-[var(--field)] border border-[var(--line)] flex items-start gap-3">
            <span className="text-[0.7rem] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[var(--accent)]/15 text-[var(--accent-ink)] border border-[var(--accent)]/25 mt-0.5 flex-shrink-0">
              Protegidos
            </span>
            <div className="text-xs text-[var(--ink-2)] leading-relaxed">
              <strong className="text-[var(--ink)] font-semibold">Métodos de pago guardados:</strong>{" "}
              se mantienen privados en tu área de perfil hasta el momento en que decides vincularlos a una causa activa o borrador.
            </div>
          </div>
        </div>
      </div>

      {/* 3. Sesión activa */}
      <div className="p-6 rounded-2xl border border-[var(--line)] bg-[var(--surface-solid)]/70 backdrop-blur-md space-y-4">
        <h2 className="text-base font-semibold text-[var(--ink)]">Control de sesión</h2>
        <p className="text-xs text-[var(--ink-3)] leading-relaxed">
          Puedes cerrar tu sesión en este navegador o invalidar el acceso en todos los dispositivos donde hayas iniciado sesión.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <button
            type="button"
            disabled={signingOut || signingOutGlobal}
            onClick={handleSignOut}
            className="flex-1 px-4 py-2.5 rounded-xl bg-[var(--field)] hover:bg-[var(--hover)] text-[var(--ink)] border border-[var(--line)] text-xs font-semibold transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {signingOut ? (
              <IconoCargando className="animate-spin text-[var(--accent)]" size={14} />
            ) : null}
            <span>Cerrar sesión en este equipo</span>
          </button>

          <button
            type="button"
            disabled={signingOut || signingOutGlobal}
            onClick={() => setShowGlobalConfirm(true)}
            className="flex-1 px-4 py-2.5 rounded-xl bg-[var(--field)] hover:bg-[var(--hover)] text-amber-400 border border-amber-500/20 text-xs font-semibold transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <span>Cerrar sesión en todos los dispositivos</span>
          </button>
        </div>
      </div>

      {/* 4. Zona de peligro: Eliminar cuenta */}
      <div className="p-6 rounded-2xl border border-rose-500/20 bg-rose-500/[0.03] backdrop-blur-md space-y-4">
        <div className="flex items-center gap-3 text-rose-400">
          <IconoBasura size={20} />
          <h2 className="text-base font-semibold text-[var(--ink)]">Zona de peligro</h2>
        </div>
        <p className="text-xs text-[var(--ink-3)] leading-relaxed">
          Eliminar tu cuenta es un proceso permanente y definitivo. Se borrarán de inmediato tu perfil, tus métodos de pago, tus comentarios, los archivos multimedia subidos y tus causas publicadas.
        </p>

        <div className="pt-2">
          <button
            type="button"
            onClick={() => {
              setConfirmInput("");
              setDeleteError(null);
              setShowDeleteModal(true);
            }}
            className="px-4 py-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/25 text-xs font-semibold transition-all flex items-center gap-2"
          >
            <IconoBasura size={14} />
            <span>Eliminar mi cuenta definitivamente</span>
          </button>
        </div>
      </div>

      {/* Modal confirmación cerrar sesión global */}
      {showGlobalConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-global-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
        >
          <div className="w-full max-w-md rounded-2xl border border-[var(--line)] bg-[var(--surface-solid)] p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-amber-400">
              <IconoAlerta size={22} />
              <h3 id="modal-global-title" className="text-base font-semibold text-[var(--ink)]">
                ¿Cerrar sesión en todos los dispositivos?
              </h3>
            </div>
            <p className="text-xs text-[var(--ink-2)] leading-relaxed">
              Esta acción invalidará tus sesiones activas en teléfonos, computadores y cualquier otro navegador. Tendrás que volver a entrar con Google.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={signingOutGlobal}
                onClick={() => setShowGlobalConfirm(false)}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-[var(--field)] text-[var(--ink-2)] hover:text-[var(--ink)] hover:bg-[var(--hover)] transition-all"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={signingOutGlobal}
                onClick={handleSignOutGlobal}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl bg-amber-500 hover:bg-amber-600 text-black shadow transition-all disabled:opacity-50"
              >
                {signingOutGlobal ? (
                  <>
                    <IconoCargando className="animate-spin" size={14} />
                    <span>Cerrando sesiones...</span>
                  </>
                ) : (
                  <span>Sí, cerrar en todos</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal confirmación eliminar cuenta */}
      {showDeleteModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-delete-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200"
        >
          <div className="w-full max-w-lg rounded-2xl border border-rose-500/30 bg-[var(--surface-solid)] p-6 shadow-2xl space-y-5">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="w-10 h-10 rounded-full bg-rose-500/15 flex items-center justify-center">
                <IconoBasura size={20} />
              </div>
              <div>
                <h3 id="modal-delete-title" className="text-base font-semibold text-[var(--ink)]">
                  ¿Estás completamente seguro?
                </h3>
                <div className="text-xs text-rose-400 font-medium">Esta acción no se puede deshacer</div>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-[var(--ink-2)] space-y-2">
              <p className="font-semibold text-rose-300">Se eliminará permanentemente:</p>
              <ul className="list-disc list-inside space-y-1 text-[var(--ink-2)]">
                <li>Tu perfil (@{username}) y biografía</li>
                <li>Tus causas creadas y borradores</li>
                <li>Tus métodos de donación guardados</li>
                <li>Tus comentarios, fotos y videos subidos</li>
                <li>Tus datos privados de contacto</li>
              </ul>
            </div>

            <div className="space-y-2">
              <label htmlFor="confirm-user-input" className="block text-xs font-medium text-[var(--ink)]">
                Escribe tu nombre de usuario <span className="font-mono text-[var(--accent)]">@{username}</span> para confirmar:
              </label>
              <input
                id="confirm-user-input"
                type="text"
                autoComplete="off"
                placeholder={username}
                value={confirmInput}
                onChange={(e) => setConfirmInput(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--field)] border border-[var(--line)] text-sm text-[var(--ink)] focus:outline-none focus:border-rose-500 transition-colors font-mono"
              />
            </div>

            {deleteError && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-400">
                {deleteError}
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-[var(--field)] text-[var(--ink-2)] hover:text-[var(--ink)] hover:bg-[var(--hover)] transition-all"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={deleting || confirmInput.trim().toLowerCase() !== username.toLowerCase()}
                onClick={handleDeleteAccount}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl bg-rose-500 hover:bg-rose-600 text-white shadow transition-all disabled:opacity-40"
              >
                {deleting ? (
                  <>
                    <IconoCargando className="animate-spin" size={14} />
                    <span>Eliminando cuenta...</span>
                  </>
                ) : (
                  <span>Eliminar mi cuenta</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
