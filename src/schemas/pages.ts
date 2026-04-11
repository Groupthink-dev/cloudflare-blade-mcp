import { z } from "zod";
import { AccountIdSchema } from "./common.js";

// ─── Projects ─────────────────────────────────────────────────────

export const ListProjectsSchema = AccountIdSchema.extend({}).strict();
export type ListProjectsInput = z.infer<typeof ListProjectsSchema>;

export const GetProjectSchema = AccountIdSchema.extend({
  project_name: z
    .string()
    .min(1)
    .describe("Pages project name."),
}).strict();
export type GetProjectInput = z.infer<typeof GetProjectSchema>;

// ─── Deployments ──────────────────────────────────────────────────

export const ListPagesDeploymentsSchema = AccountIdSchema.extend({
  project_name: z
    .string()
    .min(1)
    .describe("Pages project name."),
  env: z
    .enum(["production", "preview"])
    .optional()
    .describe("Filter by environment type (production or preview). Omit for all."),
}).strict();
export type ListPagesDeploymentsInput = z.infer<typeof ListPagesDeploymentsSchema>;

export const GetPagesDeploymentSchema = AccountIdSchema.extend({
  project_name: z
    .string()
    .min(1)
    .describe("Pages project name."),
  deployment_id: z
    .string()
    .min(1)
    .describe("Deployment ID (UUID)."),
}).strict();
export type GetPagesDeploymentInput = z.infer<typeof GetPagesDeploymentSchema>;

export const RollbackDeploymentSchema = AccountIdSchema.extend({
  project_name: z
    .string()
    .min(1)
    .describe("Pages project name."),
  deployment_id: z
    .string()
    .min(1)
    .describe("Deployment ID to rollback to. Must be a successful production deployment."),
  confirm: z
    .literal(true)
    .describe(
      "Safety gate: must be explicitly set to true. " +
        "This rolls back the production deployment to a previous version."
    ),
}).strict();
export type RollbackDeploymentInput = z.infer<typeof RollbackDeploymentSchema>;

// ─── Domains ──────────────────────────────────────────────────────

export const ListPagesDomainsSchema = AccountIdSchema.extend({
  project_name: z
    .string()
    .min(1)
    .describe("Pages project name."),
}).strict();
export type ListPagesDomainsInput = z.infer<typeof ListPagesDomainsSchema>;

// ─── Build Cache ──────────────────────────────────────────────────

export const PurgeBuildCacheSchema = AccountIdSchema.extend({
  project_name: z
    .string()
    .min(1)
    .describe("Pages project name."),
  confirm: z
    .literal(true)
    .describe("Safety gate: must be explicitly set to true to purge the build cache."),
}).strict();
export type PurgeBuildCacheInput = z.infer<typeof PurgeBuildCacheSchema>;
