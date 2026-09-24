"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
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
import { comprimirFotoCausa } from "@/lib/media/comprimir";
import { urlDeMedio } from "@/lib/media";
import { defaultGeocoder, GeocodedCity, puntoDelPais } from "@/lib/geo/geocoder";
import mundoData from "@/lib/geo/mundo.json";
import { CauseCard } from "@/components/feed/CauseCard";
import {
  initDraftAction,
  uploadCauseMediaAction,
  deleteCauseMediaAction,
  guardarBorradorAction,
  guardarInsumosAction,
  eliminarInsumoAction,
  agregarMetodoAction,
  quitarMetodoAction,
  reordenarMediosAction,
  guardarTelefonoAction,
  publicarCausaAction,
  type DraftFields,
} from "./actions";
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

interface NuevaCausaClientProps {
  currentUser: any;
  currentUserProfile: any;
  hasPhoneInitial: boolean;
}

function NuevaCausaContent({
  currentUser,
  currentUserProfile,
  hasPhoneInitial,
}: NuevaCausaClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialCountry = searchParams.get("pais") || "";

  const user = currentUser;
  const profile = currentUserProfile;
  const [hasPhone, setHasPhone] = useState(hasPhoneInitial);

  // Wizard state
  const [currentStep, setCurrentStep] = useState(1);
  const [causeId, setCauseId] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  // Indicador de guardado: nunca se queda girando; o guarda, o muestra el error con Reintentar
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const saveSeq = useRef(0);
  // Errores de validación por campo (se muestran debajo del campo que falta)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [advancing, setAdvancing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
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
  // Última búsqueda terminada (para mostrar "sin resultados" solo cuando ya respondió)
  const [citySearchedFor, setCitySearchedFor] = useState("");
  const [cityRemoteError, setCityRemoteError] = useState<string | null>(null);
  const citySearchSeq = useRef(0);

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

        if (!res.success) {
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
        console.error("Error initializing draft:", err?.code, err?.message);
        setInitError(err?.message || "No se pudo inicializar el borrador.");
      } finally {
        setInitializing(false);
      }
    }

    initDraft();
  }, [user, retryCount]);

  // 2. Guardado del borrador en el servidor. Devuelve true si quedó guardado.
  const draftFields: DraftFields = useMemo(
    () => ({
      title: title || null,
      category,
      description: description || null,
      country_code: countryCode || null,
      city: city || null,
      region: region || null,
      lat,
      lng,
      goal_amount: hasGoal && typeof goalAmount === "number" && goalAmount > 0 ? goalAmount : null,
      currency,
      collection_type: collectionType,
      supplies_instructions: suppliesInstructions || null,
    }),
    [title, category, description, countryCode, city, region, lat, lng, hasGoal, goalAmount, currency, collectionType, suppliesInstructions]
  );

  const guardarAhora = useCallback(async (): Promise<boolean> => {
    if (!causeId) return false;
    const seq = ++saveSeq.current;
    setSaveState("saving");
    setSaveError(null);
    try {
      const res = await guardarBorradorAction(causeId, draftFields);
      if (seq !== saveSeq.current) return res.success;
      if (!res.success) {
        console.error("Guardado del borrador:", res.code, res.error);
        setSaveState("error");
        setSaveError(res.error);
        return false;
      }
      setSaveState("saved");
      setSavedAt(res.savedAt);
      return true;
    } catch (err: any) {
      console.error("Guardado del borrador:", err?.code, err?.message);
      if (seq === saveSeq.current) {
        setSaveState("error");
        setSaveError(`No se pudo guardar el borrador: ${err?.message || "error de conexión"}`);
      }
      return false;
    }
  }, [causeId, draftFields]);

  // Guardado automático con 800 ms de espera
  const firstAutosave = useRef(true);
  useEffect(() => {
    if (!causeId || initializing) return;
    if (firstAutosave.current) {
      // Recién cargado de la base: no hay nada nuevo que guardar
      firstAutosave.current = false;
      return;
    }
    const timer = setTimeout(() => {
      guardarAhora();
    }, 800);
    return () => clearTimeout(timer);
  }, [causeId, initializing, guardarAhora]);

  // City autocomplete search
  useEffect(() => {
    const seq = ++citySearchSeq.current;
    if (!citySearchQuery || citySearchQuery.trim().length < 2) {
      setCitySuggestions([]);
      setSearchingCities(false);
      setCityRemoteError(null);
      setCitySearchedFor("");
      return;
    }

    setSearchingCities(true);
    const timer = setTimeout(async () => {
      try {
        const { cities, remoteError } = await defaultGeocoder.searchCities(citySearchQuery, countryCode);
        if (seq !== citySearchSeq.current) return; // llegó una búsqueda más nueva
        setCitySuggestions(cities);
        setCityRemoteError(remoteError);
      } catch (err: any) {
        console.error("Búsqueda de ciudades:", err?.name, err?.message);
        if (seq !== citySearchSeq.current) return;
        setCitySuggestions([]);
        setCityRemoteError(err?.message || "error desconocido");
      } finally {
        if (seq === citySearchSeq.current) {
          setSearchingCities(false);
          setCitySearchedFor(citySearchQuery);
        }
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
    setFieldErrors((prev) => ({ ...prev, city: "" }));
  };

  /**
   * Ciudad escrita a mano (pueblos que no están en la lista): se guarda el texto tal cual y
   * como coordenadas el punto del país de mundo.json, redondeado a 2 decimales.
   */
  const handleUseTypedCity = () => {
    const name = citySearchQuery.trim().replace(/\s+/g, " ").slice(0, 80);
    if (name.length < 2) return;
    const punto = puntoDelPais(countryCode);
    if (!punto) {
      setFieldErrors((prev) => ({ ...prev, city: "No tenemos la ubicación de ese país. Elige otro país." }));
      return;
    }
    setCity(name);
    setRegion("");
    setLat(punto.lat);
    setLng(punto.lng);
    setCitySearchQuery("");
    setCitySuggestions([]);
    setFieldErrors((prev) => ({ ...prev, city: "" }));
  };

  const typedCity = citySearchQuery.trim();
  const citySearchFinished = !searchingCities && citySearchedFor === citySearchQuery && typedCity.length >= 2;

  // Media file handling
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files || []);
    if (files.length > 0) {
      processFiles(files);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      processFiles(files);
    }
  };

  const processFiles = async (files: File[]) => {
    if (!files.length || !causeId || !user) return;
    if (fileInputRef.current) fileInputRef.current.value = "";

    let currentImages = mediaList.filter((m) => m.kind === "imagen" && !m.error).length;
    let currentVideos = mediaList.filter((m) => m.kind === "video" && !m.error).length;
    let nextPosition = mediaList.length;

    for (const file of files) {
      const fileName = file.name || "";
      const isVideo = file.type.startsWith("video/") || /\.(mp4|webm|mov|m4v|mkv|avi)$/i.test(fileName);
      const isImage = file.type.startsWith("image/") || /\.(jpe?g|png|webp|gif|avif|heic|heif|bmp|svg)$/i.test(fileName);

      if (!isImage && !isVideo) continue;

      if (isImage && currentImages >= 10) {
        alert("Máximo 10 imágenes permitidas.");
        continue;
      }
      if (isVideo && currentVideos >= 1) {
        alert("Máximo 1 video permitido por causa.");
        continue;
      }

      if (isImage) currentImages++;
      else currentVideos++;
      const tempId = crypto.randomUUID();
      const nextPos = nextPosition++;
      let previewUrl = "";
      try {
        previewUrl = URL.createObjectURL(file);
      } catch {
        previewUrl = "";
      }

      // Add temporary placeholder with instant local preview
      setMediaList((prev) => [
        ...prev,
        {
          id: tempId,
          storage_path: "",
          kind: isVideo ? "video" : "imagen",
          position: nextPos,
          previewUrl,
          isUploading: true,
        },
      ]);

      try {
        let fileToUpload: File | Blob = file;
        let width: number | null = null;
        let height: number | null = null;

        if (isImage) {
          try {
            // Compress on canvas if possible (removes EXIF, scales to max 1600px)
            const compressed = await comprimirFotoCausa(file);
            fileToUpload = compressed.fullFile;
            width = compressed.width;
            height = compressed.height;
          } catch (e: any) {
            // Formatos que el navegador no puede dibujar (p. ej. HEIC) se suben tal cual
            console.error("No se pudo comprimir la foto, se sube el original:", e?.name, e?.message);
            fileToUpload = file;
          }
        }

        const formData = new FormData();
        formData.append("causeId", causeId);
        formData.append("file", fileToUpload);
        formData.append("kind", isVideo ? "video" : "imagen");
        formData.append("position", String(nextPos));
        if (width) formData.append("width", String(width));
        if (height) formData.append("height", String(height));

        const res = await uploadCauseMediaAction(formData);

        if (!res.success || !res.mediaItem) {
          throw new Error(res.error || "No se pudo subir el archivo.");
        }

        const dbItem = res.mediaItem;
        setMediaList((prev) =>
          prev.map((m) =>
            m.id === tempId
              ? {
                  id: dbItem.id,
                  storage_path: dbItem.storage_path,
                  kind: dbItem.kind,
                  position: nextPos,
                  width: dbItem.width,
                  height: dbItem.height,
                  previewUrl: m.previewUrl,
                  isUploading: false,
                }
              : m
          )
        );
      } catch (err: any) {
        console.error("Upload error:", err?.code, err?.message);
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

    // Los que fallaron al subir no tienen fila en la base
    if (!item.id || item.error || item.isUploading) {
      setMediaList((prev) => prev.filter((_, i) => i !== index));
      return;
    }

    setActionError(null);
    try {
      const res = await deleteCauseMediaAction(item.id);
      if (!res.success) {
        setActionError(res.error);
        return;
      }
      setMediaList((prev) => prev.filter((m) => m.id !== item.id));
    } catch (err: any) {
      console.error("Eliminar foto:", err?.code, err?.message);
      setActionError(`No se pudo eliminar el archivo: ${err?.message || "error de conexión"}`);
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
    const previous = mediaList;
    setMediaList(reindexed);

    if (!causeId) return;
    setActionError(null);
    try {
      const res = await reordenarMediosAction(
        causeId,
        reindexed.filter((m) => m.id && !m.error && !m.isUploading).map((m) => m.id!)
      );
      if (!res.success) {
        setMediaList(previous);
        setActionError(res.error);
      }
    } catch (err: any) {
      console.error("Reordenar fotos:", err?.code, err?.message);
      setMediaList(previous);
      setActionError(`No se pudo guardar el nuevo orden: ${err?.message || "error de conexión"}`);
    }
  };

  // Donation methods management (todo pasa por el servidor y reporta el error real)
  const toMethodItem = (created: any, position: number): DonationMethodItem => ({
    id: created.id,
    kind: created.kind,
    provider: created.provider,
    account_holder: created.account_holder,
    account_value: created.account_value,
    details: created.details || "",
    position,
    profile_method_id: created.profile_method_id || null,
  });

  const addMethod = async (
    method: {
      kind: DonationMethodKind;
      provider: string;
      account_holder: string;
      account_value: string;
      details?: string | null;
      profile_method_id?: string | null;
    },
    guardarEnPerfil: boolean
  ): Promise<boolean> => {
    if (!causeId || !user) return false;
    if (donationMethods.length >= 5) {
      alert("Puedes agregar un máximo de 5 métodos por causa.");
      return false;
    }
    const nextPos = donationMethods.length;
    setActionError(null);
    try {
      const res = await agregarMetodoAction(
        causeId,
        {
          kind: method.kind,
          provider: method.provider,
          account_holder: method.account_holder,
          account_value: method.account_value,
          details: method.details || null,
          profile_method_id: method.profile_method_id || null,
        },
        nextPos,
        guardarEnPerfil
      );
      if (!res.success) {
        setActionError(res.error);
        return false;
      }
      if (res.profileMethod) {
        setProfileMethods((prev) => [...prev, res.profileMethod as ProfileDonationMethod]);
      }
      setDonationMethods((prev) => [...prev, toMethodItem(res.method, nextPos)]);
      setFieldErrors((prev) => ({ ...prev, methods: "" }));
      return true;
    } catch (err: any) {
      console.error("Agregar método:", err?.code, err?.message);
      setActionError(`No se pudo guardar el método de donación: ${err?.message || "error de conexión"}`);
      return false;
    }
  };

  const handleToggleProfileMethod = async (pm: ProfileDonationMethod) => {
    const existing = donationMethods.find(
      (m) =>
        m.profile_method_id === pm.id ||
        (m.provider === pm.provider && m.account_value === pm.account_value)
    );

    if (existing) {
      await handleRemoveDonationMethod(existing.id);
    } else {
      await addMethod({ ...pm, profile_method_id: pm.id }, false);
    }
  };

  const handleAddDonationMethod = async () => {
    if (!newMethod.provider || !newMethod.account_holder || !newMethod.account_value) {
      alert("Por favor completa el proveedor, titular y cuenta.");
      return;
    }
    const ok = await addMethod(newMethod, saveInProfile);
    if (!ok) return;

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
    setActionError(null);
    try {
      const res = await quitarMetodoAction(id);
      if (!res.success) {
        setActionError(res.error);
        return;
      }
      setDonationMethods((prev) => prev.filter((m) => m.id !== id));
    } catch (err: any) {
      console.error("Quitar método:", err?.code, err?.message);
      setActionError(`No se pudo quitar el método: ${err?.message || "error de conexión"}`);
    }
  };

  const handleCopyPreviousMethod = async (method: DonationMethodItem) => {
    await addMethod(method, false);
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
      setActionError(null);
      try {
        const res = await eliminarInsumoAction(item.id);
        if (!res.success) {
          setActionError(res.error);
          return;
        }
      } catch (err: any) {
        console.error("Eliminar insumo:", err?.code, err?.message);
        setActionError(`No se pudo eliminar el insumo: ${err?.message || "error de conexión"}`);
        return;
      }
    }
    setSuppliesList((prev) =>
      prev.filter((_, idx) => idx !== index).map((s, idx) => ({ ...s, position: idx }))
    );
  };

  /** Guarda la lista de insumos (los renglones sin nombre se descartan). */
  const guardarInsumos = async (): Promise<boolean> => {
    if (!causeId) return false;
    const conNombre = suppliesList.filter((item) => item.name.trim());
    try {
      const res = await guardarInsumosAction(
        causeId,
        conNombre.map((item) => ({
          id: item.id,
          name: item.name,
          unit: item.unit,
          quantity_needed: typeof item.quantity_needed === "number" ? item.quantity_needed : null,
        }))
      );
      if (!res.success) {
        setSaveState("error");
        setSaveError(res.error);
        return false;
      }
      setSuppliesList(conNombre.map((item, idx) => ({ ...item, id: res.ids[idx], position: idx })));
      return true;
    } catch (err: any) {
      console.error("Guardar insumos:", err?.code, err?.message);
      setSaveState("error");
      setSaveError(`No se pudieron guardar los insumos: ${err?.message || "error de conexión"}`);
      return false;
    }
  };

  // Validación de cada paso: errores debajo del campo que falta
  const includesMoney = collectionType === "dinero" || collectionType === "ambas";
  const includesSupplies = collectionType === "insumos" || collectionType === "ambas";

  const telefonoCompleto = () => {
    const selected = PHONE_COUNTRIES.find((c) => c.code === contactCountryCode);
    const full = contactPhone.startsWith("+")
      ? contactPhone
      : `${selected?.dial || "+57"}${contactPhone.replace(/^0+/, "")}`;
    const parsed = parsePhoneNumberFromString(full, contactCountryCode as CountryCode);
    return parsed && parsed.isValid() ? parsed.format("E.164") : null;
  };

  const validarPaso = (step: number): Record<string, string> => {
    const errs: Record<string, string> = {};
    if (step === 1) {
      const fotos = mediaList.filter((m) => m.kind === "imagen" && m.id && !m.error && !m.isUploading).length;
      if (mediaList.some((m) => m.isUploading)) errs.media = "Espera a que terminen de subir tus archivos.";
      else if (fotos < 2) errs.media = "Agrega al menos 2 fotos.";
    }
    if (step === 2) {
      const t = title.trim().length;
      if (t < 10 || t > 90) errs.title = "El título debe tener entre 10 y 90 caracteres.";
      if (description.trim().length < 80) errs.description = "La historia necesita al menos 80 caracteres.";
      if (!category) errs.category = "Elige una categoría.";
      if (includesMoney && hasGoal && !(typeof goalAmount === "number" && goalAmount > 0)) {
        errs.goal = "Escribe un monto mayor que 0 o desactiva la meta.";
      }
    }
    if (step === 3) {
      if (!countryCode) errs.country = "Elige tu país.";
      if (!city || lat === null || lng === null) errs.city = "Elige tu ciudad de la lista.";
    }
    if (step === 4) {
      if (includesMoney && donationMethods.length < 1) {
        errs.methods = "Agrega al menos un medio para recibir donaciones.";
      }
      if (includesSupplies) {
        if (!suppliesList.some((s) => s.name.trim().length >= 2)) errs.supplies = "Agrega al menos un insumo.";
        if (suppliesInstructions.trim().length < 20) {
          errs.suppliesInstructions = "Explica cómo pueden entregarte los insumos (mínimo 20 caracteres).";
        }
      }
    }
    if (step === 5 && !hasPhone && !telefonoCompleto()) {
      errs.phone = "Agrega tu número de contacto.";
    }
    return errs;
  };

  /** Valida y guarda el paso actual. Solo avanza si todo quedó guardado. */
  const irAPaso = async (target: number) => {
    if (target === currentStep) return;
    if (target < currentStep) {
      // Volver atrás nunca se bloquea; el paso que se deja igual se guarda
      guardarAhora();
      setFieldErrors({});
      setCurrentStep(target);
      return;
    }

    setAdvancing(true);
    try {
      for (let step = currentStep; step < target; step++) {
        const errs = validarPaso(step);
        if (Object.keys(errs).length > 0) {
          setFieldErrors(errs);
          setCurrentStep(step);
          return;
        }
        if (step === 4 && includesSupplies && !(await guardarInsumos())) {
          setCurrentStep(step);
          return;
        }
      }
      // Cada paso guarda al salir de él; si falla, no se avanza
      if (!(await guardarAhora())) return;
      setFieldErrors({});
      setCurrentStep(target);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setAdvancing(false);
    }
  };

  const PUBLISH_ERRORS: Record<string, { message: string; step: number }> = {
    REQ_IMAGENES: { message: "Agrega al menos 2 fotos.", step: 1 },
    REQ_TITULO: { message: "El título debe tener entre 10 y 90 caracteres.", step: 2 },
    REQ_DESCRIPCION: { message: "La historia necesita al menos 80 caracteres.", step: 2 },
    REQ_UBICACION: { message: "Elige tu país y tu ciudad.", step: 3 },
    REQ_METODOS: { message: "Agrega al menos un medio para recibir donaciones.", step: 4 },
    REQ_INSUMOS: { message: "Agrega al menos un insumo.", step: 4 },
    REQ_ENTREGA: { message: "Explica cómo pueden entregarte los insumos.", step: 4 },
    REQ_TELEFONO: { message: "Agrega tu número de contacto.", step: 5 },
  };

  // Step 5: Publish Cause Action
  const handlePublish = async () => {
    if (!causeId || !user) return;
    setPublishError(null);

    const errs = validarPaso(5);
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }

    setIsPublishing(true);
    try {
      // Teléfono (si falta, se pide aquí mismo)
      if (!hasPhone) {
        const phoneRes = await guardarTelefonoAction(telefonoCompleto()!);
        if (!phoneRes.success) {
          setFieldErrors({ phone: phoneRes.error });
          return;
        }
        setHasPhone(true);
      }

      // Todo lo del borrador queda guardado antes de publicar
      if (includesSupplies && !(await guardarInsumos())) {
        setPublishError({ message: "No se pudieron guardar los insumos. Revisa el aviso de arriba.", step: 4 });
        return;
      }
      if (!(await guardarAhora())) {
        setPublishError({ message: "No se pudo guardar el borrador antes de publicar. Revisa el aviso de arriba." });
        return;
      }

      const res = await publicarCausaAction(causeId);
      if (!res.success) {
        const known = res.code ? PUBLISH_ERRORS[res.code] : undefined;
        if (known) {
          setPublishError(known);
          setCurrentStep(known.step);
        } else if (res.code === "REQ_PERFIL") {
          setPublishError({ message: "Completa tu nombre en tu perfil antes de publicar." });
        } else {
          setPublishError({ message: `No se pudo publicar la causa: ${res.error}` });
        }
        return;
      }

      // Success! Navigate to the published cause page
      router.push(`/causa/${causeId}?publicada=1`);
    } catch (err: any) {
      console.error("Publicar causa:", err?.code, err?.message);
      setPublishError({ message: `No se pudo publicar la causa: ${err?.message || "error de conexión"}` });
    } finally {
      setIsPublishing(false);
    }
  };

  if (initializing) {
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

  const readyImages = mediaList.filter((m) => m.kind === "imagen" && m.id && !m.error && !m.isUploading).length;
  const hasMinImages = readyImages >= 2;

  return (
    <div className="max-w-4xl mx-auto px-4 pt-28 md:pt-32 pb-24">
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
              onClick={() => irAPaso(s.num)}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                currentStep === s.num
                  ? "bg-[var(--cta)] text-white shadow-md shadow-blue-500/25 ring-2 ring-[var(--cta)]/30 font-bold"
                  : currentStep > s.num
                  ? "bg-[var(--hover)] text-[var(--cta)] border border-[var(--cta)]/30 font-medium"
                  : "bg-[var(--field)] border border-[var(--line)] text-[var(--ink-2)] hover:text-[var(--ink)] hover:bg-[var(--hover)]"
              }`}
            >
              <span
                className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${
                  currentStep === s.num
                    ? "bg-white/20 text-white"
                    : currentStep > s.num
                    ? "bg-[var(--cta)] text-white"
                    : "bg-black/10 dark:bg-white/10 text-[var(--ink-2)]"
                }`}
              >
                {currentStep > s.num ? <IconoCheck size={10} /> : s.num}
              </span>
              <span className="hidden sm:inline">{s.label}</span>
            </button>
          ))}
        </div>

        {saveState === "saving" && (
          <div className="mt-2 text-[11px] text-text-secondary flex items-center justify-center gap-1">
            <IconoCargando size={12} className="animate-spin text-accent" />
            <span>Guardando…</span>
          </div>
        )}
        {saveState === "saved" && savedAt && (
          <div className="mt-2 text-[11px] text-text-secondary flex items-center justify-center gap-1">
            <IconoCheck size={12} className="text-emerald-400" />
            <span>
              Guardado {new Date(savedAt).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
        )}
        {saveState === "error" && (
          <div className="mt-2 text-[11px] text-rose-400 flex items-center justify-center gap-1.5">
            <IconoAlerta size={12} />
            <span>No se pudo guardar{saveError ? `: ${saveError}` : ""}</span>
            <button
              type="button"
              onClick={() => guardarAhora()}
              className="underline font-semibold cursor-pointer"
            >
              Reintentar
            </button>
          </div>
        )}
      </div>

      {actionError && (
        <div className="mb-6 p-4 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-start gap-3 text-red-400">
          <IconoAlerta size={20} className="flex-shrink-0 mt-0.5" />
          <div className="flex-1 text-sm">
            <p className="font-semibold">{actionError}</p>
          </div>
        </div>
      )}

      {/* Global Publish Error Banner */}
      {publishError && (
        <div className="mb-6 p-4 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-start gap-3 text-red-400">
          <IconoAlerta size={20} className="flex-shrink-0 mt-0.5" />
          <div className="flex-1 text-sm">
            <p className="font-semibold">{publishError.message}</p>
            {publishError.step && publishError.step !== currentStep && (
              <button
                onClick={() => setCurrentStep(publishError.step!)}
                className="underline text-xs mt-1 font-medium block"
              >
                Ir al paso {publishError.step} para corregir
              </button>
            )}
            {publishError.message.includes("perfil") && (
              <Link href="/perfil" className="underline text-xs mt-1 font-medium block">
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
                Puedes subir fotos en cualquier tamaño, proporción (vertical, horizontal o cuadrada) o resolución.
                El sistema las optimiza automáticamente. La primera foto será la portada de tu causa en el planeta.
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
              onDragOver={handleDragOver}
              onDragEnter={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-3xl p-8 text-center cursor-pointer transition-all flex flex-col items-center justify-center group ${
                isDragging
                  ? "border-[var(--cta)] bg-[var(--hover)] scale-[1.01]"
                  : "border-[var(--line-strong)] hover:border-[var(--cta)] bg-[var(--field)]"
              }`}
            >
              <div className="w-14 h-14 rounded-2xl bg-[var(--hover)] flex items-center justify-center text-[var(--cta)] mb-3 group-hover:scale-110 transition-transform">
                <IconoSubir size={28} />
              </div>
              <p className="font-semibold text-text-primary text-sm">
                Toca o arrastra tus fotos aquí
              </p>
              <p className="text-xs text-text-secondary mt-1">
                Acepta cualquier tamaño, proporción y resolución (JPG, PNG, WebP)
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
                            urlDeMedio("causas-videos", item.storage_path)
                          }
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <img
                          src={
                            item.previewUrl ||
                            urlDeMedio("causas-imagenes", item.storage_path)
                          }
                          alt={`Medio ${idx + 1}`}
                          className="w-full h-full object-cover"
                        />
                      )}

                      {/* Cover badge */}
                      {idx === 0 && (
                        <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-[var(--cta)] text-white text-[10px] font-bold z-10 shadow-md">
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
                        <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center text-white z-20">
                          <IconoCargando size={24} className="animate-spin mb-1 text-[var(--cta)]" />
                          <span className="text-[10px] font-medium">Subiendo foto...</span>
                        </div>
                      )}

                      {/* Upload error overlay */}
                      {item.error && !item.isUploading && (
                        <div className="absolute inset-0 bg-red-950/85 p-2 flex flex-col items-center justify-center text-center text-white z-20">
                          <IconoAlerta size={18} className="text-red-400 mb-1" />
                          <span className="text-[10px] text-red-200 line-clamp-2">{item.error}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveMedia(idx)}
                            className="mt-1.5 px-2 py-0.5 rounded bg-red-600/70 hover:bg-red-600 text-[10px] text-white cursor-pointer"
                          >
                            Quitar
                          </button>
                        </div>
                      )}

                      {/* Action buttons */}
                      <div className="absolute top-2 right-2 flex flex-col gap-1 z-10 opacity-90 group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={() => handleRemoveMedia(idx)}
                          className="p-1.5 rounded-full bg-red-500/80 hover:bg-red-500 text-white cursor-pointer"
                          title="Eliminar"
                        >
                          <IconoBasura size={13} />
                        </button>
                        {idx > 0 && (
                          <button
                            type="button"
                            onClick={() => handleMoveMedia(idx, "up")}
                            className="p-1.5 rounded-full bg-black/60 hover:bg-black/80 text-white cursor-pointer"
                            title="Mover arriba"
                          >
                            <IconoFlechaArriba size={13} />
                          </button>
                        )}
                        {idx < mediaList.length - 1 && (
                          <button
                            type="button"
                            onClick={() => handleMoveMedia(idx, "down")}
                            className="p-1.5 rounded-full bg-black/60 hover:bg-black/80 text-white cursor-pointer"
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
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                  : "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20"
              }`}
            >
              {hasMinImages ? <IconoCheckCirculo size={16} /> : <IconoInfo size={16} />}
              <span>
                {hasMinImages
                  ? `¡Listo! Cumples con el requisito de fotos (${readyImages} añadidas).`
                  : "Agrega al menos 2 fotos para continuar."}
              </span>
            </div>
            {fieldErrors.media && (
                <p className="text-xs text-rose-400 font-medium mt-1.5 -mt-3">{fieldErrors.media}</p>
              )}
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
              {fieldErrors.title && (
                <p className="text-xs text-rose-400 font-medium mt-1.5">{fieldErrors.title}</p>
              )}
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
              {fieldErrors.category && (
                <p className="text-xs text-rose-400 font-medium mt-1.5">{fieldErrors.category}</p>
              )}
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
              {fieldErrors.description && (
                <p className="text-xs text-rose-400 font-medium mt-1.5">{fieldErrors.description}</p>
              )}
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
                        onChange={(e) => setGoalAmount(e.target.value && Number(e.target.value) > 0 ? Number(e.target.value) : "")}
                        placeholder="Ej: 5000"
                        className="w-full px-4 py-2.5 rounded-xl glass-surface border border-glass-tint focus:border-accent outline-none text-text-primary text-sm"
                      />
                      {fieldErrors.goal && (
                <p className="text-xs text-rose-400 font-medium mt-1.5">{fieldErrors.goal}</p>
              )}
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
              {fieldErrors.country && (
                <p className="text-xs text-rose-400 font-medium mt-1.5">{fieldErrors.country}</p>
              )}
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
              {fieldErrors.city && (
                <p className="text-xs text-rose-400 font-medium mt-1.5">{fieldErrors.city}</p>
              )}

              {/* Estado de la búsqueda: nunca queda mudo */}
              {!city && typedCity.length >= 2 && searchingCities && (
                <p className="text-xs text-text-secondary mt-1.5">Buscando…</p>
              )}
              {!city && citySearchFinished && cityRemoteError && (
                <p className="text-xs text-rose-400 font-medium mt-1.5">
                  No pudimos consultar el buscador de ciudades ({cityRemoteError}).{" "}
                  <button type="button" onClick={handleUseTypedCity} className="text-accent underline hover:text-accent/80">
                    Usar «{typedCity}» tal como la escribiste
                  </button>
                </p>
              )}
              {!city && citySearchFinished && !cityRemoteError && citySuggestions.length === 0 && (
                <p className="text-xs text-text-secondary mt-1.5">
                  No encontramos esa ciudad, puedes escribirla.{" "}
                  <button type="button" onClick={handleUseTypedCity} className="text-accent underline hover:text-accent/80">
                    Usar «{typedCity}»
                  </button>
                </p>
              )}

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
                  <button
                    type="button"
                    onClick={handleUseTypedCity}
                    className="w-full px-4 py-2.5 text-left text-xs hover:bg-glass-tint flex items-center justify-between text-text-secondary transition-colors"
                  >
                    <span>¿No está? Usar «{typedCity}» tal como la escribiste</span>
                  </button>
                </div>
              )}
            </div>

            {/* Selected Location Confirmation */}
            {city && lat !== null && lng !== null && (
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
                {fieldErrors.methods && (
                <p className="text-xs text-rose-400 font-medium mt-1.5 mt-0">{fieldErrors.methods}</p>
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
                {fieldErrors.supplies && (
                <p className="text-xs text-rose-400 font-medium mt-1.5 mt-0">{fieldErrors.supplies}</p>
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
                  {fieldErrors.suppliesInstructions && (
                <p className="text-xs text-rose-400 font-medium mt-1.5 mt-0">{fieldErrors.suppliesInstructions}</p>
              )}
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
                Así se verá tu causa en el feed principal. Revisa la vista previa antes de publicar.
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
                      setFieldErrors((prev) => ({ ...prev, phone: "" }));
                    }}
                    className="flex-1 px-3 py-2.5 rounded-xl glass-surface border border-glass-tint text-xs text-text-primary outline-none font-mono"
                  />
                </div>

                {fieldErrors.phone && (
                  <div className="text-xs text-rose-400 font-medium">
                    {fieldErrors.phone}
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
                  public_id: profile?.public_id || "",
                  avatar_url: profile?.avatar_url,
                }}
                media={mediaList}
                isPreview={true}
              />
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
        <div className="mt-8 pt-6 border-t border-[var(--line)] flex items-center justify-between">
          <button
            type="button"
            onClick={() => irAPaso(Math.max(1, currentStep - 1))}
            disabled={currentStep === 1}
            className="px-5 py-2.5 rounded-full border border-[var(--line)] bg-[var(--field)] text-[var(--ink-2)] hover:text-[var(--ink)] hover:bg-[var(--hover)] disabled:opacity-30 text-sm font-semibold flex items-center gap-2 transition-all cursor-pointer disabled:cursor-not-allowed"
          >
            <IconoFlechaIzquierda size={16} /> <span>Anterior</span>
          </button>

          {currentStep < 5 ? (
            <button
              type="button"
              onClick={() => irAPaso(currentStep + 1)}
              disabled={advancing}
              className="px-6 py-2.5 rounded-full bg-[var(--cta)] text-white text-sm font-semibold flex items-center gap-2 hover:brightness-110 shadow-md shadow-blue-600/20 transition-all active:scale-95 cursor-pointer disabled:opacity-60"
            >
              <span>Siguiente</span>
              {advancing ? <IconoCargando size={16} className="animate-spin" /> : <IconoFlechaDerecha size={16} />}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function NuevaCausaClient(props: NuevaCausaClientProps) {
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
      <NuevaCausaContent {...props} />
    </React.Suspense>
  );
}
