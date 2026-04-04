/**
 * KV formatters — concise mode strips unnecessary metadata
 * for token-efficient LLM output.
 */

interface ConciseNamespace {
  id: string;
  title: string;
  supports_url_encoding?: boolean;
}

/**
 * Formats a single KV namespace for output.
 */
export function formatNamespace(
  ns: Record<string, unknown>,
  concise: boolean = true
): ConciseNamespace | Record<string, unknown> {
  if (!concise) return ns;

  return {
    id: String(ns.id ?? ""),
    title: String(ns.title ?? ""),
    ...(ns.supports_url_encoding !== undefined
      ? { supports_url_encoding: Boolean(ns.supports_url_encoding) }
      : {}),
  };
}

/**
 * Formats an array of KV namespaces.
 */
export function formatNamespaces(
  namespaces: Record<string, unknown>[],
  concise: boolean = true
): Array<ConciseNamespace | Record<string, unknown>> {
  return namespaces.map((ns) => formatNamespace(ns, concise));
}

interface ConciseKeyEntry {
  name: string;
  expiration?: number;
  metadata?: unknown;
}

/**
 * Formats a single KV key list entry.
 */
export function formatKeyEntry(
  entry: Record<string, unknown>
): ConciseKeyEntry {
  const result: ConciseKeyEntry = {
    name: String(entry.name ?? ""),
  };
  if (entry.expiration !== undefined) {
    result.expiration = Number(entry.expiration);
  }
  if (entry.metadata !== undefined && entry.metadata !== null) {
    result.metadata = entry.metadata;
  }
  return result;
}
