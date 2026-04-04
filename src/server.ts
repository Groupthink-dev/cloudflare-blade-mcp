import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerZoneTools } from "./tools/zones.js";
import { registerRecordReadTools } from "./tools/records-read.js";
import { registerRecordWriteTools } from "./tools/records-write.js";
import { registerBulkTools } from "./tools/records-bulk.js";
import { registerKvTools } from "./tools/kv.js";
import { registerD1Tools } from "./tools/d1.js";
import { registerTunnelTools } from "./tools/tunnels.js";

/**
 * Creates and configures the MCP server with all Cloudflare tools registered.
 *
 * 31 tools total:
 *   DNS (10):  cf_dns_list_zones, cf_dns_get_zone, cf_dns_list_records,
 *              cf_dns_get_record, cf_dns_export_records, cf_dns_create_record,
 *              cf_dns_update_record, cf_dns_delete_record, cf_dns_bulk_create,
 *              cf_dns_bulk_update
 *   KV (7):   cf_kv_list_namespaces, cf_kv_list_keys, cf_kv_get,
 *             cf_kv_put, cf_kv_delete, cf_kv_bulk_put, cf_kv_bulk_delete
 *   D1 (7):   cf_d1_list_databases, cf_d1_get_database, cf_d1_query,
 *             cf_d1_execute, cf_d1_export, cf_d1_list_tables, cf_d1_describe_table
 *   Tunnel (7): cf_tunnel_list, cf_tunnel_get, cf_tunnel_create, cf_tunnel_delete,
 *               cf_tunnel_list_configs, cf_tunnel_update_config, cf_tunnel_list_connections
 */
export function createServer(): McpServer {
  const server = new McpServer({
    name: "cloudflare-blade-mcp",
    version: "0.1.0",
  });

  // DNS
  registerZoneTools(server);
  registerRecordReadTools(server);
  registerRecordWriteTools(server);
  registerBulkTools(server);

  // KV
  registerKvTools(server);

  // D1
  registerD1Tools(server);

  // Tunnels
  registerTunnelTools(server);

  return server;
}
