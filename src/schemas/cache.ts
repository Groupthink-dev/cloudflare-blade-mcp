import { z } from "zod";

export const CachePurgeSchema = z.object({
  zone_id: z
    .string()
    .min(1)
    .describe("Cloudflare Zone ID (32-char hex). Use cf_dns_list_zones to find it."),
  purge_everything: z
    .boolean()
    .optional()
    .describe("Purge ALL cached content for the zone. Use with extreme care."),
  files: z
    .array(z.string())
    .optional()
    .describe("Purge specific URLs (e.g. ['https://example.com/styles.css']). Max 30 per call."),
  tags: z
    .array(z.string())
    .optional()
    .describe("Purge by Cache-Tag header values. Enterprise only."),
  hosts: z
    .array(z.string())
    .optional()
    .describe("Purge by hostname (e.g. ['www.example.com']). Enterprise only."),
  prefixes: z
    .array(z.string())
    .optional()
    .describe("Purge by URL prefix (e.g. ['www.example.com/assets/']). Enterprise only."),
  confirm: z
    .literal(true)
    .describe("Safety gate: must be explicitly set to true to purge cache."),
}).strict();
export type CachePurgeInput = z.infer<typeof CachePurgeSchema>;
