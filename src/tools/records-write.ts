/**
 * DNS record write tools: cf_dns_create_record, cf_dns_update_record, cf_dns_delete_record
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getClient } from "../services/cloudflare.js";
import { formatRecord } from "../formatters/record.js";
import { handleApiError } from "../utils/errors.js";
import { formatMetaLine, appendMeta } from "stallari-mcp-helpers";
import {
  CreateRecordSchema,
  UpdateRecordSchema,
  DeleteRecordSchema,
} from "../schemas/records.js";
import type {
  CreateRecordInput,
  UpdateRecordInput,
  DeleteRecordInput,
} from "../schemas/records.js";

export function registerRecordWriteTools(server: McpServer): void {
  // ─── cf_dns_create_record ────────────────────────────────────
  server.registerTool(
    "cf_dns_create_record",
    {
      title: "Create DNS Record",
      description:
        `Create a new DNS record in a zone. Supports all record types: ` +
        `A, AAAA, CNAME, MX, TXT, SRV, CAA, NS, PTR, and more.\n\n` +
        `Required: zone_id, type, name, content.\n` +
        `Optional: ttl (1=auto), proxied (A/AAAA/CNAME only), priority (MX), comment, tags.\n` +
        `For complex types (SRV, CAA, CERT), use the 'data' field with structured JSON.\n\n` +
        `Safety: You MUST set confirm=true to proceed.\n\n` +
        `Returns: the created record in concise format.`,
      inputSchema: CreateRecordSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (params: CreateRecordInput) => {
      try {
        // Safety: confirm must be true (enforced by Zod z.literal(true))
        if (!params.confirm) {
          return {
            content: [{
              type: "text" as const,
              text: "Create aborted. You must set confirm=true to create a DNS record.",
            }],
            isError: true,
          };
        }

        const t0 = performance.now();
        const client = getClient();

        // Build the create payload
        const payload: Record<string, unknown> = {
          type: params.type,
          name: params.name,
          content: params.content,
          ttl: params.ttl,
        };

        if (params.proxied !== undefined) payload.proxied = params.proxied;
        if (params.priority !== undefined) payload.priority = params.priority;
        if (params.comment) payload.comment = params.comment;
        if (params.tags) payload.tags = params.tags;
        if (params.data) payload.data = params.data;

        const record = await client.dns.records.create({
          zone_id: params.zone_id,
          ...payload,
        } as Parameters<typeof client.dns.records.create>[0]);

        const formatted = formatRecord(record as unknown as Record<string, unknown>, true);
        const recordId = String((record as unknown as Record<string, unknown>).id ?? "");
        const text = JSON.stringify({ created: true, record: formatted }, null, 2);
        const metaLine = formatMetaLine({
          filtered_by: [],
          latency_ms: Math.round(performance.now() - t0),
          redactions: [],
          next_cursor: null,
          rows_affected: 1,
          target_id: `${params.zone_id}/${recordId}`,
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

  // ─── cf_dns_update_record ────────────────────────────────────
  server.registerTool(
    "cf_dns_update_record",
    {
      title: "Update DNS Record",
      description:
        `Update an existing DNS record (partial update / PATCH). ` +
        `Only the fields you provide will be changed; others remain untouched.\n\n` +
        `Required: zone_id, record_id.\n` +
        `Updatable: content, name, ttl, proxied, comment, tags, data.\n\n` +
        `Safety: You MUST set confirm=true to proceed.\n\n` +
        `Returns: the updated record in concise format.`,
      inputSchema: UpdateRecordSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: UpdateRecordInput) => {
      try {
        // Safety: confirm must be true (enforced by Zod z.literal(true))
        if (!params.confirm) {
          return {
            content: [{
              type: "text" as const,
              text: "Update aborted. You must set confirm=true to update a DNS record.",
            }],
            isError: true,
          };
        }

        const t0 = performance.now();
        const client = getClient();

        // Build patch payload — only include fields that were provided
        const payload: Record<string, unknown> = {};
        if (params.content !== undefined) payload.content = params.content;
        if (params.name !== undefined) payload.name = params.name;
        if (params.ttl !== undefined) payload.ttl = params.ttl;
        if (params.proxied !== undefined) payload.proxied = params.proxied;
        if (params.comment !== undefined) payload.comment = params.comment;
        if (params.tags !== undefined) payload.tags = params.tags;
        if (params.data !== undefined) payload.data = params.data;

        if (Object.keys(payload).length === 0) {
          return {
            content: [{
              type: "text" as const,
              text: "No fields to update. Provide at least one of: content, name, ttl, proxied, comment, tags, data.",
            }],
            isError: true,
          };
        }

        const record = await client.dns.records.edit(params.record_id, {
          zone_id: params.zone_id,
          ...payload,
        } as Parameters<typeof client.dns.records.edit>[1]);

        const formatted = formatRecord(record as unknown as Record<string, unknown>, true);
        const text = JSON.stringify({ updated: true, record: formatted }, null, 2);
        const metaLine = formatMetaLine({
          filtered_by: [],
          latency_ms: Math.round(performance.now() - t0),
          redactions: [],
          next_cursor: null,
          rows_affected: 1,
          target_id: `${params.zone_id}/${params.record_id}`,
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

  // ─── cf_dns_delete_record ────────────────────────────────────
  server.registerTool(
    "cf_dns_delete_record",
    {
      title: "Delete DNS Record",
      description:
        `Permanently delete a DNS record. THIS IS IRREVERSIBLE.\n\n` +
        `Safety: You MUST set confirm=true to proceed. The tool will refuse ` +
        `without explicit confirmation.\n\n` +
        `Tip: Use cf_dns_get_record first to verify you have the right record.\n\n` +
        `Returns: { deleted: true, record_id: "..." }`,
      inputSchema: DeleteRecordSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: DeleteRecordInput) => {
      try {
        // Safety: confirm must be true (enforced by Zod z.literal(true))
        if (!params.confirm) {
          return {
            content: [{
              type: "text" as const,
              text: "Delete aborted. You must set confirm=true to permanently delete a DNS record.",
            }],
            isError: true,
          };
        }

        const t0 = performance.now();
        const client = getClient();

        // Fetch the record first so we can show what was deleted
        let recordInfo: string;
        try {
          const existing = await client.dns.records.get(params.record_id, {
            zone_id: params.zone_id,
          });
          const r = existing as unknown as Record<string, unknown>;
          recordInfo = `${r.type} ${r.name} → ${r.content}`;
        } catch {
          recordInfo = params.record_id;
        }

        await client.dns.records.delete(params.record_id, {
          zone_id: params.zone_id,
        });

        const text = JSON.stringify({
          deleted: true,
          record_id: params.record_id,
          was: recordInfo,
        }, null, 2);
        const metaLine = formatMetaLine({
          filtered_by: [],
          latency_ms: Math.round(performance.now() - t0),
          redactions: [],
          next_cursor: null,
          rows_affected: 1,
          target_id: `${params.zone_id}/${params.record_id}`,
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
