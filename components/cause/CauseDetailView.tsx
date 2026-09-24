"use client";

import React, { useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  IconoCorazon,
  IconoGuardar,
  IconoCompartir,
  IconoMarcador,
  IconoCalendario,
  IconoFlechaIzquierda,
  IconoFlechaDerecha,
  IconoCopiar,
  IconoCheck,
  IconoAlerta,
  IconoCheckCirculo,
  IconoEnlace,
  IconoEditar,
  IconoArchivo,
  IconoEstrellas,
  IconoCandado,
  IconoMaximizar,
  IconoCerrar,
  IconoTarjeta,
  IconoCorazon as IconoSeguir,
} from "@/components/iconos";
import { toggleFollowAction } from "@/app/actions/social";
import { Glass } from "@/components/ui/Glass";
import { MarcoImagen } from "@/components/media/MarcoImagen";
import { formatDistanceToNow } from "@/lib/utils/date";
import { CommentsSection, type CommentItem } from "@/components/cause/CommentsSection";
import { urlDeAvatar } from "@/lib/media";
import { createClient } from "@/lib/supabase/client";
import { ModalRegistrarApoyo } from "@/components/cause/ModalRegistrarApoyo";

interface MediaItem {
  id: string;
  storage_path: string;
  bucket: string;
  kind: "imagen" | "video";
  phase: "causa" | "resultado";
  position: number;
  width?: number | null;
  height?: number | null;
  duration_seconds?: number | null;
}

interface DonationMethod {
  id: string;
  kind: string;
  provider: string;
  account_holder: string;
  account_value: string;
  details?: string | null;
  position: number;
}

interface Supply {
  id: string;
  name: string;
  unit?: string | null;
  quantity_needed?: number | null;
  quantity_received: number;
  position: number;
}

interface CauseDetailViewProps {
  cause: {
    id: string;
    title: string;
    category: string;
    description: string;
    status: "borrador" | "activa" | "cerrada" | "finalizada" | "oculta";
    city?: string | null;
    country_code?: string | null;
    region?: string | null;
    goal_amount?: number | null;
    raised_reported?: number | null;
    currency?: string;
    published_at?: string | null;
    closed_at?: string | null;
    finalized_at?: string | null;
    closing_note?: string | null;
    author_id: string;
    collection_type?: "dinero" | "insumos" | "ambas";
    supplies_instructions?: string | null;
    is_example?: boolean;
    first_support_confirmed_at?: string | null;
    author: {
      id: string;
      full_name: string;
      public_id: string;
      avatar_url?: string | null;
      bio?: string | null;
    };
    media: MediaItem[];
  };
  countryName?: string;
  donationMethods: DonationMethod[];
  supplies?: Supply[];
  results?: {
    summary: string;
    amount_received: number;
    currency: string;
  } | null;
  isSaved: boolean;
  isFollowing: boolean;
  isOwner: boolean;
  currentUserId?: string | null;
  currentUser?: { id: string; email: string } | null;
  currentUserProfile?: {
    id: string;
    full_name: string | null;
    public_id: string | null;
    avatar_url: string | null;
    onboarding_completed_at: string | null;
  } | null;
  initialComments: CommentItem[];
  initialCommentsHasMore: boolean;
  initialCommentsTotal: number;
}

const CATEGORY_LABELS: Record<string, string> = {
  terremoto: "Terremoto",
  inundacion: "Inundación",
  incendio: "Incendio",
  tormenta: "Tormenta",
  sequia: "Sequía",
  salud: "Salud",
  alimentacion: "Alimentación",
  vivienda: "Vivienda",
  educacion: "Educación",
  otra: "Causa Solidaria",
};

/** Returns true for example/test paths that have no real file in storage */
function isExamplePath(storagePath: string) {
  return storagePath.startsWith("ejemplo/") || storagePath.startsWith("test/");
}

export function CauseDetailView({
  cause,
  countryName,
  donationMethods,
  supplies = [],
  results,
  isSaved: initialSaved,
  isFollowing: initialFollowing,
  isOwner,
  currentUserId,
  currentUser,
  currentUserProfile,
  initialComments,
  initialCommentsHasMore,
  initialCommentsTotal,
}: CauseDetailViewProps) {
  const router = useRouter();
  const supabase = createClient();

  const [activeMediaIdx, setActiveMediaIdx] = useState(0);
  const [isSaved, setIsSaved] = useState(initialSaved);
  const [isFollowing, setIsFollowing] = useState(initialFollowing);
  const [copiedValue, setCopiedValue] = useState<string | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [currentRaised, setCurrentRaised] = useState(cause.raised_reported || 0);
  const [suppliesList, setSuppliesList] = useState(supplies);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";

  // Filter media for cause story phase
  const causeMedia = [...(cause.media || [])]
    .filter((m) => m.phase === "causa")
    .sort((a, b) => a.position - b.position);

  // Filter media for results phase
  const resultsMedia = [...(cause.media || [])]
    .filter((m) => m.phase === "resultado")
    .sort((a, b) => a.position - b.position);

  const getMediaUrl = (item: MediaItem) => {
    if (isExamplePath(item.storage_path)) return "";
    if (item.storage_path.startsWith("http")) return item.storage_path;
    return `${supabaseUrl}/storage/v1/object/public/${item.bucket}/${item.storage_path}`;
  };

  const handleCopy = async (val: string) => {
    try {
      await navigator.clipboard.writeText(val);
      setCopiedValue(val);
      setTimeout(() => setCopiedValue(null), 2000);
    } catch (err: any) {
      console.error("No se pudo copiar:", err?.name, err?.message);
      alert("No pudimos copiar. Selecciona el texto y cópialo a mano.");
    }
  };

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: cause.title, text: `Apoya la causa: ${cause.title}`, url });
        return;
      } catch (err: any) {
        // Cancelar el diálogo de compartir no es un error
        if (err?.name === "AbortError") return;
        console.error("No se pudo compartir:", err?.name, err?.message);
      }
    }
    handleCopy(url);
  };

  const handleToggleSave = async () => {
    if (!currentUserId) {
      router.push(`/entrar?next=/causa/${cause.id}`);
      return;
    }
    const next = !isSaved;
    setIsSaved(next);
    try {
      const { error } = next
        ? await supabase.from("saves").insert({ user_id: currentUserId, cause_id: cause.id })
        : await supabase.from("saves").delete().eq("user_id", currentUserId).eq("cause_id", cause.id);
      if (error) {
        console.error("Guardar causa:", error.code, error.message);
        setIsSaved(!next); // revert on error
        alert(`No pudimos ${next ? "guardar" : "quitar"} la causa: ${error.message}`);
      }
    } catch (err: any) {
      console.error("Guardar causa:", err?.code, err?.message);
      setIsSaved(!next); // revert on error
    }
  };

  const handleToggleFollow = async () => {
    if (!currentUserId) {
      router.push(`/entrar?next=/causa/${cause.id}`);
      return;
    }
    const next = !isFollowing;
    setIsFollowing(next);
    try {
      const res = await toggleFollowAction(cause.author_id);
      if (!res.success) {
        setIsFollowing(!next); // revert on error
        alert(res.error || "No pudimos actualizar el seguimiento.");
      } else if (res.isFollowing !== undefined) {
        setIsFollowing(res.isFollowing);
      }
    } catch (err: any) {
      console.error("Seguir:", err?.code, err?.message);
      setIsFollowing(!next); // revert on error
    }
  };

  const locationText = [cause.city, countryName || cause.country_code].filter(Boolean).join(", ");

  const collectionType = cause.collection_type ?? "dinero";
  const includesDinero = collectionType === "dinero" || collectionType === "ambas";
  const includesInsumos = collectionType === "insumos" || collectionType === "ambas";

  const progressPercent =
    cause.goal_amount && cause.goal_amount > 0
      ? Math.min(100, Math.round(((cause.raised_reported || 0) / cause.goal_amount) * 100))
      : 0;

  // Insumos progress summary
  const suppliesDone = supplies.filter(
    (s) => s.quantity_needed != null && s.quantity_received >= s.quantity_needed
  ).length;

  return (
    <div className="max-w-4xl mx-auto px-4 space-y-8">

      {/* 0. Banner de causa de ejemplo */}
      {cause.is_example && (
        <div className="flex items-start gap-3 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-500 text-sm">
          <IconoAlerta size={18} className="flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">Esta es una causa de demostración.</p>
            <p className="text-xs mt-0.5 opacity-90">No envíes dinero ni insumos. Solo existe para que pruebes la plataforma.</p>
          </div>
        </div>
      )}

      {/* 1. Top Navigation & Author Controls */}
      <div className="flex items-center justify-between">
        <Link
          href="/explorar"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-text-secondary hover:text-text-primary transition-colors"
        >
          <IconoFlechaIzquierda size={16} /> Volver al feed
        </Link>

        {isOwner && (
          <div className="flex items-center gap-2">
            {(cause.status === "activa" || cause.status === "cerrada") && (
              <button
                type="button"
                onClick={() => setShowSupportModal(true)}
                className="px-3.5 py-1.5 rounded-full bg-[var(--cta)] hover:bg-[var(--accent)] text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
              >
                <IconoTarjeta size={14} /> Registrar apoyo recibido
              </button>
            )}
            {cause.status === "activa" && (
              <Link
                href={`/causa/${cause.id}/cerrar`}
                className="px-3 py-1.5 rounded-full glass-surface hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-semibold flex items-center gap-1 transition-all"
              >
                <IconoArchivo size={14} /> Cerrar causa
              </Link>
            )}
            {cause.status === "cerrada" && (
              <Link
                href={`/causa/${cause.id}/resultados`}
                className="px-3.5 py-1.5 rounded-full bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 hover:bg-emerald-600 shadow-md shadow-emerald-500/20"
              >
                <IconoEstrellas size={14} /> Publicar resultados
              </Link>
            )}
          </div>
        )}
      </div>

      {/* 2. Results Banner (If Finalized) */}
      {cause.status === "finalizada" && results && (
        <section className="glass-card rounded-3xl p-6 sm:p-8 space-y-4 border border-emerald-500/40 bg-emerald-500/5">
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-xs uppercase tracking-wider">
              Resultados de la Causa
            </span>
            <span className="text-xs text-text-secondary">
              Finalizada el{" "}
              {cause.finalized_at ? new Date(cause.finalized_at).toLocaleDateString("es") : ""}
            </span>
          </div>

          <div className="space-y-2">
            <h3 className="font-bold text-xl text-text-primary">
              Monto total recibido: {results.currency} {results.amount_received.toLocaleString()}
            </h3>
            <p className="text-sm text-text-secondary whitespace-pre-wrap">{results.summary}</p>
          </div>

          {/* Results Gallery */}
          {resultsMedia.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
              {resultsMedia.map((rm, idx) => (
                <div
                  key={rm.id || idx}
                  className="aspect-video rounded-2xl overflow-hidden glass-surface border border-glass-tint"
                >
                  {isExamplePath(rm.storage_path) ? (
                    <MarcoImagen aspectRatio="16/9" isResult />
                  ) : (
                    <img src={getMediaUrl(rm)} alt="Evidencia de resultados" className="w-full h-full object-cover" />
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* 3. Full Media Gallery */}
      {causeMedia.length > 0 && (
        <div className="space-y-3">
          {/* Main Display Frame (4:3) */}
          <div className="relative w-full aspect-[4/3] sm:aspect-[16/10] rounded-3xl overflow-hidden glass-card group select-none">
            {isExamplePath(causeMedia[activeMediaIdx]?.storage_path ?? "") ? (
              <MarcoImagen
                aspectRatio="4/3"
                index={activeMediaIdx + 1}
                total={causeMedia.length}
              />
            ) : causeMedia[activeMediaIdx]?.kind === "video" ? (
              <div className="relative w-full h-full">
                <video
                  src={getMediaUrl(causeMedia[activeMediaIdx])}
                  controls
                  playsInline
                  preload="none"
                  className="w-full h-full object-cover"
                />
              </div>
            ) : (
              <img
                src={getMediaUrl(causeMedia[activeMediaIdx])}
                alt={cause.title}
                className="w-full h-full object-cover cursor-pointer"
                onClick={() => setLightboxOpen(true)}
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                }}
              />
            )}

            {/* Expand Button */}
            {!isExamplePath(causeMedia[activeMediaIdx]?.storage_path ?? "") && (
              <button
                onClick={() => setLightboxOpen(true)}
                className="absolute top-4 right-4 p-2 rounded-full glass-surface text-white opacity-0 group-hover:opacity-100 transition-opacity hover:scale-110 active:scale-95 z-20"
                title="Pantalla completa"
                aria-label="Ver en pantalla completa"
              >
                <IconoMaximizar size={18} />
              </button>
            )}

            {/* Arrows */}
            {causeMedia.length > 1 && (
              <>
                <button
                  onClick={() => setActiveMediaIdx((prev) => (prev > 0 ? prev - 1 : causeMedia.length - 1))}
                  className="absolute left-4 top-1/2 -translate-y-1/2 p-2.5 rounded-full glass-surface text-white opacity-0 group-hover:opacity-100 transition-opacity hover:scale-110 active:scale-95 z-20"
                  aria-label="Imagen anterior"
                >
                  <IconoFlechaIzquierda size={22} />
                </button>
                <button
                  onClick={() => setActiveMediaIdx((prev) => (prev < causeMedia.length - 1 ? prev + 1 : 0))}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-2.5 rounded-full glass-surface text-white opacity-0 group-hover:opacity-100 transition-opacity hover:scale-110 active:scale-95 z-20"
                  aria-label="Imagen siguiente"
                >
                  <IconoFlechaDerecha size={22} />
                </button>
                <div className="absolute bottom-4 left-4 px-3 py-1 rounded-full glass-surface text-white text-xs font-semibold z-20">
                  {activeMediaIdx + 1} de {causeMedia.length}
                </div>
              </>
            )}
          </div>

          {/* Thumbnails */}
          {causeMedia.length > 1 && (
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
              {causeMedia.map((m, idx) => (
                <button
                  key={m.id || idx}
                  onClick={() => setActiveMediaIdx(idx)}
                  aria-label={`Ver imagen ${idx + 1}`}
                  className={`relative w-20 h-16 rounded-xl overflow-hidden flex-shrink-0 transition-all border-2 ${
                    activeMediaIdx === idx
                      ? "border-accent scale-105 shadow-md"
                      : "border-transparent opacity-60 hover:opacity-100"
                  }`}
                >
                  {isExamplePath(m.storage_path) ? (
                    <MarcoImagen />
                  ) : (
                    <img
                      src={getMediaUrl(m)}
                      alt=""
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display = "none";
                      }}
                    />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 4. Header Details */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-3 py-1 rounded-lg bg-accent/10 text-accent font-bold text-xs uppercase tracking-wider">
              {CATEGORY_LABELS[cause.category] || cause.category}
            </span>

            {cause.is_example && (
              <span className="px-3 py-1 rounded-lg bg-amber-500/20 text-amber-400 font-bold text-xs">
                Ejemplo
              </span>
            )}
            {cause.status === "cerrada" && (
              <span className="px-3 py-1 rounded-lg bg-amber-500/20 text-amber-400 font-bold text-xs">
                Cerrada
              </span>
            )}
            {cause.status === "finalizada" && (
              <span className="px-3 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 font-bold text-xs">
                Finalizada
              </span>
            )}
          </div>

          {/* Social actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleToggleSave}
              className={`p-2.5 rounded-full glass-surface transition-colors ${
                isSaved ? "text-accent" : "text-text-secondary hover:text-text-primary"
              }`}
              title={isSaved ? "Guardada" : "Guardar"}
              aria-label={isSaved ? "Guardada" : "Guardar causa"}
            >
              <IconoGuardar size={20} className={isSaved ? "fill-accent text-accent" : ""} />
            </button>

            <button
              onClick={handleShare}
              className="p-2.5 rounded-full glass-surface text-text-secondary hover:text-text-primary transition-colors"
              title="Compartir causa"
              aria-label="Compartir causa"
            >
              <IconoCompartir size={20} />
            </button>
          </div>
        </div>

        <h1 className="text-2xl sm:text-4xl font-extrabold text-text-primary tracking-tight">
          {cause.title}
        </h1>

        <div className="flex flex-wrap items-center gap-4 text-xs sm:text-sm text-text-secondary">
          {locationText && (
            <div className="flex items-center gap-1.5">
              <IconoMarcador size={16} className="text-accent" />
              <span>{locationText}</span>
            </div>
          )}

          {cause.published_at && (
            <div className="flex items-center gap-1.5">
              <IconoCalendario size={16} />
              <span>Publicado {formatDistanceToNow(cause.published_at)}</span>
            </div>
          )}
        </div>
      </div>

      {/* 5. Author Card */}
      <Glass variant="panel" className="p-4 rounded-3xl flex items-center justify-between gap-4">
        <Link href={`/u/${cause.author.public_id}`} className="flex items-center gap-3 min-w-0">
          <div className="w-12 h-12 rounded-full overflow-hidden bg-glass-tint flex-shrink-0 flex items-center justify-center font-bold text-accent text-lg">
            {urlDeAvatar(cause.author.avatar_url) ? (
              <img
                src={urlDeAvatar(cause.author.avatar_url)!}
                alt={cause.author.full_name}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              cause.author.full_name.charAt(0).toUpperCase()
            )}
          </div>

          <div className="min-w-0">
            <p className="font-bold text-text-primary text-sm sm:text-base hover:underline truncate">
              {cause.author.full_name}
            </p>
            <p className="text-xs text-text-secondary">{cause.author.public_id}</p>
          </div>
        </Link>

        {!isOwner && (
          <button
            id="btn-seguir-autor"
            onClick={handleToggleFollow}
            className={`px-4 py-2 rounded-full text-xs font-semibold transition-all border ${
              isFollowing
                ? "bg-transparent text-text-secondary border-glass-tint hover:text-text-primary"
                : "bg-accent text-white border-accent hover:bg-accent/90 shadow-md shadow-accent/20"
            }`}
            aria-pressed={isFollowing}
          >
            {isFollowing ? "Siguiendo ✓" : "Seguir"}
          </button>
        )}
      </Glass>

      {/* 6. Progress & Supplies */}
      {/* 6a. Barra de progreso en dinero */}
      {includesDinero && cause.goal_amount && cause.goal_amount > 0 && (
        <Glass
          variant="card"
          id="progreso"
          className="p-6 rounded-3xl space-y-3"
          style={{ scrollMarginTop: "calc(var(--alto-header) + 16px)" } as React.CSSProperties}
        >
          <div className="flex justify-between items-baseline">
            <div>
              <span className="text-2xl font-black text-text-primary">
                {cause.currency} {(currentRaised || 0).toLocaleString()}
              </span>
              <span className="text-xs text-text-secondary ml-2">
                reportados de {cause.currency} {cause.goal_amount.toLocaleString()}
              </span>
            </div>
            <span className="text-sm font-bold text-accent">{progressPercent}%</span>
          </div>

          {/* Barra de progreso */}
          <div
            role="progressbar"
            aria-valuenow={progressPercent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${progressPercent}% de la meta alcanzada`}
            className="w-full h-1.5 rounded-full overflow-hidden"
            style={{ background: "var(--line)" }}
          >
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${progressPercent}%`, background: "var(--accent)" }}
            />
          </div>

          <p className="text-[11px] text-text-secondary italic">
            Monto reportado directamente por quien publica. Puente no procesa los pagos.
          </p>
        </Glass>
      )}

      {/* 6b. Insumos */}
      {includesInsumos && suppliesList.length > 0 && (
        <Glass variant="card" id="insumos" className="p-6 rounded-3xl space-y-4"
          style={{ scrollMarginTop: "calc(var(--alto-header) + 16px)" } as React.CSSProperties}
        >
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-lg text-text-primary">Insumos necesarios</h3>
            {cause.status === "activa" && (
              <span className="text-xs text-text-secondary">
                {suppliesDone} de {suppliesList.length} completos
              </span>
            )}
          </div>

          <div className="space-y-3">
            {suppliesList.map((s) => {
              const pct =
                s.quantity_needed && s.quantity_needed > 0
                  ? Math.min(100, Math.round((s.quantity_received / s.quantity_needed) * 100))
                  : null;
              return (
                <div key={s.id} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold text-text-primary">{s.name}</span>
                    {s.quantity_needed != null && (
                      <span className="text-xs text-text-secondary">
                        {s.quantity_received} / {s.quantity_needed}
                        {s.unit ? ` ${s.unit}` : ""}
                      </span>
                    )}
                  </div>
                  {pct != null && (
                    <div
                      role="progressbar"
                      aria-valuenow={pct}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`${s.name}: ${pct}%`}
                      className="w-full h-1 rounded-full overflow-hidden"
                      style={{ background: "var(--line)" }}
                    >
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${pct}%`,
                          background: pct >= 100 ? "#22c55e" : "var(--accent)",
                        }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <p className="text-[11px] text-text-secondary italic">
            Cantidades reportadas por quien publica la causa.
          </p>
        </Glass>
      )}

      {/* 7. Story / Description */}
      <div className="space-y-3">
        <h2 className="font-bold text-lg text-text-primary">Historia</h2>
        <p className="text-text-primary text-sm sm:text-base leading-relaxed whitespace-pre-wrap">
          {cause.description}
        </p>
      </div>

      {/* 8. Cómo Donar / Cómo hacer llegar insumos */}
      <section
        id="donar"
        className="space-y-6 pt-4"
        style={{ scrollMarginTop: "calc(var(--alto-header) + 16px)" } as React.CSSProperties}
      >
        {/* 8a. Cómo donar dinero */}
        {includesDinero && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <IconoTarjeta size={22} className="text-accent" />
              <h3 className="font-bold text-xl text-text-primary">Cómo donar dinero</h3>
              {cause.status === "activa" && (
                <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 font-semibold text-xs ml-auto">
                  Recibiendo apoyo
                </span>
              )}
            </div>

            {/* Aviso */}
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs flex items-start gap-3">
              <IconoAlerta size={18} className="flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">
                  Puente no procesa donaciones. Verifica los datos antes de enviar dinero.
                </p>
                <p className="mt-0.5 opacity-90">
                  Las donaciones son 100% directas entre tú y quien publica. Sin comisiones.
                </p>
              </div>
            </div>

            {cause.status === "cerrada" || cause.status === "finalizada" ? (
              <div className="p-6 rounded-3xl glass-card text-center text-text-secondary text-sm">
                <p className="font-semibold text-text-primary">Esta causa ya no recibe donaciones.</p>
              </div>
            ) : !currentUserId ? (
              <div className="p-8 rounded-3xl glass-card border border-glass-tint text-center space-y-3">
                <IconoCandado size={32} className="mx-auto text-accent opacity-80" />
                <h4 className="font-bold text-base text-text-primary">Inicia sesión para ver cómo donar</h4>
                <p className="text-xs text-text-secondary max-w-sm mx-auto">
                  Para proteger los datos bancarios contra raspados automatizados, debes iniciar sesión.
                </p>
                <Link
                  href={`/entrar?next=/causa/${cause.id}#donar`}
                  className="inline-block px-6 py-2.5 rounded-full bg-accent text-white font-semibold text-xs hover:bg-accent/90 shadow-md shadow-accent/20"
                >
                  Iniciar sesión
                </Link>
              </div>
            ) : cause.is_example ? (
              <div className="p-5 rounded-2xl glass-card border border-amber-500/20 text-center text-sm text-text-secondary">
                <p className="font-semibold text-text-primary">Aquí aparecerían tus métodos de pago.</p>
                <p className="text-xs mt-1">Esta es una causa de ejemplo. No envíes dinero real.</p>
              </div>
            ) : donationMethods.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {donationMethods.map((m) => (
                  <div
                    key={m.id}
                    className="p-5 rounded-3xl glass-surface border border-glass-tint space-y-3 flex flex-col justify-between"
                  >
                    <div className="space-y-1 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm text-text-primary">{m.provider}</span>
                        <span className="px-2 py-0.5 rounded-md bg-accent/10 text-accent text-[10px] font-semibold uppercase">
                          {m.kind.replace(/_/g, " ")}
                        </span>
                      </div>
                      <p className="text-text-secondary">
                        <span className="font-medium text-text-primary">Titular:</span> {m.account_holder}
                      </p>
                      <div className="pt-1">
                        <span className="text-text-secondary block text-[11px]">Dato de cuenta:</span>
                        <p className="font-mono text-sm font-semibold text-text-primary break-all">
                          {m.account_value}
                        </p>
                      </div>
                      {m.details && (
                        <p className="text-text-secondary italic text-[11px] pt-1">{m.details}</p>
                      )}
                    </div>
                    <div className="pt-2">
                      <button
                        onClick={() => handleCopy(m.account_value)}
                        className="w-full py-2 rounded-xl glass-tint hover:bg-glass-tint/80 text-xs font-semibold text-text-primary flex items-center justify-center gap-1.5 transition-all"
                      >
                        {copiedValue === m.account_value ? (
                          <>
                            <IconoCheck size={14} className="text-emerald-400" />
                            <span className="text-emerald-400">¡Copiado!</span>
                          </>
                        ) : (
                          <>
                            <IconoCopiar size={14} />
                            <span>Copiar dato de cuenta</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-text-secondary text-center py-4">
                No se han configurado métodos de donación aún.
              </p>
            )}
          </div>
        )}

        {/* 8b. Cómo entregar insumos */}
        {includesInsumos && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-xl">📦</span>
              <h3 className="font-bold text-xl text-text-primary">Cómo entregar insumos</h3>
            </div>

            {/* Aviso */}
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs flex items-start gap-3">
              <IconoAlerta size={18} className="flex-shrink-0 mt-0.5" />
              <p className="font-semibold">
                Puente no interviene en la entrega. Coordina directamente con quien publica.
              </p>
            </div>

            {cause.is_example ? (
              <div className="p-5 rounded-2xl glass-card border border-amber-500/20 text-center text-sm text-text-secondary">
                <p className="font-semibold text-text-primary">Aquí aparecerían las instrucciones de entrega.</p>
                <p className="text-xs mt-1">Esta es una causa de ejemplo.</p>
              </div>
            ) : !currentUserId ? (
              <div className="p-6 rounded-3xl glass-card border border-glass-tint text-center space-y-2">
                <IconoCandado size={28} className="mx-auto text-accent opacity-80" />
                <p className="text-sm text-text-secondary">Inicia sesión para ver las instrucciones de entrega.</p>
                <Link
                  href={`/entrar?next=/causa/${cause.id}#donar`}
                  className="inline-block px-5 py-2 rounded-full bg-accent text-white font-semibold text-xs hover:bg-accent/90"
                >
                  Iniciar sesión
                </Link>
              </div>
            ) : cause.supplies_instructions ? (
              <div className="p-5 rounded-2xl glass-card border border-glass-tint">
                <p className="text-sm text-text-primary leading-relaxed whitespace-pre-wrap">
                  {cause.supplies_instructions}
                </p>
              </div>
            ) : (
              <p className="text-xs text-text-secondary text-center py-4">
                No se han configurado instrucciones de entrega.
              </p>
            )}
          </div>
        )}
      </section>

      {/* 9. Comments Section */}
      <section
        id="comentarios"
        style={{ scrollMarginTop: "calc(var(--alto-header) + 16px)" } as React.CSSProperties}
      >
        <CommentsSection
          causeId={cause.id}
          causeAuthorId={cause.author_id}
          currentUser={currentUser}
          currentUserProfile={currentUserProfile}
          initialComments={initialComments}
          initialHasMore={initialCommentsHasMore}
          initialTotal={initialCommentsTotal}
        />
      </section>

      {/* 10. Lightbox Modal */}
      {lightboxOpen && causeMedia.length > 0 && (
        <div className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center p-4 backdrop-blur-md">
          <button
            onClick={() => setLightboxOpen(false)}
            className="absolute top-6 right-6 p-3 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors z-50"
            aria-label="Cerrar"
          >
            <IconoCerrar size={24} />
          </button>

          <div className="relative max-w-5xl max-h-[85vh] w-full flex items-center justify-center">
            {causeMedia[activeMediaIdx]?.kind === "video" ? (
              <video
                src={getMediaUrl(causeMedia[activeMediaIdx])}
                controls
                autoPlay
                className="max-h-[85vh] max-w-full rounded-2xl"
              />
            ) : isExamplePath(causeMedia[activeMediaIdx]?.storage_path ?? "") ? (
              <div className="w-full max-w-2xl aspect-[4/3]">
                <MarcoImagen aspectRatio="4/3" index={activeMediaIdx + 1} total={causeMedia.length} />
              </div>
            ) : (
              <img
                src={getMediaUrl(causeMedia[activeMediaIdx])}
                alt={cause.title}
                className="max-h-[85vh] max-w-full object-contain rounded-2xl shadow-2xl"
              />
            )}

            {causeMedia.length > 1 && (
              <>
                <button
                  onClick={() => setActiveMediaIdx((prev) => (prev > 0 ? prev - 1 : causeMedia.length - 1))}
                  className="absolute left-2 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 text-white hover:bg-white/20"
                  aria-label="Imagen anterior"
                >
                  <IconoFlechaIzquierda size={28} />
                </button>
                <button
                  onClick={() => setActiveMediaIdx((prev) => (prev < causeMedia.length - 1 ? prev + 1 : 0))}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 text-white hover:bg-white/20"
                  aria-label="Imagen siguiente"
                >
                  <IconoFlechaDerecha size={28} />
                </button>
              </>
            )}
          </div>

          <div className="mt-4 text-xs font-semibold text-white/70">
            {activeMediaIdx + 1} / {causeMedia.length}
          </div>
        </div>
      )}

      {/* Modal Registrar Apoyo Recibido (PLAN.md 6.3) */}
      <ModalRegistrarApoyo
        isOpen={showSupportModal}
        onClose={() => setShowSupportModal(false)}
        causeId={cause.id}
        collectionType={collectionType}
        currency={cause.currency || "USD"}
        currentRaised={currentRaised}
        supplies={suppliesList}
        onSuccess={(newAmount, newSupplies) => {
          if (typeof newAmount === "number") {
            setCurrentRaised(newAmount);
          }
          if (newSupplies) {
            setSuppliesList(
              newSupplies.map((s, idx) => ({
                id: s.id,
                name: s.name,
                unit: s.unit ?? null,
                quantity_needed: s.quantity_needed ?? null,
                quantity_received: s.quantity_received,
                position: s.position ?? idx,
              }))
            );
          }
        }}
      />
    </div>
  );
}
