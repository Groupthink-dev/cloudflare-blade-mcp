# cloudflare-blade-mcp

MCP server for the Cloudflare platform — DNS, Workers KV, D1 databases, and Tunnels with token-efficient defaults.

## Why this MCP?

| Feature | cloudflare-blade-mcp | Generic CF tools |
|---------|---------------------|-----------------|
| Token efficiency | 60-80% fewer tokens via concise mode | Full API responses |
| Platform coverage | DNS + KV + D1 + Tunnels (31 tools) | DNS only |
| Safety gates | `confirm: true` on all destructive ops | Varies |
| Dual transport | stdio + Streamable HTTP | Usually stdio only |
| Workers deployable | Single codebase → Cloudflare Workers | No |

## Quick Start

### stdio (Claude Desktop / Claude Code)

```json
{
  "mcpServers": {
    "cloudflare-blade-mcp": {
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

### HTTP (remote access / tunnel)

```bash
TRANSPORT=http CLOUDFLARE_API_TOKEN=xxx CLOUDFLARE_ACCOUNT_ID=xxx MCP_API_TOKEN=secret node dist/index.js
```

## Tools (31 total)

### DNS (10 tools)

| Tool | Purpose | R/W |
|------|---------|-----|
| `cf_dns_list_zones` | List domains with filtering | R |
| `cf_dns_get_zone` | Get zone by ID or domain name | R |
| `cf_dns_list_records` | List/filter/sample DNS records | R |
| `cf_dns_get_record` | Get a single record | R |
| `cf_dns_export_records` | Export zone as BIND file | R |
| `cf_dns_create_record` | Create any DNS record type | W |
| `cf_dns_update_record` | Partial update (PATCH) | W |
| `cf_dns_delete_record` | Delete record (confirm required) | W |
| `cf_dns_bulk_create` | Create up to 100 records | W |
| `cf_dns_bulk_update` | Update up to 100 records | W |

### Workers KV (7 tools)

| Tool | Purpose | R/W |
|------|---------|-----|
| `cf_kv_list_namespaces` | List KV namespaces | R |
| `cf_kv_list_keys` | List keys with prefix filter + cursor | R |
| `cf_kv_get` | Read a key's value | R |
| `cf_kv_put` | Write a key-value pair | W |
| `cf_kv_delete` | Delete a key (confirm required) | W |
| `cf_kv_bulk_put` | Write up to 10,000 pairs | W |
| `cf_kv_bulk_delete` | Delete up to 10,000 keys (confirm required) | W |

### D1 (7 tools)

| Tool | Purpose | R/W |
|------|---------|-----|
| `cf_d1_list_databases` | List D1 databases | R |
| `cf_d1_get_database` | Get database details | R |
| `cf_d1_query` | Execute read-only SQL | R |
| `cf_d1_execute` | Execute write SQL (confirm required) | W |
| `cf_d1_export` | Export all table schemas + row counts | R |
| `cf_d1_list_tables` | List tables with row counts | R |
| `cf_d1_describe_table` | Describe table schema (PRAGMA) | R |

### Tunnels (7 tools)

| Tool | Purpose | R/W |
|------|---------|-----|
| `cf_tunnel_list` | List tunnels with name filter | R |
| `cf_tunnel_get` | Get tunnel details | R |
| `cf_tunnel_create` | Create a new tunnel | W |
| `cf_tunnel_delete` | Delete a tunnel (confirm required) | W |
| `cf_tunnel_list_configs` | List tunnel ingress rules | R |
| `cf_tunnel_update_config` | Update ingress rules (confirm required) | W |
| `cf_tunnel_list_connections` | List active connections | R |

## Token Efficiency

All read tools default to **concise mode** — only essential fields are returned. This saves 60-80% of tokens compared to raw Cloudflare API responses.

- `concise=true` (default): Minimal fields for decision-making
- `include_details=true`: Full Cloudflare API response
- `summary_only=true` (DNS): Count + type distribution only
- `random_sample=true` (DNS): N random records for quick audits

## Environment Variables

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `CLOUDFLARE_API_TOKEN` | Yes | — | API token ([create one](https://dash.cloudflare.com/profile/api-tokens)) |
| `CLOUDFLARE_ACCOUNT_ID` | For KV/D1/Tunnel | — | Account ID ([find it](https://developers.cloudflare.com/fundamentals/setup/find-account-and-zone-ids/)) |
| `TRANSPORT` | No | `stdio` | `stdio` or `http` |
| `PORT` | No | `8787` | HTTP server port |
| `MCP_API_TOKEN` | No | — | Bearer token for HTTP auth |

## API Token Permissions

Create a token at [dash.cloudflare.com/profile/api-tokens](https://dash.cloudflare.com/profile/api-tokens) with:

- **Zone → DNS → Edit** (for DNS tools)
- **Account → Workers KV Storage → Edit** (for KV tools)
- **Account → D1 → Edit** (for D1 tools)
- **Account → Cloudflare Tunnel → Edit** (for Tunnel tools)
- **Account → Account Settings → Read** (for account verification)

## Development

```bash
npm install
npm run dev          # stdio with hot-reload
npm run dev:http     # HTTP with hot-reload
npm test             # run tests
npm run typecheck    # type-check only
npm run build        # compile to dist/
```

## License

MIT
