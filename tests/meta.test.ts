/**
 * DD-338 Phase E.ts — `_meta` envelope helper wire-shape tests.
 *
 * Covers `formatMetaLine` + `appendMeta` imported from the canonical
 * `stallari-mcp-helpers` npm package (substrate swap from local
 * `src/utils/meta.ts` in DD-338 Phase E.ts).
 *
 * Wire shape locked per DD-338 Phase A.1 contract; canonical lib emits
 * `redactions` + `next_cursor` ALWAYS-PRESENT (was: omit-when-empty in
 * the prior local helper). `error_notes` stays omit-when-empty. Per-blade
 * wire-shape tests here pin the contract surface that cloudflare tool
 * handlers depend on. Field-presence + ordering invariants are the
 * canonical lib's to own (its own test suite); this file pins
 * consumer-facing behaviour.
 */
import { describe, it, expect } from "vitest";
import { formatMetaLine, appendMeta } from "stallari-mcp-helpers";

describe("formatMetaLine", () => {
  it("emits required fields in canonical order", () => {
    const line = formatMetaLine({
      matched_total: 42,
      returned: 10,
      filtered_by: ["limit=10"],
      latency_ms: 123,
      redactions: [],
      next_cursor: null,
    });
    expect(line).toBe(
      `_meta: {"matched_total":42,"returned":10,"filtered_by":["limit=10"],"latency_ms":123,"redactions":[],"next_cursor":null}`,
    );
  });

  it("sorts filtered_by alphabetically", () => {
    const line = formatMetaLine({
      matched_total: 1,
      returned: 1,
      filtered_by: ["zone_id=z", "limit=10", "account_id=a"],
      latency_ms: 1,
      redactions: [],
      next_cursor: null,
    });
    const parsed = JSON.parse(line.replace(/^_meta: /, ""));
    expect(parsed.filtered_by).toEqual([
      "account_id=a",
      "limit=10",
      "zone_id=z",
    ]);
  });

  it("always emits redactions when empty", () => {
    const line = formatMetaLine({
      matched_total: 0,
      returned: 0,
      filtered_by: [],
      latency_ms: 0,
      redactions: [],
      next_cursor: null,
    });
    const parsed = JSON.parse(line.replace(/^_meta: /, ""));
    expect(parsed.redactions).toEqual([]);
  });

  it("keeps non-empty redactions", () => {
    const line = formatMetaLine({
      matched_total: 0,
      returned: 0,
      filtered_by: [],
      latency_ms: 0,
      redactions: ["next_cursor_unavailable"],
      next_cursor: null,
    });
    const parsed = JSON.parse(line.replace(/^_meta: /, ""));
    expect(parsed.redactions).toEqual(["next_cursor_unavailable"]);
  });

  it("always emits next_cursor when null", () => {
    const line = formatMetaLine({
      matched_total: 0,
      returned: 0,
      filtered_by: [],
      latency_ms: 0,
      redactions: [],
      next_cursor: null,
    });
    const parsed = JSON.parse(line.replace(/^_meta: /, ""));
    expect(parsed.next_cursor).toBeNull();
  });

  it("keeps empty-string next_cursor", () => {
    const line = formatMetaLine({
      matched_total: 0,
      returned: 0,
      filtered_by: [],
      latency_ms: 0,
      redactions: [],
      next_cursor: "",
    });
    const parsed = JSON.parse(line.replace(/^_meta: /, ""));
    expect(parsed.next_cursor).toBe("");
  });

  it("keeps non-empty next_cursor", () => {
    const line = formatMetaLine({
      matched_total: 0,
      returned: 0,
      filtered_by: [],
      latency_ms: 0,
      redactions: [],
      next_cursor: "abc123",
    });
    const parsed = JSON.parse(line.replace(/^_meta: /, ""));
    expect(parsed.next_cursor).toBe("abc123");
  });

  it("drops empty error_notes (still omit-when-empty)", () => {
    const line = formatMetaLine({
      matched_total: 0,
      returned: 0,
      filtered_by: [],
      latency_ms: 0,
      redactions: [],
      next_cursor: null,
      error_notes: [],
    });
    expect(line).not.toContain("error_notes");
  });

  it("keeps non-empty error_notes", () => {
    const line = formatMetaLine({
      matched_total: 0,
      returned: 0,
      filtered_by: [],
      latency_ms: 0,
      redactions: [],
      next_cursor: null,
      error_notes: ["partial_results: 1 region unavailable"],
    });
    const parsed = JSON.parse(line.replace(/^_meta: /, ""));
    expect(parsed.error_notes).toEqual([
      "partial_results: 1 region unavailable",
    ]);
  });

  it("rounds latency_ms to integer", () => {
    const line = formatMetaLine({
      matched_total: 0,
      returned: 0,
      filtered_by: [],
      latency_ms: 12.7,
      redactions: [],
      next_cursor: null,
    });
    const parsed = JSON.parse(line.replace(/^_meta: /, ""));
    expect(parsed.latency_ms).toBe(13);
  });

  it("emits single-line JSON (no newlines inside)", () => {
    const line = formatMetaLine({
      matched_total: 1,
      returned: 1,
      filtered_by: ["a=1", "b=2"],
      latency_ms: 1,
      redactions: ["foo"],
      next_cursor: "cursor-x",
      error_notes: ["note-y"],
    });
    expect(line).not.toContain("\n");
    expect(line).not.toContain("\r");
  });

  it("starts with literal '_meta: '", () => {
    const line = formatMetaLine({
      matched_total: 0,
      returned: 0,
      filtered_by: [],
      latency_ms: 0,
      redactions: [],
      next_cursor: null,
    });
    expect(line.slice(0, 7)).toBe("_meta: ");
  });
});

describe("appendMeta", () => {
  it("uses exactly two newlines as separator", () => {
    const result = appendMeta("payload", "_meta: {}");
    expect(result).toBe("payload\n\n_meta: {}");
  });

  it("does not emit \\r\\n", () => {
    const result = appendMeta("payload", "_meta: {}");
    expect(result).not.toContain("\r");
  });

  it("does not emit triple newlines", () => {
    const result = appendMeta("payload", "_meta: {}");
    expect(result).not.toContain("\n\n\n");
  });

  it("preserves payload content untouched", () => {
    const payload = '{"foo": "bar", "list": [1, 2, 3]}';
    const result = appendMeta(payload, "_meta: {}");
    expect(result.startsWith(payload)).toBe(true);
  });
});
