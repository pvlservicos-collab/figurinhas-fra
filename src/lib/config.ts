import { getDb } from "./db";
import { DEFAULT_CONFIG, SiteConfig } from "./config-defaults";

export type { SiteConfig };
export { DEFAULT_CONFIG };

let cache: { data: SiteConfig; ts: number } | null = null;
const CACHE_TTL_MS = 60_000;

export async function getConfig(): Promise<SiteConfig> {
  if (cache && Date.now() - cache.ts < CACHE_TTL_MS) return cache.data;

  try {
    const sql = getDb();
    const rows = await sql`SELECT data FROM site_config WHERE id = 1 LIMIT 1`;
    if (rows.length > 0 && rows[0].data) {
      const data = { ...DEFAULT_CONFIG, ...rows[0].data } as SiteConfig;
      cache = { data, ts: Date.now() };
      return data;
    }
  } catch {
    // Table may not exist yet — fall through to default
  }

  return DEFAULT_CONFIG;
}

export async function saveConfig(partial: Partial<SiteConfig>): Promise<SiteConfig> {
  const current = await getConfig();
  const next = { ...current, ...partial };

  const sql = getDb();
  await sql`
    INSERT INTO site_config (id, data, updated_at)
    VALUES (1, ${JSON.stringify(next)}::jsonb, now())
    ON CONFLICT (id) DO UPDATE
      SET data = ${JSON.stringify(next)}::jsonb, updated_at = now()
  `;

  cache = { data: next, ts: Date.now() };
  return next;
}
