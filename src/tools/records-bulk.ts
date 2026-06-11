/**
 * Bulk DNS record tools: cf_dns_bulk_create, cf_dns_bulk_update
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getClient } from "../services/cloudflare.js";
import { formatRecord } from "../formatters/record.js";
import { handleApiError } from "../utils/errors.js";
import { formatMetaLine, appendMeta } from "stallari-mcp-helpers";
import { BulkCreateSchema, BulkUpdateSchema } from "../schemas/records.js";
import type { BulkCreateInput, BulkUpdateInput } from "../schemas/records.js";

export function registerBulkTools(server: McpServer): void {
  // ─── cf_dns_bulk_create ──────────────────────────────────────
  server.registerTool(
    "cf_dns_bulk_create",
    {
      title: "Bulk Create DNS Records",
      description:
        `Create multiple DNS records in a single operation (max 100 per call).\n\n` +
        `Each record in the array needs: type, name, content.\n` +
        `Optional per record: ttl, proxied, priority, comment, tags, data.\n\n` +
        `Records are created sequentially. If one fails, previously created records persist.\n\n` +
        `Safety: You MUST set confirm=true to proceed.\n\n` +
        `Returns: { created: N, failed: N, results: [...] }`,
      inputSchema: BulkCreateSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (params: BulkCreateInput) => {
      try {
        // Safety: confirm must be true (enforced by Zod z.literal(true))
        if (!params.confirm) {
          return {
            content: [{
              type: "text" as const,
              text: "Bulk create aborted. You must set confirm=true to bulk-create DNS records.",
            }],
            isError: true,
          };
        }

        const t0 = performance.now();
        const client = getClient();
        const results: Array<{
          index: number;
          success: boolean;
          record?: unknown;
          error?: string;
        }> = [];

        let created = 0;
        let failed = 0;

        for (let i = 0; i < params.records.length; i++) {
          const rec = params.records[i];
          try {
            const payload: Record<string, unknown> = {
              type: rec.type,
              name: rec.name,
              content: rec.content,
              ttl: rec.ttl,
            };
            if (rec.proxied !== undefined) payload.proxied = rec.proxied;
            if (rec.priority !== undefined) payload.priority = rec.priority;
            if (rec.comment) payload.comment = rec.comment;
            if (rec.tags) payload.tags = rec.tags;
            if (rec.data) payload.data = rec.data;

            const record = await client.dns.records.create({
              zone_id: params.zone_id,
              ...payload,
            } as Parameters<typeof client.dns.records.create>[0]);

            const formatted = formatRecord(record as unknown as Record<string, unknown>, true);
            results.push({ index: i, success: true, record: formatted });
            created++;
          } catch (error) {
            results.push({ index: i, success: false, error: handleApiError(error) });
            failed++;
          }
        }

        const text = JSON.stringify({ created, failed, total: params.records.length, results }, null, 2);
        const metaLine = formatMetaLine({
          filtered_by: [],
          latency_ms: Math.round(performance.now() - t0),
          redactions: [],
          next_cursor: null,
          rows_affected: created,
          target_id: params.zone_id,
          write_durability: "replicated",
          response_timestamp: new Date().toISOString(),
        });
        return {
          content: [{ type: "text" as const, text: appendMeta(text, metaLine) }],
        };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: handleApiError(error) }],
          isError: true,
        };
      }
    }
  );

  // ─── cf_dns_bulk_update ──────────────────────────────────────
  server.registerTool(
    "cf_dns_bulk_update",
    {
      title: "Bulk Update DNS Records",
      description:
        `Update multiple DNS records in a single operation (max 100 per call).\n\n` +
        `Each record needs: record_id + any fields to change (content, name, ttl, proxied, comment, tags, data).\n\n` +
        `Records are updated sequentially. If one fails, previously updated records persist.\n\n` +
        `Safety: You MUST set confirm=true to proceed.\n\n` +
        `Returns: { updated: N, failed: N, results: [...] }`,
      inputSchema: BulkUpdateSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: BulkUpdateInput) => {
      try {
        // Safety: confirm must be true (enforced by Zod z.literal(true))
        if (!params.confirm) {
          return {
            content: [{
              type: "text" as const,
              text: "Bulk update aborted. You must set confirm=true to bulk-update DNS records.",
            }],
            isError: true,
          };
        }

        const t0 = performance.now();
        const client = getClient();
        const results: Array<{
          index: number;
          record_id: string;
          success: boolean;
          record?: unknown;
          error?: string;
        }> = [];

        let updated = 0;
        let failed = 0;

        for (let i = 0; i < params.records.length; i++) {
          const rec = params.records[i];
          try {
            const payload: Record<string, unknown> = {};
            if (rec.content !== undefined) payload.content = rec.content;
            if (rec.name !== undefined) payload.name = rec.name;
            if (rec.ttl !== undefined) payload.ttl = rec.ttl;
            if (rec.proxied !== undefined) payload.proxied = rec.proxied;
            if (rec.comment !== undefined) payload.comment = rec.comment;
            if (rec.tags !== undefined) payload.tags = rec.tags;
            if (rec.data !== undefined) payload.data = rec.data;

            const record = await client.dns.records.edit(rec.record_id, {
              zone_id: params.zone_id,
              ...payload,
            } as Parameters<typeof client.dns.records.edit>[1]);

            const formatted = formatRecord(record as unknown as Record<string, unknown>, true);
            results.push({ index: i, record_id: rec.record_id, success: true, record: formatted });
            updated++;
          } catch (error) {
            results.push({ index: i, record_id: rec.record_id, success: false, error: handleApiError(error) });
            failed++;
          }
        }

        const text = JSON.stringify({ updated, failed, total: params.records.length, results }, null, 2);
        const metaLine = formatMetaLine({
          filtered_by: [],
          latency_ms: Math.round(performance.now() - t0),
          redactions: [],
          next_cursor: null,
          rows_affected: updated,
          target_id: params.zone_id,
          write_durability: "replicated",
          response_timestamp: new Date().toISOString(),
        });
        return {
          content: [{ type: "text" as const, text: appendMeta(text, metaLine) }],
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
