"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import {
  IconoComentar,
  IconoGuardar,
  IconoCompartir,
  IconoFlechaIzquierda,
  IconoFlechaDerecha,
  IconoMenu,
  IconoCheck,
  IconoAlerta,
  IconoFlechaDerecha as IconoVerMas,
} from "@/components/iconos";
import { formatDistanceToNow } from "@/lib/utils/date";
import { getCountryName } from "@/lib/geo/countries";
import { toggleFollowAction } from "@/app/actions/social";
import { MarcoImagen } from "@/components/media/MarcoImagen";

export interface CauseMediaItem {
  id?: string;
  storage_path: string;
  kind: "imagen" | "video";
  position: number;
  width?: number | null;
  height?: number | null;
  previewUrl?: string;
}

export interface CauseAuthor {
  id: string;
  full_name: string;
  username: string;
  avatar_url?: string | null;
}

export interface CauseCardProps {
  id: string;
  title: string;
  category: string;
  description: string;
  status: "borrador" | "activa" | "cerrada" | "finalizada" | "oculta";
  city?: string | null;
  country_code?: string | null;
  country_name?: string | null;
  published_at?: string | null;
  closed_at?: string | null;
  finalized_at?: string | null;
  goal_amount?: number | null;
  raised_reported?: number | null;
  currency?: string;
  comments_count?: number;
  saves_count?: number;
  author: CauseAuthor;
  media: CauseMediaItem[];
  recentComments?: Array<{
    id: string;
    author_name: string;
    author_username: string;
    body: string;
  }>;
  resultsSummary?: string | null;
  resultsMedia?: CauseMediaItem[];
  resultsAmountReceived?: number | null;
  collection_type?: "dinero" | "insumos" | "ambas";
  is_example?: boolean;
  supplies?: Array<{
    id: string;
    name: string;
    quantity_needed?: number | null;
    quantity_received?: number | null;
    position?: number;
  }>;
  isSaved?: boolean;
  isFollowing?: boolean;
  isOwner?: boolean;
  isPreview?: boolean;
  authorActions?: React.ReactNode;
  onSaveToggle?: (causeId: string, current: boolean) => void;
  onFollowToggle?: (authorId: string, current: boolean) => void;
  onReport?: (causeId: string) => void;
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

function getInitials(name?: string | null): string {
  if (!name) return "P";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export function CauseCard({
  id,
  title,
  category,
  description,
  status,
  city,
  country_code,
  country_name,
  published_at,
  closed_at,
  finalized_at,
  goal_amount,
  raised_reported,
  currency = "USD",
  comments_count = 0,
  saves_count = 0,
  author,
  media = [],
  resultsSummary,
  resultsMedia = [],
  resultsAmountReceived,
  collection_type = "dinero",
  is_example = false,
  supplies = [],
  isSaved = false,
  isFollowing = false,
  isOwner = false,
  isPreview = false,
  authorActions,
  onSaveToggle,
  onFollowToggle,
  onReport,
}: CauseCardProps) {
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);
  const [saved, setSaved] = useState(isSaved);
  const [following, setFollowing] = useState(isFollowing);

  useEffect(() => {
    setFollowing(isFollowing);
  }, [isFollowing]);

  useEffect(() => {
    setSaved(isSaved);
  }, [isSaved]);
  const [copiedLink, setCopiedLink] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [imageErrorMap, setImageErrorMap] = useState<Record<number, boolean>>({});

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";

  const sortedMedia = [...media].sort((a, b) => a.position - b.position);
  const sortedResultsMedia = [...resultsMedia].sort((a, b) => a.position - b.position);

  const getMediaUrl = (item: CauseMediaItem) => {
    if (item.previewUrl) return item.previewUrl;
    if (item.storage_path.startsWith("http")) return item.storage_path;
    const bucket = item.kind === "video" ? "causas-videos" : "causas-imagenes";
    return `${supabaseUrl}/storage/v1/object/public/${bucket}/${item.storage_path}`;
  };

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/causa/${id}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title,
          text: `Apoya la causa: ${title}`,
          url: shareUrl,
        });
        return;
      } catch {}
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {}
  };

  const handleSave = () => {
    const next = !saved;
    setSaved(next);
    onSaveToggle?.(id, saved);
  };

  const handleFollow = async () => {
    const next = !following;
    setFollowing(next);
    if (onFollowToggle) {
      onFollowToggle(author.id, following);
    } else {
      const res = await toggleFollowAction(author.id);
      if (!res.success) {
        if (res.error === "SIN_SESION") {
          window.location.href = `/entrar?next=/causa/${id}`;
        } else {
          setFollowing(!next);
        }
      } else if (res.isFollowing !== undefined) {
        setFollowing(res.isFollowing);
      }
    }
  };

  const resolvedCountry = country_name || getCountryName(country_code);
  const locationText = [city, resolvedCountry].filter(Boolean).join(", ");

  const timeAgo =
    status === "cerrada" && closed_at
      ? `Cerrada ${formatDistanceToNow(new Date(closed_at))}`
      : status === "finalizada" && finalized_at
      ? `Finalizada ${formatDistanceToNow(new Date(finalized_at))}`
      : published_at
      ? `Publicada ${formatDistanceToNow(new Date(published_at))}`
      : "Reciente";

  const progressPercent =
    goal_amount && goal_amount > 0
      ? Math.min(100, Math.round(((raised_reported || 0) / goal_amount) * 100))
      : 0;

  const activeMedia = sortedMedia[currentMediaIndex];
  const isSeedPlaceholder =
    !activeMedia ||
    activeMedia.storage_path.startsWith("seed/") ||
    Boolean(imageErrorMap[currentMediaIndex]);

  return (
    <div className="@container w-full">
      <article
        className="w-full rounded-2xl sm:rounded-3xl border border-[var(--line)] bg-[color-mix(in_oklab,var(--bg)_84%,transparent)] transition-all duration-200 overflow-hidden hover:border-[var(--glass-edge)] hover:shadow-lg"
        style={{ backdropFilter: "none" }}
      >
        <div className="flex flex-col @[640px]:flex-row @[640px]:items-stretch">
          {/* ====================================================
              COLUMNA IZQUIERDA / SUPERIOR: MEDIOS
              ==================================================== */}
          <div className="w-full @[640px]:w-[42%] @[640px]:min-w-[280px] @[640px]:max-w-[390px] p-3.5 @[640px]:p-5 flex flex-col justify-start">
            {status === "finalizada" && sortedResultsMedia.length > 0 ? (
              /* Variante finalizada: Vista Antes / Después */
              <div className="relative w-full aspect-[4/3] rounded-xl overflow-hidden grid grid-cols-2 gap-0.5 bg-[var(--surface-solid)] border border-[var(--line)]">
                {/* ANTES */}
                <div className="relative w-full h-full overflow-hidden bg-black/20">
                  <span className="absolute top-2 left-2 z-10 px-2 py-0.5 text-[0.7rem] font-mono uppercase tracking-wider font-semibold rounded bg-black/70 text-white backdrop-blur-sm">
                    Antes
                  </span>
                  {sortedMedia[0] && !sortedMedia[0].storage_path.startsWith("seed/") ? (
                    <img
                      src={getMediaUrl(sortedMedia[0])}
                      alt="Antes"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <MarcoImagen aspectRatio="4/3" isResult={false} />
                  )}
                </div>

                {/* DESPUÉS */}
                <div className="relative w-full h-full overflow-hidden bg-black/20">
                  <span className="absolute top-2 right-2 z-10 px-2 py-0.5 text-[0.7rem] font-mono uppercase tracking-wider font-semibold rounded bg-[var(--accent)] text-white backdrop-blur-sm">
                    Después
                  </span>
                  {sortedResultsMedia[0] &&
                  !sortedResultsMedia[0].storage_path.startsWith("seed/") ? (
                    <img
                      src={getMediaUrl(sortedResultsMedia[0])}
                      alt="Después"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <MarcoImagen aspectRatio="4/3" isResult={true} />
                  )}
                </div>
              </div>
            ) : (
              /* Variante normal (activa o cerrada): Carrusel 4:3 */
              <div className="relative group w-full aspect-video @[640px]:aspect-[4/3] rounded-xl overflow-hidden bg-[color-mix(in_oklab,var(--bg)_92%,var(--ink))] border border-[var(--line)] flex items-center justify-center">
                {isSeedPlaceholder ? (
                  <MarcoImagen
                    aspectRatio="4/3"
                    index={sortedMedia.length > 0 ? currentMediaIndex + 1 : undefined}
                    total={sortedMedia.length > 0 ? sortedMedia.length : undefined}
                    isResult={false}
                  />
                ) : (
                  <img
                    src={getMediaUrl(activeMedia)}
                    alt={title}
                    onError={() =>
                      setImageErrorMap((prev) => ({ ...prev, [currentMediaIndex]: true }))
                    }
                    className="w-full h-full object-cover"
                  />
                )}

                {/* Indicador 1/N */}
                {sortedMedia.length > 1 && (
                  <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded-full bg-black/65 backdrop-blur-md text-[0.7rem] font-mono text-white pointer-events-none z-10">
                    {currentMediaIndex + 1}/{sortedMedia.length}
                  </div>
                )}

                {/* Flechas de carrusel */}
                {sortedMedia.length > 1 && (
                  <>
                    <button
                      type="button"
                      aria-label="Imagen anterior"
                      onClick={(e) => {
                        e.preventDefault();
                        setCurrentMediaIndex((i) =>
                          i === 0 ? sortedMedia.length - 1 : i - 1
                        );
                      }}
                      className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 hover:bg-black/75 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
                    >
                      <IconoFlechaIzquierda size={16} />
                    </button>
                    <button
                      type="button"
                      aria-label="Siguiente imagen"
                      onClick={(e) => {
                        e.preventDefault();
                        setCurrentMediaIndex((i) =>
                          i === sortedMedia.length - 1 ? 0 : i + 1
                        );
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 hover:bg-black/75 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
                    >
                      <IconoFlechaDerecha size={16} />
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {/* ====================================================
              COLUMNA DERECHA / INFERIOR: CONTENIDO
              ==================================================== */}
          <div className="w-full @[640px]:w-[58%] p-4 sm:p-5 @[640px]:p-6 flex flex-col justify-between min-w-0">
            <div>
              {/* Fila 1: Autor y Menú */}
              <div className="flex items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <Link
                    href={isPreview ? "#" : `/u/${author.username}`}
                    className="relative w-9 h-9 rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center bg-[var(--avatar)] border border-[var(--line)] text-[var(--ink-2)] font-mono text-xs font-semibold select-none"
                  >
                    {author.avatar_url ? (
                      <img
                        src={author.avatar_url}
                        alt={author.full_name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      getInitials(author.full_name)
                    )}
                  </Link>

                  <div className="flex flex-col min-w-0 leading-tight">
                    <div className="flex items-center gap-2">
                      <Link
                        href={isPreview ? "#" : `/u/${author.username}`}
                        className="font-medium text-sm text-[var(--ink)] hover:text-[var(--accent)] truncate transition-colors"
                      >
                        {author.full_name}
                      </Link>
                    </div>
                    <span className="text-xs text-[var(--ink-3)] font-mono truncate">
                      @{author.username}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 relative">
                  {!isOwner && (
                    <button
                      type="button"
                      onClick={handleFollow}
                      className={`px-3 py-1 text-xs font-medium rounded-full border transition-colors ${
                        following
                          ? "border-[var(--line)] text-[var(--ink-3)] hover:border-red-500/50 hover:text-red-400"
                          : "border-[var(--line)] text-[var(--ink-2)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
                      }`}
                    >
                      {following ? "Siguiendo" : "Seguir"}
                    </button>
                  )}

                  <button
                    type="button"
                    aria-label="Más opciones"
                    onClick={() => setShowMenu((prev) => !prev)}
                    className="p-1.5 text-[var(--ink-3)] hover:text-[var(--ink)] rounded-lg hover:bg-[var(--hover)] transition-colors"
                  >
                    <IconoMenu size={16} />
                  </button>

                  {/* Menú flotante */}
                  {showMenu && (
                    <div className="absolute right-0 top-full mt-1 w-44 rounded-xl bg-[var(--surface-solid)] border border-[var(--line)] shadow-xl z-20 py-1 text-xs text-[var(--ink-2)]">
                      <button
                        type="button"
                        onClick={() => {
                          handleShare();
                          setShowMenu(false);
                        }}
                        className="w-full px-3 py-2 text-left hover:bg-[var(--hover)] hover:text-[var(--ink)] transition-colors flex items-center justify-between"
                      >
                        <span>Copiar enlace</span>
                        {copiedLink && <IconoCheck size={14} className="text-emerald-400" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onReport?.(id);
                          setShowMenu(false);
                        }}
                        className="w-full px-3 py-2 text-left hover:bg-[var(--hover)] text-rose-400 hover:text-rose-300 transition-colors flex items-center gap-2"
                      >
                        <IconoAlerta size={14} />
                        <span>Reportar causa</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Fila 2: Categoría, Ubicación y Tiempo */}
              <div className="flex flex-wrap items-center gap-1.5 text-xs text-[var(--ink-3)] mb-2">
                <span className="px-2 py-0.5 rounded-md bg-[var(--track)] font-medium text-[var(--ink-2)]">
                  {CATEGORY_LABELS[category] || category}
                </span>
                {is_example && (
                  <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-400 font-bold text-xs">
                    Ejemplo
                  </span>
                )}
                <span>·</span>
                {locationText && (
                  <>
                    <span className="text-[var(--ink-2)]">{locationText}</span>
                    <span>·</span>
                  </>
                )}
                <span>{timeAgo}</span>
              </div>

              {/* Fila 3: Título */}
              <h3 className="text-lg @[640px]:text-xl font-semibold text-[var(--ink)] tracking-tight leading-snug mb-2 hover:text-[var(--accent)] transition-colors">
                <Link href={`/causa/${id}`}>{title}</Link>
              </h3>

              {/* Fila 4: Descripción o Resultados */}
              {status === "finalizada" && resultsSummary ? (
                <div className="mb-3">
                  <div className="text-xs font-mono uppercase tracking-wider text-[var(--accent-ink)] font-semibold mb-1">
                    Resultados alcanzados
                  </div>
                  <p
                    className={`text-sm text-[var(--ink-2)] leading-relaxed ${
                      isExpanded ? "" : "line-clamp-4 @[640px]:line-clamp-6"
                    }`}
                  >
                    {resultsSummary}
                  </p>
                  {resultsSummary.length > 220 && (
                    <button
                      type="button"
                      onClick={() => setIsExpanded(!isExpanded)}
                      className="text-xs font-medium text-[var(--accent-ink)] hover:underline mt-1"
                    >
                      {isExpanded ? "Leer menos" : "Leer más"}
                    </button>
                  )}
                </div>
              ) : (
                <div className="mb-3">
                  <p
                    className={`text-sm text-[var(--ink-2)] leading-relaxed ${
                      isExpanded ? "" : "line-clamp-4 @[640px]:line-clamp-6"
                    }`}
                  >
                    {description}
                  </p>
                  {description.length > 220 && (
                    <button
                      type="button"
                      onClick={() => setIsExpanded(!isExpanded)}
                      className="text-xs font-medium text-[var(--accent-ink)] hover:underline mt-1"
                    >
                      {isExpanded ? "Leer menos" : "Leer más"}
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Fila 5 & 6: Estado/Progreso y Acciones */}
            <div className="pt-2 border-t border-[var(--line)]">
              {/* Progreso según variante */}
              {status === "activa" && (
                <>
                  {/* Dinero (si es dinero o ambas) */}
                  {(collection_type === "dinero" || collection_type === "ambas") &&
                    goal_amount &&
                    goal_amount > 0 && (
                      <div className="mb-3">
                        <div className="flex items-center justify-between text-xs text-[var(--ink-3)] font-mono mb-1.5">
                          <span>
                            <strong className="text-[var(--ink)] font-semibold">
                              ${(raised_reported || 0).toLocaleString()}
                            </strong>{" "}
                            reportados de ${goal_amount.toLocaleString()} {currency}
                          </span>
                          <span className="font-semibold text-[var(--ink)]">{progressPercent}%</span>
                        </div>
                        <div
                          role="progressbar"
                          aria-valuenow={progressPercent}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-label={`${progressPercent}% de la meta`}
                          className="w-full h-1.5 rounded-full bg-[var(--track)] overflow-hidden"
                        >
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-[var(--cta)] to-[var(--accent)] transition-all duration-500"
                            style={{ width: `${progressPercent}%` }}
                          />
                        </div>
                      </div>
                    )}

                  {/* Insumos (si es insumos o ambas) */}
                  {(collection_type === "insumos" || collection_type === "ambas") &&
                    supplies.length > 0 && (
                      <div className="mb-3 flex items-center justify-between text-xs text-[var(--ink-3)] font-mono py-1 px-2.5 rounded-lg bg-[var(--track)]">
                        <span>
                          <strong className="text-[var(--ink)] font-semibold">
                            {
                              supplies.filter(
                                (s) =>
                                  s.quantity_needed != null &&
                                  s.quantity_needed > 0 &&
                                  (s.quantity_received || 0) >= s.quantity_needed
                              ).length
                            }{" "}
                            de {supplies.length} insumos completos
                          </strong>
                          {supplies.length > 0 && (
                            <span className="ml-1 text-[var(--ink-2)]">
                              (
                              {supplies
                                .slice(0, 2)
                                .map((s) => s.name)
                                .join(", ")}
                              {supplies.length > 2 ? "…" : ""})
                            </span>
                          )}
                        </span>
                      </div>
                    )}
                </>
              )}

              {status === "cerrada" && (
                <div className="flex items-center justify-between text-xs font-mono py-1.5 px-2.5 rounded-lg bg-[var(--track)] mb-3 text-[var(--ink-2)]">
                  <span>Esperando publicación de resultados</span>
                  {raised_reported ? (
                    <span className="font-semibold text-[var(--ink)]">
                      ${raised_reported.toLocaleString()} {currency}
                    </span>
                  ) : null}
                </div>
              )}

              {status === "finalizada" && (
                <div className="flex items-center justify-between text-xs font-mono py-1.5 px-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 mb-3 text-emerald-400">
                  <span>Causa con cuentas rendidas</span>
                  {resultsAmountReceived ? (
                    <span className="font-semibold text-emerald-300">
                      ${resultsAmountReceived.toLocaleString()} {currency}
                    </span>
                  ) : null}
                </div>
              )}

              {/* Fila de acciones */}
              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-4 text-xs text-[var(--ink-3)]">
                  {/* Comentarios */}
                  <Link
                    href={`/causa/${id}#comentarios`}
                    className="flex items-center gap-1.5 hover:text-[var(--ink)] transition-colors"
                  >
                    <IconoComentar size={17} />
                    <span>{comments_count}</span>
                  </Link>

                  {/* Guardar */}
                  <button
                    type="button"
                    aria-label={saved ? "Quitar de guardadas" : "Guardar causa"}
                    onClick={handleSave}
                    className={`flex items-center gap-1.5 transition-colors ${
                      saved ? "text-[var(--accent)]" : "hover:text-[var(--ink)]"
                    }`}
                  >
                    <IconoGuardar size={17} />
                    <span>{saves_count + (saved && !isSaved ? 1 : !saved && isSaved ? -1 : 0)}</span>
                  </button>

                  {/* Compartir */}
                  <button
                    type="button"
                    aria-label="Compartir causa"
                    onClick={handleShare}
                    className="flex items-center gap-1.5 hover:text-[var(--ink)] transition-colors relative"
                  >
                    <IconoCompartir size={17} />
                    {copiedLink && (
                      <span className="absolute -top-7 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded bg-[var(--surface-solid)] border border-[var(--line)] text-[0.7rem] text-emerald-400 font-mono whitespace-nowrap shadow-lg">
                        ¡Copiado!
                      </span>
                    )}
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  {authorActions}
                  {status !== "borrador" && (
                    <Link
                      href={`/causa/${id}`}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-[var(--field)] text-[var(--ink)] hover:bg-[var(--hover)] hover:text-[var(--accent)] border border-[var(--line)] transition-all"
                    >
                      <span>Ver causa</span>
                      <IconoVerMas size={13} />
                    </Link>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </article>
    </div>
  );
}
