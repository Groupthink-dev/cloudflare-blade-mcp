import { z } from "zod";
import { AccountIdSchema } from "./common.js";

// ─── List / Get Scripts ───────────────────────────────────────────

export const ListScriptsSchema = AccountIdSchema.extend({}).strict();
export type ListScriptsInput = z.infer<typeof ListScriptsSchema>;

export const GetScriptSchema = AccountIdSchema.extend({
  script_name: z
    .string()
    .min(1)
    .describe("Worker script name (the ID shown in the dashboard or wrangler.toml)."),
}).strict();
export type GetScriptInput = z.infer<typeof GetScriptSchema>;

// ─── Deployments ──────────────────────────────────────────────────

export const ListDeploymentsSchema = AccountIdSchema.extend({
  script_name: z
    .string()
    .min(1)
    .describe("Worker script name."),
}).strict();
export type ListDeploymentsInput = z.infer<typeof ListDeploymentsSchema>;

export const CreateDeploymentSchema = AccountIdSchema.extend({
  script_name: z
    .string()
    .min(1)
    .describe("Worker script name."),
  versions: z
    .array(
      z.object({
        version_id: z.string().describe("Version ID (UUID) to deploy."),
        percentage: z
          .number()
          .min(0)
          .max(100)
          .describe("Percentage of traffic for this version (0–100). All versions must sum to 100."),
      })
    )
    .min(1)
    .max(2)
    .describe(
      "Versions to deploy. Use one version at 100% for a full rollout, " +
        "or two versions for a gradual rollout (percentages must sum to 100)."
    ),
  message: z
    .string()
    .optional()
    .describe("Human-readable deployment message (max 100 characters)."),
  confirm: z
    .literal(true)
    .describe("Safety gate: must be explicitly set to true to deploy."),
}).strict();
export type CreateDeploymentInput = z.infer<typeof CreateDeploymentSchema>;

// ─── Versions ─────────────────────────────────────────────────────

export const ListVersionsSchema = AccountIdSchema.extend({
  script_name: z
    .string()
    .min(1)
    .describe("Worker script name."),
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
    .default(20)
    .describe("Versions per page (default: 20, max: 100)."),
}).strict();
export type ListVersionsInput = z.infer<typeof ListVersionsSchema>;

// ─── Secrets ──────────────────────────────────────────────────────

export const ListSecretsSchema = AccountIdSchema.extend({
  script_name: z
    .string()
    .min(1)
    .describe("Worker script name."),
}).strict();
export type ListSecretsInput = z.infer<typeof ListSecretsSchema>;

export const PutSecretSchema = AccountIdSchema.extend({
  script_name: z
    .string()
    .min(1)
    .describe("Worker script name."),
  name: z
    .string()
    .min(1)
    .describe("Secret binding name (JavaScript variable name)."),
  text: z
    .string()
    .min(1)
    .describe("Secret value."),
  confirm: z
    .literal(true)
    .describe("Safety gate: must be explicitly set to true to set/update a secret."),
}).strict();
export type PutSecretInput = z.infer<typeof PutSecretSchema>;

export const DeleteSecretSchema = AccountIdSchema.extend({
  script_name: z
    .string()
    .min(1)
    .describe("Worker script name."),
  secret_name: z
    .string()
    .min(1)
    .describe("Secret binding name to delete."),
  confirm: z
    .literal(true)
    .describe("Safety gate: must be explicitly set to true to delete a secret."),
}).strict();
export type DeleteSecretInput = z.infer<typeof DeleteSecretSchema>;

// ─── Schedules (Cron Triggers) ────────────────────────────────────

export const GetSchedulesSchema = AccountIdSchema.extend({
  script_name: z
    .string()
    .min(1)
    .describe("Worker script name."),
}).strict();
export type GetSchedulesInput = z.infer<typeof GetSchedulesSchema>;

export const PutSchedulesSchema = AccountIdSchema.extend({
  script_name: z
    .string()
    .min(1)
    .describe("Worker script name."),
  schedules: z
    .array(
      z.object({
        cron: z
          .string()
          .min(1)
          .describe("Cron expression (e.g. '*/30 * * * *' for every 30 minutes)."),
      })
    )
    .min(1)
    .describe("Cron triggers for the Worker. Replaces ALL existing schedules."),
  confirm: z
    .literal(true)
    .describe("Safety gate: must be explicitly set to true. Replaces all existing cron triggers."),
}).strict();
export type PutSchedulesInput = z.infer<typeof PutSchedulesSchema>;
