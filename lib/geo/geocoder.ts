import mundoData from "./mundo.json";

export interface GeocodedCity {
  name: string;
  countryCode: string;
  lat: number; // Rounded to 2 decimals for privacy
  lng: number; // Rounded to 2 decimals for privacy
  region?: string;
}

export interface CitySearchResult {
  cities: GeocodedCity[];
  /** Mensaje si el proveedor externo falló. Las ciudades locales se devuelven igual. */
  remoteError: string | null;
}

export interface GeocoderProvider {
  /** Busca en todos los países; las del país preferido van primero. */
  searchCities(query: string, preferredCountry?: string): Promise<CitySearchResult>;
}

// Normalize strings for diacritic-insensitive search
function normalizeStr(s: string): string {
  return String(s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

function roundToTwoDecimals(num: number): number {
  return Math.round(num * 100) / 100;
}

const MAX_RESULTS = 10;

/**
 * Punto del país en mundo.json (redondeado a 2 decimales). Se usa como coordenada
 * cuando la persona escribe una ciudad que no está en la lista: basta para encender
 * la luz del país en el planeta y nunca expone una dirección.
 */
export function puntoDelPais(countryCode: string): { lat: number; lng: number } | null {
  const country = ((mundoData as any).countries || []).find(
    (c: { id: string }) => c.id === countryCode.toUpperCase()
  );
  if (!country || typeof country.lat !== "number" || typeof country.lng !== "number") return null;
  return { lat: roundToTwoDecimals(country.lat), lng: roundToTwoDecimals(country.lng) };
}

export class HybridGeocoder implements GeocoderProvider {
  private localCities: Array<{
    name: string;
    countryCode: string;
    lat: number;
    lng: number;
  }>;

  constructor() {
    const rawCities = (mundoData as any).cities || [];
    this.localCities = rawCities.map(
      ([cityName, countryCode, lat, lng]: [string, string, number, number]) => ({
        name: cityName,
        countryCode,
        lat: roundToTwoDecimals(lat),
        lng: roundToTwoDecimals(lng),
      })
    );
  }

  async searchCities(query: string, preferredCountry?: string): Promise<CitySearchResult> {
    const qNorm = normalizeStr(query);
    if (!qNorm || qNorm.length < 2) return { cities: [], remoteError: null };

    const preferred = (preferredCountry || "").toUpperCase();
    const results: GeocodedCity[] = [];
    const seen = new Set<string>();
    // Ciudades homónimas se distinguen por país y región (Madrid · Iowa / Madrid · Nebraska)
    // Si la misma ciudad llega sin región (lista local) y con región (proveedor), queda una sola.
    const push = (city: GeocodedCity) => {
      const base = `${normalizeStr(city.name)}-${city.countryCode.toLowerCase()}`;
      const key = `${base}-${normalizeStr(city.region || "")}`;
      if (seen.has(key)) return;
      const sinRegion = results.findIndex(
        (c) => !c.region && `${normalizeStr(c.name)}-${c.countryCode.toLowerCase()}` === base
      );
      if (city.region && sinRegion >= 0) {
        seen.add(key);
        results[sinRegion] = city;
        return;
      }
      if (!city.region && results.some((c) => `${normalizeStr(c.name)}-${c.countryCode.toLowerCase()}` === base)) {
        return;
      }
      seen.add(key);
      results.push(city);
    };
    // Las del país elegido primero; el resto conserva el orden del proveedor
    const ordenados = () => {
      const propias = results.filter((c) => preferred && c.countryCode.toUpperCase() === preferred);
      const otras = results.filter((c) => !(preferred && c.countryCode.toUpperCase() === preferred));
      return [...propias, ...otras].slice(0, MAX_RESULTS);
    };

    // 1. Ciudades locales de mundo.json (instantáneo)
    for (const city of this.localCities) {
      if (normalizeStr(city.name).includes(qNorm)) push({ ...city });
    }

    // 2. Proveedor externo, solo en el navegador y desde 3 letras
    if (qNorm.length < 3 || typeof window === "undefined") {
      return { cities: ordenados(), remoteError: null };
    }

    const maptilerKey = process.env.NEXT_PUBLIC_MAPTILER_KEY;
    const proveedor = maptilerKey ? "MapTiler" : "Photon";
    try {
      if (maptilerKey) {
        const url = `https://api.maptiler.com/geocoding/${encodeURIComponent(
          query
        )}.json?key=${maptilerKey}&types=place&limit=10&language=es`;
        const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
        if (!res.ok) {
          const detalle = await res.text();
          console.error("Geocoder MapTiler:", res.status, detalle);
          return { cities: ordenados(), remoteError: `${proveedor} respondió ${res.status}` };
        }
        const data = await res.json();
        for (const feat of data.features || []) {
          const name = feat.text || feat.place_name?.split(",")[0] || "";
          const [lng, lat] = feat.center || [];
          const country =
            feat.context?.find((c: any) => c.id?.startsWith("country"))?.short_code?.toUpperCase() || "";
          if (name && typeof lat === "number" && typeof lng === "number") {
            push({
              name,
              countryCode: country,
              lat: roundToTwoDecimals(lat),
              lng: roundToTwoDecimals(lng),
              region: feat.context?.find((c: any) => c.id?.startsWith("subdivision"))?.text,
            });
          }
        }
      } else {
        // Photon (OpenStreetMap). No acepta lang=es (responde 400). Se piden 15 de todos los
        // países y luego se ordenan con las del país elegido primero.
        const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(
          query
        )}&osm_tag=place:city&osm_tag=place:town&osm_tag=place:village&limit=15`;
        const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
        if (!res.ok) {
          const detalle = await res.text();
          console.error("Geocoder Photon:", res.status, detalle);
          return { cities: ordenados(), remoteError: `${proveedor} respondió ${res.status}` };
        }
        const data = await res.json();
        for (const feat of data.features || []) {
          const props = feat.properties || {};
          const featCountryCode = String(props.countrycode || "").toUpperCase();
          const [lng, lat] = feat.geometry?.coordinates || [];
          if (props.name && typeof lat === "number" && typeof lng === "number") {
            push({
              name: props.name,
              countryCode: featCountryCode,
              lat: roundToTwoDecimals(lat),
              lng: roundToTwoDecimals(lng),
              region: props.state || props.county,
            });
          }
        }
      }
      return { cities: ordenados(), remoteError: null };
    } catch (err: any) {
      console.error(`Geocoder ${proveedor}:`, err?.name, err?.message);
      const motivo =
        err?.name === "TimeoutError" ? "no respondió a tiempo" : err?.message || "error de conexión";
      return { cities: ordenados(), remoteError: `${proveedor}: ${motivo}` };
    }
  }
}

export const defaultGeocoder = new HybridGeocoder();
