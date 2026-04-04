/**
 * Workers KV tools: cf_kv_list_namespaces, cf_kv_list_keys, cf_kv_get,
 * cf_kv_put, cf_kv_delete, cf_kv_bulk_put, cf_kv_bulk_delete
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getClient, getAccountId } from "../services/cloudflare.js";
import { formatNamespaces, formatKeyEntry } from "../formatters/kv.js";
import { truncateIfNeeded } from "../utils/pagination.js";
import { handleApiError } from "../utils/errors.js";
import {
  ListNamespacesSchema,
  ListKeysSchema,
  GetValueSchema,
  PutValueSchema,
  DeleteValueSchema,
  BulkPutSchema,
  BulkDeleteSchema,
} from "../schemas/kv.js";
import type {
  ListNamespacesInput,
  ListKeysInput,
  GetValueInput,
  PutValueInput,
  DeleteValueInput,
  BulkPutInput,
  BulkDeleteInput,
} from "../schemas/kv.js";

export function registerKvTools(server: McpServer): void {
  // ─── cf_kv_list_namespaces ────────────────────────────────────
  server.registerTool(
    "cf_kv_list_namespaces",
    {
      title: "List KV Namespaces",
      description:
        `List Workers KV namespaces in your Cloudflare account. ` +
        `Returns concise output by default (id, title, supports_url_encoding).\n\n` +
        `Returns: { pagination: { total, count, page, per_page, has_more }, namespaces: [...] }`,
      inputSchema: ListNamespacesSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: ListNamespacesInput) => {
      try {
        const client = getClient();
        const accountId = getAccountId(params.account_id);

        const response = await client.kv.namespaces.list({
          account_id: accountId,
          page: params.page,
          per_page: params.per_page,
        } as Parameters<typeof client.kv.namespaces.list>[0]);

        const namespaces: Record<string, unknown>[] = [];
        for await (const ns of response) {
          namespaces.push(ns as unknown as Record<string, unknown>);
        }

        const total = namespaces.length;
        const formatted = formatNamespaces(namespaces, true);

        // Apply manual pagination since SDK may auto-paginate
        const start = (params.page - 1) * params.per_page;
        const paged = formatted.slice(start, start + params.per_page);

        const output = {
          pagination: {
            total,
            count: paged.length,
            page: params.page,
            per_page: params.per_page,
            has_more: params.page * params.per_page < total,
          },
          namespaces: paged,
        };

        const text = truncateIfNeeded(JSON.stringify(output, null, 2));
        return { content: [{ type: "text" as const, text }] };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: handleApiError(error) }],
          isError: true,
        };
      }
    }
  );

  // ─── cf_kv_list_keys ──────────────────────────────────────────
  server.registerTool(
    "cf_kv_list_keys",
    {
      title: "List KV Keys",
      description:
        `List keys in a Workers KV namespace with optional prefix filter and cursor pagination.\n\n` +
        `Returns: { keys: [...], cursor?: "...", list_complete: bool }`,
      inputSchema: ListKeysSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: ListKeysInput) => {
      try {
        const client = getClient();
        const accountId = getAccountId(params.account_id);

        const listParams: Record<string, unknown> = {
          account_id: accountId,
          limit: params.limit,
        };
        if (params.prefix) listParams.prefix = params.prefix;
        if (params.cursor) listParams.cursor = params.cursor;

        const response = await client.kv.namespaces.keys.list(
          params.namespace_id,
          listParams as unknown as Parameters<typeof client.kv.namespaces.keys.list>[1],
        );

        const keys: Record<string, unknown>[] = [];
        for await (const key of response) {
          keys.push(key as unknown as Record<string, unknown>);
        }

        const formatted = keys.map((k) => formatKeyEntry(k));

        // Extract cursor info from the response if available
        const resultInfo = (response as unknown as Record<string, unknown>).result_info as
          | Record<string, unknown>
          | undefined;
        const cursor = resultInfo?.cursor as string | undefined;

        const output: Record<string, unknown> = {
          count: formatted.length,
          keys: formatted,
          list_complete: !cursor || formatted.length < params.limit,
        };
        if (cursor) output.cursor = cursor;

        const text = truncateIfNeeded(JSON.stringify(output, null, 2));
        return { content: [{ type: "text" as const, text }] };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: handleApiError(error) }],
          isError: true,
        };
      }
    }
  );

  // ─── cf_kv_get ────────────────────────────────────────────────
  server.registerTool(
    "cf_kv_get",
    {
      title: "Get KV Value",
      description:
        `Get the value of a key from a Workers KV namespace. ` +
        `Returns the value as text (truncated if very large).\n\n` +
        `Returns: { key: "...", value: "..." }`,
      inputSchema: GetValueSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: GetValueInput) => {
      try {
        const client = getClient();
        const accountId = getAccountId(params.account_id);

        const response = await client.kv.namespaces.values.get(
          params.namespace_id,
          params.key_name,
          { account_id: accountId } as Parameters<typeof client.kv.namespaces.values.get>[2],
        );

        // The SDK returns a Response object — read body as text
        const valueStr = await response.text();

        const output = {
          key: params.key_name,
          value: valueStr,
        };

        const text = truncateIfNeeded(JSON.stringify(output, null, 2));
        return { content: [{ type: "text" as const, text }] };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: handleApiError(error) }],
          isError: true,
        };
      }
    }
  );

  // ─── cf_kv_put ────────────────────────────────────────────────
  server.registerTool(
    "cf_kv_put",
    {
      title: "Put KV Value",
      description:
        `Write a key-value pair to a Workers KV namespace. ` +
        `Overwrites the key if it already exists.\n\n` +
        `Optional: expiration_ttl (seconds, min 60), metadata (JSON object).\n\n` +
        `Returns: { written: true, key: "..." }`,
      inputSchema: PutValueSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: PutValueInput) => {
      try {
        const client = getClient();
        const accountId = getAccountId(params.account_id);

        const updateParams: Record<string, unknown> = {
          account_id: accountId,
          value: params.value,
        };
        if (params.expiration_ttl !== undefined) updateParams.expiration_ttl = params.expiration_ttl;
        if (params.metadata !== undefined) updateParams.metadata = params.metadata;

        await client.kv.namespaces.values.update(
          params.namespace_id,
          params.key_name,
          updateParams as unknown as Parameters<typeof client.kv.namespaces.values.update>[2],
        );

        const output = {
          written: true,
          key: params.key_name,
          ...(params.expiration_ttl ? { expiration_ttl: params.expiration_ttl } : {}),
        };

        return {
          content: [{ type: "text" as const, text: JSON.stringify(output, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: handleApiError(error) }],
          isError: true,
        };
      }
    }
  );

  // ─── cf_kv_delete ─────────────────────────────────────────────
  server.registerTool(
    "cf_kv_delete",
    {
      title: "Delete KV Key",
      description:
        `Permanently delete a key from a Workers KV namespace. THIS IS IRREVERSIBLE.\n\n` +
        `Safety: You MUST set confirm=true to proceed.\n\n` +
        `Tip: Use cf_kv_get first to verify the key and its value.\n\n` +
        `Returns: { deleted: true, key: "..." }`,
      inputSchema: DeleteValueSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: DeleteValueInput) => {
      try {
        if (!params.confirm) {
          return {
            content: [{
              type: "text" as const,
              text: "Delete aborted. You must set confirm=true to permanently delete a KV key.",
            }],
            isError: true,
          };
        }

        const client = getClient();
        const accountId = getAccountId(params.account_id);

        await client.kv.namespaces.values.delete(
          params.namespace_id,
          params.key_name,
          { account_id: accountId } as Parameters<typeof client.kv.namespaces.values.delete>[2],
        );

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              deleted: true,
              key: params.key_name,
            }, null, 2),
          }],
        };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: handleApiError(error) }],
          isError: true,
        };
      }
    }
  );

  // ─── cf_kv_bulk_put ───────────────────────────────────────────
  server.registerTool(
    "cf_kv_bulk_put",
    {
      title: "Bulk Put KV Values",
      description:
        `Write up to 10,000 key-value pairs to a Workers KV namespace in a single operation.\n\n` +
        `Each entry needs: key, value. Optional: expiration_ttl, metadata.\n\n` +
        `Returns: { written: N }`,
      inputSchema: BulkPutSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: BulkPutInput) => {
      try {
        const client = getClient();
        const accountId = getAccountId(params.account_id);

        const body = params.entries.map((e) => {
          const entry: Record<string, unknown> = {
            key: e.key,
            value: e.value,
          };
          if (e.expiration_ttl !== undefined) entry.expiration_ttl = e.expiration_ttl;
          if (e.metadata !== undefined) entry.metadata = e.metadata;
          return entry;
        });

        await client.kv.namespaces.bulkUpdate(
          params.namespace_id,
          { account_id: accountId, body } as unknown as Parameters<typeof client.kv.namespaces.bulkUpdate>[1],
        );

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({ written: params.entries.length }, null, 2),
          }],
        };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: handleApiError(error) }],
          isError: true,
        };
      }
    }
  );

  // ─── cf_kv_bulk_delete ────────────────────────────────────────
  server.registerTool(
    "cf_kv_bulk_delete",
    {
      title: "Bulk Delete KV Keys",
      description:
        `Permanently delete up to 10,000 keys from a Workers KV namespace in a single operation. ` +
        `THIS IS IRREVERSIBLE.\n\n` +
        `Safety: You MUST set confirm=true to proceed.\n\n` +
        `Returns: { deleted: N }`,
      inputSchema: BulkDeleteSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: BulkDeleteInput) => {
      try {
        if (!params.confirm) {
          return {
            content: [{
              type: "text" as const,
              text: "Bulk delete aborted. You must set confirm=true to permanently delete KV keys.",
            }],
            isError: true,
          };
        }

        const client = getClient();
        const accountId = getAccountId(params.account_id);

        await client.kv.namespaces.bulkDelete(
          params.namespace_id,
          { account_id: accountId, body: params.keys } as unknown as Parameters<typeof client.kv.namespaces.bulkDelete>[1],
        );

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({ deleted: params.keys.length }, null, 2),
          }],
        };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: handleApiError(error) }],
          isError: true,
        };
      }
    }
  );
}
