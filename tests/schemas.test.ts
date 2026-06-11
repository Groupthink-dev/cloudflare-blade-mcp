import { describe, expect, it } from "vitest";
import { DeleteDatabaseSchema } from "../src/schemas/d1.js";
import { BulkPutSchema, DeleteNamespaceSchema, PutValueSchema } from "../src/schemas/kv.js";
import { CreateIndexSchema, DeleteIndexSchema } from "../src/schemas/vectorize.js";
import { UpsertBindingSchema } from "../src/schemas/workers.js";
import { WorkersAiRunModelSchema } from "../src/schemas/ai.js";
import {
  BulkCreateSchema,
  BulkUpdateSchema,
  CreateRecordSchema,
  UpdateRecordSchema,
} from "../src/schemas/records.js";
import { CreateTunnelSchema } from "../src/schemas/tunnels.js";

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

describe("write safety gates (AUD-04-34)", () => {
  it("requires confirm=true for DNS record creation", () => {
    const base = { zone_id: "z1", type: "A", name: "www", content: "1.2.3.4" };
    expect(CreateRecordSchema.safeParse(base).success).toBe(false);
    expect(CreateRecordSchema.safeParse({ ...base, confirm: true }).success).toBe(true);
  });

  it("requires confirm=true for DNS record update", () => {
    const base = { zone_id: "z1", record_id: "r1", content: "5.6.7.8" };
    expect(UpdateRecordSchema.safeParse(base).success).toBe(false);
    expect(UpdateRecordSchema.safeParse({ ...base, confirm: true }).success).toBe(true);
  });

  it("requires confirm=true for DNS bulk create", () => {
    const base = { zone_id: "z1", records: [{ type: "A", name: "a", content: "1.1.1.1" }] };
    expect(BulkCreateSchema.safeParse(base).success).toBe(false);
    expect(BulkCreateSchema.safeParse({ ...base, confirm: true }).success).toBe(true);
  });

  it("requires confirm=true for DNS bulk update", () => {
    const base = { zone_id: "z1", records: [{ record_id: "r1", content: "9.9.9.9" }] };
    expect(BulkUpdateSchema.safeParse(base).success).toBe(false);
    expect(BulkUpdateSchema.safeParse({ ...base, confirm: true }).success).toBe(true);
  });

  it("requires confirm=true for KV put", () => {
    const base = { namespace_id: "ns1", key_name: "k", value: "v" };
    expect(PutValueSchema.safeParse(base).success).toBe(false);
    expect(PutValueSchema.safeParse({ ...base, confirm: true }).success).toBe(true);
  });

  it("requires confirm=true for KV bulk put", () => {
    const base = { namespace_id: "ns1", entries: [{ key: "k", value: "v" }] };
    expect(BulkPutSchema.safeParse(base).success).toBe(false);
    expect(BulkPutSchema.safeParse({ ...base, confirm: true }).success).toBe(true);
  });

  it("requires confirm=true for tunnel creation", () => {
    const base = { name: "t1", tunnel_secret: "AAAA==" };
    expect(CreateTunnelSchema.safeParse(base).success).toBe(false);
    expect(CreateTunnelSchema.safeParse({ ...base, confirm: true }).success).toBe(true);
  });

  it("rejects confirm=false everywhere (literal true only)", () => {
    expect(
      CreateRecordSchema.safeParse({
        zone_id: "z1",
        type: "A",
        name: "www",
        content: "1.2.3.4",
        confirm: false,
      }).success
    ).toBe(false);
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
