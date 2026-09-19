"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  IconoMarcador,
  IconoCalendario,
  IconoAjustes,
  IconoEstrellas,
  IconoDocumento,
  IconoBasura,
  IconoEnlace,
  IconoFlechaDerecha,
  IconoCorazon,
  IconoUsuarios,
} from "@/components/iconos";
import { Glass } from "@/components/ui/Glass";
import { CauseCard, CauseCardProps } from "@/components/feed/CauseCard";
import { createClient } from "@/lib/supabase/client";
import { getCountryName } from "@/lib/geo/countries";


interface UserProfileViewProps {
  profile: {
    id: string;
    full_name: string;
    username: string;
    avatar_url?: string | null;
    bio?: string | null;
    city?: string | null;
    country_code?: string | null;
    causes_count: number;
    followers_count: number;
    following_count: number;
    created_at: string;
  };
  countryName?: string;
  causes: any[];
  isFollowing: boolean;
  isOwner: boolean;
  currentUserId?: string | null;
}

export function UserProfileView({
  profile,
  countryName,
  causes: initialCauses,
  isFollowing: initialFollowing,
  isOwner,
  currentUserId,
}: UserProfileViewProps) {
  const router = useRouter();
  const supabase = createClient();

  const [activeTab, setActiveTab] = useState<"publicadas" | "borradores">("publicadas");
  const [following, setFollowing] = useState(initialFollowing);
  const [followersCount, setFollowersCount] = useState(profile.followers_count);
  const [causesList, setCausesList] = useState(initialCauses);

  const publishedCauses = causesList.filter((c) => c.status !== "borrador");
  const draftCauses = causesList.filter((c) => c.status === "borrador");

  const resolvedCountry = countryName || getCountryName(profile.country_code);
  const locationText = [profile.city, resolvedCountry]
    .filter(Boolean)
    .join(", ");


  const handleToggleFollow = async () => {
    if (!currentUserId) {
      router.push(`/entrar?next=/u/${profile.username}`);
      return;
    }

    const nextState = !following;
    setFollowing(nextState);
    setFollowersCount((prev) => prev + (nextState ? 1 : -1));

    try {
      if (nextState) {
        await supabase
          .from("follows")
          .insert({ follower_id: currentUserId, following_id: profile.id });
      } else {
        await supabase
          .from("follows")
          .delete()
          .eq("follower_id", currentUserId)
          .eq("following_id", profile.id);
      }
    } catch (err) {
      console.error("Error updating follow:", err);
    }
  };

  const handleDeleteDraft = async (draftId: string) => {
    if (!confirm("¿Seguro que deseas eliminar este borrador?")) return;

    await supabase.from("causes").delete().eq("id", draftId);
    setCausesList((prev) => prev.filter((c) => c.id !== draftId));
  };

  return (
    <div className="max-w-4xl mx-auto px-4 space-y-8">
      {/* 1. Profile Header Card */}
      <Glass variant="card" className="p-6 sm:p-8 rounded-3xl space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden bg-[var(--avatar)] flex-shrink-0 flex items-center justify-center font-mono font-semibold text-[var(--ink-2)] text-2xl sm:text-3xl border-2 border-[var(--line)] shadow-inner select-none">
              {profile.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={profile.full_name}
                  className="w-full h-full object-cover"
                />
              ) : (
                profile.full_name
                  .trim()
                  .split(/\s+/)
                  .slice(0, 2)
                  .map((p) => p[0])
                  .join("")
                  .toUpperCase()
              )}
            </div>

            <div className="space-y-1 min-w-0">
              <h1 className="text-xl sm:text-2xl font-black text-text-primary tracking-tight">
                {profile.full_name}
              </h1>
              <p className="text-xs text-text-secondary font-mono">@{profile.username}</p>
              {locationText && (
                <p className="text-xs text-text-secondary flex items-center gap-1 pt-0.5">
                  <IconoMarcador size={13} className="text-accent" />
                  <span>{locationText}</span>
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end">
            {isOwner ? (
              <Link
                href="/perfil"
                className="px-4 py-2 rounded-full glass-surface hover:bg-glass-tint text-text-primary font-semibold text-xs flex items-center gap-1.5 transition-all border border-glass-tint"
              >
                <IconoAjustes size={14} /> Editar perfil
              </Link>
            ) : (
              <button
                onClick={handleToggleFollow}
                className={`px-5 py-2 rounded-full font-bold text-xs transition-all ${
                  following
                    ? "bg-glass-surface text-text-secondary hover:text-text-primary border border-glass-tint"
                    : "bg-accent text-white hover:bg-accent/90 shadow-md shadow-accent/20"
                }`}
              >
                {following ? "Siguiendo" : "Seguir"}
              </button>
            )}
          </div>
        </div>

        {/* Bio */}
        {profile.bio && (
          <p className="text-xs sm:text-sm text-text-secondary leading-relaxed whitespace-pre-wrap">
            {profile.bio}
          </p>
        )}

        {/* Counters */}
        <div className="grid grid-cols-3 gap-3 pt-2 border-t border-glass-tint/40 text-center">
          <div className="space-y-0.5">
            <span className="font-extrabold text-base sm:text-lg text-text-primary block">
              {publishedCauses.length}
            </span>
            <span className="text-[11px] text-text-secondary">Causas</span>
          </div>
          <div className="space-y-0.5">
            <span className="font-extrabold text-base sm:text-lg text-text-primary block">
              {followersCount}
            </span>
            <span className="text-[11px] text-text-secondary">Seguidores</span>
          </div>
          <div className="space-y-0.5">
            <span className="font-extrabold text-base sm:text-lg text-text-primary block">
              {profile.following_count}
            </span>
            <span className="text-[11px] text-text-secondary">Siguiendo</span>
          </div>
        </div>
      </Glass>

      {/* 2. Tabs */}
      <div className="flex items-center gap-2 border-b border-glass-tint pb-1">
        <button
          onClick={() => setActiveTab("publicadas")}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === "publicadas"
              ? "bg-text-primary text-background shadow-sm"
              : "text-text-secondary hover:text-text-primary"
          }`}
        >
          Causas Publicadas ({publishedCauses.length})
        </button>

        {isOwner && (
          <button
            onClick={() => setActiveTab("borradores")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === "borradores"
                ? "bg-text-primary text-background shadow-sm"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            <IconoDocumento size={14} />
            <span>Borradores ({draftCauses.length})</span>
          </button>
        )}
      </div>

      {/* 3. Published Causes Stream */}
      {activeTab === "publicadas" && (
        <div className="space-y-8">
          {publishedCauses.length > 0 ? (
            publishedCauses.map((c) => {
              const causeMedia = ((c.media || []) as any[])
                .filter((m) => m.phase === "causa")
                .sort((a, b) => a.position - b.position)
                .map((m) => ({
                  id: m.id,
                  storage_path: m.storage_path,
                  bucket: m.bucket,
                  kind: m.kind,
                  position: m.position,
                }));

              const resultsMedia = ((c.media || []) as any[])
                .filter((m) => m.phase === "resultado")
                .sort((a, b) => a.position - b.position)
                .map((m) => ({
                  id: m.id,
                  storage_path: m.storage_path,
                  bucket: m.bucket,
                  kind: m.kind,
                  position: m.position,
                }));

              return (
                <CauseCard
                  key={c.id}
                  id={c.id}
                  title={c.title || "Sin título"}
                  category={c.category}
                  description={c.description || ""}
                  status={c.status}
                  city={c.city}
                  country_code={c.country_code}
                  published_at={c.published_at}
                  closed_at={c.closed_at}
                  finalized_at={c.finalized_at}
                  goal_amount={c.goal_amount}
                  raised_reported={c.raised_reported}
                  currency={c.currency || "USD"}
                  comments_count={c.comments_count || 0}
                  saves_count={c.saves_count || 0}
                  author={{
                    id: profile.id,
                    full_name: profile.full_name,
                    username: profile.username,
                    avatar_url: profile.avatar_url,
                  }}
                  media={causeMedia}
                  resultsMedia={resultsMedia}
                  resultsSummary={c.results?.summary || null}
                  isOwner={isOwner}
                />
              );
            })
          ) : (
            <div className="py-12 text-center text-xs text-text-secondary space-y-2">
              <p>Este usuario aún no ha publicado causas.</p>
              {isOwner && (
                <Link
                  href="/causa/nueva"
                  className="inline-block mt-2 px-5 py-2.5 rounded-full bg-accent text-white font-bold"
                >
                  Publicar mi primera causa
                </Link>
              )}
            </div>
          )}
        </div>
      )}

      {/* 4. Drafts Tab (Private, Author Only) */}
      {isOwner && activeTab === "borradores" && (
        <div className="space-y-4">
          {draftCauses.length > 0 ? (
            draftCauses.map((draft) => (
              <Glass
                key={draft.id}
                variant="card"
                className="p-5 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-md bg-sky-500/20 text-sky-400 font-bold text-[10px]">
                      Borrador
                    </span>
                    <span className="text-[11px] text-text-secondary">
                      Creado el {draft.created_at ? new Date(draft.created_at).toLocaleDateString() : ""}
                    </span>
                  </div>
                  <h3 className="font-bold text-text-primary text-sm sm:text-base truncate">
                    {draft.title || "Borrador sin título"}
                  </h3>
                  <p className="text-xs text-text-secondary line-clamp-1">
                    {draft.description || "Sin descripción aún"}
                  </p>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  <button
                    onClick={() => handleDeleteDraft(draft.id)}
                    className="p-2 rounded-full text-text-secondary hover:text-red-400 hover:bg-glass-tint transition-colors"
                    title="Eliminar borrador"
                  >
                    <IconoBasura size={16} />
                  </button>

                  <Link
                    href={`/causa/nueva?id=${draft.id}`}
                    className="px-4 py-2 rounded-full bg-accent hover:bg-accent/90 text-white font-bold text-xs flex items-center gap-1 transition-all"
                  >
                    <span>Continuar</span>
                    <IconoFlechaDerecha size={14} />
                  </Link>
                </div>
              </Glass>
            ))
          ) : (
            <p className="py-8 text-center text-xs text-text-secondary">
              No tienes ningún borrador pendiente.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
