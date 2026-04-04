/**
 * D1 database formatters — token-efficient output for database metadata and query results.
 *
 * concise=true (default): Returns only essential fields for LLM decision-making.
 * concise=false: Returns the full Cloudflare API response object.
 */

interface ConciseDatabase {
  uuid: string;
  name: string;
  version: string;
  num_tables: number;
  file_size: number;
  created_at: string;
}

interface QueryResultMeta {
  changes: number;
  duration: number;
  rows_read: number;
  rows_written: number;
}

/**
 * Formats a single D1 database for output.
 * When concise (default), strips Cloudflare metadata to essential fields.
 */
export function formatDatabase(
  db: Record<string, unknown>,
  concise: boolean = true
): ConciseDatabase | Record<string, unknown> {
  if (!concise) return db;

  return {
    uuid: String(db.uuid ?? db.id ?? ""),
    name: String(db.name ?? ""),
    version: String(db.version ?? ""),
    num_tables: Number(db.num_tables ?? 0),
    file_size: Number(db.file_size ?? 0),
    created_at: String(db.created_at ?? ""),
  };
}

/**
 * Formats an array of D1 databases.
 */
export function formatDatabases(
  dbs: Record<string, unknown>[],
  concise: boolean = true
): Array<ConciseDatabase | Record<string, unknown>> {
  return dbs.map((db) => formatDatabase(db, concise));
}

/**
 * Formats a D1 query result into a token-efficient structure.
 * Each result object from the D1 API has results[], success, and meta.
 */
export function formatQueryResult(result: Record<string, unknown>): {
  rows: unknown[];
  meta: QueryResultMeta;
} {
  const meta = (result.meta ?? {}) as Record<string, unknown>;

  return {
    rows: Array.isArray(result.results) ? result.results : [],
    meta: {
      changes: Number(meta.changes ?? 0),
      duration: Number(meta.duration ?? 0),
      rows_read: Number(meta.rows_read ?? 0),
      rows_written: Number(meta.rows_written ?? 0),
    },
  };
}
