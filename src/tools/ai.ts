/**
 * Cloudflare AI tools: AI Search, AI Gateway, and Workers AI.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { cloudflareRequest, getAccountId } from "../services/cloudflare.js";
import { formatAiGateway, formatAiGateways, formatWorkersAiModels } from "../formatters/ai.js";
import { truncateIfNeeded } from "../utils/pagination.js";
import { handleApiError } from "../utils/errors.js";
import {
  AiGatewayCreateSchema,
  AiGatewayDeleteSchema,
  AiGatewayIdSchema,
  AiGatewayListLogsSchema,
  AiGatewayListSchema,
  AiGatewayLogSchema,
  AiGatewayUpdateSchema,
  AiSearchQuerySchema,
  WorkersAiListModelsSchema,
  WorkersAiRunModelSchema,
} from "../schemas/ai.js";
import type {
  AiGatewayCreateInput,
  AiGatewayDeleteInput,
  AiGatewayIdInput,
  AiGatewayListInput,
  AiGatewayListLogsInput,
  AiGatewayLogInput,
  AiGatewayUpdateInput,
  AiSearchQueryInput,
  WorkersAiListModelsInput,
  WorkersAiRunModelInput,
} from "../schemas/ai.js";

function aiGatewayPath(accountId: string, suffix: string = ""): string {
  return `/accounts/${accountId}/ai-gateway/gateways${suffix}`;
}

function encodePathWithSlashes(value: string): string {
  return value.split("/").map((part) => encodeURIComponent(part)).join("/");
}

export function registerAiTools(server: McpServer): void {
  server.registerTool(
    "cf_ai_search_query",
    {
      title: "Query AI Search",
      description: "Query a Cloudflare AI Search / AutoRAG instance.",
      inputSchema: AiSearchQuerySchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    async (params: AiSearchQueryInput) => {
      try {
        const accountId = getAccountId(params.account_id);
        const body: Record<string, unknown> = { query: params.query };
        if (params.max_num_results !== undefined) body.max_num_results = params.max_num_results;
        if (params.rewrite_query !== undefined) body.rewrite_query = params.rewrite_query;
        const result = await cloudflareRequest<unknown>(
          "POST",
          `/accounts/${accountId}/ai-search/rags/${encodeURIComponent(params.instance_name)}/ai-search`,
          { body }
        );
        return { content: [{ type: "text" as const, text: truncateIfNeeded(JSON.stringify({ instance_name: params.instance_name, result }, null, 2)) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }
  );

  server.registerTool(
    "cf_ai_gateway_list_gateways",
    {
      title: "List AI Gateways",
      description: "List Cloudflare AI Gateways in the account.",
      inputSchema: AiGatewayListSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async (params: AiGatewayListInput) => {
      try {
        const accountId = getAccountId(params.account_id);
        const result = await cloudflareRequest<unknown>("GET", aiGatewayPath(accountId));
        const gateways = Array.isArray(result)
          ? result
          : Array.isArray((result as Record<string, unknown>)?.gateways)
            ? ((result as Record<string, unknown>).gateways as unknown[])
            : [];
        const formatted = formatAiGateways(gateways as Record<string, unknown>[]);
        return { content: [{ type: "text" as const, text: JSON.stringify({ total: formatted.length, gateways: formatted }, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }
  );

  server.registerTool(
    "cf_ai_gateway_get_gateway",
    {
      title: "Get AI Gateway",
      description: "Get a Cloudflare AI Gateway by ID.",
      inputSchema: AiGatewayIdSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async (params: AiGatewayIdInput) => {
      try {
        const accountId = getAccountId(params.account_id);
        const gateway = await cloudflareRequest<Record<string, unknown>>(
          "GET",
          aiGatewayPath(accountId, `/${encodeURIComponent(params.gateway_id)}`)
        );
        return { content: [{ type: "text" as const, text: JSON.stringify({ gateway: formatAiGateway(gateway) }, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }
  );

  server.registerTool(
    "cf_ai_gateway_create_gateway",
    {
      title: "Create AI Gateway",
      description: "Create a Cloudflare AI Gateway. Pass the Cloudflare create payload in body.",
      inputSchema: AiGatewayCreateSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    async (params: AiGatewayCreateInput) => {
      try {
        const accountId = getAccountId(params.account_id);
        const gateway = await cloudflareRequest<Record<string, unknown>>("POST", aiGatewayPath(accountId), { body: params.body });
        return { content: [{ type: "text" as const, text: JSON.stringify({ created: true, gateway: formatAiGateway(gateway) }, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }
  );

  server.registerTool(
    "cf_ai_gateway_update_gateway",
    {
      title: "Update AI Gateway",
      description: "Patch a Cloudflare AI Gateway. Pass the Cloudflare patch payload in body.",
      inputSchema: AiGatewayUpdateSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    async (params: AiGatewayUpdateInput) => {
      try {
        const accountId = getAccountId(params.account_id);
        const gateway = await cloudflareRequest<Record<string, unknown>>(
          "PATCH",
          aiGatewayPath(accountId, `/${encodeURIComponent(params.gateway_id)}`),
          { body: params.body }
        );
        return { content: [{ type: "text" as const, text: JSON.stringify({ updated: true, gateway: formatAiGateway(gateway) }, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }
  );

  server.registerTool(
    "cf_ai_gateway_delete_gateway",
    {
      title: "Delete AI Gateway",
      description: "Delete a Cloudflare AI Gateway.",
      inputSchema: AiGatewayDeleteSchema,
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
    },
    async (params: AiGatewayDeleteInput) => {
      try {
        const accountId = getAccountId(params.account_id);
        await cloudflareRequest<unknown>("DELETE", aiGatewayPath(accountId, `/${encodeURIComponent(params.gateway_id)}`));
        return { content: [{ type: "text" as const, text: JSON.stringify({ deleted: true, gateway_id: params.gateway_id }, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }
  );

  server.registerTool(
    "cf_ai_gateway_list_logs",
    {
      title: "List AI Gateway Logs",
      description: "List logs for a Cloudflare AI Gateway.",
      inputSchema: AiGatewayListLogsSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    async (params: AiGatewayListLogsInput) => {
      try {
        const accountId = getAccountId(params.account_id);
        const logs = await cloudflareRequest<unknown>(
          "GET",
          aiGatewayPath(accountId, `/${encodeURIComponent(params.gateway_id)}/logs`),
          { query: { page: params.page, per_page: params.per_page } }
        );
        return { content: [{ type: "text" as const, text: truncateIfNeeded(JSON.stringify({ gateway_id: params.gateway_id, logs }, null, 2)) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }
  );

  server.registerTool(
    "cf_ai_gateway_get_log",
    {
      title: "Get AI Gateway Log",
      description: "Get a single Cloudflare AI Gateway log.",
      inputSchema: AiGatewayLogSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async (params: AiGatewayLogInput) => {
      try {
        const accountId = getAccountId(params.account_id);
        const log = await cloudflareRequest<unknown>(
          "GET",
          aiGatewayPath(accountId, `/${encodeURIComponent(params.gateway_id)}/logs/${encodeURIComponent(params.log_id)}`)
        );
        return { content: [{ type: "text" as const, text: truncateIfNeeded(JSON.stringify({ gateway_id: params.gateway_id, log }, null, 2)) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }
  );

  server.registerTool(
    "cf_workers_ai_list_models",
    {
      title: "List Workers AI Models",
      description: "Search Workers AI models by name, task, or author.",
      inputSchema: WorkersAiListModelsSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async (params: WorkersAiListModelsInput) => {
      try {
        const accountId = getAccountId(params.account_id);
        const result = await cloudflareRequest<unknown>("GET", `/accounts/${accountId}/ai/models/search`, {
          query: {
            search: params.search,
            task: params.task,
            author: params.author,
            hide_experimental: params.hide_experimental,
            page: params.page,
            per_page: params.per_page,
          },
        });
        const models = Array.isArray(result) ? result : [];
        const formatted = formatWorkersAiModels(models as Record<string, unknown>[]);
        return { content: [{ type: "text" as const, text: truncateIfNeeded(JSON.stringify({ total: formatted.length, models: formatted }, null, 2)) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }
  );

  server.registerTool(
    "cf_workers_ai_run_model",
    {
      title: "Run Workers AI Model",
      description: "Run a Workers AI model through Cloudflare REST inference.",
      inputSchema: WorkersAiRunModelSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    async (params: WorkersAiRunModelInput) => {
      try {
        const accountId = getAccountId(params.account_id);
        const result = await cloudflareRequest<unknown>(
          "POST",
          `/accounts/${accountId}/ai/run/${encodePathWithSlashes(params.model_name)}`,
          { body: params.input }
        );
        return { content: [{ type: "text" as const, text: truncateIfNeeded(JSON.stringify({ model_name: params.model_name, result }, null, 2)) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }
  );
}
