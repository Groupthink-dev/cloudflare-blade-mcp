/**
 * Vectorize tools: lifecycle and metadata-index management.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { cloudflareRequest, getAccountId } from "../services/cloudflare.js";
import { formatMetadataIndexes, formatVectorizeIndex, formatVectorizeIndexes } from "../formatters/vectorize.js";
import { truncateIfNeeded } from "../utils/pagination.js";
import { handleApiError } from "../utils/errors.js";
import {
  CreateIndexSchema,
  CreateMetadataIndexSchema,
  DeleteIndexSchema,
  DeleteMetadataIndexSchema,
  IndexNameSchema,
  ListIndexesSchema,
} from "../schemas/vectorize.js";
import type {
  CreateIndexInput,
  CreateMetadataIndexInput,
  DeleteIndexInput,
  DeleteMetadataIndexInput,
  IndexNameInput,
  ListIndexesInput,
} from "../schemas/vectorize.js";

function vectorizePath(accountId: string, suffix: string = ""): string {
  return `/accounts/${accountId}/vectorize/v2/indexes${suffix}`;
}

export function registerVectorizeTools(server: McpServer): void {
  server.registerTool(
    "cf_vectorize_list_indexes",
    {
      title: "List Vectorize Indexes",
      description: "List Vectorize indexes in the account.",
      inputSchema: ListIndexesSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async (params: ListIndexesInput) => {
      try {
        const accountId = getAccountId(params.account_id);
        const result = await cloudflareRequest<unknown>("GET", vectorizePath(accountId));
        const indexes = Array.isArray(result)
          ? result
          : Array.isArray((result as Record<string, unknown>)?.indexes)
            ? ((result as Record<string, unknown>).indexes as unknown[])
            : [];
        const formatted = formatVectorizeIndexes(indexes as Record<string, unknown>[]);
        return { content: [{ type: "text" as const, text: truncateIfNeeded(JSON.stringify({ total: formatted.length, indexes: formatted }, null, 2)) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }
  );

  server.registerTool(
    "cf_vectorize_get_index",
    {
      title: "Get Vectorize Index",
      description: "Get a Vectorize index by name.",
      inputSchema: IndexNameSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async (params: IndexNameInput) => {
      try {
        const accountId = getAccountId(params.account_id);
        const index = await cloudflareRequest<Record<string, unknown>>(
          "GET",
          vectorizePath(accountId, `/${encodeURIComponent(params.index_name)}`)
        );
        return { content: [{ type: "text" as const, text: JSON.stringify({ index: formatVectorizeIndex(index) }, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }
  );

  server.registerTool(
    "cf_vectorize_get_index_info",
    {
      title: "Get Vectorize Index Info",
      description: "Get operational information for a Vectorize index.",
      inputSchema: IndexNameSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async (params: IndexNameInput) => {
      try {
        const accountId = getAccountId(params.account_id);
        const info = await cloudflareRequest<Record<string, unknown>>(
          "GET",
          vectorizePath(accountId, `/${encodeURIComponent(params.index_name)}/info`)
        );
        return { content: [{ type: "text" as const, text: JSON.stringify({ index_name: params.index_name, info }, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }
  );

  server.registerTool(
    "cf_vectorize_create_index",
    {
      title: "Create Vectorize Index",
      description: "Create a Vectorize index. Safety: confirm=true is required.",
      inputSchema: CreateIndexSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    async (params: CreateIndexInput) => {
      try {
        const accountId = getAccountId(params.account_id);
        const body: Record<string, unknown> = {
          name: params.name,
          config: { dimensions: params.dimensions, metric: params.metric },
        };
        if (params.description) body.description = params.description;
        const index = await cloudflareRequest<Record<string, unknown>>("POST", vectorizePath(accountId), { body });
        return { content: [{ type: "text" as const, text: JSON.stringify({ created: true, index: formatVectorizeIndex(index) }, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }
  );

  server.registerTool(
    "cf_vectorize_delete_index",
    {
      title: "Delete Vectorize Index",
      description: "Delete a Vectorize index. Safety: confirm=true and confirm_name must match index_name.",
      inputSchema: DeleteIndexSchema,
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
    },
    async (params: DeleteIndexInput) => {
      try {
        if (params.confirm_name !== params.index_name) {
          return { content: [{ type: "text" as const, text: "Delete aborted. confirm_name must exactly match index_name." }], isError: true };
        }
        const accountId = getAccountId(params.account_id);
        await cloudflareRequest<unknown>("DELETE", vectorizePath(accountId, `/${encodeURIComponent(params.index_name)}`));
        return { content: [{ type: "text" as const, text: JSON.stringify({ deleted: true, index_name: params.index_name }, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }
  );

  server.registerTool(
    "cf_vectorize_list_metadata_indexes",
    {
      title: "List Vectorize Metadata Indexes",
      description: "List metadata indexes for a Vectorize index.",
      inputSchema: IndexNameSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async (params: IndexNameInput) => {
      try {
        const accountId = getAccountId(params.account_id);
        const result = await cloudflareRequest<Record<string, unknown>>(
          "GET",
          vectorizePath(accountId, `/${encodeURIComponent(params.index_name)}/metadata_index/list`)
        );
        const indexes = Array.isArray(result.metadataIndexes) ? result.metadataIndexes : [];
        const formatted = formatMetadataIndexes(indexes as Record<string, unknown>[]);
        return { content: [{ type: "text" as const, text: JSON.stringify({ index_name: params.index_name, metadata_indexes: formatted }, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }
  );

  server.registerTool(
    "cf_vectorize_create_metadata_index",
    {
      title: "Create Vectorize Metadata Index",
      description: "Create a metadata index for filtering on a Vectorize metadata property.",
      inputSchema: CreateMetadataIndexSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    async (params: CreateMetadataIndexInput) => {
      try {
        const accountId = getAccountId(params.account_id);
        const result = await cloudflareRequest<Record<string, unknown>>(
          "POST",
          vectorizePath(accountId, `/${encodeURIComponent(params.index_name)}/metadata_index/create`),
          { body: { propertyName: params.property_name, indexType: params.index_type } }
        );
        return { content: [{ type: "text" as const, text: JSON.stringify({ created: true, index_name: params.index_name, mutation: result }, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }
  );

  server.registerTool(
    "cf_vectorize_delete_metadata_index",
    {
      title: "Delete Vectorize Metadata Index",
      description: "Delete a Vectorize metadata index.",
      inputSchema: DeleteMetadataIndexSchema,
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
    },
    async (params: DeleteMetadataIndexInput) => {
      try {
        const accountId = getAccountId(params.account_id);
        const result = await cloudflareRequest<Record<string, unknown>>(
          "POST",
          vectorizePath(accountId, `/${encodeURIComponent(params.index_name)}/metadata_index/delete`),
          { body: { propertyName: params.property_name } }
        );
        return { content: [{ type: "text" as const, text: JSON.stringify({ deleted: true, index_name: params.index_name, property_name: params.property_name, mutation: result }, null, 2) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleApiError(error) }], isError: true };
      }
    }
  );
}
