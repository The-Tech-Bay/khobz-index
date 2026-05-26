import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { CountryData, CountryRecord, FixtureData } from "../types";

interface FixtureManifest {
  schema_version: string;
  methodology_version: string;
  generated_at: string;
  months: string[];
  shards: string[];
}

interface FixtureContextValue {
  data: FixtureData | null;
  loading: boolean;
  error: string | null;
}

const FixtureContext = createContext<FixtureContextValue>({
  data: null,
  loading: true,
  error: null,
});

const FIXTURE_BASE = `${import.meta.env.BASE_URL}data/fixture`;

async function loadFixtureData(): Promise<FixtureData> {
  const manifestRes = await fetch(`${FIXTURE_BASE}/manifest.json`);
  if (!manifestRes.ok) {
    throw new Error(`Failed to load fixture manifest (${manifestRes.status})`);
  }
  const manifest = (await manifestRes.json()) as FixtureManifest;

  const shardResults = await Promise.all(
    manifest.shards.map(async (shard) => {
      const res = await fetch(`${FIXTURE_BASE}/${shard}`);
      if (!res.ok) {
        throw new Error(`Failed to load fixture shard ${shard} (${res.status})`);
      }
      return (await res.json()) as { countries: Record<string, CountryData> };
    }),
  );

  const countries: Record<string, CountryData> = {};
  for (const shard of shardResults) {
    Object.assign(countries, shard.countries);
  }

  return {
    schema_version: manifest.schema_version,
    methodology_version: manifest.methodology_version,
    generated_at: manifest.generated_at,
    months: manifest.months,
    countries,
  };
}

export function FixtureProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<FixtureData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadFixtureData()
      .then((fixture) => {
        if (!cancelled) {
          setData(fixture);
          setLoading(false);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo(
    () => ({ data, loading, error }),
    [data, loading, error],
  );

  return (
    <FixtureContext.Provider value={value}>{children}</FixtureContext.Provider>
  );
}

export function useFixtureData() {
  return useContext(FixtureContext);
}

export function useFixtureDataRequired(): FixtureData {
  const { data, loading, error } = useFixtureData();
  if (loading) {
    throw new Error("Fixture data still loading");
  }
  if (error || !data) {
    throw new Error(error ?? "Fixture data unavailable");
  }
  return data;
}

export function getRecordForMonthFromData(
  data: FixtureData,
  countryCode: string,
  month: string,
): CountryRecord | undefined {
  return data.countries[countryCode.toUpperCase()]?.records[month];
}
