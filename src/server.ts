import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerZoneTools } from "./tools/zones.js";
import { registerRecordReadTools } from "./tools/records-read.js";
import { registerRecordWriteTools } from "./tools/records-write.js";
import { registerBulkTools } from "./tools/records-bulk.js";
import { registerKvTools } from "./tools/kv.js";
import { registerD1Tools } from "./tools/d1.js";
import { registerTunnelTools } from "./tools/tunnels.js";
import { registerWorkersTools } from "./tools/workers.js";
import { registerPagesTools } from "./tools/pages.js";
import { registerR2Tools } from "./tools/r2.js";
import { registerCacheTools } from "./tools/cache.js";
import { registerVectorizeTools } from "./tools/vectorize.js";
import { registerAiTools } from "./tools/ai.js";

/**
 * Creates and configures the MCP server with all Cloudflare tools registered.
 *
 * 78 tools total:
 *   DNS (10):     cf_dns_list_zones, cf_dns_get_zone, cf_dns_list_records,
 *                 cf_dns_get_record, cf_dns_export_records, cf_dns_create_record,
 *                 cf_dns_update_record, cf_dns_delete_record, cf_dns_bulk_create,
 *                 cf_dns_bulk_update
 *   KV (9):      cf_kv_list_namespaces, cf_kv_create_namespace, cf_kv_delete_namespace,
 *                cf_kv_list_keys, cf_kv_get, cf_kv_put, cf_kv_delete, cf_kv_bulk_put,
 *                cf_kv_bulk_delete
 *   D1 (9):      cf_d1_list_databases, cf_d1_get_database, cf_d1_create_database,
 *                cf_d1_delete_database, cf_d1_query, cf_d1_execute, cf_d1_export,
 *                cf_d1_list_tables, cf_d1_describe_table
 *   Tunnel (7):  cf_tunnel_list, cf_tunnel_get, cf_tunnel_create, cf_tunnel_delete,
 *                cf_tunnel_list_configs, cf_tunnel_update_config, cf_tunnel_list_connections
 *   Workers (13): cf_workers_list_scripts, cf_workers_get_script, cf_workers_get_settings,
 *                 cf_workers_upsert_binding, cf_workers_delete_binding,
 *                 cf_workers_list_deployments, cf_workers_create_deployment,
 *                 cf_workers_list_versions, cf_workers_list_secrets, cf_workers_put_secret,
 *                 cf_workers_delete_secret, cf_workers_get_schedules, cf_workers_put_schedules
 *   Pages (7):   cf_pages_list_projects, cf_pages_get_project, cf_pages_list_deployments,
 *                cf_pages_get_deployment, cf_pages_rollback, cf_pages_list_domains,
 *                cf_pages_purge_build_cache
 *   R2 (4):     cf_r2_list_buckets, cf_r2_get_bucket, cf_r2_create_bucket, cf_r2_delete_bucket
 *   Vectorize (8): cf_vectorize_list_indexes, cf_vectorize_get_index,
 *                 cf_vectorize_get_index_info, cf_vectorize_create_index,
 *                 cf_vectorize_delete_index, cf_vectorize_list_metadata_indexes,
 *                 cf_vectorize_create_metadata_index, cf_vectorize_delete_metadata_index
 *   AI (10):    cf_ai_search_query, cf_ai_gateway_list_gateways, cf_ai_gateway_get_gateway,
 *               cf_ai_gateway_create_gateway, cf_ai_gateway_update_gateway,
 *               cf_ai_gateway_delete_gateway, cf_ai_gateway_list_logs, cf_ai_gateway_get_log,
 *               cf_workers_ai_list_models, cf_workers_ai_run_model
 *   Cache (1):  cf_cache_purge
 */
export function createServer(): McpServer {
  const server = new McpServer({
    name: "cloudflare-blade-mcp",
    version: "0.8.0",
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

  // Workers
  registerWorkersTools(server);

  // Pages
  registerPagesTools(server);

  // R2
  registerR2Tools(server);

  // Vectorize
  registerVectorizeTools(server);

  // AI Search, AI Gateway, Workers AI
  registerAiTools(server);

  // Cache
  registerCacheTools(server);

  return server;
}
