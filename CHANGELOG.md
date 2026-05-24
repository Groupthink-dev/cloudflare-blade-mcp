# Changelog

All notable changes to `cloudflare-blade-mcp` are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
