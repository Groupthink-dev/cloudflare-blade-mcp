import { z } from "zod";
import { AccountIdSchema } from "./common.js";

export const AiSearchQuerySchema = AccountIdSchema.extend({
  instance_name: z.string().min(1).describe("AI Search / AutoRAG instance name."),
  query: z.string().min(1).describe("Question or search query."),
  max_num_results: z
    .number()
    .int()
    .min(1)
    .max(50)
    .optional()
    .describe("Maximum retrieved results to return."),
  rewrite_query: z
    .boolean()
    .optional()
    .describe("Whether Cloudflare should rewrite the query before retrieval."),
}).strict();
export type AiSearchQueryInput = z.infer<typeof AiSearchQuerySchema>;

export const AiGatewayListSchema = AccountIdSchema.extend({}).strict();
export type AiGatewayListInput = z.infer<typeof AiGatewayListSchema>;

export const AiGatewayIdSchema = AccountIdSchema.extend({
  gateway_id: z.string().min(1).describe("AI Gateway ID."),
}).strict();
export type AiGatewayIdInput = z.infer<typeof AiGatewayIdSchema>;

export const AiGatewayCreateSchema = AccountIdSchema.extend({
  body: z.record(z.unknown()).describe("Cloudflare AI Gateway create payload."),
  confirm: z.literal(true).describe("Safety gate: must be explicitly set to true to create a gateway."),
}).strict();
export type AiGatewayCreateInput = z.infer<typeof AiGatewayCreateSchema>;

export const AiGatewayUpdateSchema = AccountIdSchema.extend({
  gateway_id: z.string().min(1).describe("AI Gateway ID."),
  body: z.record(z.unknown()).describe("Cloudflare AI Gateway patch payload."),
  confirm: z.literal(true).describe("Safety gate: must be explicitly set to true to update a gateway."),
}).strict();
export type AiGatewayUpdateInput = z.infer<typeof AiGatewayUpdateSchema>;

export const AiGatewayDeleteSchema = AccountIdSchema.extend({
  gateway_id: z.string().min(1).describe("AI Gateway ID."),
  confirm: z.literal(true).describe("Safety gate: must be explicitly set to true to delete a gateway."),
}).strict();
export type AiGatewayDeleteInput = z.infer<typeof AiGatewayDeleteSchema>;

export const AiGatewayListLogsSchema = AccountIdSchema.extend({
  gateway_id: z.string().min(1).describe("AI Gateway ID."),
  page: z.number().int().min(1).default(1).describe("Page number."),
  per_page: z.number().int().min(1).max(100).default(20).describe("Logs per page."),
}).strict();
export type AiGatewayListLogsInput = z.infer<typeof AiGatewayListLogsSchema>;

export const AiGatewayLogSchema = AccountIdSchema.extend({
  gateway_id: z.string().min(1).describe("AI Gateway ID."),
  log_id: z.string().min(1).describe("AI Gateway log ID."),
}).strict();
export type AiGatewayLogInput = z.infer<typeof AiGatewayLogSchema>;

export const WorkersAiListModelsSchema = AccountIdSchema.extend({
  search: z.string().optional().describe("Search model name or description."),
  task: z.string().optional().describe("Filter by task name."),
  author: z.string().optional().describe("Filter by model author."),
  hide_experimental: z.boolean().default(true).describe("Hide experimental models."),
  page: z.number().int().min(1).default(1).describe("Page number."),
  per_page: z.number().int().min(1).max(100).default(20).describe("Models per page."),
}).strict();
export type WorkersAiListModelsInput = z.infer<typeof WorkersAiListModelsSchema>;

export const WorkersAiRunModelSchema = AccountIdSchema.extend({
  model_name: z.string().min(1).describe("Workers AI model name, e.g. @cf/meta/llama-3.1-8b-instruct."),
  input: z.record(z.unknown()).describe("Model-specific input payload."),
  confirm: z.literal(true).describe("Safety gate: must be explicitly set to true to run inference."),
}).strict();
export type WorkersAiRunModelInput = z.infer<typeof WorkersAiRunModelSchema>;
