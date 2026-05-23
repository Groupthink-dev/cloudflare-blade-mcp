// src/utils/meta.ts
//
// DD-338 Phase C — `_meta` envelope helper.
//
// Wire shape canonical per spec 2026-05-21-dd-338-a1-mastodon.md
// § "Architect amendment" and 2026-05-23-dd-338-c-w3-cloud-mail.md.
//
// Pack-spec reference: docs/granularity.md § "audit_surface" — `structured`
// means the tool emits this `_meta` envelope alongside its data payload.
// The assembler (DD-287) lifts these fields into
// `ContextPacket.provenance.assemblySteps[].toolAudit`.
//
// IMPORTANT: this file is duplicated byte-for-byte across first-party
// TS blade-mcps (cloudflare-blade-mcp, vultr-blade-mcp, ...). First-party
// blades follow the "independently installable" invariant — no cross-blade
// import chains. If this helper diverges across blades that is a contract
// bug, not a refactor opportunity.

export interface MetaEnvelope {
  matched_total: number;
  returned: number;
  filtered_by: string[];
  latency_ms: number;
  redactions?: string[];
  next_cursor?: string | null;
  error_notes?: string[];
}

/**
 * Format a `_meta:` envelope line for appending to a tool payload.
 *
 * Single-line JSON; assembler regex `\n\n_meta: (\{.*\})$`.
 * Sorts `filtered_by` alphabetically for hash reproducibility.
 * Drops empty optional arrays + null `next_cursor` for token economy.
 */
export function formatMetaLine(meta: MetaEnvelope): string {
  const sorted: MetaEnvelope = {
    matched_total: meta.matched_total,
    returned: meta.returned,
    filtered_by: [...meta.filtered_by].sort(),
    latency_ms: Math.round(meta.latency_ms),
  };
  if (meta.redactions && meta.redactions.length > 0) {
    sorted.redactions = meta.redactions;
  }
  if (meta.next_cursor !== undefined && meta.next_cursor !== null) {
    sorted.next_cursor = meta.next_cursor;
  }
  if (meta.error_notes && meta.error_notes.length > 0) {
    sorted.error_notes = meta.error_notes;
  }
  return "_meta: " + JSON.stringify(sorted);
}

/**
 * Append a `_meta` envelope line to an existing text payload using the
 * canonical `\n\n` separator. Use this helper at every tool-handler site;
 * do NOT inline the concatenation.
 */
export function appendMeta(payload: string, metaLine: string): string {
  return `${payload}\n\n${metaLine}`;
}
