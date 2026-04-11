/**
 * R2 formatters — token-efficiency layer for Cloudflare R2.
 */

interface ConciseBucket {
  name: string;
  location: string;
  jurisdiction: string;
  storage_class: string;
  creation_date: string;
}

export function formatBucket(bucket: Record<string, unknown>): ConciseBucket {
  return {
    name: String(bucket.name ?? ""),
    location: String(bucket.location ?? ""),
    jurisdiction: String(bucket.jurisdiction ?? "default"),
    storage_class: String(bucket.storage_class ?? "Standard"),
    creation_date: String(bucket.creation_date ?? ""),
  };
}

export function formatBuckets(
  buckets: Record<string, unknown>[]
): ConciseBucket[] {
  return buckets.map(formatBucket);
}
