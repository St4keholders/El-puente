import mundoData from "./mundo.json";

export interface GeocodedCity {
  name: string;
  countryCode: string;
  lat: number; // Rounded to 2 decimals for privacy
  lng: number; // Rounded to 2 decimals for privacy
  region?: string;
}

export interface GeocoderProvider {
  searchCities(query: string, countryCode?: string): Promise<GeocodedCity[]>;
}

// Normalize strings for diacritic-insensitive search
function normalizeStr(s: string): string {
  return String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function roundToTwoDecimals(num: number): number {
  return Math.round(num * 100) / 100;
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

  async searchCities(query: string, countryCode?: string): Promise<GeocodedCity[]> {
    const qNorm = normalizeStr(query);
    if (!qNorm || qNorm.length < 2) return [];

    const results: GeocodedCity[] = [];
    const seen = new Set<string>();

    // 1. Search local curated cities first (instant 0ms response)
    for (const city of this.localCities) {
      if (countryCode && city.countryCode.toUpperCase() !== countryCode.toUpperCase()) {
        continue;
      }
      const cityNameNorm = normalizeStr(city.name);
      if (cityNameNorm.includes(qNorm)) {
        const key = `${city.name.toLowerCase()}-${city.countryCode.toLowerCase()}`;
        if (!seen.has(key)) {
          seen.add(key);
          results.push({
            name: city.name,
            countryCode: city.countryCode,
            lat: city.lat,
            lng: city.lng,
          });
        }
      }
      if (results.length >= 8) break;
    }

    // 2. If results are few (< 4) and query is at least 3 chars, query Photon API
    if (results.length < 5 && qNorm.length >= 3 && typeof window !== "undefined") {
      try {
        const maptilerKey = process.env.NEXT_PUBLIC_MAPTILER_KEY;
        if (maptilerKey) {
          // MapTiler Geocoding
          let url = `https://api.maptiler.com/geocoding/${encodeURIComponent(
            query
          )}.json?key=${maptilerKey}&types=place&limit=6&language=es`;
          if (countryCode) {
            url += `&country=${encodeURIComponent(countryCode.toLowerCase())}`;
          }
          const res = await fetch(url, { signal: AbortSignal.timeout(2500) });
          if (res.ok) {
            const data = await res.json();
            for (const feat of data.features || []) {
              const name = feat.text || feat.place_name?.split(",")[0] || "";
              const [lng, lat] = feat.center || [];
              const country = feat.context?.find((c: any) => c.id?.startsWith("country"))?.short_code?.toUpperCase() || countryCode || "";
              if (name && lat !== undefined && lng !== undefined) {
                const key = `${name.toLowerCase()}-${country.toLowerCase()}`;
                if (!seen.has(key)) {
                  seen.add(key);
                  results.push({
                    name,
                    countryCode: country,
                    lat: roundToTwoDecimals(lat),
                    lng: roundToTwoDecimals(lng),
                    region: feat.context?.find((c: any) => c.id?.startsWith("subdivision"))?.text,
                  });
                }
              }
            }
          }
        } else {
          // Photon Geocoding (OpenStreetMap / Komoot, open API)
          const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(
            query
          )}&osm_tag=place:city&osm_tag=place:town&limit=6&lang=es`;
          const res = await fetch(url, { signal: AbortSignal.timeout(2500) });
          if (res.ok) {
            const data = await res.json();
            for (const feat of data.features || []) {
              const props = feat.properties || {};
              const name = props.name;
              const featCountryCode = (props.countrycode || countryCode || "").toUpperCase();
              if (countryCode && featCountryCode !== countryCode.toUpperCase()) {
                continue;
              }
              const [lng, lat] = feat.geometry?.coordinates || [];
              if (name && lat !== undefined && lng !== undefined) {
                const key = `${name.toLowerCase()}-${featCountryCode.toLowerCase()}`;
                if (!seen.has(key)) {
                  seen.add(key);
                  results.push({
                    name,
                    countryCode: featCountryCode,
                    lat: roundToTwoDecimals(lat),
                    lng: roundToTwoDecimals(lng),
                    region: props.state || props.county,
                  });
                }
              }
            }
          }
        }
      } catch {
        // Fallback gracefully to local results
      }
    }

    return results;
  }
}

export const defaultGeocoder = new HybridGeocoder();
