import { z } from "zod";
import { AccountIdSchema } from "./common.js";

// ─── List Namespaces ──────────────────────────────────────────────

export const ListNamespacesSchema = AccountIdSchema.extend({
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
    .max(100)
    .default(50)
    .describe("Namespaces per page (default: 50, max: 100)."),
}).strict();

export type ListNamespacesInput = z.infer<typeof ListNamespacesSchema>;

// ─── List Keys ────────────────────────────────────────────────────

export const ListKeysSchema = AccountIdSchema.extend({
  namespace_id: z
    .string()
    .describe("KV namespace ID (32-char hex)."),
  prefix: z
    .string()
    .optional()
    .describe("Filter keys by prefix (e.g. 'user:' returns only keys starting with 'user:')."),
  cursor: z
    .string()
    .optional()
    .describe("Pagination cursor from a previous response. Pass to fetch the next page."),
  limit: z
    .number()
    .int()
    .min(1)
    .max(1000)
    .default(1000)
    .describe("Maximum keys to return (default: 1000, max: 1000)."),
}).strict();

export type ListKeysInput = z.infer<typeof ListKeysSchema>;

// ─── Get Value ────────────────────────────────────────────────────

export const GetValueSchema = AccountIdSchema.extend({
  namespace_id: z
    .string()
    .describe("KV namespace ID (32-char hex)."),
  key_name: z
    .string()
    .describe("The key to retrieve."),
}).strict();

export type GetValueInput = z.infer<typeof GetValueSchema>;

// ─── Put Value ────────────────────────────────────────────────────

export const PutValueSchema = AccountIdSchema.extend({
  namespace_id: z
    .string()
    .describe("KV namespace ID (32-char hex)."),
  key_name: z
    .string()
    .describe("The key to set."),
  value: z
    .string()
    .describe("The value to store (string)."),
  expiration_ttl: z
    .number()
    .int()
    .min(60)
    .optional()
    .describe("Time-to-live in seconds (minimum 60). Key is automatically deleted after this period."),
  metadata: z
    .record(z.unknown())
    .optional()
    .describe("Arbitrary JSON metadata to attach to the key."),
}).strict();

export type PutValueInput = z.infer<typeof PutValueSchema>;

// ─── Delete Value ─────────────────────────────────────────────────

export const DeleteValueSchema = AccountIdSchema.extend({
  namespace_id: z
    .string()
    .describe("KV namespace ID (32-char hex)."),
  key_name: z
    .string()
    .describe("The key to delete."),
  confirm: z
    .literal(true)
    .describe(
      "Safety gate: must be explicitly set to true. " +
        "This prevents accidental deletions. The key is permanently removed."
    ),
}).strict();

export type DeleteValueInput = z.infer<typeof DeleteValueSchema>;

// ─── Bulk Put ─────────────────────────────────────────────────────

export const BulkPutSchema = AccountIdSchema.extend({
  namespace_id: z
    .string()
    .describe("KV namespace ID (32-char hex)."),
  entries: z
    .array(
      z.object({
        key: z.string().min(1).describe("Key name."),
        value: z.string().describe("Value to store."),
        expiration_ttl: z
          .number()
          .int()
          .min(60)
          .optional()
          .describe("Time-to-live in seconds (minimum 60)."),
        metadata: z
          .record(z.unknown())
          .optional()
          .describe("Arbitrary JSON metadata."),
      })
    )
    .min(1)
    .max(10000)
    .describe("Array of key-value pairs to write (max 10,000 per call)."),
}).strict();

export type BulkPutInput = z.infer<typeof BulkPutSchema>;

// ─── Bulk Delete ──────────────────────────────────────────────────

export const BulkDeleteSchema = AccountIdSchema.extend({
  namespace_id: z
    .string()
    .describe("KV namespace ID (32-char hex)."),
  keys: z
    .array(z.string())
    .min(1)
    .max(10000)
    .describe("Array of key names to delete (max 10,000 per call)."),
  confirm: z
    .literal(true)
    .describe(
      "Safety gate: must be explicitly set to true. " +
        "This prevents accidental bulk deletions. All listed keys are permanently removed."
    ),
}).strict();

export type BulkDeleteInput = z.infer<typeof BulkDeleteSchema>;
