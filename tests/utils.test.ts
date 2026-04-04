import { describe, it, expect } from "vitest";
import { buildPaginationMeta, truncateIfNeeded, randomSample } from "../src/utils/pagination.js";

describe("buildPaginationMeta", () => {
  it("calculates pagination correctly", () => {
    const meta = buildPaginationMeta(100, new Array(20), 1, 20);
    expect(meta.total).toBe(100);
    expect(meta.count).toBe(20);
    expect(meta.page).toBe(1);
    expect(meta.per_page).toBe(20);
    expect(meta.has_more).toBe(true);
  });

  it("has_more is false on last page", () => {
    const meta = buildPaginationMeta(50, new Array(50), 1, 50);
    expect(meta.has_more).toBe(false);
  });

  it("has_more is false when count equals total", () => {
    const meta = buildPaginationMeta(10, new Array(10), 1, 10);
    expect(meta.has_more).toBe(false);
  });
});

describe("truncateIfNeeded", () => {
  it("returns short text unchanged", () => {
    const text = "hello world";
    expect(truncateIfNeeded(text)).toBe(text);
  });

  it("truncates text exceeding limit", () => {
    const text = "a".repeat(30_000);
    const result = truncateIfNeeded(text);
    expect(result.length).toBeLessThan(text.length);
    expect(result).toContain("TRUNCATED");
  });
});

describe("randomSample", () => {
  it("returns all items when n >= array length", () => {
    const items = [1, 2, 3];
    expect(randomSample(items, 5)).toEqual([1, 2, 3]);
  });

  it("returns exactly n items", () => {
    const items = Array.from({ length: 100 }, (_, i) => i);
    const sample = randomSample(items, 10);
    expect(sample).toHaveLength(10);
  });

  it("does not mutate the original array", () => {
    const items = [1, 2, 3, 4, 5];
    const copy = [...items];
    randomSample(items, 3);
    expect(items).toEqual(copy);
  });
});
