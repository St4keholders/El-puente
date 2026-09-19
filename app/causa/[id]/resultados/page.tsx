"use client";

import React, { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  IconoEstrellas,
  IconoSubir,
  IconoBasura,
  IconoCheckCirculo,
  IconoAlerta,
  IconoFlechaIzquierda,
  IconoCargando,
} from "@/components/iconos";
import { Glass } from "@/components/ui/Glass";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/lib/hooks/useUser";
import { compressImageToWebP, validateVideo } from "@/lib/utils/media";

interface ResultsMediaItem {
  id?: string;
  storage_path: string;
  kind: "imagen" | "video";
  position: number;
  previewUrl: string;
  isUploading?: boolean;
}

export default function PublicarResultadosPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const { user, loading: userLoading } = useUser();
  const supabase = createClient();

  const [cause, setCause] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Form states
  const [amountReceived, setAmountReceived] = useState<number | "">("");
  const [currency, setCurrency] = useState("USD");
  const [summary, setSummary] = useState("");
  const [mediaList, setMediaList] = useState<ResultsMediaItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (userLoading) return;
    if (!user) {
      router.push(`/entrar?next=/causa/${id}/resultados`);
      return;
    }

    async function loadCause() {
      const { data, error } = await supabase
        .from("causes")
        .select("*")
        .eq("id", id)
        .single();

      if (error || !data) {
        alert("Causa no encontrada");
        router.push("/explorar");
        return;
      }

      if (data.author_id !== user!.id) {
        alert("No tienes permiso para gestionar los resultados de esta causa.");
        router.push(`/causa/${id}`);
        return;
      }

      setCause(data);
      setCurrency(data.currency || "USD");
      if (data.raised_reported) {
        setAmountReceived(data.raised_reported);
      }

      // Check if results already exist
      const { data: existingResults } = await supabase
        .from("cause_results")
        .select("*")
        .eq("cause_id", id)
        .single();

      if (existingResults) {
        setAmountReceived(existingResults.amount_received);
        setCurrency(existingResults.currency);
        setSummary(existingResults.summary);
      }

      // Load existing results media
      const { data: existingMedia } = await supabase
        .from("cause_media")
        .select("*")
        .eq("cause_id", id)
        .eq("phase", "resultado")
        .order("position", { ascending: true });

      if (existingMedia && existingMedia.length > 0) {
        setMediaList(
          existingMedia.map((m) => ({
            id: m.id,
            storage_path: m.storage_path,
            kind: m.kind,
            position: m.position,
            previewUrl: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${m.bucket}/${m.storage_path}`,
          }))
        );
      }

      setLoading(false);
    }

    loadCause();
  }, [id, user, userLoading]);

  // Upload results media
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length || !cause || !user) return;

    if (fileInputRef.current) fileInputRef.current.value = "";

    for (const file of files) {
      const isVideo = file.type.startsWith("video/");
      const isImage = file.type.startsWith("image/");
      if (!isImage && !isVideo) continue;

      const tempId = crypto.randomUUID();
      const nextPos = mediaList.length;

      setMediaList((prev) => [
        ...prev,
        {
          id: tempId,
          storage_path: "",
          kind: isVideo ? "video" : "imagen",
          position: nextPos,
          previewUrl: URL.createObjectURL(file),
          isUploading: true,
        },
      ]);

      try {
        if (isVideo) {
          const validated = await validateVideo(file);
          const ext = file.name.split(".").pop() || "mp4";
          const storagePath = `${user.id}/${cause.id}/res_${crypto.randomUUID()}.${ext}`;

          const { error: uploadErr } = await supabase.storage
            .from("causas-videos")
            .upload(storagePath, validated.file);
          if (uploadErr) throw uploadErr;

          const { data: dbItem, error: dbErr } = await supabase
            .from("cause_media")
            .insert({
              cause_id: cause.id,
              owner_id: user.id,
              storage_path: storagePath,
              bucket: "causas-videos",
              kind: "video",
              phase: "resultado",
              position: nextPos,
              width: validated.width,
              height: validated.height,
              duration_seconds: validated.duration,
            })
            .select()
            .single();

          if (dbErr) throw dbErr;

          setMediaList((prev) =>
            prev.map((m) =>
              m.id === tempId
                ? {
                    id: dbItem.id,
                    storage_path: storagePath,
                    kind: "video",
                    position: nextPos,
                    previewUrl: validated.previewUrl,
                    isUploading: false,
                  }
                : m
            )
          );
        } else {
          const processed = await compressImageToWebP(file, 2000, 0.82);
          const storagePath = `${user.id}/${cause.id}/res_${crypto.randomUUID()}.webp`;

          const { error: uploadErr } = await supabase.storage
            .from("causas-imagenes")
            .upload(storagePath, processed.blob, { contentType: "image/webp" });
          if (uploadErr) throw uploadErr;

          const { data: dbItem, error: dbErr } = await supabase
            .from("cause_media")
            .insert({
              cause_id: cause.id,
              owner_id: user.id,
              storage_path: storagePath,
              bucket: "causas-imagenes",
              kind: "imagen",
              phase: "resultado",
              position: nextPos,
              width: processed.width,
              height: processed.height,
            })
            .select()
            .single();

          if (dbErr) throw dbErr;

          setMediaList((prev) =>
            prev.map((m) =>
              m.id === tempId
                ? {
                    id: dbItem.id,
                    storage_path: storagePath,
                    kind: "imagen",
                    position: nextPos,
                    previewUrl: processed.previewUrl,
                    isUploading: false,
                  }
                : m
            )
          );
        }
      } catch (err: any) {
        alert("Error al subir archivo: " + err.message);
        setMediaList((prev) => prev.filter((m) => m.id !== tempId));
      }
    }
  };

  const handleRemoveMedia = async (index: number) => {
    const item = mediaList[index];
    if (!item) return;

    if (item.id && !item.id.startsWith("temp-")) {
      await supabase.from("cause_media").delete().eq("id", item.id);
    }
    setMediaList((prev) => prev.filter((_, i) => i !== index));
  };

  // Submit results
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const hasAfterPhoto = mediaList.some((m) => m.kind === "imagen");
    if (!hasAfterPhoto) {
      setErrorMsg("Debes subir al menos 1 foto del resultado (el 'después').");
      return;
    }

    if (typeof amountReceived !== "number" || amountReceived < 0) {
      setErrorMsg("Ingresa el monto total recibido (puede ser 0 si no se recibieron aportes).");
      return;
    }

    const trimmedSummary = summary.trim();
    if (trimmedSummary.length < 80 || trimmedSummary.length > 3000) {
      setErrorMsg("El resumen de resultados debe tener entre 80 y 3.000 caracteres.");
      return;
    }

    setIsSubmitting(true);
    try {
      // Upsert cause_results
      const { error: resultsErr } = await supabase.from("cause_results").upsert(
        {
          cause_id: cause.id,
          owner_id: user!.id,
          amount_received: amountReceived,
          currency,
          summary: trimmedSummary,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "cause_id" }
      );

      if (resultsErr) throw resultsErr;

      // Update cause status to finalizada
      const { error: causeErr } = await supabase
        .from("causes")
        .update({
          status: "finalizada",
          finalized_at: new Date().toISOString(),
          raised_reported: amountReceived,
        })
        .eq("id", cause.id);

      if (causeErr) throw causeErr;

      router.push(`/causa/${cause.id}?resultados_publicados=1`);
    } catch (err: any) {
      setErrorMsg("Error al publicar resultados: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (userLoading || loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center">
        <IconoCargando className="animate-spin text-accent mb-4" size={36} />
        <p className="text-text-secondary text-sm">Cargando causa...</p>
      </div>
    );
  }

  const hasAfterPhoto = mediaList.some((m) => m.kind === "imagen");
  const isSummaryValid = summary.length >= 80 && summary.length <= 3000;

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <Link
        href={`/causa/${id}`}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-text-secondary hover:text-text-primary mb-6 transition-colors"
      >
        <IconoFlechaIzquierda size={16} /> Volver a la causa
      </Link>

      <Glass variant="card" className="rounded-3xl p-6 sm:p-8 space-y-6">
        <div className="space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center mb-2">
            <IconoEstrellas size={24} />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-text-primary">
            Publicar Resultados de la Causa
          </h1>
          <p className="text-xs text-text-secondary">
            Causa: <strong className="text-text-primary">"{cause.title}"</strong>
          </p>
        </div>

        {errorMsg && (
          <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
            <IconoAlerta size={16} className="flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 1. Photos of Results */}
          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-text-primary block">
                Fotos y videos del resultado (el "después") *
              </label>
              <p className="text-[11px] text-text-secondary">
                Al menos 1 foto obligatoria. La primera foto se comparará con la portada original en
                el control antes/después.
              </p>
            </div>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              accept="image/*,video/mp4,video/webm,video/quicktime"
              multiple
              className="hidden"
            />

            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-glass-tint hover:border-accent/60 rounded-2xl p-6 text-center cursor-pointer transition-colors bg-glass-surface flex flex-col items-center justify-center group"
            >
              <IconoSubir size={24} className="text-accent mb-2 group-hover:scale-110 transition-transform" />
              <p className="font-semibold text-text-primary text-xs">
                Sube las fotos y videos del resultado
              </p>
            </div>

            {mediaList.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                {mediaList.map((m, idx) => (
                  <div
                    key={m.id || idx}
                    className="relative aspect-square rounded-2xl overflow-hidden glass-surface border border-glass-tint group"
                  >
                    {m.kind === "video" ? (
                      <video src={m.previewUrl} className="w-full h-full object-cover" />
                    ) : (
                      <img src={m.previewUrl} alt="" className="w-full h-full object-cover" />
                    )}

                    {idx === 0 && (
                      <span className="absolute top-1.5 left-1.5 px-2 py-0.5 rounded-md bg-emerald-500 text-white text-[9px] font-bold z-10">
                        Después principal
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={() => handleRemoveMedia(idx)}
                      className="absolute top-1.5 right-1.5 p-1 rounded-full bg-red-500/80 hover:bg-red-500 text-white z-10"
                    >
                      <IconoBasura size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 2. Amount Received */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2 space-y-1">
              <label className="text-xs font-semibold text-text-primary block">
                Monto total recibido *
              </label>
              <input
                type="number"
                min="0"
                step="any"
                required
                value={amountReceived}
                onChange={(e) =>
                  setAmountReceived(e.target.value ? Number(e.target.value) : "")
                }
                placeholder="Ej: 4200"
                className="w-full px-4 py-2.5 rounded-2xl glass-surface border border-glass-tint focus:border-accent outline-none text-text-primary text-sm"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-text-primary block">Moneda</label>
              <input
                type="text"
                disabled
                value={currency}
                className="w-full px-4 py-2.5 rounded-2xl glass-surface border border-glass-tint text-text-secondary text-sm bg-transparent"
              />
            </div>
          </div>

          {/* 3. Summary of expenditures */}
          <div className="space-y-1">
            <div className="flex justify-between items-center text-xs">
              <label className="font-semibold text-text-primary">
                Resumen de cómo se usó el dinero *
              </label>
              <span className={isSummaryValid ? "text-text-secondary" : "text-amber-400"}>
                {summary.length} / 3000 (mínimo 80)
              </span>
            </div>
            <textarea
              required
              rows={5}
              maxLength={3000}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Detalla de forma transparente cómo se invirtieron los fondos recibidos, qué materiales o atenciones se adquirieron y el impacto generado gracias a las donaciones."
              className="w-full px-4 py-3 rounded-2xl glass-surface border border-glass-tint focus:border-accent outline-none text-text-primary text-sm resize-none whitespace-pre-wrap"
            />
          </div>

          {/* Submit Action */}
          <div className="pt-4 flex items-center justify-end gap-3">
            <Link
              href={`/causa/${id}`}
              className="px-5 py-2.5 rounded-full glass-surface text-text-secondary hover:text-text-primary text-xs font-semibold"
            >
              Cancelar
            </Link>

            <button
              type="submit"
              disabled={isSubmitting || !hasAfterPhoto || !isSummaryValid}
              className="px-6 py-2.5 rounded-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-emerald-500/25"
            >
              {isSubmitting ? (
                <>
                  <IconoCargando size={14} className="animate-spin" />
                  <span>Publicando resultados...</span>
                </>
              ) : (
                <>
                  <IconoEstrellas size={14} />
                  <span>Publicar Resultados y Finalizar</span>
                </>
              )}
            </button>
          </div>
        </form>
      </Glass>
    </div>
  );
}
