---
name: cloudflare-blade
description: >
  Manage the Cloudflare platform — DNS records, Workers KV, D1 databases, and
  Tunnels with extreme token efficiency. 31 tools across 4 domains.
version: 0.1.0
author: groupthink-dev
triggers:
  - DNS
  - Cloudflare
  - domain
  - record
  - zone
  - A record
  - AAAA
  - CNAME
  - MX
  - TXT
  - SRV
  - CAA
  - SPF
  - DKIM
  - DMARC
  - proxy
  - orange cloud
  - TTL
  - nameserver
  - DNS migration
  - BIND export
  - Workers KV
  - KV namespace
  - KV store
  - key-value
  - D1
  - D1 database
  - SQLite
  - SQL query
  - Cloudflare database
  - Tunnel
  - cloudflared
  - ingress
  - tunnel config
---

# Cloudflare Blade MCP — LLM Skill Guide

## Token Efficiency Rules

1. **Always start with concise mode** (default). Only use `include_details=true` when you need full Cloudflare metadata.
2. **Use `summary_only=true`** for DNS zones with many records — returns type distribution without individual records.
3. **Use `random_sample=true`** to audit a zone without loading all records.
4. **Filter first** — use `filter_type`, `filter_name`, `filter_content` to narrow DNS results.
5. **Use `cf_d1_list_tables`** before querying a D1 database to understand the schema.
6. **Use `cf_d1_describe_table`** before writing SQL — it returns column names, types, and constraints.
7. **Prefer `cf_kv_list_keys` with `prefix`** over listing all keys in large namespaces.
8. **Prefer `cf_d1_query`** over `cf_d1_execute` for read operations — it communicates read-only intent.
9. **Use bulk operations** (`cf_kv_bulk_put`, `cf_dns_bulk_create`) when writing multiple items.
10. **Account ID**: Set `CLOUDFLARE_ACCOUNT_ID` env var to avoid passing it on every KV/D1/Tunnel call.

## Quick Start — 5 Most Common Operations

```
# List all DNS zones
cf_dns_list_zones

# List DNS records for a zone
cf_dns_list_records zone_id="<zone_id>"

# Create an A record
cf_dns_create_record zone_id="<zone_id>" type="A" name="www" content="1.2.3.4"

# List KV namespaces
cf_kv_list_namespaces

# Query a D1 database
cf_d1_query database_id="<db_id>" sql="SELECT * FROM users LIMIT 10"
```

## Tool Reference

### DNS Tools (10)

| Tool | Purpose | Best for |
|------|---------|----------|
| `cf_dns_list_zones` | List domains | Finding zone IDs |
| `cf_dns_get_zone` | Get zone details | Checking nameservers, status |
| `cf_dns_list_records` | List/filter records | Auditing, searching records |
| `cf_dns_get_record` | Get single record | Verifying before update/delete |
| `cf_dns_export_records` | BIND export | Backups, migrations |
| `cf_dns_create_record` | Create record | Adding DNS entries |
| `cf_dns_update_record` | Update record | Changing IPs, TTLs, proxy |
| `cf_dns_delete_record` | Delete record | Removing stale entries |
| `cf_dns_bulk_create` | Create many (max 100) | Migrations, initial setup |
| `cf_dns_bulk_update` | Update many (max 100) | Mass TTL/proxy changes |

### KV Tools (7)

| Tool | Purpose | Best for |
|------|---------|----------|
| `cf_kv_list_namespaces` | List namespaces | Finding namespace IDs |
| `cf_kv_list_keys` | List keys | Browsing, prefix search |
| `cf_kv_get` | Read value | Inspecting config/data |
| `cf_kv_put` | Write value | Setting config, caching |
| `cf_kv_delete` | Delete key | Cleanup |
| `cf_kv_bulk_put` | Write many (max 10k) | Data loading, migrations |
| `cf_kv_bulk_delete` | Delete many (max 10k) | Namespace cleanup |

### D1 Tools (7)

| Tool | Purpose | Best for |
|------|---------|----------|
| `cf_d1_list_databases` | List databases | Finding database IDs |
| `cf_d1_get_database` | Get database details | Checking size, table count |
| `cf_d1_query` | Read-only SQL | SELECT queries |
| `cf_d1_execute` | Write SQL | INSERT, UPDATE, DELETE, DDL |
| `cf_d1_export` | Export schemas | Understanding DB structure |
| `cf_d1_list_tables` | List tables + counts | Quick DB overview |
| `cf_d1_describe_table` | Table schema (PRAGMA) | Column names, types, PKs |

### Tunnel Tools (7)

| Tool | Purpose | Best for |
|------|---------|----------|
| `cf_tunnel_list` | List tunnels | Finding tunnel IDs |
| `cf_tunnel_get` | Get tunnel details | Status check |
| `cf_tunnel_create` | Create tunnel | New service exposure |
| `cf_tunnel_delete` | Delete tunnel | Decommissioning |
| `cf_tunnel_list_configs` | List ingress rules | Reviewing routing |
| `cf_tunnel_update_config` | Update ingress rules | Changing routing |
| `cf_tunnel_list_connections` | List connections | Checking connector health |
