import { z } from "zod";
import { AccountIdSchema } from "./common.js";

// ─── List / Get ────────────────────────────────────────────────────

export const ListDatabasesSchema = AccountIdSchema.extend({
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
    .describe("Databases per page (default: 50, max: 100)."),
}).strict();

export type ListDatabasesInput = z.infer<typeof ListDatabasesSchema>;

export const GetDatabaseSchema = AccountIdSchema.extend({
  database_id: z.string().describe("D1 database UUID."),
}).strict();

export type GetDatabaseInput = z.infer<typeof GetDatabaseSchema>;

// ─── Create / Delete Database ────────────────────────────────────

export const CreateDatabaseSchema = AccountIdSchema.extend({
  name: z
    .string()
    .min(1)
    .describe("Name for the new D1 database."),
  jurisdiction: z
    .string()
    .optional()
    .describe("Optional jurisdiction setting supported by Cloudflare D1."),
  primary_location_hint: z
    .string()
    .optional()
    .describe("Optional D1 primary location hint."),
  confirm: z
    .literal(true)
    .describe("Safety gate: must be explicitly set to true to create a database."),
}).strict();

export type CreateDatabaseInput = z.infer<typeof CreateDatabaseSchema>;

export const DeleteDatabaseSchema = AccountIdSchema.extend({
  database_id: z.string().describe("D1 database UUID."),
  name: z
    .string()
    .min(1)
    .describe("Exact database name. Used to verify the database before deletion."),
  confirm: z
    .literal(true)
    .describe("Safety gate: must be explicitly set to true to permanently delete the database."),
}).strict();

export type DeleteDatabaseInput = z.infer<typeof DeleteDatabaseSchema>;

// ─── Query (read-only) ────────────────────────────────────────────

export const QuerySchema = AccountIdSchema.extend({
  database_id: z.string().describe("D1 database UUID."),
  sql: z.string().describe("SQL SELECT query."),
  params: z
    .array(z.string())
    .optional()
    .describe("Bind parameters for the SQL query (positional ?1, ?2, ...)."),
}).strict();

export type QueryInput = z.infer<typeof QuerySchema>;

// ─── Execute (write) ──────────────────────────────────────────────

export const ExecuteSchema = AccountIdSchema.extend({
  database_id: z.string().describe("D1 database UUID."),
  sql: z
    .string()
    .describe("SQL write statement (INSERT, UPDATE, DELETE, CREATE TABLE, etc.)."),
  params: z
    .array(z.string())
    .optional()
    .describe("Bind parameters for the SQL statement (positional ?1, ?2, ...)."),
  confirm: z
    .literal(true)
    .describe(
      "Safety gate: must be explicitly set to true. " +
        "This prevents accidental write operations against production databases."
    ),
}).strict();

export type ExecuteInput = z.infer<typeof ExecuteSchema>;

// ─── Export ───────────────────────────────────────────────────────

export const ExportSchema = AccountIdSchema.extend({
  database_id: z.string().describe("D1 database UUID."),
}).strict();

export type ExportInput = z.infer<typeof ExportSchema>;

// ─── List Tables ──────────────────────────────────────────────────

export const ListTablesSchema = AccountIdSchema.extend({
  database_id: z.string().describe("D1 database UUID."),
}).strict();

export type ListTablesInput = z.infer<typeof ListTablesSchema>;

// ─── Describe Table ───────────────────────────────────────────────

export const DescribeTableSchema = AccountIdSchema.extend({
  database_id: z.string().describe("D1 database UUID."),
  table_name: z.string().describe("Table name to describe."),
}).strict();

export type DescribeTableInput = z.infer<typeof DescribeTableSchema>;
