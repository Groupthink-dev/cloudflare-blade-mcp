# Changelog

All notable changes to `cloudflare-blade-mcp` are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.8.0] - 2026-06-11

### Security
- AUD-04-03: `cf_d1_query` now enforces its `readOnlyHint` annotation with a
  conservative allowlist SQL classifier. Only a single read statement
  (SELECT, WITH ... SELECT, EXPLAIN [QUERY PLAN] of a read statement, or a
  read-form PRAGMA) is accepted; comments are stripped before classification
  and multi-statement input is rejected. Write SQL is routed to
  `cf_d1_execute` (which carries the confirm gate).
- AUD-04-34: the 7 previously ungated mutating tools — `cf_dns_create_record`,
  `cf_dns_update_record`, `cf_dns_bulk_create`, `cf_dns_bulk_update`,
  `cf_kv_put`, `cf_kv_bulk_put`, `cf_tunnel_create` — now require
  `confirm=true` (Zod `z.literal(true)` + handler refusal path), matching the
  gate already present on every other write tool in the blade.

### Fixed
- AUD-04-47: the MCP initialize handshake self-reported a stale `0.4.0`
  version constant; synced to the package version.

## [0.5.0] - 2026-05-24

### Changed
- DD-338 Phase E.ts: depend on `stallari-mcp-helpers^0.1.0` from npm; deleted
  local `src/utils/meta.ts`. Pure substrate swap — no behavioural change at the
  tool-handler level. Wire-shape: `_meta.redactions: []` and
  `_meta.next_cursor: null` now always emitted (was omit-when-empty);
  canonicalises TS to match Python sister + DD-338 A.1 wire contract.
  All 9 `formatMetaLine` call sites updated to pass `redactions: []` +
  `next_cursor: null` (none of the cloudflare tools surface redactions today
  and most omit `next_cursor`).
