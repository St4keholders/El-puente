"use client";

import React, { useState, useEffect, useRef, useTransition, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  IconoSubir,
  IconoFoto,
  IconoVideo,
  IconoMarcador,
  IconoCorazon,
  IconoTarjeta,
  IconoCheck,
  IconoFlechaDerecha,
  IconoFlechaIzquierda,
  IconoBasura,
  IconoAlerta,
  IconoCheckCirculo,
  IconoFlechaArriba,
  IconoFlechaAbajo,
  IconoEstrellas,
  IconoCopiar,
  IconoMas,
  IconoCargando,
  IconoInfo,
} from "@/components/iconos";
import { Glass } from "@/components/ui/Glass";
import { useUser } from "@/lib/hooks/useUser";
import { createClient } from "@/lib/supabase/client";
import { comprimirFotoCausa, validarVideo, generarPortadaVideo } from "@/lib/media/comprimir";
import { getUserStorageUsage, MAX_USER_STORAGE_BYTES } from "@/lib/media";
import { defaultGeocoder, GeocodedCity } from "@/lib/geo/geocoder";
import mundoData from "@/lib/geo/mundo.json";
import { CauseCard } from "@/components/feed/CauseCard";
import { initDraftAction } from "./actions";
import type { Database } from "@/lib/database.types";
import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";

type CauseCategory = Database["public"]["Enums"]["cause_category"];
type DonationMethodKind = Database["public"]["Enums"]["donation_method_kind"];

export interface WizardSupplyItem {
  id?: string;
  name: string;
  unit: string;
  quantity_needed: number | "";
  quantity_received: number;
  position: number;
}

interface MediaUploadItem {
  id?: string;
  storage_path: string;
  kind: "imagen" | "video";
  position: number;
  width?: number | null;
  height?: number | null;
  previewUrl: string;
  isUploading?: boolean;
  error?: string;
}

interface DonationMethodItem {
  id?: string;
  kind: DonationMethodKind;
  provider: string;
  account_holder: string;
  account_value: string;
  details?: string;
  position: number;
  profile_method_id?: string | null;
}

interface ProfileDonationMethod {
  id: string;
  kind: DonationMethodKind;
  provider: string;
  account_holder: string;
  account_value: string;
  details: string | null;
  position: number;
}

const CATEGORIES: Array<{ id: CauseCategory; label: string }> = [
  { id: "terremoto", label: "Terremoto" },
  { id: "inundacion", label: "Inundación" },
  { id: "incendio", label: "Incendio" },
  { id: "tormenta", label: "Tormenta / Huracán" },
  { id: "sequia", label: "Sequía" },
  { id: "salud", label: "Salud y Emergencia Médica" },
  { id: "alimentacion", label: "Alimentación y Agua" },
  { id: "vivienda", label: "Reconstrucción y Vivienda" },
  { id: "educacion", label: "Educación y Niñez" },
  { id: "otra", label: "Otra Causa Solidaria" },
];

const METHOD_KINDS: Array<{ id: DonationMethodKind; label: string }> = [
  { id: "transferencia_bancaria", label: "Transferencia Bancaria" },
  { id: "billetera_digital", label: "Billetera Digital (Nequi, Daviplata, Mercado Pago, etc.)" },
  { id: "paypal", label: "PayPal" },
  { id: "enlace_de_pago", label: "Enlace de Pago o Colecta Externa" },
  { id: "otro", label: "Otro Método" },
];

const CURRENCIES = ["USD", "EUR", "COP", "MXN", "CLP", "ARS", "PEN", "BRL"];

const PHONE_COUNTRIES = [
  { code: "CO", name: "Colombia", dial: "+57" },
  { code: "MX", name: "México", dial: "+52" },
  { code: "AR", name: "Argentina", dial: "+54" },
  { code: "CL", name: "Chile", dial: "+56" },
  { code: "PE", name: "Perú", dial: "+51" },
  { code: "EC", name: "Ecuador", dial: "+593" },
  { code: "VE", name: "Venezuela", dial: "+58" },
  { code: "ES", name: "España", dial: "+34" },
  { code: "US", name: "Estados Unidos", dial: "+1" },
  { code: "BR", name: "Brasil", dial: "+55" },
  { code: "BO", name: "Bolivia", dial: "+591" },
  { code: "UY", name: "Uruguay", dial: "+598" },
  { code: "PY", name: "Paraguay", dial: "+595" },
  { code: "CR", name: "Costa Rica", dial: "+506" },
  { code: "PA", name: "Panamá", dial: "+507" },
  { code: "GT", name: "Guatemala", dial: "+502" },
  { code: "HN", name: "Honduras", dial: "+504" },
  { code: "SV", name: "El Salvador", dial: "+503" },
  { code: "NI", name: "Nicaragua", dial: "+505" },
  { code: "DO", name: "Rep. Dominicana", dial: "+1" },
];

function NuevaCausaContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialCountry = searchParams.get("pais") || "";

  const { user, profile, hasPhone, loading: userLoading } = useUser();
  const supabase = createClient();

  // Wizard state
  const [currentStep, setCurrentStep] = useState(1);
  const [causeId, setCauseId] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [autoSaving, setAutoSaving] = useState(false);
  const [publishError, setPublishError] = useState<{ message: string; step?: number } | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);

  // Step 1: Media
  const [mediaList, setMediaList] = useState<MediaUploadItem[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step 2: Story
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<CauseCategory>("otra");
  const [description, setDescription] = useState("");
  const [hasGoal, setHasGoal] = useState(false);
  const [goalAmount, setGoalAmount] = useState<number | "">("");
  const [currency, setCurrency] = useState("USD");

  // Step 3: Location
  const [countryCode, setCountryCode] = useState(initialCountry.toUpperCase() || "CO");
  const [city, setCity] = useState("");
  const [region, setRegion] = useState("");
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [citySearchQuery, setCitySearchQuery] = useState("");
  const [citySuggestions, setCitySuggestions] = useState<GeocodedCity[]>([]);
  const [searchingCities, setSearchingCities] = useState(false);

  // Step 4: What do you need (Dinero, Insumos, Ambos)
  const [collectionType, setCollectionType] = useState<"dinero" | "insumos" | "ambas">("dinero");
  const [suppliesInstructions, setSuppliesInstructions] = useState("");
  const [suppliesList, setSuppliesList] = useState<WizardSupplyItem[]>([]);
  const [donationMethods, setDonationMethods] = useState<DonationMethodItem[]>([]);
  const [profileMethods, setProfileMethods] = useState<ProfileDonationMethod[]>([]);
  const [saveInProfile, setSaveInProfile] = useState(true);
  const [showMethodModal, setShowMethodModal] = useState(false);
  const [newMethod, setNewMethod] = useState<{
    kind: DonationMethodKind;
    provider: string;
    account_holder: string;
    account_value: string;
    details: string;
  }>({
    kind: "transferencia_bancaria",
    provider: "",
    account_holder: "",
    account_value: "",
    details: "",
  });
  const [previousMethodsAvailable, setPreviousMethodsAvailable] = useState<DonationMethodItem[]>([]);

  // Step 5: Phone requirement
  const [contactPhone, setContactPhone] = useState("");
  const [contactCountryCode, setContactCountryCode] = useState("CO");
  const [phoneError, setPhoneError] = useState<string | null>(null);

  // Countries from mundo.json
  const countries = useMemo(() => {
    return ((mundoData as any).countries || []) as Array<{
      id: string;
      n: string;
      en: string;
      lat: number;
      lng: number;
    }>;
  }, []);

  const selectedCountryObj = useMemo(
    () => countries.find((c) => c.id === countryCode),
    [countries, countryCode]
  );

  // 1. Initialize or load draft
  useEffect(() => {
    if (userLoading) return;
    if (!user) {
      router.push(`/entrar?next=/causa/nueva`);
      return;
    }

    async function initDraft() {
      try {
        setInitializing(true);
        setInitError(null);
        const draftParam = searchParams.get("draftId") || searchParams.get("id");

        const res = await initDraftAction({
          draftParam,
          defaultCountry: countryCode,
        });

        if (res.redirect) {
          router.push(res.redirect);
          return;
        }

        if (!res.success || !res.draft) {
          setInitError(res.error || "No pudimos inicializar el borrador.");
          return;
        }

        const draft = res.draft;
        setCauseId(draft.id);
        setTitle(draft.title || "");
        setCategory(draft.category || "otra");
        setDescription(draft.description || "");
        setCountryCode(draft.country_code || countryCode || "CO");
        setCity(draft.city || "");
        setRegion(draft.region || "");
        setLat(draft.lat);
        setLng(draft.lng);
        if (draft.goal_amount) {
          setHasGoal(true);
          setGoalAmount(draft.goal_amount);
        }
        setCurrency(draft.currency || "USD");
        setCollectionType(draft.collection_type || "dinero");
        setSuppliesInstructions(draft.supplies_instructions || "");

        // Load existing supplies for this draft
        if (res.supplies && res.supplies.length > 0) {
          setSuppliesList(
            res.supplies.map((s: any) => ({
              id: s.id,
              name: s.name,
              unit: s.unit || "",
              quantity_needed: s.quantity_needed ?? "",
              quantity_received: s.quantity_received || 0,
              position: s.position,
            }))
          );
        }

        // Load existing media for this draft
        if (res.media && res.media.length > 0) {
          setMediaList(
            res.media.map((m: any) => ({
              id: m.id,
              storage_path: m.storage_path,
              kind: m.kind,
              position: m.position,
              width: m.width,
              height: m.height,
              previewUrl: "",
            }))
          );
        }

        // Load existing donation methods for this draft
        if (res.methods && res.methods.length > 0) {
          setDonationMethods(
            res.methods.map((m: any) => ({
              id: m.id,
              kind: m.kind,
              provider: m.provider,
              account_holder: m.account_holder,
              account_value: m.account_value,
              details: m.details || "",
              position: m.position,
              profile_method_id: m.profile_method_id || null,
            }))
          );
        }

        // Load saved profile donation methods (Sección 6)
        if (res.profileMethods && res.profileMethods.length > 0) {
          setProfileMethods(res.profileMethods as ProfileDonationMethod[]);
        }

        // Previous methods available
        if (res.prevMethods && res.prevMethods.length > 0) {
          setPreviousMethodsAvailable(
            res.prevMethods.map((m: any) => ({
              kind: m.kind,
              provider: m.provider,
              account_holder: m.account_holder,
              account_value: m.account_value,
              details: m.details || "",
              position: m.position,
              profile_method_id: m.profile_method_id || null,
            }))
          );
        }
      } catch (err: any) {
        console.error("Error initializing draft:", err);
        setInitError(err?.message || "No se pudo inicializar el borrador.");
      } finally {
        setInitializing(false);
      }
    }

    initDraft();
  }, [user, userLoading, retryCount]);

  // 2. Debounced auto-save (800ms)
  useEffect(() => {
    if (!causeId || initializing) return;

    const timer = setTimeout(async () => {
      setAutoSaving(true);
      try {
        await supabase
          .from("causes")
          .update({
            title: title || null,
            category,
            description: description || null,
            country_code: countryCode || null,
            city: city || null,
            region: region || null,
            lat,
            lng,
            goal_amount: hasGoal && typeof goalAmount === "number" ? goalAmount : null,
            currency,
            collection_type: collectionType,
            supplies_instructions: suppliesInstructions || null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", causeId);
      } catch (err) {
        console.error("Auto-save error:", err);
      } finally {
        setAutoSaving(false);
      }
    }, 800);

    return () => clearTimeout(timer);
  }, [
    causeId,
    title,
    category,
    description,
    countryCode,
    city,
    region,
    lat,
    lng,
    hasGoal,
    goalAmount,
    currency,
    collectionType,
    suppliesInstructions,
    initializing,
  ]);

  // City autocomplete search
  useEffect(() => {
    if (!citySearchQuery || citySearchQuery.length < 2) {
      setCitySuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSearchingCities(true);
      try {
        const results = await defaultGeocoder.searchCities(citySearchQuery, countryCode);
        setCitySuggestions(results);
      } catch {
        setCitySuggestions([]);
      } finally {
        setSearchingCities(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [citySearchQuery, countryCode]);

  const handleSelectCity = (item: GeocodedCity) => {
    setCity(item.name);
    setRegion(item.region || "");
    setLat(item.lat);
    setLng(item.lng);
    setCitySearchQuery("");
    setCitySuggestions([]);
  };

  // Media file handling

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length || !causeId || !user) return;

    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = "";

    const currentImages = mediaList.filter((m) => m.kind === "imagen").length;
    const currentVideos = mediaList.filter((m) => m.kind === "video").length;

    for (const file of files) {
      const isVideo = file.type.startsWith("video/");
      const isImage = file.type.startsWith("image/");

      if (!isImage && !isVideo) continue;

      if (isImage && currentImages >= 10) {
        alert("Máximo 10 imágenes permitidas.");
        continue;
      }
      if (isVideo && currentVideos >= 1) {
        alert("Máximo 1 video permitido por causa.");
        continue;
      }

      // Check 60 MB storage quota per user (PLAN.md 7.3)
      try {
        const currentBytes = await getUserStorageUsage(user.id);
        if (currentBytes + file.size > MAX_USER_STORAGE_BYTES) {
          alert("Llegaste al límite de archivos. Elimina algo para subir más.");
          continue;
        }
      } catch {
        // Non-blocking quota check failure
      }

      const tempId = crypto.randomUUID();
      const nextPos = mediaList.length;

      // Add temporary placeholder
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
          const validated = await validarVideo(file);
          const ext = file.name.split(".").pop() || "mp4";
          const fileUuid = crypto.randomUUID();
          const storagePath = `${user.id}/${causeId}/${fileUuid}.${ext}`;
          const posterPath = `${user.id}/${causeId}/${fileUuid}_poster.webp`;

          // Generate poster
          let posterBytes = 0;
          try {
            const poster = await generarPortadaVideo(file);
            posterBytes = poster.bytes;
            await supabase.storage
              .from("causas-imagenes")
              .upload(posterPath, poster.blob, {
                cacheControl: "31536000",
                contentType: "image/webp",
                upsert: false,
              });
          } catch (e) {
            console.warn("Could not generate poster frame:", e);
          }

          const { error: uploadErr } = await supabase.storage
            .from("causas-videos")
            .upload(storagePath, validated.file, {
              cacheControl: "31536000",
              upsert: false,
            });

          if (uploadErr) throw uploadErr;

          const { data: dbItem, error: dbErr } = await supabase
            .from("cause_media")
            .insert({
              cause_id: causeId,
              owner_id: user.id,
              storage_path: storagePath,
              bucket: "causas-videos",
              kind: "video",
              phase: "causa",
              position: nextPos,
              width: validated.width,
              height: validated.height,
              duration_seconds: validated.duration,
              bytes: validated.bytes + posterBytes,
              thumb_path: posterPath,
            })
            .select()
            .single();

          if (dbErr) {
            // Cleanup on DB error
            await supabase.storage.from("causas-videos").remove([storagePath]);
            await supabase.storage.from("causas-imagenes").remove([posterPath]);
            throw dbErr;
          }

          setMediaList((prev) =>
            prev.map((m) =>
              m.id === tempId
                ? {
                    id: dbItem.id,
                    storage_path: storagePath,
                    kind: "video",
                    position: nextPos,
                    width: validated.width,
                    height: validated.height,
                    previewUrl: m.previewUrl,
                    isUploading: false,
                  }
                : m
            )
          );
        } else {
          // Compress image to 1600px + 400px thumbnail WebP (PLAN.md 7.2)
          const fileUuid = crypto.randomUUID();
          const compressed = await comprimirFotoCausa(file);
          const storagePath = `${user.id}/${causeId}/${fileUuid}.webp`;
          const thumbPath = `${user.id}/${causeId}/${fileUuid}_400.webp`;

          const { error: uploadErr } = await supabase.storage
            .from("causas-imagenes")
            .upload(storagePath, compressed.fullBlob, {
              cacheControl: "31536000",
              contentType: "image/webp",
              upsert: false,
            });

          if (uploadErr) throw uploadErr;

          // Upload thumbnail
          const { error: thumbErr } = await supabase.storage
            .from("causas-imagenes")
            .upload(thumbPath, compressed.thumbBlob, {
              cacheControl: "31536000",
              contentType: "image/webp",
              upsert: false,
            });

          if (thumbErr) {
            console.warn("Error uploading thumbnail:", thumbErr);
          }

          const { data: dbItem, error: dbErr } = await supabase
            .from("cause_media")
            .insert({
              cause_id: causeId,
              owner_id: user.id,
              storage_path: storagePath,
              bucket: "causas-imagenes",
              kind: "imagen",
              phase: "causa",
              position: nextPos,
              width: compressed.width,
              height: compressed.height,
              bytes: compressed.bytes,
              thumb_path: thumbPath,
            })
            .select()
            .single();

          if (dbErr) {
            await supabase.storage.from("causas-imagenes").remove([storagePath, thumbPath]);
            throw dbErr;
          }

          setMediaList((prev) =>
            prev.map((m) =>
              m.id === tempId
                ? {
                    id: dbItem.id,
                    storage_path: storagePath,
                    kind: "imagen",
                    position: nextPos,
                    width: compressed.width,
                    height: compressed.height,
                    previewUrl: compressed.previewUrl,
                    isUploading: false,
                  }
                : m
            )
          );
        }
      } catch (err: any) {
        console.error("Upload error:", err);
        setMediaList((prev) =>
          prev.map((m) =>
            m.id === tempId
              ? {
                  ...m,
                  isUploading: false,
                  error: err.message || "Error al subir archivo",
                }
              : m
          )
        );
      }
    }
  };

  const handleRemoveMedia = async (index: number) => {
    const item = mediaList[index];
    if (!item) return;

    if (item.id && !item.id.startsWith("temp-")) {
      await supabase.from("cause_media").delete().eq("id", item.id);
    }

    const updated = mediaList.filter((_, i) => i !== index);
    // Reindex positions
    const reindexed = updated.map((m, i) => ({ ...m, position: i }));
    setMediaList(reindexed);

    // Update positions in DB
    for (const m of reindexed) {
      if (m.id) {
        await supabase.from("cause_media").update({ position: m.position }).eq("id", m.id);
      }
    }
  };

  const handleMoveMedia = async (index: number, direction: "up" | "down") => {
    const targetIdx = direction === "up" ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= mediaList.length) return;

    const list = [...mediaList];
    const temp = list[index];
    list[index] = list[targetIdx];
    list[targetIdx] = temp;

    const reindexed = list.map((m, i) => ({ ...m, position: i }));
    setMediaList(reindexed);

    for (const m of reindexed) {
      if (m.id) {
        await supabase.from("cause_media").update({ position: m.position }).eq("id", m.id);
      }
    }
  };

  // Donation methods management
  const handleToggleProfileMethod = async (pm: ProfileDonationMethod) => {
    if (!causeId || !user) return;

    const existing = donationMethods.find(
      (m) =>
        m.profile_method_id === pm.id ||
        (m.provider === pm.provider && m.account_value === pm.account_value)
    );

    if (existing) {
      if (existing.id) {
        await supabase.from("donation_methods").delete().eq("id", existing.id);
      }
      setDonationMethods((prev) => prev.filter((m) => m !== existing));
    } else {
      if (donationMethods.length >= 5) {
        alert("Puedes agregar un máximo de 5 métodos por causa.");
        return;
      }

      const nextPos = donationMethods.length;
      const { data: created, error } = await supabase
        .from("donation_methods")
        .insert({
          cause_id: causeId,
          owner_id: user.id,
          kind: pm.kind,
          provider: pm.provider,
          account_holder: pm.account_holder,
          account_value: pm.account_value,
          details: pm.details || null,
          position: nextPos,
          profile_method_id: pm.id,
        })
        .select()
        .single();

      if (error) {
        alert("Error al vincular el método: " + error.message);
        return;
      }

      setDonationMethods((prev) => [
        ...prev,
        {
          id: created.id,
          kind: created.kind,
          provider: created.provider,
          account_holder: created.account_holder,
          account_value: created.account_value,
          details: created.details || "",
          position: nextPos,
          profile_method_id: pm.id,
        },
      ]);
    }
  };

  const handleAddDonationMethod = async () => {
    if (!newMethod.provider || !newMethod.account_holder || !newMethod.account_value) {
      alert("Por favor completa el proveedor, titular y cuenta.");
      return;
    }
    if (!causeId || !user) return;
    if (donationMethods.length >= 5) {
      alert("Puedes agregar un máximo de 5 métodos por causa.");
      return;
    }

    let profileMethodId: string | null = null;

    if (saveInProfile) {
      try {
        const { data: pmCreated, error: pmErr } = await supabase
          .from("profile_donation_methods")
          .insert({
            owner_id: user.id,
            kind: newMethod.kind,
            provider: newMethod.provider,
            account_holder: newMethod.account_holder,
            account_value: newMethod.account_value,
            details: newMethod.details || null,
            position: profileMethods.length,
          })
          .select()
          .single();

        if (!pmErr && pmCreated) {
          profileMethodId = pmCreated.id;
          setProfileMethods((prev) => [...prev, pmCreated as ProfileDonationMethod]);
        }
      } catch (e) {
        console.warn("Could not save method to profile:", e);
      }
    }

    const nextPos = donationMethods.length;
    const { data: created, error } = await supabase
      .from("donation_methods")
      .insert({
        cause_id: causeId,
        owner_id: user.id,
        kind: newMethod.kind,
        provider: newMethod.provider,
        account_holder: newMethod.account_holder,
        account_value: newMethod.account_value,
        details: newMethod.details || null,
        position: nextPos,
        profile_method_id: profileMethodId,
      })
      .select()
      .single();

    if (error) {
      alert("Error al guardar método de donación: " + error.message);
      return;
    }

    setDonationMethods((prev) => [
      ...prev,
      {
        id: created.id,
        kind: created.kind,
        provider: created.provider,
        account_holder: created.account_holder,
        account_value: created.account_value,
        details: created.details || "",
        position: nextPos,
        profile_method_id: profileMethodId,
      },
    ]);

    setNewMethod({
      kind: "transferencia_bancaria",
      provider: "",
      account_holder: "",
      account_value: "",
      details: "",
    });
    setShowMethodModal(false);
  };

  const handleRemoveDonationMethod = async (id?: string) => {
    if (!id) return;
    await supabase.from("donation_methods").delete().eq("id", id);
    setDonationMethods((prev) => prev.filter((m) => m.id !== id));
  };

  const handleCopyPreviousMethod = async (method: DonationMethodItem) => {
    if (!causeId || !user) return;
    if (donationMethods.length >= 5) {
      alert("Puedes agregar un máximo de 5 métodos por causa.");
      return;
    }
    const nextPos = donationMethods.length;
    const { data: created, error } = await supabase
      .from("donation_methods")
      .insert({
        cause_id: causeId,
        owner_id: user.id,
        kind: method.kind,
        provider: method.provider,
        account_holder: method.account_holder,
        account_value: method.account_value,
        details: method.details || null,
        position: nextPos,
        profile_method_id: method.profile_method_id || null,
      })
      .select()
      .single();

    if (!error && created) {
      setDonationMethods((prev) => [
        ...prev,
        {
          id: created.id,
          kind: created.kind,
          provider: created.provider,
          account_holder: created.account_holder,
          account_value: created.account_value,
          details: created.details || "",
          position: nextPos,
          profile_method_id: method.profile_method_id || null,
        },
      ]);
    }
  };

  // Insumos helper actions
  const handleAddSupply = () => {
    if (suppliesList.length >= 12) {
      alert("Puedes agregar un máximo de 12 insumos por causa.");
      return;
    }
    setSuppliesList((prev) => [
      ...prev,
      {
        name: "",
        unit: "unidades",
        quantity_needed: "",
        quantity_received: 0,
        position: prev.length,
      },
    ]);
  };

  const handleUpdateSupply = (
    index: number,
    field: keyof WizardSupplyItem,
    val: any
  ) => {
    setSuppliesList((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: val };
      return next;
    });
  };

  const handleMoveSupply = (index: number, direction: "up" | "down") => {
    if (
      (direction === "up" && index === 0) ||
      (direction === "down" && index === suppliesList.length - 1)
    ) {
      return;
    }
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    setSuppliesList((prev) => {
      const next = [...prev];
      const temp = next[index];
      next[index] = next[targetIndex];
      next[targetIndex] = temp;
      return next.map((item, idx) => ({ ...item, position: idx }));
    });
  };

  const handleDeleteSupply = async (index: number) => {
    const item = suppliesList[index];
    if (item.id) {
      await supabase.from("cause_supplies").delete().eq("id", item.id);
    }
    setSuppliesList((prev) =>
      prev.filter((_, idx) => idx !== index).map((s, idx) => ({ ...s, position: idx }))
    );
  };

  const handleSaveSuppliesToDb = async () => {
    if (!causeId || !user) return;
    for (const [idx, item] of suppliesList.entries()) {
      if (!item.name.trim()) continue;
      if (item.id) {
        await supabase
          .from("cause_supplies")
          .update({
            name: item.name.trim(),
            unit: item.unit.trim() || null,
            quantity_needed: typeof item.quantity_needed === "number" ? item.quantity_needed : null,
            position: idx,
          })
          .eq("id", item.id);
      } else {
        const { data: created } = await supabase
          .from("cause_supplies")
          .insert({
            cause_id: causeId,
            owner_id: user.id,
            name: item.name.trim(),
            unit: item.unit.trim() || null,
            quantity_needed: typeof item.quantity_needed === "number" ? item.quantity_needed : null,
            position: idx,
          })
          .select()
          .single();
        if (created) {
          item.id = created.id;
        }
      }
    }
  };

  // Step 5: Publish Cause Action
  const handlePublish = async () => {
    if (!causeId || !user) return;
    setPublishError(null);
    setPhoneError(null);

    // If user lacks phone, validate and save it first (Sección 6)
    if (!hasPhone) {
      const selectedCountry = PHONE_COUNTRIES.find((c) => c.code === contactCountryCode);
      const dial = selectedCountry?.dial || "+57";
      const fullPhone = contactPhone.startsWith("+")
        ? contactPhone
        : `${dial}${contactPhone.replace(/^0+/, "")}`;

      const parsed = parsePhoneNumberFromString(fullPhone, contactCountryCode as CountryCode);
      if (!parsed || !parsed.isValid()) {
        setPhoneError("Escribe un número de teléfono válido para publicar.");
        setCurrentStep(5);
        return;
      }

      const formatted = parsed.format("E.164");
      const { error: phoneErr } = await supabase
        .from("profile_private")
        .update({ phone: formatted })
        .eq("id", user.id);

      if (phoneErr) {
        setPhoneError("No se pudo guardar el teléfono: " + phoneErr.message);
        setCurrentStep(5);
        return;
      }
    }

    setIsPublishing(true);

    try {
      // Sync supplies before publishing if cause accepts supplies
      if (collectionType === "insumos" || collectionType === "ambas") {
        await handleSaveSuppliesToDb();
      }

      // Direct Postgres status update to trigger check_cause_activation
      const { error } = await supabase
        .from("causes")
        .update({
          status: "activa",
          collection_type: collectionType,
          supplies_instructions: suppliesInstructions.trim() || null,
          published_at: new Date().toISOString(),
        })
        .eq("id", causeId);

      if (error) {
        const msg = error.message || "";
        if (msg.includes("REQ_TELEFONO")) {
          setPublishError({
            message: "Agrega tu número de contacto para publicar. No se muestra públicamente.",
            step: 5,
          });
          setCurrentStep(5);
        } else if (msg.includes("REQ_IMAGENES")) {
          setPublishError({
            message: "Agrega al menos 2 fotos para publicar.",
            step: 1,
          });
          setCurrentStep(1);
        } else if (msg.includes("REQ_TITULO")) {
          setPublishError({
            message: "El título debe tener entre 10 y 90 caracteres.",
            step: 2,
          });
          setCurrentStep(2);
        } else if (msg.includes("REQ_DESCRIPCION")) {
          setPublishError({
            message: "Cuenta un poco más: la descripción necesita al menos 80 caracteres.",
            step: 2,
          });
          setCurrentStep(2);
        } else if (msg.includes("REQ_UBICACION")) {
          setPublishError({
            message: "Elige tu país y tu ciudad.",
            step: 3,
          });
          setCurrentStep(3);
        } else if (msg.includes("REQ_METODOS")) {
          setPublishError({
            message: "Agrega al menos un medio para recibir donaciones.",
            step: 4,
          });
          setCurrentStep(4);
        } else if (msg.includes("REQ_INSUMOS")) {
          setPublishError({
            message: "Agrega al menos un insumo que necesites.",
            step: 4,
          });
          setCurrentStep(4);
        } else if (msg.includes("REQ_ENTREGA")) {
          setPublishError({
            message: "Explica cómo pueden hacerte llegar los insumos.",
            step: 4,
          });
          setCurrentStep(4);
        } else if (msg.includes("REQ_PERFIL")) {
          setPublishError({
            message: "Completa tu nombre en tu perfil antes de publicar.",
          });
        } else {
          setPublishError({
            message: "Error al publicar: " + msg,
          });
        }
        return;
      }

      // Success! Navigate to the published cause page
      router.push(`/causa/${causeId}?publicada=1`);
    } catch (err: any) {
      setPublishError({ message: err.message || "Error inesperado" });
    } finally {
      setIsPublishing(false);
    }
  };

  if (userLoading || initializing) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center">
        <IconoCargando className="animate-spin text-accent mb-4" size={36} />
        <p className="text-text-secondary text-sm font-medium">Cargando borrador de causa...</p>
      </div>
    );
  }

  if (initError) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center gap-4 px-4">
        <IconoAlerta size={32} className="text-red-500" />
        <p className="text-text-secondary text-sm text-center max-w-sm">{initError}</p>
        <button
          onClick={() => {
            setInitError(null);
            setInitializing(true);
            setRetryCount((c) => c + 1);
          }}
          className="px-5 py-2.5 rounded-xl bg-accent text-white text-sm font-semibold hover:bg-accent/90 cursor-pointer"
        >
          Reintentar
        </button>
      </div>
    );
  }

  // Pre-calculate step readiness for visual feedback
  const hasMinImages = mediaList.filter((m) => m.kind === "imagen").length >= 2;
  const isTitleValid = title.length >= 10 && title.length <= 90;
  const isDescValid = description.length >= 80 && description.length <= 5000;
  const isLocationValid = Boolean(countryCode && city && lat && lng);
  const hasDonationMethod = donationMethods.length >= 1;
  const hasSupplies = suppliesList.length >= 1 && suppliesList.some((s) => s.name.trim().length >= 2);
  const hasSuppliesInstructions =
    suppliesInstructions.trim().length >= 20 && suppliesInstructions.trim().length <= 600;
  const isNeedsValid =
    collectionType === "dinero"
      ? hasDonationMethod
      : collectionType === "insumos"
      ? hasSupplies && hasSuppliesInstructions
      : hasDonationMethod && hasSupplies && hasSuppliesInstructions;
  const hasValidProfile = Boolean(profile?.full_name && profile.full_name.trim().length >= 2);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Wizard Header & Stepper */}
      <div className="mb-8 text-center">
        <h1 className="text-2xl sm:text-3xl font-bold text-text-primary tracking-tight">
          Publicar una Causa
        </h1>
        <p className="text-xs sm:text-sm text-text-secondary mt-1 max-w-md mx-auto">
          Crea tu causa comunitaria. Las donaciones llegarán directo a ti sin comisiones.
        </p>

        {/* Step Progress Pills */}
        <div className="flex items-center justify-center gap-1.5 sm:gap-3 mt-6">
          {[
            { num: 1, label: "Fotos y Videos" },
            { num: 2, label: "Historia" },
            { num: 3, label: "Ubicación" },
            { num: 4, label: "Qué necesitas" },
            { num: 5, label: "Revisar" },
          ].map((s) => (
            <button
              key={s.num}
              onClick={() => setCurrentStep(s.num)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                currentStep === s.num
                  ? "bg-accent text-white shadow-lg shadow-accent/20"
                  : currentStep > s.num
                  ? "bg-glass-tint text-accent border border-accent/30"
                  : "bg-glass-surface text-text-secondary opacity-60"
              }`}
            >
              <span className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] bg-black/20">
                {currentStep > s.num ? <IconoCheck size={10} /> : s.num}
              </span>
              <span className="hidden md:inline">{s.label}</span>
            </button>
          ))}
        </div>

        {autoSaving && (
          <div className="mt-2 text-[11px] text-text-secondary flex items-center justify-center gap-1">
            <IconoCargando size={12} className="animate-spin text-accent" />
            <span>Guardando borrador...</span>
          </div>
        )}
      </div>

      {/* Global Publish Error Banner */}
      {publishError && (
        <div className="mb-6 p-4 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-start gap-3 text-red-400">
          <IconoAlerta size={20} className="flex-shrink-0 mt-0.5" />
          <div className="flex-1 text-sm">
            <p className="font-semibold">{publishError.message}</p>
            {publishError.step && (
              <button
                onClick={() => setCurrentStep(publishError.step!)}
                className="underline text-xs mt-1 font-medium block"
              >
                Ir al paso {publishError.step} para corregir
              </button>
            )}
            {publishError.message.includes("perfil") && (
              <Link href="/ajustes" className="underline text-xs mt-1 font-medium block">
                Completar mi perfil ahora →
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Step Panels */}
      <div className="glass-card rounded-3xl p-6 sm:p-8">
        {/* ================= STEP 1: PHOTOS & VIDEOS ================= */}
        {currentStep === 1 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-text-primary">Paso 1 · Fotos y Videos</h2>
              <p className="text-xs text-text-secondary mt-1">
                Sube entre 2 y 10 fotos (JPG, PNG, WebP) y hasta 2 videos (máximo 90s y 50 MB).
                La primera imagen será la portada. Las fotos se optimizan y se borran sus metadatos
                EXIF/GPS por privacidad.
              </p>
            </div>

            {/* Hidden file input */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              accept="image/*,video/mp4,video/webm,video/quicktime"
              multiple
              className="hidden"
            />

            {/* Drag and drop upload zone */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-glass-tint hover:border-accent/60 rounded-3xl p-8 text-center cursor-pointer transition-colors bg-glass-surface flex flex-col items-center justify-center group"
            >
              <div className="w-14 h-14 rounded-2xl bg-accent/10 flex items-center justify-center text-accent mb-3 group-hover:scale-110 transition-transform">
                <IconoSubir size={28} />
              </div>
              <p className="font-semibold text-text-primary text-sm">
                Toca o arrastra tus archivos aquí
              </p>
              <p className="text-xs text-text-secondary mt-1">
                Al menos 2 fotos requeridas para publicar
              </p>
            </div>

            {/* Media list grid */}
            {mediaList.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs text-text-secondary">
                  <span>{mediaList.length} archivos añadidos</span>
                  <span>Usa las flechas para reordenar (el 1° es la portada)</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {mediaList.map((item, idx) => (
                    <div
                      key={item.id || idx}
                      className="relative aspect-[4/5] rounded-2xl overflow-hidden glass-surface border border-glass-tint group"
                    >
                      {item.kind === "video" ? (
                        <video
                          src={
                            item.previewUrl ||
                            `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/causas-videos/${item.storage_path}`
                          }
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <img
                          src={
                            item.previewUrl ||
                            `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/causas-imagenes/${item.storage_path}`
                          }
                          alt={`Medio ${idx + 1}`}
                          className="w-full h-full object-cover"
                        />
                      )}

                      {/* Cover badge */}
                      {idx === 0 && (
                        <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-accent text-white text-[10px] font-bold z-10 shadow-md">
                          Portada
                        </span>
                      )}

                      {/* Video indicator badge */}
                      {item.kind === "video" && (
                        <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded-md bg-black/60 text-white text-[10px] font-medium z-10 flex items-center gap-1">
                          <IconoVideo size={12} /> Video
                        </span>
                      )}

                      {/* Uploading overlay */}
                      {item.isUploading && (
                        <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-white z-20">
                          <IconoCargando size={24} className="animate-spin mb-1 text-accent" />
                          <span className="text-[10px]">Optimizando...</span>
                        </div>
                      )}

                      {/* Action buttons */}
                      <div className="absolute top-2 right-2 flex flex-col gap-1 z-10 opacity-90 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleRemoveMedia(idx)}
                          className="p-1.5 rounded-full bg-red-500/80 hover:bg-red-500 text-white"
                          title="Eliminar"
                        >
                          <IconoBasura size={13} />
                        </button>
                        {idx > 0 && (
                          <button
                            onClick={() => handleMoveMedia(idx, "up")}
                            className="p-1.5 rounded-full bg-black/60 hover:bg-black/80 text-white"
                            title="Mover arriba"
                          >
                            <IconoFlechaArriba size={13} />
                          </button>
                        )}
                        {idx < mediaList.length - 1 && (
                          <button
                            onClick={() => handleMoveMedia(idx, "down")}
                            className="p-1.5 rounded-full bg-black/60 hover:bg-black/80 text-white"
                            title="Mover abajo"
                          >
                            <IconoFlechaAbajo size={13} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Validation helper */}
            <div
              className={`p-3 rounded-2xl flex items-center gap-2 text-xs ${
                hasMinImages
                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                  : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
              }`}
            >
              {hasMinImages ? <IconoCheckCirculo size={16} /> : <IconoAlerta size={16} />}
              <span>
                {hasMinImages
                  ? "¡Listo! Cumples con el requisito mínimo de 2 fotos."
                  : "Recuerda: se requieren mínimo 2 fotos para activar la causa."}
              </span>
            </div>
          </div>
        )}

        {/* ================= STEP 2: YOUR STORY ================= */}
        {currentStep === 2 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-text-primary">Paso 2 · Tu Historia</h2>
              <p className="text-xs text-text-secondary mt-1">
                Cuenta de manera clara qué ocurrió y qué se necesita. La honestidad y los detalles
                generan confianza en quienes donan.
              </p>
            </div>

            {/* Title */}
            <div>
              <div className="flex justify-between items-center text-xs mb-1.5">
                <label className="font-semibold text-text-primary">Título de la causa *</label>
                <span className={title.length < 10 || title.length > 90 ? "text-amber-400" : "text-text-secondary"}>
                  {title.length} / 90 (mínimo 10)
                </span>
              </div>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={90}
                placeholder="Ej: Ayuda para reconstruir la vivienda familiar tras inundación"
                className="w-full px-4 py-3 rounded-2xl glass-surface border border-glass-tint focus:border-accent outline-none text-text-primary text-sm"
              />
            </div>

            {/* Category selection */}
            <div>
              <label className="font-semibold text-text-primary text-xs block mb-2">
                Categoría *
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategory(cat.id)}
                    className={`p-3 rounded-2xl flex flex-col items-center justify-center text-center transition-all border ${
                      category === cat.id
                        ? "bg-accent/20 border-accent text-accent font-semibold shadow-md"
                        : "glass-surface border-glass-tint text-text-secondary hover:text-text-primary hover:border-glass-tint/80"
                    }`}
                  >
                    <span className="text-xs font-medium">{cat.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Description */}
            <div>
              <div className="flex justify-between items-center text-xs mb-1.5">
                <label className="font-semibold text-text-primary">Descripción completa *</label>
                <span
                  className={
                    description.length < 80 || description.length > 5000
                      ? "text-amber-400"
                      : "text-text-secondary"
                  }
                >
                  {description.length} / 5000 (mínimo 80)
                </span>
              </div>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={6}
                maxLength={5000}
                placeholder="Explica qué sucedió, a quiénes afecta, qué se necesita con urgencia y cómo se utilizarán los aportes. Cuanta más transparencia brindes, mayor respaldo recibirás."
                className="w-full px-4 py-3 rounded-2xl glass-surface border border-glass-tint focus:border-accent outline-none text-text-primary text-sm whitespace-pre-wrap resize-y"
              />
            </div>

            {/* Goal Amount (Optional, only if includes money) */}
            {(collectionType === "dinero" || collectionType === "ambas") && (
              <div className="p-4 rounded-2xl glass-surface border border-glass-tint space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold text-text-primary text-sm">
                      ¿Deseas definir una meta económica?
                    </h4>
                    <p className="text-xs text-text-secondary">
                      Opcional. Si la activas, se mostrará una barra de progreso.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setHasGoal(!hasGoal)}
                    className={`w-12 h-6 rounded-full transition-colors relative ${
                      hasGoal ? "bg-accent" : "bg-glass-tint"
                    }`}
                  >
                    <span
                      className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${
                        hasGoal ? "translate-x-6" : ""
                      }`}
                    />
                  </button>
                </div>

                {hasGoal && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    <div>
                      <label className="text-xs text-text-secondary block mb-1">Monto de la meta</label>
                      <input
                        type="number"
                        min="1"
                        step="any"
                        value={goalAmount}
                        onChange={(e) => setGoalAmount(e.target.value ? Number(e.target.value) : "")}
                        placeholder="Ej: 5000"
                        className="w-full px-4 py-2.5 rounded-xl glass-surface border border-glass-tint focus:border-accent outline-none text-text-primary text-sm"
                      />
                    </div>

                    <div>
                      <label className="text-xs text-text-secondary block mb-1">Moneda</label>
                      <select
                        value={currency}
                        onChange={(e) => setCurrency(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl glass-surface border border-glass-tint focus:border-accent outline-none text-text-primary text-sm bg-transparent"
                      >
                        {CURRENCIES.map((c) => (
                          <option key={c} value={c} className="bg-background text-text-primary">
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ================= STEP 3: LOCATION ================= */}
        {currentStep === 3 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-text-primary">Paso 3 · Ubicación</h2>
              <p className="text-xs text-text-secondary mt-1">
                Indica el país y la ciudad donde ocurre la causa. Por tu seguridad y privacidad,
                nunca pedimos dirección exacta ni calle.
              </p>
            </div>

            {/* Privacy notice */}
            <div className="p-4 rounded-2xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-start gap-3 text-xs">
              <IconoInfo size={18} className="flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Por tu seguridad solo mostramos tu ciudad.</p>
                <p className="mt-0.5 opacity-90">
                  Las coordenadas se redondean al centro de la localidad para ubicar la luz en el
                  planeta sin exponer tu domicilio.
                </p>
              </div>
            </div>

            {/* Country Selector */}
            <div>
              <label className="font-semibold text-text-primary text-xs block mb-1.5">País *</label>
              <select
                value={countryCode}
                onChange={(e) => {
                  setCountryCode(e.target.value);
                  setCity("");
                  setLat(null);
                  setLng(null);
                }}
                className="w-full px-4 py-3 rounded-2xl glass-surface border border-glass-tint focus:border-accent outline-none text-text-primary text-sm bg-transparent"
              >
                {countries.map((c) => (
                  <option key={c.id} value={c.id} className="bg-background text-text-primary">
                    {c.n} ({c.id})
                  </option>
                ))}
              </select>
            </div>

            {/* City Autocomplete */}
            <div className="relative">
              <label className="font-semibold text-text-primary text-xs block mb-1.5">
                Ciudad o Localidad *
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={city ? `${city}${region ? `, ${region}` : ""}` : citySearchQuery}
                  onChange={(e) => {
                    setCity("");
                    setLat(null);
                    setLng(null);
                    setCitySearchQuery(e.target.value);
                  }}
                  placeholder={`Escribe para buscar ciudad en ${selectedCountryObj?.n || "el país"}...`}
                  className="w-full pl-10 pr-4 py-3 rounded-2xl glass-surface border border-glass-tint focus:border-accent outline-none text-text-primary text-sm"
                />
                <IconoMarcador
                  size={18}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-secondary"
                />
                {searchingCities && (
                  <IconoCargando
                    size={16}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 animate-spin text-accent"
                  />
                )}
              </div>

              {/* Suggestions Dropdown */}
              {citySuggestions.length > 0 && !city && (
                <div className="absolute left-0 right-0 top-full mt-2 rounded-2xl glass-tint border border-glass-tint shadow-2xl z-30 overflow-hidden py-1">
                  {citySuggestions.map((item, idx) => (
                    <button
                      key={`${item.name}-${idx}`}
                      type="button"
                      onClick={() => handleSelectCity(item)}
                      className="w-full px-4 py-2.5 text-left text-xs hover:bg-glass-tint flex items-center justify-between text-text-primary transition-colors"
                    >
                      <span className="font-medium">
                        {item.name}
                        {item.region ? `, ${item.region}` : ""}
                      </span>
                      <span className="text-[10px] text-text-secondary font-mono">
                        {item.lat.toFixed(2)}°, {item.lng.toFixed(2)}°
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Selected Location Confirmation */}
            {city && lat && lng && (
              <div className="p-4 rounded-2xl glass-surface border border-emerald-500/30 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <IconoCheckCirculo size={16} className="text-emerald-400" />
                  <div>
                    <p className="font-semibold text-text-primary">
                      {city}, {selectedCountryObj?.n}
                    </p>
                    <p className="text-text-secondary text-[11px]">
                      Centroide: {lat.toFixed(2)}°, {lng.toFixed(2)}°
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setCity("");
                    setLat(null);
                    setLng(null);
                  }}
                  className="text-accent underline hover:text-accent/80"
                >
                  Cambiar
                </button>
              </div>
            )}
          </div>
        )}

        {/* ================= STEP 4: WHAT DO YOU NEED ================= */}
        {currentStep === 4 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-text-primary">
                Paso 4 · Qué necesitas
              </h2>
              <p className="text-xs text-text-secondary mt-1">
                Elige qué tipo de ayuda necesitas recibir para esta causa: dinero, insumos en especie o ambos.
              </p>
            </div>

            {/* Selector de tipo de recolección */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                {
                  id: "dinero" as const,
                  title: "Dinero",
                  desc: "Recibe fondos mediante transferencias bancarias o billeteras digitales.",
                  icon: "💳",
                },
                {
                  id: "insumos" as const,
                  title: "Insumos",
                  desc: "Recibe víveres, ropa, colchonetas, materiales o medicinas.",
                  icon: "📦",
                },
                {
                  id: "ambas" as const,
                  title: "Ambos",
                  desc: "Permite recibir tanto apoyo económico como donaciones en especie.",
                  icon: "🤝",
                },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setCollectionType(opt.id)}
                  className={`p-4 rounded-2xl border text-left transition-all ${
                    collectionType === opt.id
                      ? "bg-accent/15 border-accent text-text-primary shadow-md"
                      : "glass-surface border-glass-tint hover:border-glass-tint/80 text-text-secondary"
                  }`}
                >
                  <div className="text-2xl mb-2">{opt.icon}</div>
                  <div className="font-bold text-sm text-text-primary">{opt.title}</div>
                  <div className="text-xs text-text-secondary mt-1 leading-snug">{opt.desc}</div>
                </button>
              ))}
            </div>

            {/* SECCIÓN DINERO */}
            {(collectionType === "dinero" || collectionType === "ambas") && (
              <div className="space-y-4 pt-2 border-t border-[var(--line)]">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="text-base font-bold text-text-primary flex items-center gap-2">
                      <IconoTarjeta size={18} className="text-accent" />
                      Métodos para recibir donaciones en dinero
                    </h3>
                    <p className="text-xs text-text-secondary mt-0.5">
                      Registra entre 1 y 5 canales donde quienes quieran ayudarte te transferirán directamente.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowMethodModal(true)}
                    className="px-4 py-2 rounded-full bg-accent text-white text-xs font-semibold flex items-center gap-1.5 hover:bg-accent/90 shadow-md shadow-accent/20 self-start"
                  >
                    <IconoMas size={16} /> Añadir método
                  </button>
                </div>

                {/* Safety Warning */}
                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-start gap-3 text-xs">
                  <IconoAlerta size={18} className="flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">Revisa bien estos datos.</p>
                    <p className="mt-0.5 opacity-90">
                      Las donaciones llegan directamente a tus cuentas. Puente no recibe, no retiene y no cobra comisión sobre ninguna donación.
                    </p>
                  </div>
                </div>

                {/* Profile Saved Methods selection */}
                {profileMethods.length > 0 && (
                  <div className="p-4 rounded-2xl glass-surface border border-glass-tint space-y-3">
                    <div>
                      <p className="text-xs font-semibold text-text-primary flex items-center gap-1.5">
                        <IconoTarjeta size={14} className="text-accent" />
                        Tus métodos guardados en el perfil:
                      </p>
                      <p className="text-[11px] text-text-secondary mt-0.5">
                        Marca con casilla los métodos que deseas activar en esta causa (mínimo 1, máximo 5).
                      </p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {profileMethods.map((pm) => {
                        const isChecked = donationMethods.some(
                          (m) =>
                            m.profile_method_id === pm.id ||
                            (m.provider === pm.provider && m.account_value === pm.account_value)
                        );
                        return (
                          <label
                            key={pm.id}
                            className={`p-3 rounded-xl border flex items-start gap-3 cursor-pointer transition-all ${
                              isChecked
                                ? "bg-accent/15 border-accent text-text-primary shadow-sm"
                                : "glass-tint border-glass-tint hover:border-glass-tint/80 text-text-secondary"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleToggleProfileMethod(pm)}
                              className="mt-1 rounded accent-[var(--accent)] cursor-pointer"
                            />
                            <div className="min-w-0 flex-1 text-xs">
                              <div className="flex items-center gap-1.5">
                                <span className="font-semibold text-text-primary">{pm.provider}</span>
                                <span className="px-1.5 py-0.5 rounded bg-glass-tint text-[10px] uppercase font-mono text-accent">
                                  {pm.kind.replace(/_/g, " ")}
                                </span>
                              </div>
                              <div className="text-text-secondary truncate">{pm.account_holder}</div>
                              <div className="font-mono text-[11px] text-text-primary truncate">
                                {pm.account_value}
                              </div>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Option to copy from previous causes */}
                {profileMethods.length === 0 && previousMethodsAvailable.length > 0 && donationMethods.length === 0 && (
                  <div className="p-4 rounded-2xl glass-surface border border-glass-tint">
                    <p className="text-xs font-semibold text-text-primary mb-2 flex items-center gap-1.5">
                      <IconoCopiar size={14} className="text-accent" />
                      Métodos utilizados en causas anteriores:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {previousMethodsAvailable.map((prevM, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleCopyPreviousMethod(prevM)}
                          className="px-3 py-1.5 rounded-xl glass-tint border border-glass-tint hover:border-accent text-xs text-text-primary flex items-center gap-1.5 transition-all"
                        >
                          <IconoMas size={12} className="text-accent" />
                          <span>
                            {prevM.provider}: {prevM.account_value}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Current Methods List */}
                {donationMethods.length > 0 ? (
                  <div className="space-y-3">
                    {donationMethods.map((m, idx) => (
                      <div
                        key={m.id || idx}
                        className="p-4 rounded-2xl glass-surface border border-glass-tint flex items-center justify-between gap-4"
                      >
                        <div className="space-y-1 text-xs">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-text-primary text-sm">{m.provider}</span>
                            <span className="px-2 py-0.5 rounded-md bg-glass-tint text-accent text-[10px] uppercase font-semibold">
                              {METHOD_KINDS.find((k) => k.id === m.kind)?.label.split(" ")[0]}
                            </span>
                          </div>
                          <p className="text-text-secondary">
                            <span className="font-medium text-text-primary">Titular:</span> {m.account_holder}
                          </p>
                          <p className="font-mono text-text-primary">{m.account_value}</p>
                          {m.details && (
                            <p className="text-text-secondary italic text-[11px]">{m.details}</p>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveDonationMethod(m.id)}
                          className="p-2 rounded-full text-text-secondary hover:text-red-400 hover:bg-glass-tint transition-colors"
                          title="Eliminar método"
                        >
                          <IconoBasura size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-6 rounded-2xl border border-dashed border-glass-tint text-center text-text-secondary text-xs">
                    <IconoTarjeta size={24} className="mx-auto mb-1.5 opacity-40" />
                    <p>Aún no has agregado ningún método para recibir dinero.</p>
                    <p className="text-[11px] opacity-70 mt-0.5">
                      Se requiere al menos 1 método si pides dinero.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* SECCIÓN INSUMOS */}
            {(collectionType === "insumos" || collectionType === "ambas") && (
              <div className="space-y-4 pt-2 border-t border-[var(--line)]">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="text-base font-bold text-text-primary flex items-center gap-2">
                      <span>📦</span>
                      Insumos que necesitas
                    </h3>
                    <p className="text-xs text-text-secondary mt-0.5">
                      Agrega entre 1 y 12 renglones con las cosas específicas que requieres.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddSupply}
                    disabled={suppliesList.length >= 12}
                    className="px-4 py-2 rounded-full bg-accent text-white text-xs font-semibold flex items-center gap-1.5 hover:bg-accent/90 shadow-md shadow-accent/20 disabled:opacity-50 self-start"
                  >
                    <IconoMas size={16} /> Añadir insumo
                  </button>
                </div>

                {suppliesList.length > 0 ? (
                  <div className="space-y-2.5">
                    {suppliesList.map((sup, idx) => (
                      <div
                        key={sup.id || idx}
                        className="p-3 sm:p-4 rounded-2xl glass-surface border border-glass-tint flex flex-col sm:flex-row sm:items-center gap-3 text-xs"
                      >
                        <div className="flex items-center gap-1 text-text-secondary">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => handleMoveSupply(idx, "up")}
                            className="p-1 rounded hover:bg-glass-tint disabled:opacity-30"
                            title="Subir"
                            aria-label="Subir"
                          >
                            <IconoFlechaArriba size={14} />
                          </button>
                          <button
                            type="button"
                            disabled={idx === suppliesList.length - 1}
                            onClick={() => handleMoveSupply(idx, "down")}
                            className="p-1 rounded hover:bg-glass-tint disabled:opacity-30"
                            title="Bajar"
                            aria-label="Bajar"
                          >
                            <IconoFlechaAbajo size={14} />
                          </button>
                          <span className="font-mono text-[11px] w-4 text-center">{idx + 1}</span>
                        </div>

                        <div className="flex-1 min-w-0">
                          <input
                            type="text"
                            placeholder="Nombre del insumo (ej: Colchonetas, Leche en polvo) *"
                            value={sup.name}
                            maxLength={80}
                            onChange={(e) => handleUpdateSupply(idx, "name", e.target.value)}
                            className="w-full px-3 py-2 rounded-xl glass-surface border border-glass-tint text-text-primary text-xs outline-none focus:border-accent"
                          />
                        </div>

                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="1"
                            placeholder="Cant."
                            value={sup.quantity_needed}
                            onChange={(e) =>
                              handleUpdateSupply(
                                idx,
                                "quantity_needed",
                                e.target.value ? Number(e.target.value) : ""
                              )
                            }
                            className="w-20 px-3 py-2 rounded-xl glass-surface border border-glass-tint text-text-primary text-xs outline-none font-mono"
                          />

                          <input
                            type="text"
                            placeholder="Unidad (kg, cajas...)"
                            value={sup.unit}
                            maxLength={20}
                            onChange={(e) => handleUpdateSupply(idx, "unit", e.target.value)}
                            className="w-32 px-3 py-2 rounded-xl glass-surface border border-glass-tint text-text-primary text-xs outline-none"
                          />

                          <button
                            type="button"
                            onClick={() => handleDeleteSupply(idx)}
                            className="p-2 rounded-xl text-text-secondary hover:text-red-400 hover:bg-glass-tint transition-colors"
                            title="Eliminar insumo"
                          >
                            <IconoBasura size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-6 rounded-2xl border border-dashed border-glass-tint text-center text-text-secondary text-xs">
                    <span className="text-2xl mb-1 block">📦</span>
                    <p>Aún no has agregado ningún insumo a la lista.</p>
                    <button
                      type="button"
                      onClick={handleAddSupply}
                      className="mt-2 text-accent font-semibold underline text-xs"
                    >
                      + Añadir el primer insumo
                    </button>
                  </div>
                )}

                {/* Instrucciones de entrega */}
                <div className="space-y-1.5 pt-2">
                  <div className="flex justify-between items-center text-xs">
                    <label className="font-semibold text-text-primary">
                      Cómo hacer llegar los insumos *
                    </label>
                    <span
                      className={
                        suppliesInstructions.trim().length < 20 ||
                        suppliesInstructions.trim().length > 600
                          ? "text-amber-400"
                          : "text-text-secondary"
                      }
                    >
                      {suppliesInstructions.length} / 600 (mínimo 20)
                    </span>
                  </div>
                  <p className="text-[11px] text-text-secondary">
                    Privado. Solo se mostrará a personas que hayan iniciado sesión. No des una dirección exacta si prefieres coordinar por mensaje.
                  </p>
                  <textarea
                    rows={3}
                    maxLength={600}
                    value={suppliesInstructions}
                    onChange={(e) => setSuppliesInstructions(e.target.value)}
                    placeholder="Ej: Recibimos en la parroquia del barrio, de 8 a 5. Escríbeme antes por WhatsApp al número que aparece cuando inicias sesión."
                    className="w-full px-4 py-3 rounded-2xl glass-surface border border-glass-tint focus:border-accent outline-none text-text-primary text-xs whitespace-pre-wrap resize-y"
                  />
                </div>
              </div>
            )}

            {/* Modal for adding method */}
            {showMethodModal && (
              <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="glass-card rounded-3xl p-6 w-full max-w-md space-y-4 border border-glass-tint">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-bold text-text-primary">Añadir Medio de Donación</h3>
                    <button
                      onClick={() => setShowMethodModal(false)}
                      className="text-text-secondary hover:text-text-primary text-xs"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="space-y-3 text-xs">
                    <div>
                      <label className="text-text-secondary block mb-1">Tipo de método *</label>
                      <select
                        value={newMethod.kind}
                        onChange={(e) =>
                          setNewMethod({ ...newMethod, kind: e.target.value as DonationMethodKind })
                        }
                        className="w-full px-3 py-2 rounded-xl glass-surface border border-glass-tint text-text-primary outline-none bg-transparent"
                      >
                        {METHOD_KINDS.map((k) => (
                          <option key={k.id} value={k.id} className="bg-background text-text-primary">
                            {k.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-text-secondary block mb-1">
                        Proveedor o Banco (ej: Nequi, Bancolombia, BBVA, Mercado Pago, PayPal) *
                      </label>
                      <input
                        type="text"
                        value={newMethod.provider}
                        onChange={(e) => setNewMethod({ ...newMethod, provider: e.target.value })}
                        placeholder="Nombre de la entidad o app"
                        className="w-full px-3 py-2 rounded-xl glass-surface border border-glass-tint text-text-primary outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-text-secondary block mb-1">Nombre del Titular *</label>
                      <input
                        type="text"
                        value={newMethod.account_holder}
                        onChange={(e) =>
                          setNewMethod({ ...newMethod, account_holder: e.target.value })
                        }
                        placeholder="Nombre y apellido completo"
                        className="w-full px-3 py-2 rounded-xl glass-surface border border-glass-tint text-text-primary outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-text-secondary block mb-1">
                        Número de cuenta, teléfono, correo o enlace *
                      </label>
                      <input
                        type="text"
                        value={newMethod.account_value}
                        onChange={(e) =>
                          setNewMethod({ ...newMethod, account_value: e.target.value })
                        }
                        placeholder="Dato exacto para recibir la donación"
                        className="w-full px-3 py-2 rounded-xl glass-surface border border-glass-tint text-text-primary outline-none font-mono"
                      />
                    </div>

                    <div>
                      <label className="text-text-secondary block mb-1">Detalles opcionales</label>
                      <input
                        type="text"
                        value={newMethod.details}
                        onChange={(e) => setNewMethod({ ...newMethod, details: e.target.value })}
                        placeholder="Ej: Cédula para transferencias, código SWIFT, etc."
                        className="w-full px-3 py-2 rounded-xl glass-surface border border-glass-tint text-text-primary outline-none"
                      />
                    </div>

                    <label className="flex items-center gap-2 cursor-pointer pt-2">
                      <input
                        type="checkbox"
                        checked={saveInProfile}
                        onChange={(e) => setSaveInProfile(e.target.checked)}
                        className="rounded accent-[var(--accent)] cursor-pointer"
                      />
                      <span className="text-xs text-text-primary font-medium">
                        Guardarlo también en mi perfil
                      </span>
                    </label>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowMethodModal(false)}
                      className="px-4 py-2 rounded-xl glass-surface text-text-secondary text-xs font-semibold"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={handleAddDonationMethod}
                      className="px-4 py-2 rounded-xl bg-accent text-white text-xs font-semibold hover:bg-accent/90"
                    >
                      Guardar método
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================= STEP 5: REVIEW & PUBLISH ================= */}
        {currentStep === 5 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-text-primary">Paso 5 · Revisar y Publicar</h2>
              <p className="text-xs text-text-secondary mt-1">
                Así se verá tu causa en el feed principal. Verifica que todos los requisitos estén
                cumplidos antes de publicar.
              </p>
            </div>

            {/* Phone requirement in Step 5 if not saved yet (Sección 6) */}
            {!hasPhone && (
              <div className="p-5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs space-y-3">
                <div className="flex items-center gap-2 text-amber-400">
                  <IconoAlerta size={18} />
                  <h3 className="font-bold text-sm text-text-primary">
                    Tu número de contacto (privado)
                  </h3>
                </div>
                <p className="text-text-secondary leading-relaxed">
                  Lo necesitas para publicar una causa. No se muestra públicamente en tu perfil ni en la causa; solo se usa para contacto de seguridad y soporte.
                </p>

                <div className="flex flex-col sm:flex-row gap-2">
                  <select
                    value={contactCountryCode}
                    onChange={(e) => setContactCountryCode(e.target.value)}
                    className="w-full sm:w-48 px-3 py-2.5 rounded-xl glass-surface border border-glass-tint text-xs text-text-primary outline-none"
                  >
                    {PHONE_COUNTRIES.map((c) => (
                      <option key={c.code} value={c.code} className="bg-background text-text-primary">
                        {c.name} ({c.dial})
                      </option>
                    ))}
                  </select>
                  <input
                    type="tel"
                    placeholder="Número de teléfono móvil"
                    value={contactPhone}
                    onChange={(e) => {
                      setContactPhone(e.target.value);
                      setPhoneError(null);
                    }}
                    className="flex-1 px-3 py-2.5 rounded-xl glass-surface border border-glass-tint text-xs text-text-primary outline-none font-mono"
                  />
                </div>

                {phoneError && (
                  <div className="text-xs text-rose-400 font-medium">
                    {phoneError}
                  </div>
                )}
              </div>
            )}

            {/* Live Feed Card Preview */}
            <div className="py-2 flex justify-center">
              <CauseCard
                id={causeId || "preview"}
                title={title || "Título de la causa"}
                category={category}
                description={description || "Descripción detallada de la causa..."}
                status="activa"
                city={city || "Ciudad"}
                country_code={countryCode}
                country_name={selectedCountryObj?.n}
                published_at={new Date().toISOString()}
                goal_amount={hasGoal && typeof goalAmount === "number" ? goalAmount : null}
                currency={currency}
                collection_type={collectionType}
                supplies={suppliesList.map((s, idx) => ({
                  id: s.id || String(idx),
                  name: s.name,
                  quantity_needed: typeof s.quantity_needed === "number" ? s.quantity_needed : null,
                  quantity_received: s.quantity_received || 0,
                  position: idx,
                }))}
                author={{
                  id: user?.id || "preview-id",
                  full_name: profile?.full_name || "Mi Nombre",
                  username: profile?.username || "mi_usuario",
                  avatar_url: profile?.avatar_url,
                }}
                media={mediaList}
                isPreview={true}
              />
            </div>

            {/* Checklist Card */}
            <div className="p-5 rounded-2xl glass-surface border border-glass-tint space-y-3">
              <h4 className="font-semibold text-text-primary text-xs uppercase tracking-wider">
                Requisitos de Activación
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div
                  className={`flex items-center gap-2 ${
                    hasMinImages ? "text-emerald-400" : "text-amber-400"
                  }`}
                >
                  {hasMinImages ? <IconoCheck size={16} /> : <IconoAlerta size={16} />}
                  <span>Mínimo 2 fotos ({mediaList.filter((m) => m.kind === "imagen").length}/2)</span>
                </div>

                <div
                  className={`flex items-center gap-2 ${
                    isTitleValid ? "text-emerald-400" : "text-amber-400"
                  }`}
                >
                  {isTitleValid ? <IconoCheck size={16} /> : <IconoAlerta size={16} />}
                  <span>Título entre 10 y 90 caracteres ({title.length})</span>
                </div>

                <div
                  className={`flex items-center gap-2 ${
                    isDescValid ? "text-emerald-400" : "text-amber-400"
                  }`}
                >
                  {isDescValid ? <IconoCheck size={16} /> : <IconoAlerta size={16} />}
                  <span>Historia de mínimo 80 caracteres ({description.length})</span>
                </div>

                <div
                  className={`flex items-center gap-2 ${
                    isLocationValid ? "text-emerald-400" : "text-amber-400"
                  }`}
                >
                  {isLocationValid ? <IconoCheck size={16} /> : <IconoAlerta size={16} />}
                  <span>
                    Ubicación definida ({city ? `${city}, ${countryCode}` : "Sin ciudad"})
                  </span>
                </div>

                {(collectionType === "dinero" || collectionType === "ambas") && (
                  <div
                    className={`flex items-center gap-2 ${
                      hasDonationMethod ? "text-emerald-400" : "text-amber-400"
                    }`}
                  >
                    {hasDonationMethod ? <IconoCheck size={16} /> : <IconoAlerta size={16} />}
                    <span>
                      Al menos 1 método de donación ({donationMethods.length} configurados)
                    </span>
                  </div>
                )}

                {(collectionType === "insumos" || collectionType === "ambas") && (
                  <>
                    <div
                      className={`flex items-center gap-2 ${
                        hasSupplies ? "text-emerald-400" : "text-amber-400"
                      }`}
                    >
                      {hasSupplies ? <IconoCheck size={16} /> : <IconoAlerta size={16} />}
                      <span>
                        Al menos 1 insumo en la lista ({suppliesList.length} agregados)
                      </span>
                    </div>

                    <div
                      className={`flex items-center gap-2 ${
                        hasSuppliesInstructions ? "text-emerald-400" : "text-amber-400"
                      }`}
                    >
                      {hasSuppliesInstructions ? <IconoCheck size={16} /> : <IconoAlerta size={16} />}
                      <span>
                        Instrucciones de entrega ({suppliesInstructions.trim().length}/20 caracteres mín.)
                      </span>
                    </div>
                  </>
                )}

                <div
                  className={`flex items-center gap-2 ${
                    hasPhone || Boolean(contactPhone.trim()) ? "text-emerald-400" : "text-amber-400"
                  }`}
                >
                  {hasPhone || Boolean(contactPhone.trim()) ? <IconoCheck size={16} /> : <IconoAlerta size={16} />}
                  <span>
                    Teléfono de contacto privado ({hasPhone || Boolean(contactPhone.trim()) ? "Configurado" : "Falta agregar"})
                  </span>
                </div>

                <div
                  className={`flex items-center gap-2 ${
                    hasValidProfile ? "text-emerald-400" : "text-amber-400"
                  }`}
                >
                  {hasValidProfile ? <IconoCheck size={16} /> : <IconoAlerta size={16} />}
                  <span>
                    Nombre en tu perfil ({profile?.full_name || "Pendiente"})
                  </span>
                </div>
              </div>

              {!hasValidProfile && (
                <div className="pt-2 text-xs text-amber-400 flex items-center gap-1">
                  <IconoAlerta size={14} /> Tu perfil necesita un nombre completo antes de publicar.{" "}
                  <Link href="/perfil" className="underline font-semibold">
                    Completar en Perfil →
                  </Link>
                </div>
              )}
            </div>

            {/* Big Publish Button */}
            <div className="pt-4 flex flex-col items-center gap-3">
              <button
                type="button"
                onClick={handlePublish}
                disabled={isPublishing}
                className="w-full sm:w-80 py-4 rounded-full bg-accent hover:bg-accent/90 disabled:opacity-50 text-white font-bold text-sm sm:text-base transition-transform active:scale-95 shadow-xl shadow-accent/25 flex items-center justify-center gap-2"
              >
                {isPublishing ? (
                  <>
                    <IconoCargando size={18} className="animate-spin" />
                    <span>Activando causa en el planeta...</span>
                  </>
                ) : (
                  <>
                    <IconoEstrellas size={18} />
                    <span>Publicar Causa Ahora</span>
                  </>
                )}
              </button>
              <p className="text-[11px] text-text-secondary text-center">
                Al hacer clic, tu causa se activará de inmediato y encenderá la luz de tu país en el
                planeta 3D.
              </p>
            </div>
          </div>
        )}

        {/* Wizard Navigation Footer */}
        <div className="mt-8 pt-6 border-t border-glass-tint flex items-center justify-between">
          <button
            type="button"
            onClick={() => setCurrentStep((prev) => Math.max(1, prev - 1))}
            disabled={currentStep === 1}
            className="px-4 py-2 rounded-full glass-surface text-text-secondary hover:text-text-primary disabled:opacity-30 text-xs font-semibold flex items-center gap-1.5 transition-all"
          >
            <IconoFlechaIzquierda size={16} /> Anterior
          </button>

          {currentStep < 5 ? (
            <button
              type="button"
              onClick={() => setCurrentStep((prev) => Math.min(5, prev + 1))}
              className="px-5 py-2 rounded-full bg-accent text-white text-xs font-semibold flex items-center gap-1.5 hover:bg-accent/90 shadow-md shadow-accent/20 transition-all"
            >
              Siguiente <IconoFlechaDerecha size={16} />
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default function NuevaCausaPage() {
  return (
    <React.Suspense
      fallback={
        <div className="flex min-h-[70vh] items-center justify-center text-sm text-[var(--ink-2)]">
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
            <span>Cargando editor de causa...</span>
          </div>
        </div>
      }
    >
      <NuevaCausaContent />
    </React.Suspense>
  );
}
