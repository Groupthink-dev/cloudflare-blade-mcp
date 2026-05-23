/**
 * DD-338 Phase C Wave 3 — `_meta` envelope helper unit tests.
 *
 * Covers `formatMetaLine` + `appendMeta` from `src/utils/meta.ts`.
 * Wire shape canonical per spec 2026-05-21-dd-338-a1-mastodon.md.
 */
import { describe, it, expect } from "vitest";
import { formatMetaLine, appendMeta } from "../src/utils/meta.js";

describe("formatMetaLine", () => {
  it("emits required fields in canonical order", () => {
    const line = formatMetaLine({
      matched_total: 42,
      returned: 10,
      filtered_by: ["limit=10"],
      latency_ms: 123,
    });
    expect(line).toBe(
      `_meta: {"matched_total":42,"returned":10,"filtered_by":["limit=10"],"latency_ms":123}`,
    );
  });

  it("sorts filtered_by alphabetically", () => {
    const line = formatMetaLine({
      matched_total: 1,
      returned: 1,
      filtered_by: ["zone_id=z", "limit=10", "account_id=a"],
      latency_ms: 1,
    });
    const parsed = JSON.parse(line.replace(/^_meta: /, ""));
    expect(parsed.filtered_by).toEqual([
      "account_id=a",
      "limit=10",
      "zone_id=z",
    ]);
  });

  it("drops empty redactions array", () => {
    const line = formatMetaLine({
      matched_total: 0,
      returned: 0,
      filtered_by: [],
      latency_ms: 0,
      redactions: [],
    });
    expect(line).not.toContain("redactions");
  });

  it("keeps non-empty redactions", () => {
    const line = formatMetaLine({
      matched_total: 0,
      returned: 0,
      filtered_by: [],
      latency_ms: 0,
      redactions: ["next_cursor_unavailable"],
    });
    const parsed = JSON.parse(line.replace(/^_meta: /, ""));
    expect(parsed.redactions).toEqual(["next_cursor_unavailable"]);
  });

  it("drops null next_cursor", () => {
    const line = formatMetaLine({
      matched_total: 0,
      returned: 0,
      filtered_by: [],
      latency_ms: 0,
      next_cursor: null,
    });
    expect(line).not.toContain("next_cursor");
  });

  it("drops undefined next_cursor", () => {
    const line = formatMetaLine({
      matched_total: 0,
      returned: 0,
      filtered_by: [],
      latency_ms: 0,
    });
    expect(line).not.toContain("next_cursor");
  });

  it("keeps empty-string next_cursor", () => {
    const line = formatMetaLine({
      matched_total: 0,
      returned: 0,
      filtered_by: [],
      latency_ms: 0,
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
      next_cursor: "abc123",
    });
    const parsed = JSON.parse(line.replace(/^_meta: /, ""));
    expect(parsed.next_cursor).toBe("abc123");
  });

  it("drops empty error_notes", () => {
    const line = formatMetaLine({
      matched_total: 0,
      returned: 0,
      filtered_by: [],
      latency_ms: 0,
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
