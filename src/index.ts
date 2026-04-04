#!/usr/bin/env node
/**
 * cloudflare-blade-mcp — Entry point
 *
 * Supports two transport modes:
 *   TRANSPORT=stdio  (default) — for Claude Desktop and local MCP clients
 *   TRANSPORT=http   — Hono-based Streamable HTTP for remote access / Workers
 */

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { Hono } from "hono";
import { createServer } from "./server.js";
import { validateToken } from "./services/cloudflare.js";
import { getBearerToken, validateApiKey, validateBearerToken } from "./services/auth.js";

// ─── stdio transport ─────────────────────────────────────────────

async function runStdio(): Promise<void> {
  console.error("cloudflare-blade-mcp: starting in stdio mode...");

  try {
    const tokenInfo = await validateToken();
    console.error(`  ✓ API token verified (id: ${tokenInfo.id}, status: ${tokenInfo.status})`);
  } catch (err) {
    console.error(`  ✗ ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }

  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("  ✓ MCP server running via stdio. Waiting for requests...");
}

// ─── HTTP transport (Hono) ───────────────────────────────────────

async function runHttp(): Promise<void> {
  const port = parseInt(process.env.PORT || "8787", 10);
  console.error(`cloudflare-blade-mcp: starting in HTTP mode on port ${port}...`);

  try {
    const tokenInfo = await validateToken();
    console.error(`  ✓ API token verified (id: ${tokenInfo.id}, status: ${tokenInfo.status})`);
  } catch (err) {
    console.error(`  ✗ ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }

  const app = new Hono();

  // Bearer token middleware — when MCP_API_TOKEN is set, every request must
  // carry a matching Authorization: Bearer header. If unset, pass through.
  app.use("/*", async (c, next) => {
    const result = validateBearerToken(c.req.header("Authorization") ?? null);
    if (result === null) {
      // Bearer auth not configured — fall through to per-route auth
      await next();
      return;
    }
    if (!result) {
      return c.json({ error: "Unauthorized" }, 401);
    }
    await next();
  });

  // Health check
  app.get("/health", (c) => c.json({ status: "ok", server: "cloudflare-blade-mcp" }));

  // MCP endpoint — Streamable HTTP
  app.post("/mcp", async (c) => {
    // X-API-Key auth (only reached when bearer auth is not configured)
    if (!getBearerToken()) {
      const apiKeyHeader = c.req.header("X-API-Key") ?? null;
      const apiKeyQuery = new URL(c.req.url).searchParams.get("api_key");

      if (!validateApiKey(apiKeyHeader, apiKeyQuery)) {
        return c.json({ error: "Unauthorized. Provide X-API-Key header or ?api_key= query parameter." }, 401);
      }
    }

    // Create a fresh transport + server per request (stateless)
    const server = createServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined, // stateless
      enableJsonResponse: true,
    });

    const body = await c.req.json();

    // We need to use the raw Node.js req/res for the transport
    // In Hono + Node, we can access them via c.env
    const nodeReq = (c.env as Record<string, unknown>)?.incoming as
      | import("node:http").IncomingMessage
      | undefined;
    const nodeRes = (c.env as Record<string, unknown>)?.outgoing as
      | import("node:http").ServerResponse
      | undefined;

    if (nodeReq && nodeRes) {
      nodeRes.on("close", () => transport.close());
      await server.connect(transport);
      await transport.handleRequest(nodeReq, nodeRes, body);
      return undefined as unknown as Response;
    }

    // Fallback: process the JSON-RPC request manually
    // This path handles Workers/non-Node environments
    await server.connect(transport);

    // For environments without raw Node req/res, we process via a different path
    // The transport needs Node IncomingMessage/ServerResponse, so for Workers
    // we need a different approach. For now, return method not allowed.
    return c.json(
      { error: "HTTP transport requires Node.js runtime. Use stdio for Workers or deploy with node_compat." },
      501
    );
  });

  // Start the Node.js HTTP server using Hono's serve helper
  const { serve } = await import("@hono/node-server");
  serve({ fetch: app.fetch, port }, () => {
    if (getBearerToken()) {
      console.error("  ✓ Bearer token auth enabled (MCP_API_TOKEN is set)");
    } else {
      console.error("  ⚠ Bearer token auth disabled (no MCP_API_TOKEN)");
    }
    console.error(`  ✓ MCP server running at http://localhost:${port}/mcp`);
    console.error(`  ✓ Health check at http://localhost:${port}/health`);
  });
}

// ─── Main ────────────────────────────────────────────────────────

const transport = process.env.TRANSPORT || "stdio";

if (transport === "http") {
  runHttp().catch((err) => {
    console.error("Fatal:", err);
    process.exit(1);
  });
} else {
  runStdio().catch((err) => {
    console.error("Fatal:", err);
    process.exit(1);
  });
}
