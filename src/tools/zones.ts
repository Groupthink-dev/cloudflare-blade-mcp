/**
 * Zone read tools: cf_dns_list_zones, cf_dns_get_zone
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getClient } from "../services/cloudflare.js";
import { formatZone, formatZones } from "../formatters/zone.js";
import { buildPaginationMeta, truncateIfNeeded } from "../utils/pagination.js";
import { handleApiError } from "../utils/errors.js";
import { ListZonesSchema, GetZoneSchema } from "../schemas/zones.js";
import type { ListZonesInput, GetZoneInput } from "../schemas/zones.js";
import { formatMetaLine, appendMeta } from "stallari-mcp-helpers";

export function registerZoneTools(server: McpServer): void {
  // ─── cf_dns_list_zones ───────────────────────────────────────
  server.registerTool(
    "cf_dns_list_zones",
    {
      title: "List Cloudflare Zones",
      description:
        `List DNS zones (domains) in your Cloudflare account. ` +
        `Returns concise output by default (id, name, status, nameservers). ` +
        `Use filters to narrow results. Use include_details=true for full zone metadata.\n\n` +
        `Returns: { pagination: { total, count, page, per_page, has_more }, zones: [...] }`,
      inputSchema: ListZonesSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: ListZonesInput) => {
      try {
        const t0 = performance.now();
        const client = getClient();
        const concise = params.include_details ? false : params.concise;

        const queryParams: Record<string, unknown> = {
          page: params.page,
          per_page: params.per_page,
        };
        if (params.filter_name) queryParams.name = params.filter_name;
        if (params.filter_status) queryParams.status = params.filter_status;
        if (params.filter_account_id) queryParams["account.id"] = params.filter_account_id;

        const response = await client.zones.list(queryParams as Parameters<typeof client.zones.list>[0]);

        // Extract zones from the response
        const zones: Record<string, unknown>[] = [];
        for await (const zone of response) {
          zones.push(zone as unknown as Record<string, unknown>);
        }

        const total = zones.length; // The SDK auto-paginates, so we get all matching
        const formatted = formatZones(zones, concise);
        const pagination = buildPaginationMeta(total, formatted, params.page, params.per_page);

        // Apply manual pagination since SDK auto-paginates
        const start = (params.page - 1) * params.per_page;
        const paged = formatted.slice(start, start + params.per_page);

        const output = {
          pagination: { ...pagination, count: paged.length },
          zones: paged,
        };

        const filteredBy: string[] = [`page=${params.page}`, `per_page=${params.per_page}`];
        if (params.filter_name) filteredBy.push(`name=${params.filter_name}`);
        if (params.filter_status) filteredBy.push(`status=${params.filter_status}`);
        if (params.filter_account_id) filteredBy.push(`account_id=${params.filter_account_id}`);

        const text = truncateIfNeeded(JSON.stringify(output, null, 2));
        const metaLine = formatMetaLine({
          matched_total: total,
          returned: paged.length,
          filtered_by: filteredBy,
          latency_ms: Math.round(performance.now() - t0),
          redactions: [],
          next_cursor: null,
        });
        return { content: [{ type: "text" as const, text: appendMeta(text, metaLine) }] };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: handleApiError(error) }],
          isError: true,
        };
      }
    }
  );

  // ─── cf_dns_get_zone ─────────────────────────────────────────
  server.registerTool(
    "cf_dns_get_zone",
    {
      title: "Get Zone Details",
      description:
        `Get details for a single Cloudflare zone by ID or domain name. ` +
        `Returns concise output by default. Use include_details=true for full metadata.\n\n` +
        `Returns: { zone: { id, name, status, name_servers, ... } }`,
      inputSchema: GetZoneSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: GetZoneInput) => {
      try {
        const client = getClient();
        const concise = params.include_details ? false : params.concise;

        let zoneId = params.zone_id;

        // If zone_name provided, look up the zone ID
        if (!zoneId && params.zone_name) {
          const search = await client.zones.list({ name: params.zone_name });
          const zones: Record<string, unknown>[] = [];
          for await (const z of search) {
            zones.push(z as unknown as Record<string, unknown>);
          }
          if (zones.length === 0) {
            return {
              content: [{ type: "text" as const, text: `No zone found for domain '${params.zone_name}'.` }],
              isError: true,
            };
          }
          zoneId = String(zones[0].id);
        }

        if (!zoneId) {
          return {
            content: [{ type: "text" as const, text: "Provide either zone_id or zone_name." }],
            isError: true,
          };
        }

        const zone = await client.zones.get({ zone_id: zoneId });
        const formatted = formatZone(zone as unknown as Record<string, unknown>, concise);

        const output = { zone: formatted };
        return { content: [{ type: "text" as const, text: JSON.stringify(output, null, 2) }] };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: handleApiError(error) }],
          isError: true,
        };
      }
    }
  );
}
