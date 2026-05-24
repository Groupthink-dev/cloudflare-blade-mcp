/**
 * Cloudflare Cache tool: cf_cache_purge
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getClient } from "../services/cloudflare.js";
import { handleApiError } from "../utils/errors.js";
import { formatMetaLine, appendMeta } from "stallari-mcp-helpers";
import { CachePurgeSchema } from "../schemas/cache.js";
import type { CachePurgeInput } from "../schemas/cache.js";

export function registerCacheTools(server: McpServer): void {
  // ─── cf_cache_purge ─────────────────────────────────────────────
  server.registerTool(
    "cf_cache_purge",
    {
      title: "Purge Cache",
      description:
        `Purge cached content for a zone. Supports multiple purge modes:\n\n` +
        `- **purge_everything=true**: Removes ALL cached files (all tiers)\n` +
        `- **files**: Purge specific URLs (all tiers, max 30 per call)\n` +
        `- **tags**: Purge by Cache-Tag header (Enterprise only)\n` +
        `- **hosts**: Purge by hostname (Enterprise only)\n` +
        `- **prefixes**: Purge by URL prefix (Enterprise only)\n\n` +
        `Only one purge mode per call. Safety: You MUST set confirm=true.\n\n` +
        `Returns: { purged: true, id, mode }`,
      inputSchema: CachePurgeSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: CachePurgeInput) => {
      try {
        if (!params.confirm) {
          return {
            content: [{
              type: "text" as const,
              text: "Purge aborted. You must set confirm=true to purge cache.",
            }],
            isError: true,
          };
        }

        // Validate exactly one purge mode is specified
        const modes = [
          params.purge_everything ? "purge_everything" : null,
          params.files?.length ? "files" : null,
          params.tags?.length ? "tags" : null,
          params.hosts?.length ? "hosts" : null,
          params.prefixes?.length ? "prefixes" : null,
        ].filter(Boolean);

        if (modes.length === 0) {
          return {
            content: [{
              type: "text" as const,
              text: "Error: Specify at least one purge mode (purge_everything, files, tags, hosts, or prefixes).",
            }],
            isError: true,
          };
        }

        if (modes.length > 1) {
          return {
            content: [{
              type: "text" as const,
              text: `Error: Only one purge mode per call. You specified: ${modes.join(", ")}. Make separate calls for each mode.`,
            }],
            isError: true,
          };
        }

        const t0 = performance.now();
        const client = getClient();
        const mode = modes[0]!;

        // Build the purge body based on mode
        const body: Record<string, unknown> = { zone_id: params.zone_id };
        if (params.purge_everything) body.purge_everything = true;
        if (params.files?.length) body.files = params.files;
        if (params.tags?.length) body.tags = params.tags;
        if (params.hosts?.length) body.hosts = params.hosts;
        if (params.prefixes?.length) body.prefixes = params.prefixes;

        const result = await client.cache.purge(
          body as unknown as Parameters<typeof client.cache.purge>[0]
        );

        const resultObj = result as unknown as Record<string, unknown> | null;

        // Compute rows_affected from the mode's target set when present
        let rowsAffected: number;
        if (params.purge_everything) {
          rowsAffected = 1;
        } else if (params.files?.length) {
          rowsAffected = params.files.length;
        } else if (params.tags?.length) {
          rowsAffected = params.tags.length;
        } else if (params.hosts?.length) {
          rowsAffected = params.hosts.length;
        } else if (params.prefixes?.length) {
          rowsAffected = params.prefixes.length;
        } else {
          rowsAffected = 1;
        }

        const text = JSON.stringify({
          purged: true,
          id: resultObj?.id ?? null,
          mode,
        }, null, 2);
        const metaLine = formatMetaLine({
          filtered_by: [],
          latency_ms: Math.round(performance.now() - t0),
          redactions: [],
          next_cursor: null,
          rows_affected: rowsAffected,
          target_id: params.zone_id,
          write_durability: "edge",
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
