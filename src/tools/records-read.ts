/**
 * DNS record read tools: cf_dns_list_records, cf_dns_get_record, cf_dns_export_records
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getClient } from "../services/cloudflare.js";
import { formatRecord, formatRecords, buildRecordSummary } from "../formatters/record.js";
import { buildPaginationMeta, truncateIfNeeded, randomSample } from "../utils/pagination.js";
import { handleApiError } from "../utils/errors.js";
import { formatMetaLine, appendMeta } from "../utils/meta.js";
import {
  ListRecordsSchema,
  GetRecordSchema,
  ExportRecordsSchema,
} from "../schemas/records.js";
import type {
  ListRecordsInput,
  GetRecordInput,
  ExportRecordsInput,
} from "../schemas/records.js";

export function registerRecordReadTools(server: McpServer): void {
  // ─── cf_dns_list_records ─────────────────────────────────────
  server.registerTool(
    "cf_dns_list_records",
    {
      title: "List DNS Records",
      description:
        `List DNS records for a zone with powerful filtering and token-efficient output.\n\n` +
        `Modes:\n` +
        `  • summary_only=true → returns only count + type distribution (most token-efficient)\n` +
        `  • random_sample=true → returns N random records for quick audits\n` +
        `  • default → paginated concise records\n\n` +
        `Filters: filter_type, filter_name, filter_content, filter_proxied, filter_comment, filter_tag\n\n` +
        `Returns: { pagination, summary, records[] } — fields present depend on mode.`,
      inputSchema: ListRecordsSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: ListRecordsInput) => {
      try {
        const client = getClient();
        const concise = params.include_details ? false : params.concise;

        // Build Cloudflare API query params
        const queryParams: Record<string, unknown> = {
          page: params.page,
          per_page: params.per_page,
        };
        if (params.filter_type) queryParams.type = params.filter_type;
        if (params.filter_name) queryParams["name.contains"] = params.filter_name;
        if (params.filter_content) queryParams["content.contains"] = params.filter_content;
        if (params.filter_proxied !== undefined) queryParams.proxied = params.filter_proxied;
        if (params.filter_comment) queryParams["comment.contains"] = params.filter_comment;
        if (params.filter_tag) queryParams.tag = params.filter_tag;
        if (params.order) queryParams.order = params.order;

        // Fetch records — use the SDK's page-level API for controlled pagination
        const page = await client.dns.records.list({
          zone_id: params.zone_id,
          ...queryParams,
        } as Parameters<typeof client.dns.records.list>[0]);

        const records: Record<string, unknown>[] = [];
        for await (const record of page) {
          records.push(record as unknown as Record<string, unknown>);
          // Safety: stop collecting if we've gathered way more than needed
          if (records.length >= params.per_page * 10 && !params.summary_only && !params.random_sample) break;
        }

        const total = records.length;

        // ── Summary-only mode (most token-efficient) ──
        if (params.summary_only) {
          const summary = buildRecordSummary(records);
          return {
            content: [{ type: "text" as const, text: JSON.stringify({ summary }, null, 2) }],
          };
        }

        // ── Random sample mode ──
        if (params.random_sample) {
          const sampled = randomSample(records, params.sample_size);
          const formatted = formatRecords(sampled, concise);
          const output = {
            sample: { total_in_zone: total, sample_size: formatted.length },
            records: formatted,
          };
          return {
            content: [{ type: "text" as const, text: truncateIfNeeded(JSON.stringify(output, null, 2)) }],
          };
        }

        // ── Paginated mode (default) ──
        const start = (params.page - 1) * params.per_page;
        const paged = records.slice(start, start + params.per_page);
        const formatted = formatRecords(paged, concise);
        const pagination = buildPaginationMeta(total, formatted, params.page, params.per_page);

        // Include summary stats alongside records for zones with many records
        const summary = total > 20 ? buildRecordSummary(records) : undefined;

        const output = {
          pagination,
          ...(summary ? { summary } : {}),
          records: formatted,
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

  // ─── cf_dns_get_record ───────────────────────────────────────
  server.registerTool(
    "cf_dns_get_record",
    {
      title: "Get DNS Record",
      description:
        `Get a single DNS record by ID. Returns concise output by default.\n\n` +
        `Returns: { record: { id, type, name, content, proxied, ttl, ... } }`,
      inputSchema: GetRecordSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: GetRecordInput) => {
      try {
        const client = getClient();
        const concise = params.include_details ? false : params.concise;

        const record = await client.dns.records.get(params.record_id, {
          zone_id: params.zone_id,
        });

        const formatted = formatRecord(record as unknown as Record<string, unknown>, concise);
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ record: formatted }, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: handleApiError(error) }],
          isError: true,
        };
      }
    }
  );

  // ─── cf_dns_export_records ───────────────────────────────────
  server.registerTool(
    "cf_dns_export_records",
    {
      title: "Export DNS Records (BIND format)",
      description:
        `Export all DNS records for a zone in BIND zonefile format. ` +
        `Useful for backups, migrations, and auditing.\n\n` +
        `Returns: raw BIND zonefile text.`,
      inputSchema: ExportRecordsSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: ExportRecordsInput) => {
      try {
        const t0 = performance.now();
        const client = getClient();
        const result = await client.dns.records.export({ zone_id: params.zone_id });
        const latencyMs = Math.round(performance.now() - t0);
        const text = typeof result === "string" ? result : JSON.stringify(result);
        const truncated = truncateIfNeeded(text);
        // For BIND zonefile exports, record count is an approximation —
        // count non-comment, non-blank lines as a proxy for record cardinality.
        const recordLines = truncated
          .split("\n")
          .filter((line) => line.trim() && !line.trim().startsWith(";")).length;
        const metaLine = formatMetaLine({
          matched_total: recordLines,
          returned: recordLines,
          filtered_by: [`zone_id=${params.zone_id}`],
          latency_ms: latencyMs,
        });
        return {
          content: [{ type: "text" as const, text: appendMeta(truncated, metaLine) }],
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
