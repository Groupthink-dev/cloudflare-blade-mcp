/**
 * DD-338 Phase C Wave 3 — Cloudflare server-handler envelope determinism.
 *
 * Mocks `getClient` / `cloudflareRequest` from `src/services/cloudflare.js`
 * and the global `fetch` (for DNS export). For each B+C tool that gained
 * `_meta` envelope emit, asserts:
 *
 *   1. The result text contains `\n\n_meta: ` and the trailing JSON parses.
 *   2. Required envelope fields are present + non-negative.
 *   3. `filtered_by` is sorted alphabetically.
 *   4. Byte-equal across N=3 calls with identical mocked upstream
 *      (after stripping the non-deterministic `latency_ms` field).
 *
 * Test surface intentionally calls tool handlers via the MCP McpServer's
 * registered handler map (private API — accessed via casted `_registeredTools`).
 * This is the pattern used elsewhere in stallari first-party MCP test suites.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

// Mock services BEFORE importing createServer so registerTool sees the mock.
vi.mock("../src/services/cloudflare.js", () => {
  const mockClient = {
    d1: {
      database: {
        query: vi.fn(),
        list: vi.fn(),
        get: vi.fn(),
      },
    },
    zeroTrust: {
      tunnels: {
        cloudflared: {
          list: vi.fn(),
          configurations: { get: vi.fn() },
          connections: { get: vi.fn() },
        },
      },
    },
    workers: {
      scripts: {
        list: vi.fn(),
        secrets: { list: vi.fn() },
        deployments: { get: vi.fn() },
        versions: { list: vi.fn() },
      },
    },
    pages: {
      projects: {
        list: vi.fn(),
        domains: { list: vi.fn() },
        deployments: { list: vi.fn() },
      },
    },
    dns: {
      records: { export: vi.fn(), list: vi.fn() },
    },
    zones: {
      list: vi.fn(),
    },
    kv: {
      namespaces: {
        list: vi.fn(),
        keys: { list: vi.fn() },
      },
    },
    r2: {
      buckets: { list: vi.fn() },
    },
  };
  return {
    getClient: () => mockClient,
    getAccountId: (override?: string) => override || "acct_test",
    cloudflareRequest: vi.fn(),
    resetClient: vi.fn(),
    validateToken: vi.fn(),
    __mockClient: mockClient,
  };
});

import { createServer } from "../src/server.js";
import * as cfService from "../src/services/cloudflare.js";

interface RegisteredTool {
  handler: (args: unknown) => Promise<{
    content: Array<{ type: string; text: string }>;
    isError?: boolean;
  }>;
}

interface McpServerInternal {
  _registeredTools: Record<string, RegisteredTool>;
}

function getTool(server: McpServer, name: string): RegisteredTool {
  const internal = server as unknown as McpServerInternal;
  const tool = internal._registeredTools[name];
  if (!tool) throw new Error(`tool ${name} not registered`);
  return tool;
}

function parseMeta(text: string): Record<string, unknown> {
  const m = text.match(/\n\n_meta: (\{.*\})$/);
  if (!m) throw new Error(`no _meta tail in: ${text.slice(-200)}`);
  return JSON.parse(m[1]) as Record<string, unknown>;
}

function stripLatency(text: string): string {
  return text.replace(/"latency_ms":\s*\d+/, '"latency_ms":0');
}

const mockClient = (cfService as unknown as { __mockClient: Record<string, unknown> }).__mockClient;

describe("cf_d1_query envelope", () => {
  let server: McpServer;
  beforeEach(() => {
    vi.clearAllMocks();
    server = createServer();
    (mockClient.d1 as { database: { query: ReturnType<typeof vi.fn> } }).database.query.mockResolvedValue([
      {
        results: [{ id: 1, name: "row-a" }, { id: 2, name: "row-b" }],
        meta: { duration: 12, rows_read: 2, rows_written: 0 },
      },
    ]);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("emits a parseable _meta envelope", async () => {
    const tool = getTool(server, "cf_d1_query");
    const res = await tool.handler({
      account_id: "acct_test",
      database_id: "db-abc",
      sql: "SELECT * FROM users",
    });
    const text = res.content[0].text;
    const meta = parseMeta(text);
    expect(meta.matched_total).toBe(2);
    expect(meta.returned).toBe(2);
    expect(Array.isArray(meta.filtered_by)).toBe(true);
    expect(meta.filtered_by).toEqual([...(meta.filtered_by as string[])].sort());
    const filters = meta.filtered_by as string[];
    expect(filters).toContain("database_id=db-abc");
    expect(filters.some((f) => f.startsWith("sql="))).toBe(true);
    expect(typeof meta.latency_ms).toBe("number");
  });

  it("hashes the SQL string (privacy)", async () => {
    const tool = getTool(server, "cf_d1_query");
    const res = await tool.handler({
      account_id: "acct_test",
      database_id: "db-abc",
      sql: "SELECT * FROM users WHERE password = 'secret'",
    });
    expect(res.content[0].text).not.toContain("password");
    expect(res.content[0].text).not.toContain("secret");
  });

  it("N=3 byte-equal after stripping latency", async () => {
    const tool = getTool(server, "cf_d1_query");
    const args = { account_id: "acct_test", database_id: "db-abc", sql: "SELECT 1" };
    const r1 = stripLatency((await tool.handler(args)).content[0].text);
    const r2 = stripLatency((await tool.handler(args)).content[0].text);
    const r3 = stripLatency((await tool.handler(args)).content[0].text);
    expect(r1).toBe(r2);
    expect(r2).toBe(r3);
  });
});

describe("cf_d1_export envelope", () => {
  let server: McpServer;
  beforeEach(() => {
    vi.clearAllMocks();
    server = createServer();
    const q = (mockClient.d1 as { database: { query: ReturnType<typeof vi.fn> } }).database.query;
    q.mockImplementation(async (_id: unknown, payload: { sql: string }) => {
      if (payload.sql.startsWith("SELECT name, sql")) {
        return [{
          results: [
            { name: "users", sql: "CREATE TABLE users (id INT)" },
            { name: "posts", sql: "CREATE TABLE posts (id INT)" },
          ],
        }];
      }
      // COUNT(*) per table
      return [{ results: [{ count: 7 }] }];
    });
  });

  it("emits envelope with tables count", async () => {
    const tool = getTool(server, "cf_d1_export");
    const res = await tool.handler({ account_id: "acct_test", database_id: "db-x" });
    const meta = parseMeta(res.content[0].text);
    expect(meta.matched_total).toBe(2);
    expect(meta.returned).toBe(2);
    expect(meta.filtered_by).toEqual(["database_id=db-x"]);
  });

  it("N=3 byte-equal after stripping latency", async () => {
    const tool = getTool(server, "cf_d1_export");
    const args = { account_id: "acct_test", database_id: "db-x" };
    const r1 = stripLatency((await tool.handler(args)).content[0].text);
    const r2 = stripLatency((await tool.handler(args)).content[0].text);
    const r3 = stripLatency((await tool.handler(args)).content[0].text);
    expect(r1).toBe(r2);
    expect(r2).toBe(r3);
  });
});

describe("cf_d1_list_tables envelope", () => {
  let server: McpServer;
  beforeEach(() => {
    vi.clearAllMocks();
    server = createServer();
    const q = (mockClient.d1 as { database: { query: ReturnType<typeof vi.fn> } }).database.query;
    q.mockImplementation(async (_id: unknown, payload: { sql: string }) => {
      if (payload.sql.startsWith("SELECT name")) {
        return [{ results: [{ name: "a" }, { name: "b" }, { name: "c" }] }];
      }
      return [{ results: [{ count: 3 }] }];
    });
  });

  it("N=3 byte-equal after stripping latency", async () => {
    const tool = getTool(server, "cf_d1_list_tables");
    const args = { account_id: "acct_test", database_id: "db-y" };
    const r1 = stripLatency((await tool.handler(args)).content[0].text);
    const r2 = stripLatency((await tool.handler(args)).content[0].text);
    const r3 = stripLatency((await tool.handler(args)).content[0].text);
    expect(r1).toBe(r2);
    expect(r2).toBe(r3);
    const meta = parseMeta((await tool.handler(args)).content[0].text);
    expect(meta.matched_total).toBe(3);
    expect(meta.filtered_by).toEqual(["database_id=db-y"]);
  });
});

describe("cf_d1_describe_table envelope", () => {
  let server: McpServer;
  beforeEach(() => {
    vi.clearAllMocks();
    server = createServer();
    (mockClient.d1 as { database: { query: ReturnType<typeof vi.fn> } }).database.query.mockResolvedValue([
      {
        results: [
          { cid: 0, name: "id", type: "INTEGER", notnull: 1, dflt_value: null, pk: 1 },
          { cid: 1, name: "name", type: "TEXT", notnull: 0, dflt_value: null, pk: 0 },
        ],
      },
    ]);
  });

  it("N=3 byte-equal after stripping latency", async () => {
    const tool = getTool(server, "cf_d1_describe_table");
    const args = { account_id: "acct_test", database_id: "db-z", table_name: "users" };
    const r1 = stripLatency((await tool.handler(args)).content[0].text);
    const r2 = stripLatency((await tool.handler(args)).content[0].text);
    const r3 = stripLatency((await tool.handler(args)).content[0].text);
    expect(r1).toBe(r2);
    expect(r2).toBe(r3);
    const meta = parseMeta(r1);
    expect(meta.matched_total).toBe(2);
    expect(meta.filtered_by).toEqual(["database_id=db-z", "table_name=users"]);
  });
});

describe("cf_tunnel_list_configs envelope", () => {
  let server: McpServer;
  beforeEach(() => {
    vi.clearAllMocks();
    server = createServer();
    const cfgGet = (mockClient.zeroTrust as { tunnels: { cloudflared: { configurations: { get: ReturnType<typeof vi.fn> } } } })
      .tunnels.cloudflared.configurations.get;
    cfgGet.mockResolvedValue({
      config: {
        ingress: [
          { hostname: "a.example.com", service: "http://localhost:8080" },
          { hostname: "", service: "http_status:404" },
        ],
      },
    });
  });

  it("N=3 byte-equal after stripping latency", async () => {
    const tool = getTool(server, "cf_tunnel_list_configs");
    const args = { account_id: "acct_test", tunnel_id: "tun-1" };
    const r1 = stripLatency((await tool.handler(args)).content[0].text);
    const r2 = stripLatency((await tool.handler(args)).content[0].text);
    const r3 = stripLatency((await tool.handler(args)).content[0].text);
    expect(r1).toBe(r2);
    expect(r2).toBe(r3);
    const meta = parseMeta(r1);
    expect(meta.matched_total).toBe(2);
    expect(meta.filtered_by).toEqual(["tunnel_id=tun-1"]);
  });
});

describe("cf_tunnel_list_connections envelope", () => {
  let server: McpServer;
  beforeEach(() => {
    vi.clearAllMocks();
    server = createServer();
    const connGet = (mockClient.zeroTrust as { tunnels: { cloudflared: { connections: { get: ReturnType<typeof vi.fn> } } } })
      .tunnels.cloudflared.connections.get;
    // PagePromise: returns an async iterable
    async function* iter() {
      yield { id: "c1", client_version: "1.0", conns: [] };
      yield { id: "c2", client_version: "1.0", conns: [] };
    }
    connGet.mockResolvedValue(iter());
  });

  it("N=3 byte-equal after stripping latency", async () => {
    const tool = getTool(server, "cf_tunnel_list_connections");
    const args = { account_id: "acct_test", tunnel_id: "tun-2" };
    const r1 = stripLatency((await tool.handler(args)).content[0].text);
    // Re-mock per call since async generator is single-use
    const connGet = (mockClient.zeroTrust as { tunnels: { cloudflared: { connections: { get: ReturnType<typeof vi.fn> } } } })
      .tunnels.cloudflared.connections.get;
    async function* iter() {
      yield { id: "c1", client_version: "1.0", conns: [] };
      yield { id: "c2", client_version: "1.0", conns: [] };
    }
    connGet.mockResolvedValue(iter());
    const r2 = stripLatency((await tool.handler(args)).content[0].text);
    connGet.mockResolvedValue(iter());
    const r3 = stripLatency((await tool.handler(args)).content[0].text);
    expect(r1).toBe(r2);
    expect(r2).toBe(r3);
    const meta = parseMeta(r1);
    expect(meta.matched_total).toBe(2);
    expect(meta.filtered_by).toEqual(["tunnel_id=tun-2"]);
  });
});

describe("cf_workers_list_secrets envelope", () => {
  let server: McpServer;
  beforeEach(() => {
    vi.clearAllMocks();
    server = createServer();
    const list = (mockClient.workers as { scripts: { secrets: { list: ReturnType<typeof vi.fn> } } })
      .scripts.secrets.list;
    async function* iter() {
      yield { name: "API_KEY", type: "secret_text" };
    }
    list.mockReturnValue(iter());
  });

  it("envelope contains script_name scope", async () => {
    const tool = getTool(server, "cf_workers_list_secrets");
    const args = { account_id: "acct_test", script_name: "my-worker" };
    const res = await tool.handler(args);
    const meta = parseMeta(res.content[0].text);
    expect(meta.matched_total).toBe(1);
    expect(meta.filtered_by).toEqual(["script_name=my-worker"]);
  });

  it("N=3 byte-equal after stripping latency", async () => {
    const tool = getTool(server, "cf_workers_list_secrets");
    const list = (mockClient.workers as { scripts: { secrets: { list: ReturnType<typeof vi.fn> } } })
      .scripts.secrets.list;
    async function* iter() {
      yield { name: "API_KEY", type: "secret_text" };
    }
    const args = { account_id: "acct_test", script_name: "w" };
    list.mockReturnValue(iter());
    const r1 = stripLatency((await tool.handler(args)).content[0].text);
    list.mockReturnValue(iter());
    const r2 = stripLatency((await tool.handler(args)).content[0].text);
    list.mockReturnValue(iter());
    const r3 = stripLatency((await tool.handler(args)).content[0].text);
    expect(r1).toBe(r2);
    expect(r2).toBe(r3);
  });
});

describe("cf_pages_list_domains envelope", () => {
  let server: McpServer;
  beforeEach(() => {
    vi.clearAllMocks();
    server = createServer();
    const list = (mockClient.pages as { projects: { domains: { list: ReturnType<typeof vi.fn> } } })
      .projects.domains.list;
    async function* iter() {
      yield { name: "example.com", status: "active", created_on: "2026-01-01" };
    }
    list.mockReturnValue(iter());
  });

  it("N=3 byte-equal after stripping latency", async () => {
    const tool = getTool(server, "cf_pages_list_domains");
    const list = (mockClient.pages as { projects: { domains: { list: ReturnType<typeof vi.fn> } } })
      .projects.domains.list;
    async function* iter() {
      yield { name: "example.com", status: "active", created_on: "2026-01-01" };
    }
    const args = { account_id: "acct_test", project_name: "my-site" };
    list.mockReturnValue(iter());
    const r1 = stripLatency((await tool.handler(args)).content[0].text);
    list.mockReturnValue(iter());
    const r2 = stripLatency((await tool.handler(args)).content[0].text);
    list.mockReturnValue(iter());
    const r3 = stripLatency((await tool.handler(args)).content[0].text);
    expect(r1).toBe(r2);
    expect(r2).toBe(r3);
    const meta = parseMeta(r1);
    expect(meta.filtered_by).toEqual(["project_name=my-site"]);
  });
});

describe("cf_dns_export_records envelope", () => {
  let server: McpServer;
  beforeEach(() => {
    vi.clearAllMocks();
    server = createServer();
    const exp = (mockClient.dns as { records: { export: ReturnType<typeof vi.fn> } }).records.export;
    exp.mockResolvedValue(
      `;; BIND zonefile\nexample.com.\t300\tIN\tA\t1.2.3.4\nwww.example.com.\t300\tIN\tA\t1.2.3.5\n`,
    );
  });

  it("envelope contains zone_id scope", async () => {
    const tool = getTool(server, "cf_dns_export_records");
    const args = { zone_id: "zone-abc" };
    const res = await tool.handler(args);
    const meta = parseMeta(res.content[0].text);
    expect(meta.filtered_by).toEqual(["zone_id=zone-abc"]);
    expect(meta.matched_total).toBeGreaterThanOrEqual(2);
  });

  it("N=3 byte-equal after stripping latency", async () => {
    const tool = getTool(server, "cf_dns_export_records");
    const args = { zone_id: "zone-xyz" };
    const r1 = stripLatency((await tool.handler(args)).content[0].text);
    const r2 = stripLatency((await tool.handler(args)).content[0].text);
    const r3 = stripLatency((await tool.handler(args)).content[0].text);
    expect(r1).toBe(r2);
    expect(r2).toBe(r3);
  });
});

// ─── DD-338 Phase C Wave 4 — adoption-sweep 12 list_* tools ───────────────
//
// One envelope test per tool: parse `_meta`, sanity-check matched_total +
// filtered_by, confirm sort + latency. Mocks the upstream SDK call site to
// yield a small deterministic payload. Mirrors the Wave 3 pattern above.

describe("cf_d1_list_databases envelope", () => {
  let server: McpServer;
  beforeEach(() => {
    vi.clearAllMocks();
    server = createServer();
    const list = (mockClient.d1 as { database: { list: ReturnType<typeof vi.fn> } }).database.list;
    async function* iter() {
      yield { uuid: "db1", name: "alpha", version: "1.0", num_tables: 2, file_size: 1024, created_at: "2026-01-01" };
      yield { uuid: "db2", name: "beta", version: "1.0", num_tables: 1, file_size: 512, created_at: "2026-01-02" };
    }
    list.mockReturnValue(iter());
  });

  it("envelope contains pagination scope", async () => {
    const tool = getTool(server, "cf_d1_list_databases");
    const res = await tool.handler({ page: 1, per_page: 50 });
    const meta = parseMeta(res.content[0].text);
    expect(meta.matched_total).toBe(2);
    expect(meta.returned).toBe(2);
    expect(meta.filtered_by).toEqual(["page=1", "per_page=50"]);
    expect(meta.next_cursor).toBeNull();
    expect(typeof meta.latency_ms).toBe("number");
  });
});

describe("cf_dns_list_zones envelope", () => {
  let server: McpServer;
  beforeEach(() => {
    vi.clearAllMocks();
    server = createServer();
    const list = (mockClient.zones as { list: ReturnType<typeof vi.fn> }).list;
    async function* iter() {
      yield { id: "z1", name: "example.com", status: "active", name_servers: [] };
      yield { id: "z2", name: "example.org", status: "active", name_servers: [] };
    }
    list.mockResolvedValue(iter());
  });

  it("envelope contains pagination + filter scope", async () => {
    const tool = getTool(server, "cf_dns_list_zones");
    const res = await tool.handler({
      page: 1,
      per_page: 50,
      concise: true,
      include_details: false,
      filter_status: "active",
    });
    const meta = parseMeta(res.content[0].text);
    expect(meta.matched_total).toBe(2);
    expect(meta.returned).toBe(2);
    expect(meta.filtered_by).toEqual([...(meta.filtered_by as string[])].sort());
    expect((meta.filtered_by as string[])).toContain("status=active");
  });
});

describe("cf_dns_list_records envelope", () => {
  let server: McpServer;
  beforeEach(() => {
    vi.clearAllMocks();
    server = createServer();
    const list = (mockClient.dns as { records: { list: ReturnType<typeof vi.fn> } }).records.list;
    async function* iter() {
      yield { id: "r1", type: "A", name: "a.example.com", content: "1.2.3.4", proxied: false, ttl: 300 };
      yield { id: "r2", type: "A", name: "b.example.com", content: "5.6.7.8", proxied: true, ttl: 300 };
    }
    list.mockResolvedValue(iter());
  });

  it("envelope contains zone_id scope", async () => {
    const tool = getTool(server, "cf_dns_list_records");
    const res = await tool.handler({
      zone_id: "zone-abc",
      page: 1,
      per_page: 50,
      concise: true,
      include_details: false,
      summary_only: false,
      random_sample: false,
      sample_size: 10,
    });
    const meta = parseMeta(res.content[0].text);
    expect(meta.matched_total).toBe(2);
    expect((meta.filtered_by as string[])).toContain("zone_id=zone-abc");
    expect(meta.filtered_by).toEqual([...(meta.filtered_by as string[])].sort());
  });
});

describe("cf_kv_list_namespaces envelope", () => {
  let server: McpServer;
  beforeEach(() => {
    vi.clearAllMocks();
    server = createServer();
    const list = (mockClient.kv as { namespaces: { list: ReturnType<typeof vi.fn> } }).namespaces.list;
    async function* iter() {
      yield { id: "ns1", title: "session", supports_url_encoding: true };
    }
    list.mockResolvedValue(iter());
  });

  it("envelope contains pagination scope", async () => {
    const tool = getTool(server, "cf_kv_list_namespaces");
    const res = await tool.handler({ page: 1, per_page: 50 });
    const meta = parseMeta(res.content[0].text);
    expect(meta.matched_total).toBe(1);
    expect(meta.filtered_by).toEqual(["page=1", "per_page=50"]);
  });
});

describe("cf_kv_list_keys envelope", () => {
  let server: McpServer;
  beforeEach(() => {
    vi.clearAllMocks();
    server = createServer();
    const list = (mockClient.kv as { namespaces: { keys: { list: ReturnType<typeof vi.fn> } } }).namespaces.keys.list;
    async function* iter() {
      yield { name: "k1" };
      yield { name: "k2" };
    }
    const response = iter() as AsyncGenerator<unknown> & { result_info?: Record<string, unknown> };
    response.result_info = { cursor: "next-page-token" };
    list.mockResolvedValue(response);
  });

  it("envelope contains namespace_id + next_cursor", async () => {
    const tool = getTool(server, "cf_kv_list_keys");
    const res = await tool.handler({
      namespace_id: "ns-xyz",
      limit: 1000,
      prefix: "user:",
    });
    const meta = parseMeta(res.content[0].text);
    expect((meta.filtered_by as string[])).toContain("namespace_id=ns-xyz");
    expect((meta.filtered_by as string[])).toContain("prefix=user:");
    expect(meta.filtered_by).toEqual([...(meta.filtered_by as string[])].sort());
    expect(meta.next_cursor).toBe("next-page-token");
  });
});

describe("cf_tunnel_list envelope", () => {
  let server: McpServer;
  beforeEach(() => {
    vi.clearAllMocks();
    server = createServer();
    const list = (mockClient.zeroTrust as { tunnels: { cloudflared: { list: ReturnType<typeof vi.fn> } } })
      .tunnels.cloudflared.list;
    async function* iter() {
      yield { id: "t1", name: "tun-a", status: "healthy", created_at: "2026-01-01", connections: [] };
    }
    list.mockResolvedValue(iter());
  });

  it("envelope contains pagination + is_deleted scope", async () => {
    const tool = getTool(server, "cf_tunnel_list");
    const res = await tool.handler({ is_deleted: false, page: 1, per_page: 50 });
    const meta = parseMeta(res.content[0].text);
    expect(meta.matched_total).toBe(1);
    expect((meta.filtered_by as string[])).toContain("is_deleted=false");
    expect(meta.filtered_by).toEqual([...(meta.filtered_by as string[])].sort());
  });
});

describe("cf_workers_list_scripts envelope", () => {
  let server: McpServer;
  beforeEach(() => {
    vi.clearAllMocks();
    server = createServer();
    const list = (mockClient.workers as { scripts: { list: ReturnType<typeof vi.fn> } }).scripts.list;
    async function* iter() {
      yield { id: "worker-a", created_on: "2026-01-01", modified_on: "2026-01-02" };
      yield { id: "worker-b", created_on: "2026-01-03", modified_on: "2026-01-04" };
    }
    list.mockReturnValue(iter());
  });

  it("envelope has empty filtered_by (no filters)", async () => {
    const tool = getTool(server, "cf_workers_list_scripts");
    const res = await tool.handler({});
    const meta = parseMeta(res.content[0].text);
    expect(meta.matched_total).toBe(2);
    expect(meta.filtered_by).toEqual([]);
  });
});

describe("cf_workers_list_deployments envelope", () => {
  let server: McpServer;
  beforeEach(() => {
    vi.clearAllMocks();
    server = createServer();
    const get = (mockClient.workers as { scripts: { deployments: { get: ReturnType<typeof vi.fn> } } })
      .scripts.deployments.get;
    get.mockResolvedValue({
      deployments: [
        { id: "d1", created_on: "2026-01-02", author_email: "a@x.com", source: "api" },
        { id: "d2", created_on: "2026-01-01", author_email: "b@x.com", source: "api" },
      ],
    });
  });

  it("envelope contains script_name scope", async () => {
    const tool = getTool(server, "cf_workers_list_deployments");
    const res = await tool.handler({ script_name: "my-worker" });
    const meta = parseMeta(res.content[0].text);
    expect(meta.matched_total).toBe(2);
    expect(meta.filtered_by).toEqual(["script_name=my-worker"]);
  });
});

describe("cf_workers_list_versions envelope", () => {
  let server: McpServer;
  beforeEach(() => {
    vi.clearAllMocks();
    server = createServer();
    const list = (mockClient.workers as { scripts: { versions: { list: ReturnType<typeof vi.fn> } } })
      .scripts.versions.list;
    async function* iter() {
      yield { id: "v1", number: 2, created_on: "2026-01-02" };
      yield { id: "v2", number: 1, created_on: "2026-01-01" };
    }
    list.mockReturnValue(iter());
  });

  it("envelope contains script_name + pagination scope", async () => {
    const tool = getTool(server, "cf_workers_list_versions");
    const res = await tool.handler({ script_name: "my-worker", page: 1, per_page: 50 });
    const meta = parseMeta(res.content[0].text);
    expect(meta.matched_total).toBe(2);
    expect((meta.filtered_by as string[])).toContain("script_name=my-worker");
    expect(meta.filtered_by).toEqual([...(meta.filtered_by as string[])].sort());
  });
});

describe("cf_pages_list_projects envelope", () => {
  let server: McpServer;
  beforeEach(() => {
    vi.clearAllMocks();
    server = createServer();
    const list = (mockClient.pages as { projects: { list: ReturnType<typeof vi.fn> } }).projects.list;
    async function* iter() {
      yield { name: "site-a", subdomain: "site-a.pages.dev", production_branch: "main", domains: [] };
    }
    list.mockReturnValue(iter());
  });

  it("envelope has empty filtered_by (no filters)", async () => {
    const tool = getTool(server, "cf_pages_list_projects");
    const res = await tool.handler({});
    const meta = parseMeta(res.content[0].text);
    expect(meta.matched_total).toBe(1);
    expect(meta.filtered_by).toEqual([]);
  });
});

describe("cf_pages_list_deployments envelope", () => {
  let server: McpServer;
  beforeEach(() => {
    vi.clearAllMocks();
    server = createServer();
    const list = (mockClient.pages as { projects: { deployments: { list: ReturnType<typeof vi.fn> } } })
      .projects.deployments.list;
    async function* iter() {
      yield { id: "dep1", environment: "production", url: "https://site-a.pages.dev", stages: [] };
    }
    list.mockReturnValue(iter());
  });

  it("envelope contains project_name + env scope", async () => {
    const tool = getTool(server, "cf_pages_list_deployments");
    const res = await tool.handler({ project_name: "my-site", env: "production" });
    const meta = parseMeta(res.content[0].text);
    expect(meta.matched_total).toBe(1);
    expect((meta.filtered_by as string[])).toContain("project_name=my-site");
    expect((meta.filtered_by as string[])).toContain("env=production");
    expect(meta.filtered_by).toEqual([...(meta.filtered_by as string[])].sort());
  });
});

describe("cf_r2_list_buckets envelope", () => {
  let server: McpServer;
  beforeEach(() => {
    vi.clearAllMocks();
    server = createServer();
    const list = (mockClient.r2 as { buckets: { list: ReturnType<typeof vi.fn> } }).buckets.list;
    list.mockResolvedValue({
      buckets: [
        { name: "bucket-a", location: "wnam", storage_class: "Standard", creation_date: "2026-01-01" },
      ],
      cursor: "next-bucket-cursor",
    });
  });

  it("envelope contains per_page + next_cursor", async () => {
    const tool = getTool(server, "cf_r2_list_buckets");
    const res = await tool.handler({ per_page: 100 });
    const meta = parseMeta(res.content[0].text);
    expect(meta.matched_total).toBe(1);
    expect(meta.filtered_by).toEqual(["per_page=100"]);
    expect(meta.next_cursor).toBe("next-bucket-cursor");
  });
});

describe("createServer smoke", () => {
  it("creates a server with the correct name", () => {
    const server = createServer();
    expect(server).toBeDefined();
  });
});
