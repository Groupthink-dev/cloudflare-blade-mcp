/**
 * Cloudflare Tunnel tools: cf_tunnel_list, cf_tunnel_get, cf_tunnel_create,
 * cf_tunnel_delete, cf_tunnel_list_configs, cf_tunnel_update_config, cf_tunnel_list_connections
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getClient, getAccountId } from "../services/cloudflare.js";
import { formatTunnel, formatTunnels, formatConnection, formatIngressRule } from "../formatters/tunnel.js";
import { truncateIfNeeded } from "../utils/pagination.js";
import { handleApiError } from "../utils/errors.js";
import {
  ListTunnelsSchema,
  GetTunnelSchema,
  CreateTunnelSchema,
  DeleteTunnelSchema,
  ListConfigsSchema,
  UpdateConfigSchema,
  ListConnectionsSchema,
} from "../schemas/tunnels.js";
import type {
  ListTunnelsInput,
  GetTunnelInput,
  CreateTunnelInput,
  DeleteTunnelInput,
  ListConfigsInput,
  UpdateConfigInput,
  ListConnectionsInput,
} from "../schemas/tunnels.js";

export function registerTunnelTools(server: McpServer): void {
  // ─── cf_tunnel_list ─────────────────────────────────────────────
  server.registerTool(
    "cf_tunnel_list",
    {
      title: "List Cloudflare Tunnels",
      description:
        `List Cloudflare Tunnels in your account with optional name filter.\n\n` +
        `Returns: { pagination, tunnels[] } with concise output by default ` +
        `(id, name, status, created_at, connections_count).`,
      inputSchema: ListTunnelsSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: ListTunnelsInput) => {
      try {
        const client = getClient();
        const accountId = getAccountId(params.account_id);

        const queryParams: Record<string, unknown> = {
          account_id: accountId,
          is_deleted: params.is_deleted,
          page: params.page,
          per_page: params.per_page,
        };
        if (params.name) queryParams.name = params.name;

        // Use cloudflared.list() for Cloudflare Tunnels specifically
        const response = await client.zeroTrust.tunnels.cloudflared.list(
          queryParams as unknown as Parameters<typeof client.zeroTrust.tunnels.cloudflared.list>[0]
        );

        const tunnels: Record<string, unknown>[] = [];
        for await (const tunnel of response) {
          tunnels.push(tunnel as unknown as Record<string, unknown>);
        }

        const total = tunnels.length;
        const start = (params.page - 1) * params.per_page;
        const paged = tunnels.slice(start, start + params.per_page);
        const formatted = formatTunnels(paged, true);

        const output = {
          pagination: {
            total,
            count: formatted.length,
            page: params.page,
            per_page: params.per_page,
            has_more: params.page * params.per_page < total,
          },
          tunnels: formatted,
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

  // ─── cf_tunnel_get ──────────────────────────────────────────────
  server.registerTool(
    "cf_tunnel_get",
    {
      title: "Get Tunnel Details",
      description:
        `Get details for a single Cloudflare Tunnel by ID.\n\n` +
        `Returns: { tunnel: { id, name, status, created_at, connections_count } }`,
      inputSchema: GetTunnelSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: GetTunnelInput) => {
      try {
        const client = getClient();
        const accountId = getAccountId(params.account_id);

        const tunnel = await client.zeroTrust.tunnels.cloudflared.get(params.tunnel_id, {
          account_id: accountId,
        });

        const formatted = formatTunnel(tunnel as unknown as Record<string, unknown>, true);
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ tunnel: formatted }, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: handleApiError(error) }],
          isError: true,
        };
      }
    }
  );

  // ─── cf_tunnel_create ───────────────────────────────────────────
  server.registerTool(
    "cf_tunnel_create",
    {
      title: "Create Cloudflare Tunnel",
      description:
        `Create a new Cloudflare Tunnel. Requires a unique name and a base64-encoded secret.\n\n` +
        `Generate a secret: openssl rand -base64 32\n\n` +
        `Returns: { created: true, tunnel: { id, name, status, ... } }`,
      inputSchema: CreateTunnelSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (params: CreateTunnelInput) => {
      try {
        const client = getClient();
        const accountId = getAccountId(params.account_id);

        const payload: Record<string, unknown> = {
          account_id: accountId,
          name: params.name,
          tunnel_secret: params.tunnel_secret,
        };
        if (params.config_src) payload.config_src = params.config_src;

        const tunnel = await client.zeroTrust.tunnels.cloudflared.create(
          payload as unknown as Parameters<typeof client.zeroTrust.tunnels.cloudflared.create>[0]
        );

        const formatted = formatTunnel(tunnel as unknown as Record<string, unknown>, true);
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({ created: true, tunnel: formatted }, null, 2),
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

  // ─── cf_tunnel_delete ───────────────────────────────────────────
  server.registerTool(
    "cf_tunnel_delete",
    {
      title: "Delete Cloudflare Tunnel",
      description:
        `Permanently delete a Cloudflare Tunnel. THIS IS IRREVERSIBLE.\n\n` +
        `Safety: You MUST set confirm=true to proceed. The tool will refuse ` +
        `without explicit confirmation.\n\n` +
        `Tip: Use cf_tunnel_get first to verify you have the right tunnel.\n\n` +
        `Returns: { deleted: true, tunnel_id: "..." }`,
      inputSchema: DeleteTunnelSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: DeleteTunnelInput) => {
      try {
        if (!params.confirm) {
          return {
            content: [{
              type: "text" as const,
              text: "Delete aborted. You must set confirm=true to permanently delete a tunnel.",
            }],
            isError: true,
          };
        }

        const client = getClient();
        const accountId = getAccountId(params.account_id);

        // Fetch the tunnel first so we can show what was deleted
        let tunnelInfo: string;
        try {
          const existing = await client.zeroTrust.tunnels.cloudflared.get(params.tunnel_id, {
            account_id: accountId,
          });
          const t = existing as unknown as Record<string, unknown>;
          tunnelInfo = `${t.name} (${t.status})`;
        } catch {
          tunnelInfo = params.tunnel_id;
        }

        await client.zeroTrust.tunnels.cloudflared.delete(params.tunnel_id, {
          account_id: accountId,
        });

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              deleted: true,
              tunnel_id: params.tunnel_id,
              was: tunnelInfo,
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

  // ─── cf_tunnel_list_configs ─────────────────────────────────────
  server.registerTool(
    "cf_tunnel_list_configs",
    {
      title: "List Tunnel Ingress Configuration",
      description:
        `Get the ingress configuration (routing rules) for a Cloudflare Tunnel.\n\n` +
        `Returns: { tunnel_id, ingress: [{ hostname, service, path? }, ...] }`,
      inputSchema: ListConfigsSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: ListConfigsInput) => {
      try {
        const client = getClient();
        const accountId = getAccountId(params.account_id);

        const config = await client.zeroTrust.tunnels.cloudflared.configurations.get(
          params.tunnel_id,
          { account_id: accountId }
        );

        const configObj = config as unknown as Record<string, unknown>;
        const tunnelConfig = configObj.config as Record<string, unknown> | undefined;
        const ingress = Array.isArray(tunnelConfig?.ingress) ? tunnelConfig.ingress : [];
        const formatted = ingress.map((rule: Record<string, unknown>) => formatIngressRule(rule));

        const output = {
          tunnel_id: params.tunnel_id,
          ingress: formatted,
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

  // ─── cf_tunnel_update_config ────────────────────────────────────
  server.registerTool(
    "cf_tunnel_update_config",
    {
      title: "Update Tunnel Ingress Configuration",
      description:
        `Update the ingress configuration (routing rules) for a Cloudflare Tunnel. ` +
        `THIS REPLACES ALL EXISTING RULES.\n\n` +
        `Safety: You MUST set confirm=true to proceed.\n\n` +
        `The last ingress rule must be a catch-all (empty hostname, e.g. service='http_status:404').\n\n` +
        `Returns: { updated: true, tunnel_id, ingress: [...] }`,
      inputSchema: UpdateConfigSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: UpdateConfigInput) => {
      try {
        if (!params.confirm) {
          return {
            content: [{
              type: "text" as const,
              text: "Update aborted. You must set confirm=true to replace tunnel ingress configuration.",
            }],
            isError: true,
          };
        }

        const client = getClient();
        const accountId = getAccountId(params.account_id);

        // Build ingress rules, preserving optional path
        const ingress = params.ingress.map((rule) => {
          const entry: Record<string, unknown> = {
            hostname: rule.hostname,
            service: rule.service,
          };
          if (rule.path) entry.path = rule.path;
          return entry;
        });

        await client.zeroTrust.tunnels.cloudflared.configurations.update(
          params.tunnel_id,
          {
            account_id: accountId,
            config: { ingress },
          } as unknown as Parameters<typeof client.zeroTrust.tunnels.cloudflared.configurations.update>[1]
        );

        const formatted = params.ingress.map((rule) => formatIngressRule(rule as unknown as Record<string, unknown>));

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              updated: true,
              tunnel_id: params.tunnel_id,
              ingress: formatted,
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

  // ─── cf_tunnel_list_connections ─────────────────────────────────
  server.registerTool(
    "cf_tunnel_list_connections",
    {
      title: "List Tunnel Connections",
      description:
        `List active connections (connectors) for a Cloudflare Tunnel.\n\n` +
        `Returns: { tunnel_id, connections: [{ id, client_version, conns: [{ origin_ip, colo_name, opened_at, is_pending_reconnect }] }, ...] }`,
      inputSchema: ListConnectionsSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: ListConnectionsInput) => {
      try {
        const client = getClient();
        const accountId = getAccountId(params.account_id);

        const result = await client.zeroTrust.tunnels.cloudflared.connections.get(
          params.tunnel_id,
          { account_id: accountId }
        );

        // connections.get() returns a PagePromise of Client objects (connectors)
        const connectors: Record<string, unknown>[] = [];
        for await (const connector of result) {
          connectors.push(connector as unknown as Record<string, unknown>);
        }

        const formatted = connectors.map((conn) => formatConnection(conn));

        const output = {
          tunnel_id: params.tunnel_id,
          connections: formatted,
        };

        return {
          content: [{ type: "text" as const, text: truncateIfNeeded(JSON.stringify(output, null, 2)) }],
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
