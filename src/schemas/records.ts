import { z } from "zod";
import {
  OutputFlagsSchema,
  PaginationSchema,
  DnsRecordTypeSchema,
  ZoneIdentifierSchema,
  SamplingSchema,
} from "./common.js";

// ─── List / Get ────────────────────────────────────────────────────

export const ListRecordsSchema = ZoneIdentifierSchema.merge(OutputFlagsSchema)
  .merge(PaginationSchema)
  .merge(SamplingSchema)
  .extend({
    filter_type: DnsRecordTypeSchema.optional().describe(
      "Filter by record type (A, AAAA, CNAME, MX, TXT, etc.)."
    ),
    filter_name: z
      .string()
      .optional()
      .describe("Filter by record name (substring match, e.g. 'www' matches 'www.example.com')."),
    filter_content: z
      .string()
      .optional()
      .describe("Filter by record content/value (substring match)."),
    filter_proxied: z
      .boolean()
      .optional()
      .describe("Filter by proxy status (true = orange cloud, false = DNS only)."),
    filter_comment: z
      .string()
      .optional()
      .describe("Filter by comment (substring match)."),
    filter_tag: z
      .string()
      .optional()
      .describe("Filter by tag in 'name:value' format."),
    order: z
      .enum(["type", "name", "content", "ttl", "proxied"])
      .optional()
      .describe("Sort order field."),
    summary_only: z
      .boolean()
      .default(false)
      .describe(
        "Return only count + type distribution, no individual records. " +
          "Extremely token-efficient for auditing large zones."
      ),
  })
  .strict();

export type ListRecordsInput = z.infer<typeof ListRecordsSchema>;

export const GetRecordSchema = ZoneIdentifierSchema.extend({
  record_id: z.string().describe("DNS record ID (32-char hex)."),
})
  .merge(OutputFlagsSchema)
  .strict();

export type GetRecordInput = z.infer<typeof GetRecordSchema>;

export const ExportRecordsSchema = ZoneIdentifierSchema.strict();

export type ExportRecordsInput = z.infer<typeof ExportRecordsSchema>;

// ─── Create ────────────────────────────────────────────────────────

export const CreateRecordSchema = ZoneIdentifierSchema.extend({
  type: DnsRecordTypeSchema.describe("DNS record type (A, AAAA, CNAME, MX, TXT, SRV, CAA, etc.)."),
  name: z
    .string()
    .min(1)
    .describe("Record name (e.g. 'www', '@' for root, or FQDN 'www.example.com')."),
  content: z
    .string()
    .min(1)
    .describe(
      "Record value. IP for A/AAAA, hostname for CNAME/MX, text for TXT, etc."
    ),
  ttl: z
    .number()
    .int()
    .min(1)
    .default(1)
    .describe("TTL in seconds. Use 1 for 'automatic' (Cloudflare default)."),
  proxied: z
    .boolean()
    .optional()
    .describe("Enable Cloudflare proxy (orange cloud). Only for A, AAAA, CNAME."),
  priority: z
    .number()
    .int()
    .min(0)
    .max(65535)
    .optional()
    .describe("Priority for MX records (required for MX, lower = higher priority)."),
  comment: z
    .string()
    .max(100)
    .optional()
    .describe("Optional comment (max 100 chars)."),
  tags: z
    .array(z.string())
    .optional()
    .describe("Optional tags for organization (e.g. ['env:prod', 'service:web'])."),
  data: z
    .record(z.unknown())
    .optional()
    .describe(
      "Structured data for complex record types (SRV, CAA, CERT, etc.). " +
        "E.g. SRV: {service: '_sip', proto: '_tcp', name: 'example.com', priority: 10, weight: 5, port: 5060, target: 'sip.example.com'}"
    ),
  confirm: z
    .literal(true)
    .describe(
      "Safety gate: must be explicitly set to true. " +
        "This prevents accidental write operations against production zones."
    ),
}).strict();

export type CreateRecordInput = z.infer<typeof CreateRecordSchema>;

// ─── Update ────────────────────────────────────────────────────────

export const UpdateRecordSchema = ZoneIdentifierSchema.extend({
  record_id: z.string().describe("DNS record ID to update (32-char hex)."),
  content: z
    .string()
    .optional()
    .describe("New record value."),
  name: z
    .string()
    .optional()
    .describe("New record name."),
  ttl: z
    .number()
    .int()
    .min(1)
    .optional()
    .describe("New TTL in seconds. Use 1 for 'automatic'."),
  proxied: z
    .boolean()
    .optional()
    .describe("New proxy status. Only for A, AAAA, CNAME."),
  comment: z
    .string()
    .max(100)
    .optional()
    .describe("New comment (max 100 chars)."),
  tags: z
    .array(z.string())
    .optional()
    .describe("New tags (replaces existing)."),
  data: z
    .record(z.unknown())
    .optional()
    .describe("New structured data for complex record types."),
  confirm: z
    .literal(true)
    .describe(
      "Safety gate: must be explicitly set to true. " +
        "This prevents accidental write operations against production zones."
    ),
}).strict();

export type UpdateRecordInput = z.infer<typeof UpdateRecordSchema>;

// ─── Delete ────────────────────────────────────────────────────────

export const DeleteRecordSchema = ZoneIdentifierSchema.extend({
  record_id: z.string().describe("DNS record ID to delete (32-char hex)."),
  confirm: z
    .literal(true)
    .describe(
      "Safety gate: must be explicitly set to true. " +
        "This prevents accidental deletions. The record is permanently removed."
    ),
}).strict();

export type DeleteRecordInput = z.infer<typeof DeleteRecordSchema>;

// ─── Bulk ──────────────────────────────────────────────────────────

export const BulkCreateSchema = ZoneIdentifierSchema.extend({
  records: z
    .array(
      z.object({
        type: DnsRecordTypeSchema,
        name: z.string().min(1),
        content: z.string().min(1),
        ttl: z.number().int().min(1).default(1),
        proxied: z.boolean().optional(),
        priority: z.number().int().min(0).max(65535).optional(),
        comment: z.string().max(100).optional(),
        tags: z.array(z.string()).optional(),
        data: z.record(z.unknown()).optional(),
      })
    )
    .min(1)
    .max(100)
    .describe(
      "Array of DNS records to create (max 100 per call). Each record needs type, name, content at minimum."
    ),
  confirm: z
    .literal(true)
    .describe(
      "Safety gate: must be explicitly set to true. " +
        "This prevents accidental bulk write operations against production zones."
    ),
}).strict();

export type BulkCreateInput = z.infer<typeof BulkCreateSchema>;

export const BulkUpdateSchema = ZoneIdentifierSchema.extend({
  records: z
    .array(
      z.object({
        record_id: z.string().describe("DNS record ID to update."),
        content: z.string().optional(),
        name: z.string().optional(),
        ttl: z.number().int().min(1).optional(),
        proxied: z.boolean().optional(),
        comment: z.string().max(100).optional(),
        tags: z.array(z.string()).optional(),
        data: z.record(z.unknown()).optional(),
      })
    )
    .min(1)
    .max(100)
    .describe("Array of DNS record updates (max 100 per call). Each needs record_id + fields to change."),
  confirm: z
    .literal(true)
    .describe(
      "Safety gate: must be explicitly set to true. " +
        "This prevents accidental bulk write operations against production zones."
    ),
}).strict();

export type BulkUpdateInput = z.infer<typeof BulkUpdateSchema>;
