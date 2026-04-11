/**
 * Cloudflare R2 tools: cf_r2_list_buckets, cf_r2_get_bucket,
 * cf_r2_create_bucket, cf_r2_delete_bucket
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getClient, getAccountId } from "../services/cloudflare.js";
import { formatBucket, formatBuckets } from "../formatters/r2.js";
import { truncateIfNeeded } from "../utils/pagination.js";
import { handleApiError } from "../utils/errors.js";
import {
  ListBucketsSchema,
  GetBucketSchema,
  CreateBucketSchema,
  DeleteBucketSchema,
} from "../schemas/r2.js";
import type {
  ListBucketsInput,
  GetBucketInput,
  CreateBucketInput,
  DeleteBucketInput,
} from "../schemas/r2.js";

export function registerR2Tools(server: McpServer): void {
  // ─── cf_r2_list_buckets ─────────────────────────────────────────
  server.registerTool(
    "cf_r2_list_buckets",
    {
      title: "List R2 Buckets",
      description:
        `List R2 buckets in your account with optional name filter.\n\n` +
        `Returns: { buckets[] } with name, location, jurisdiction, storage_class, creation_date.`,
      inputSchema: ListBucketsSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: ListBucketsInput) => {
      try {
        const client = getClient();
        const accountId = getAccountId(params.account_id);

        const queryParams: Record<string, unknown> = {
          account_id: accountId,
          per_page: params.per_page,
        };
        if (params.name_contains) queryParams.name_contains = params.name_contains;
        if (params.cursor) queryParams.cursor = params.cursor;

        const result = await client.r2.buckets.list(
          queryParams as unknown as Parameters<typeof client.r2.buckets.list>[0]
        );

        const resultObj = result as unknown as Record<string, unknown>;
        const buckets = Array.isArray(resultObj.buckets) ? resultObj.buckets : [];
        const formatted = formatBuckets(buckets as Record<string, unknown>[]);

        const output: Record<string, unknown> = {
          total: formatted.length,
          buckets: formatted,
        };

        // Include cursor for pagination if present
        if (resultObj.cursor) {
          output.next_cursor = resultObj.cursor;
        }

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

  // ─── cf_r2_get_bucket ───────────────────────────────────────────
  server.registerTool(
    "cf_r2_get_bucket",
    {
      title: "Get R2 Bucket Details",
      description:
        `Get details for a single R2 bucket by name.\n\n` +
        `Returns: { bucket: { name, location, jurisdiction, storage_class, creation_date } }`,
      inputSchema: GetBucketSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: GetBucketInput) => {
      try {
        const client = getClient();
        const accountId = getAccountId(params.account_id);

        const queryParams: Record<string, unknown> = { account_id: accountId };
        if (params.jurisdiction) queryParams.jurisdiction = params.jurisdiction;

        const bucket = await client.r2.buckets.get(
          params.bucket_name,
          queryParams as unknown as Parameters<typeof client.r2.buckets.get>[1]
        );

        const formatted = formatBucket(bucket as unknown as Record<string, unknown>);
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ bucket: formatted }, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: handleApiError(error) }],
          isError: true,
        };
      }
    }
  );

  // ─── cf_r2_create_bucket ────────────────────────────────────────
  server.registerTool(
    "cf_r2_create_bucket",
    {
      title: "Create R2 Bucket",
      description:
        `Create a new R2 bucket. Bucket names must be globally unique.\n\n` +
        `Safety: You MUST set confirm=true to proceed.\n\n` +
        `Returns: { created: true, bucket: { name, location, ... } }`,
      inputSchema: CreateBucketSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (params: CreateBucketInput) => {
      try {
        if (!params.confirm) {
          return {
            content: [{
              type: "text" as const,
              text: "Create aborted. You must set confirm=true to create a bucket.",
            }],
            isError: true,
          };
        }

        const client = getClient();
        const accountId = getAccountId(params.account_id);

        const body: Record<string, unknown> = {
          account_id: accountId,
          name: params.name,
          storageClass: params.storage_class,
        };
        if (params.location) body.locationHint = params.location;
        if (params.jurisdiction) body.jurisdiction = params.jurisdiction;

        const bucket = await client.r2.buckets.create(
          body as unknown as Parameters<typeof client.r2.buckets.create>[0]
        );

        const formatted = formatBucket(bucket as unknown as Record<string, unknown>);
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({ created: true, bucket: formatted }, null, 2),
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

  // ─── cf_r2_delete_bucket ────────────────────────────────────────
  server.registerTool(
    "cf_r2_delete_bucket",
    {
      title: "Delete R2 Bucket",
      description:
        `Delete an R2 bucket. The bucket MUST be empty. THIS IS IRREVERSIBLE.\n\n` +
        `Safety: You MUST set confirm=true to proceed.\n\n` +
        `Tip: Use cf_r2_get_bucket first to verify you have the right bucket.\n\n` +
        `Returns: { deleted: true, bucket_name }`,
      inputSchema: DeleteBucketSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: DeleteBucketInput) => {
      try {
        if (!params.confirm) {
          return {
            content: [{
              type: "text" as const,
              text: "Delete aborted. You must set confirm=true to permanently delete a bucket.",
            }],
            isError: true,
          };
        }

        const client = getClient();
        const accountId = getAccountId(params.account_id);

        const body: Record<string, unknown> = { account_id: accountId };
        if (params.jurisdiction) body.jurisdiction = params.jurisdiction;

        await client.r2.buckets.delete(
          params.bucket_name,
          body as unknown as Parameters<typeof client.r2.buckets.delete>[1]
        );

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              deleted: true,
              bucket_name: params.bucket_name,
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
}
