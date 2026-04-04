import { describe, it, expect } from "vitest";
import { formatRecord, formatRecords, buildRecordSummary } from "../src/formatters/record.js";
import { formatZone, formatZones } from "../src/formatters/zone.js";
import { formatNamespace, formatNamespaces, formatKeyEntry } from "../src/formatters/kv.js";
import { formatDatabase, formatDatabases, formatQueryResult } from "../src/formatters/d1.js";
import { formatTunnel, formatTunnels, formatConnection, formatIngressRule } from "../src/formatters/tunnel.js";

// ─── DNS Record Formatters ─────────────────────────────────────

describe("formatRecord", () => {
  const fullRecord = {
    id: "abc123",
    type: "A",
    name: "www.example.com",
    content: "1.2.3.4",
    proxied: true,
    ttl: 1,
    comment: "primary web",
    created_on: "2026-01-01T00:00:00Z",
    modified_on: "2026-01-02T00:00:00Z",
    zone_id: "zone123",
    zone_name: "example.com",
    meta: { auto_added: false },
  };

  it("returns concise record by default", () => {
    const result = formatRecord(fullRecord) as Record<string, unknown>;
    expect(result.id).toBe("abc123");
    expect(result.type).toBe("A");
    expect(result.name).toBe("www.example.com");
    expect(result.content).toBe("1.2.3.4");
    expect(result.proxied).toBe(true);
    expect(result.ttl).toBe("auto");
    expect(result.comment).toBe("primary web");
    // Should NOT include zone_id, zone_name, meta
    expect(result).not.toHaveProperty("zone_id");
    expect(result).not.toHaveProperty("zone_name");
    expect(result).not.toHaveProperty("meta");
  });

  it("returns full record when concise=false", () => {
    const result = formatRecord(fullRecord, false) as Record<string, unknown>;
    expect(result.zone_id).toBe("zone123");
    expect(result.meta).toBeDefined();
  });

  it("omits proxied for non-proxy-eligible types", () => {
    const mxRecord = { ...fullRecord, type: "MX", priority: 10, proxied: false };
    const result = formatRecord(mxRecord) as Record<string, unknown>;
    expect(result).not.toHaveProperty("proxied");
    expect(result.priority).toBe(10);
  });

  it("includes SRV data fields", () => {
    const srvRecord = {
      ...fullRecord,
      type: "SRV",
      data: { priority: 10, weight: 5, port: 5060 },
    };
    const result = formatRecord(srvRecord) as Record<string, unknown>;
    expect(result.priority).toBe(10);
    expect(result.weight).toBe(5);
    expect(result.port).toBe(5060);
  });
});

describe("buildRecordSummary", () => {
  it("builds type distribution and proxy counts", () => {
    const records = [
      { type: "A", proxied: true },
      { type: "A", proxied: false },
      { type: "CNAME", proxied: true },
      { type: "MX", proxied: false },
    ];
    const summary = buildRecordSummary(records);
    expect(summary.total).toBe(4);
    expect(summary.by_type).toEqual({ A: 2, CNAME: 1, MX: 1 });
    expect(summary.by_proxied).toEqual({ proxied: 2, dns_only: 2 });
  });
});

// ─── Zone Formatters ───────────────────────────────────────────

describe("formatZone", () => {
  const fullZone = {
    id: "zone123",
    name: "example.com",
    status: "active",
    name_servers: ["ns1.cloudflare.com", "ns2.cloudflare.com"],
    created_on: "2026-01-01T00:00:00Z",
    account: { id: "acc123", name: "My Account" },
    plan: { name: "Free" },
  };

  it("returns concise zone by default", () => {
    const result = formatZone(fullZone) as Record<string, unknown>;
    expect(result.id).toBe("zone123");
    expect(result.name).toBe("example.com");
    expect(result.status).toBe("active");
    expect(result).not.toHaveProperty("account");
    expect(result).not.toHaveProperty("plan");
  });

  it("returns full zone when concise=false", () => {
    const result = formatZone(fullZone, false) as Record<string, unknown>;
    expect(result.account).toBeDefined();
    expect(result.plan).toBeDefined();
  });
});

// ─── KV Formatters ────────────────────────────────────────────

describe("formatNamespace", () => {
  const ns = {
    id: "ns123",
    title: "MY_KV_STORE",
    supports_url_encoding: true,
    extra_field: "should be stripped",
  };

  it("returns concise namespace", () => {
    const result = formatNamespace(ns, true) as Record<string, unknown>;
    expect(result.id).toBe("ns123");
    expect(result.title).toBe("MY_KV_STORE");
    expect(result.supports_url_encoding).toBe(true);
    expect(result).not.toHaveProperty("extra_field");
  });

  it("returns full namespace when concise=false", () => {
    const result = formatNamespace(ns, false) as Record<string, unknown>;
    expect(result.extra_field).toBe("should be stripped");
  });
});

describe("formatKeyEntry", () => {
  it("includes name and metadata when present", () => {
    const entry = { name: "my-key", expiration: 1720000000, metadata: { version: 2 } };
    const result = formatKeyEntry(entry);
    expect(result.name).toBe("my-key");
    expect(result.expiration).toBe(1720000000);
    expect(result.metadata).toEqual({ version: 2 });
  });

  it("omits expiration and metadata when absent", () => {
    const entry = { name: "simple-key" };
    const result = formatKeyEntry(entry);
    expect(result.name).toBe("simple-key");
    expect(result).not.toHaveProperty("expiration");
    expect(result).not.toHaveProperty("metadata");
  });
});

// ─── D1 Formatters ────────────────────────────────────────────

describe("formatDatabase", () => {
  const db = {
    uuid: "db-abc-123",
    name: "my-database",
    version: "production",
    num_tables: 5,
    file_size: 1024000,
    created_at: "2026-01-01T00:00:00Z",
    running_in_region: "WEUR",
  };

  it("returns concise database", () => {
    const result = formatDatabase(db) as Record<string, unknown>;
    expect(result.uuid).toBe("db-abc-123");
    expect(result.name).toBe("my-database");
    expect(result).not.toHaveProperty("running_in_region");
  });

  it("returns full database when concise=false", () => {
    const result = formatDatabase(db, false) as Record<string, unknown>;
    expect(result.running_in_region).toBe("WEUR");
  });
});

describe("formatQueryResult", () => {
  it("extracts rows and meta from query result", () => {
    const result = {
      results: [{ id: 1, name: "test" }],
      meta: { changes: 0, duration: 1.5, rows_read: 1, rows_written: 0 },
      success: true,
    };
    const formatted = formatQueryResult(result);
    expect(formatted.rows).toEqual([{ id: 1, name: "test" }]);
    expect(formatted.meta.duration).toBe(1.5);
    expect(formatted.meta.rows_read).toBe(1);
  });
});

// ─── Tunnel Formatters ────────────────────────────────────────

describe("formatTunnel", () => {
  const tunnel = {
    id: "tun-123",
    name: "my-tunnel",
    status: "healthy",
    created_at: "2026-01-01T00:00:00Z",
    connections: [{ id: "c1" }, { id: "c2" }],
    remote_config: true,
  };

  it("returns concise tunnel", () => {
    const result = formatTunnel(tunnel, true) as Record<string, unknown>;
    expect(result.id).toBe("tun-123");
    expect(result.name).toBe("my-tunnel");
    expect(result.status).toBe("healthy");
    expect(result.connections_count).toBe(2);
    expect(result).not.toHaveProperty("remote_config");
  });

  it("returns full tunnel when concise=false", () => {
    const result = formatTunnel(tunnel, false) as Record<string, unknown>;
    expect(result.remote_config).toBe(true);
  });
});

describe("formatConnection", () => {
  it("formats a connector with nested connections", () => {
    const conn = {
      id: "connector-1",
      version: "2024.3.0",
      conns: [
        { colo_name: "SYD", origin_ip: "1.2.3.4", opened_at: "2026-01-01T00:00:00Z", is_pending_reconnect: false },
      ],
    };
    const result = formatConnection(conn);
    expect(result.id).toBe("connector-1");
    expect(result.client_version).toBe("2024.3.0");
    expect(result.conns).toHaveLength(1);
    expect(result.conns[0].colo_name).toBe("SYD");
  });
});

describe("formatIngressRule", () => {
  it("formats an ingress rule", () => {
    const rule = { hostname: "app.example.com", service: "http://localhost:8080", path: "/api" };
    const result = formatIngressRule(rule);
    expect(result.hostname).toBe("app.example.com");
    expect(result.service).toBe("http://localhost:8080");
    expect(result.path).toBe("/api");
  });

  it("omits path when absent", () => {
    const rule = { hostname: "", service: "http_status:404" };
    const result = formatIngressRule(rule);
    expect(result).not.toHaveProperty("path");
  });
});
