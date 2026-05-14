import { describe, expect, it } from "vitest";
import { DeleteDatabaseSchema } from "../src/schemas/d1.js";
import { DeleteNamespaceSchema } from "../src/schemas/kv.js";
import { CreateIndexSchema, DeleteIndexSchema } from "../src/schemas/vectorize.js";
import { UpsertBindingSchema } from "../src/schemas/workers.js";
import { WorkersAiRunModelSchema } from "../src/schemas/ai.js";

describe("destructive safety schemas", () => {
  it("requires confirm=true for D1 database deletion", () => {
    const result = DeleteDatabaseSchema.safeParse({ database_id: "db1", name: "prod" });
    expect(result.success).toBe(false);
  });

  it("requires exact namespace title input for KV namespace deletion", () => {
    const result = DeleteNamespaceSchema.safeParse({
      namespace_id: "ns1",
      title: "CACHE",
      confirm: true,
    });
    expect(result.success).toBe(true);
  });

  it("requires confirm_name for Vectorize index deletion", () => {
    const result = DeleteIndexSchema.safeParse({ index_name: "docs", confirm: true });
    expect(result.success).toBe(false);
  });
});

describe("new Cloudflare capability schemas", () => {
  it("validates Vectorize dimensions and metric", () => {
    const result = CreateIndexSchema.safeParse({
      name: "docs",
      dimensions: 768,
      metric: "cosine",
      confirm: true,
    });
    expect(result.success).toBe(true);
  });

  it("accepts generic Worker binding payloads with name and type", () => {
    const result = UpsertBindingSchema.safeParse({
      script_name: "api",
      binding: { name: "DB", type: "d1", id: "db1" },
      confirm: true,
    });
    expect(result.success).toBe(true);
  });

  it("validates Workers AI run payloads", () => {
    const result = WorkersAiRunModelSchema.safeParse({
      model_name: "@cf/baai/bge-base-en-v1.5",
      input: { text: "hello" },
      confirm: true,
    });
    expect(result.success).toBe(true);
  });
});
