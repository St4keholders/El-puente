import mundoData from "./mundo.json";

interface RawCountry {
  id: string;
  n: string;
}

const rawCountries: RawCountry[] = ((mundoData as any).countries || []) as RawCountry[];

const countryMap = new Map<string, string>();
rawCountries.forEach((c) => {
  if (c.id && c.n) {
    countryMap.set(c.id.toUpperCase(), c.n);
  }
});

export function getCountryName(code?: string | null): string {
  if (!code) return "";
  const upper = code.trim().toUpperCase();
  return countryMap.get(upper) || code;
}

export function getAllCountries(): Array<{ id: string; name: string }> {
  return rawCountries.map((c) => ({
    id: c.id,
    name: c.n,
  })).sort((a, b) => a.name.localeCompare(b.name, "es"));
}
