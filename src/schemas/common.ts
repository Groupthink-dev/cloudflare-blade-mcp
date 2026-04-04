import { z } from "zod";
import { DEFAULT_PER_PAGE, DNS_RECORD_TYPES } from "../constants.js";

/** Shared concise/details flags used by all read tools. */
export const OutputFlagsSchema = z.object({
  concise: z
    .boolean()
    .default(true)
    .describe("Return minimal fields only (default: true). Set false for full Cloudflare response."),
  include_details: z
    .boolean()
    .default(false)
    .describe("Include all Cloudflare metadata (tags, meta, settings). Overrides concise when true."),
});

/** Shared pagination schema. */
export const PaginationSchema = z.object({
  page: z
    .number()
    .int()
    .min(1)
    .default(1)
    .describe("Page number (starts at 1)."),
  per_page: z
    .number()
    .int()
    .min(1)
    .max(5000)
    .default(DEFAULT_PER_PAGE)
    .describe(`Records per page (default: ${DEFAULT_PER_PAGE}, max: 5000).`),
});

/** DNS record type enum for filtering and creation. */
export const DnsRecordTypeSchema = z.enum(DNS_RECORD_TYPES);

/** Zone identifier — either zone_id or zone_name. */
export const ZoneIdentifierSchema = z.object({
  zone_id: z
    .string()
    .describe("Cloudflare Zone ID (32-char hex). Required unless zone_name is provided."),
});

/** Account identifier — required for KV, D1, and Tunnel APIs. */
export const AccountIdSchema = z.object({
  account_id: z
    .string()
    .optional()
    .describe("Cloudflare Account ID. Falls back to CLOUDFLARE_ACCOUNT_ID env var if not provided."),
});

/** Random sampling flag. */
export const SamplingSchema = z.object({
  random_sample: z
    .boolean()
    .default(false)
    .describe("Return a random sample instead of paginated results. Useful for quick audits."),
  sample_size: z
    .number()
    .int()
    .min(1)
    .max(50)
    .default(5)
    .describe("Number of random records to return when random_sample=true (default: 5)."),
});
