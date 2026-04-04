/**
 * Tunnel formatters — token-efficiency layer for Cloudflare Tunnels.
 *
 * concise=true (default): Returns only essential fields.
 * concise=false: Returns the full Cloudflare API response.
 */

interface ConciseTunnel {
  id: string;
  name: string;
  status: string;
  created_at: string;
  connections_count: number;
}

interface ConciseConnection {
  id: string;
  client_version: string;
  run_at: string;
  conns: Array<{
    colo_name: string;
    origin_ip: string;
    opened_at: string;
    is_pending_reconnect: boolean;
  }>;
}

interface ConciseIngressRule {
  hostname: string;
  service: string;
  path?: string;
}

/**
 * Formats a single tunnel for output.
 * When concise (default), strips all Cloudflare metadata.
 */
export function formatTunnel(
  tunnel: Record<string, unknown>,
  concise: boolean = true
): ConciseTunnel | Record<string, unknown> {
  if (!concise) return tunnel;

  const connections = Array.isArray(tunnel.connections) ? tunnel.connections : [];

  return {
    id: String(tunnel.id ?? ""),
    name: String(tunnel.name ?? ""),
    status: String(tunnel.status ?? ""),
    created_at: String(tunnel.created_at ?? ""),
    connections_count: connections.length,
  };
}

/**
 * Formats an array of tunnels.
 */
export function formatTunnels(
  tunnels: Record<string, unknown>[],
  concise: boolean = true
): Array<ConciseTunnel | Record<string, unknown>> {
  return tunnels.map((t) => formatTunnel(t, concise));
}

/**
 * Formats a single tunnel connector (Client object from connections.get()).
 * Each connector has an id, version, run_at, and nested conns array.
 */
export function formatConnection(
  conn: Record<string, unknown>
): ConciseConnection {
  const conns = Array.isArray(conn.conns) ? conn.conns : [];
  return {
    id: String(conn.id ?? ""),
    client_version: String(conn.version ?? ""),
    run_at: String(conn.run_at ?? ""),
    conns: conns.map((c: Record<string, unknown>) => ({
      colo_name: String(c.colo_name ?? ""),
      origin_ip: String(c.origin_ip ?? ""),
      opened_at: String(c.opened_at ?? ""),
      is_pending_reconnect: Boolean(c.is_pending_reconnect ?? false),
    })),
  };
}

/**
 * Formats a single ingress rule.
 */
export function formatIngressRule(
  rule: Record<string, unknown>
): ConciseIngressRule {
  const result: ConciseIngressRule = {
    hostname: String(rule.hostname ?? ""),
    service: String(rule.service ?? ""),
  };
  if (rule.path) {
    result.path = String(rule.path);
  }
  return result;
}
