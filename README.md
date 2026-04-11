# Cloudflare Blade MCP

A token-efficient MCP server for the Cloudflare platform. 53 tools across DNS, Workers KV, D1, Tunnels, Workers, Pages, R2, and Cache — with safety gates on every destructive operation.

## Why another Cloudflare MCP?

| | Official CF MCP | mcp-cloudflare | **This** |
|---|---|---|---|
| **Scope** | Workers/KV/R2/D1 (no DNS) | DNS + Workers + KV | DNS + KV + D1 + Tunnels + Workers + Pages + R2 + Cache |
| **Tools** | 12 | 14 | 53 (targeted) |
| **Token cost** | Full API responses | Full API responses | 60-80% savings via concise mode |
| **Write safety** | None | None | Confirm gates on all destructive ops |
| **Transport** | stdio only | stdio only | stdio + Streamable HTTP |
| **Deployment** | Local only | Local only | Local + Cloudflare Workers |

**The official Cloudflare MCP** (`cloudflare/mcp-server-cloudflare`) covers Workers, KV, R2, and D1 but has no DNS tools — one of the most common Cloudflare management tasks. Its responses return full Cloudflare API payloads, exhausting token budgets on large zones.

**This MCP** is designed for agentic platforms that need:
- **Broad platform coverage** — DNS, KV, D1, Tunnels, Workers, Pages, R2, and Cache from a single server.
- **Token discipline** — concise mode strips 60-80% of response payload by default. Summary and random-sample modes for large zones.
- **Safe writes** — every delete, bulk operation, and config replacement requires explicit `confirm: true`.
- **Flexible deployment** — stdio for local clients, Streamable HTTP for remote access, Cloudflare Workers for always-on.

## Quick Start

### Install

```bash
# From source
git clone https://github.com/groupthink-dev/cloudflare-blade-mcp.git
cd cloudflare-blade-mcp
npm install && npm run build
```

### Configure

```bash
# Required — create at dash.cloudflare.com/profile/api-tokens
export CLOUDFLARE_API_TOKEN="your-api-token"

# Required for KV, D1, and Tunnel tools
export CLOUDFLARE_ACCOUNT_ID="your-account-id"
```

**API token permissions** — create a [custom token](https://dash.cloudflare.com/profile/api-tokens) with:
- **Zone > DNS > Edit** — DNS tools
- **Account > Workers KV Storage > Edit** — KV tools
- **Account > D1 > Edit** — D1 tools
- **Account > Cloudflare Tunnel > Edit** — Tunnel tools
- **Account > Workers Scripts > Edit** — Workers tools
- **Account > Cloudflare Pages > Edit** — Pages tools
- **Account > R2 > Edit** — R2 tools
- **Zone > Cache Purge > Purge** — Cache tools

You can scope the token to only the services you need. DNS-only users don't need account-level permissions.

### Run

```bash
# stdio (default — for Claude Code, Claude Desktop)
node dist/index.js

# HTTP transport (for remote access, tunnels)
TRANSPORT=http MCP_API_TOKEN=your-secret node dist/index.js
```

### Claude Code / Claude Desktop

```json
{
  "mcpServers": {
    "cloudflare": {
      "command": "node",
      "args": ["/path/to/cloudflare-blade-mcp/dist/index.js"],
      "env": {
        "CLOUDFLARE_API_TOKEN": "your-api-token",
        "CLOUDFLARE_ACCOUNT_ID": "your-account-id"
      }
    }
  }
}
```

## Tools (53)

### DNS (10 tools)

| Tool | Description | Token Cost |
|------|-------------|-----------|
| `cf_dns_list_zones` | List domains with status/name filtering | Low |
| `cf_dns_get_zone` | Get zone by ID or domain name | Low |
| `cf_dns_list_records` | List/filter records, summary mode, random sampling | Medium |
| `cf_dns_get_record` | Get a single record by ID | Low |
| `cf_dns_export_records` | Export zone as BIND zonefile | High |
| `cf_dns_create_record` | Create A, AAAA, CNAME, MX, TXT, SRV, CAA, NS... | Low |
| `cf_dns_update_record` | Partial update (PATCH) — change only what you specify | Low |
| `cf_dns_delete_record` | Delete record (**confirm required**) | Low |
| `cf_dns_bulk_create` | Create up to 100 records in one call | Medium |
| `cf_dns_bulk_update` | Update up to 100 records in one call | Medium |

### Workers KV (7 tools)

| Tool | Description | Token Cost |
|------|-------------|-----------|
| `cf_kv_list_namespaces` | List KV namespaces in account | Low |
| `cf_kv_list_keys` | List keys with prefix filter + cursor pagination | Medium |
| `cf_kv_get` | Read a key's value | Varies |
| `cf_kv_put` | Write a key-value pair with optional TTL + metadata | Low |
| `cf_kv_delete` | Delete a key (**confirm required**) | Low |
| `cf_kv_bulk_put` | Write up to 10,000 key-value pairs | Medium |
| `cf_kv_bulk_delete` | Delete up to 10,000 keys (**confirm required**) | Low |

### D1 (7 tools)

| Tool | Description | Token Cost |
|------|-------------|-----------|
| `cf_d1_list_databases` | List D1 databases in account | Low |
| `cf_d1_get_database` | Get database details (size, tables, version) | Low |
| `cf_d1_query` | Execute read-only SQL with bind parameters | Varies |
| `cf_d1_execute` | Execute write SQL (**confirm required**, blocks DROP DATABASE) | Low |
| `cf_d1_export` | Export all table schemas + row counts | Medium |
| `cf_d1_list_tables` | List tables with row counts | Low |
| `cf_d1_describe_table` | Describe table schema via PRAGMA | Low |

### Tunnels (7 tools)

| Tool | Description | Token Cost |
|------|-------------|-----------|
| `cf_tunnel_list` | List tunnels with name filter | Low |
| `cf_tunnel_get` | Get tunnel status + connection count | Low |
| `cf_tunnel_create` | Create a new Cloudflare Tunnel | Low |
| `cf_tunnel_delete` | Delete a tunnel (**confirm required**) | Low |
| `cf_tunnel_list_configs` | List ingress routing rules | Low |
| `cf_tunnel_update_config` | Replace ingress rules (**confirm required**) | Low |
| `cf_tunnel_list_connections` | List active cloudflared connectors | Low |

### Workers (10 tools)

| Tool | Description | Token Cost |
|------|-------------|-----------|
| `cf_workers_list_scripts` | List all Worker scripts in account | Low |
| `cf_workers_get_script` | Get script metadata, settings, schedules, deployment | Low |
| `cf_workers_list_deployments` | List deployments with version routing | Low |
| `cf_workers_create_deployment` | Deploy versions with percentage routing (**confirm required**) | Low |
| `cf_workers_list_versions` | List script versions | Low |
| `cf_workers_list_secrets` | List secret binding names (values never exposed) | Low |
| `cf_workers_put_secret` | Set/update a secret binding (**confirm required**) | Low |
| `cf_workers_delete_secret` | Delete a secret binding (**confirm required**) | Low |
| `cf_workers_get_schedules` | Get cron triggers | Low |
| `cf_workers_put_schedules` | Set cron triggers — replaces all (**confirm required**) | Low |

### Pages (7 tools)

| Tool | Description | Token Cost |
|------|-------------|-----------|
| `cf_pages_list_projects` | List all Pages projects | Medium |
| `cf_pages_get_project` | Get project details with latest deployment | Low |
| `cf_pages_list_deployments` | List deployments, filter by environment | Medium |
| `cf_pages_get_deployment` | Get deployment details with stages and trigger | Low |
| `cf_pages_rollback` | Rollback production to a previous deployment (**confirm required**) | Low |
| `cf_pages_list_domains` | List custom domains for a project | Low |
| `cf_pages_purge_build_cache` | Purge build cache (**confirm required**) | Low |

### R2 (4 tools)

| Tool | Description | Token Cost |
|------|-------------|-----------|
| `cf_r2_list_buckets` | List R2 buckets with name filter | Low |
| `cf_r2_get_bucket` | Get bucket details (location, storage class) | Low |
| `cf_r2_create_bucket` | Create a new R2 bucket (**confirm required**) | Low |
| `cf_r2_delete_bucket` | Delete an empty R2 bucket (**confirm required**) | Low |

### Cache (1 tool)

| Tool | Description | Token Cost |
|------|-------------|-----------|
| `cf_cache_purge` | Purge by URLs, tags, hosts, prefixes, or everything (**confirm required**) | Low |

## Token Efficiency

All read tools default to **concise mode** — only the fields needed for decision-making are returned.

```
# Concise (default) — 6 fields
{ "id": "abc123", "type": "A", "name": "www.example.com",
  "content": "1.2.3.4", "proxied": true, "ttl": "auto" }

# Full (include_details=true) — 20+ fields
{ "id": "abc123", "type": "A", "name": "www.example.com",
  "content": "1.2.3.4", "proxied": true, "ttl": 1,
  "zone_id": "...", "zone_name": "...", "created_on": "...",
  "modified_on": "...", "proxiable": true, "locked": false,
  "meta": { "auto_added": false, "managed_by_apps": false },
  "comment": null, "tags": [], ... }
```

**Additional modes for large zones:**

| Mode | Use case | Example |
|------|----------|---------|
| `summary_only=true` | Audit record distribution | Returns `{ total: 142, by_type: { A: 45, CNAME: 30, ... } }` |
| `random_sample=true` | Spot-check a large zone | Returns 5 random records (configurable) |
| Filters | Narrow before fetching | `filter_type="MX"`, `filter_name="www"`, `filter_proxied=true` |

## Security Model

| Layer | Mechanism |
|-------|-----------|
| Token validation | API token verified against Cloudflare on startup — fails fast if invalid |
| Confirm gates | All destructive tools require `confirm: true` (Zod `z.literal(true)`) |
| DROP protection | `cf_d1_execute` rejects `DROP DATABASE` statements |
| Bearer auth | Optional `MCP_API_TOKEN` for HTTP transport (timing-safe comparison) |
| X-API-Key fallback | Auto-generated or env-set key for HTTP when bearer is not configured |
| No credential leakage | API tokens never appear in tool responses or error messages |

## Environment Variables

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `CLOUDFLARE_API_TOKEN` | Yes | — | [API token](https://dash.cloudflare.com/profile/api-tokens) |
| `CLOUDFLARE_ACCOUNT_ID` | For KV/D1/Tunnel | — | [Account ID](https://developers.cloudflare.com/fundamentals/setup/find-account-and-zone-ids/) (also overridable per-call) |
| `TRANSPORT` | No | `stdio` | `stdio` or `http` |
| `PORT` | No | `8787` | HTTP server port |
| `MCP_API_TOKEN` | No | — | Bearer token for HTTP auth |
| `CLOUDFLARE_DNS_MCP_API_KEY` | No | auto-generated | X-API-Key for HTTP transport |

## Architecture

```
src/
├── index.ts                 — Entry point: stdio / HTTP transport selection
├── server.ts                — MCP server factory, registers all 53 tools
├── constants.ts             — Shared config (limits, record types, field lists)
├── tools/
│   ├── zones.ts             — cf_dns_list_zones, cf_dns_get_zone
│   ├── records-read.ts      — cf_dns_list_records, cf_dns_get_record, cf_dns_export_records
│   ├── records-write.ts     — cf_dns_create_record, cf_dns_update_record, cf_dns_delete_record
│   ├── records-bulk.ts      — cf_dns_bulk_create, cf_dns_bulk_update
│   ├── kv.ts                — 7 Workers KV tools
│   ├── d1.ts                — 7 D1 database tools
│   ├── tunnels.ts           — 7 Cloudflare Tunnel tools
│   ├── workers.ts           — 10 Workers script/deployment/secret tools
│   ├── pages.ts             — 7 Pages project/deployment tools
│   ├── r2.ts                — 4 R2 bucket management tools
│   └── cache.ts             — 1 Cache purge tool
├── schemas/                 — Zod validation schemas per domain
├── formatters/              — Token-efficient output formatters per domain
├── services/
│   ├── cloudflare.ts        — SDK singleton, account ID resolution, token validation
│   └── auth.ts              — Bearer + X-API-Key auth for HTTP transport
└── utils/
    ├── pagination.ts        — Pagination meta, truncation, random sampling
    └── errors.ts            — Cloudflare SDK error → actionable message mapping
```

**Dependencies:** `@modelcontextprotocol/sdk`, `cloudflare` (official SDK), `zod`, `hono`. No Cloudflare dashboard scraping — pure API.

## Development

```bash
npm install              # install dependencies
npm run dev              # stdio with hot-reload
npm run dev:http         # HTTP with hot-reload
npm test                 # run tests (vitest)
npm run typecheck        # type-check only
npm run build            # compile to dist/
```

## Sidereal Marketplace

This MCP conforms to the `edge-platform-v2` service contract (53/53 operations) across eight service domains: `dns`, `kv`, `d1`, `tunnel`, `workers`, `pages`, `r2`, `cache`.

See `sidereal-plugin.yaml` for the full plugin manifest.

## License

MIT
