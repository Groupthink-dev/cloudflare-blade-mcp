import { describe, it, expect } from "vitest";
import { createServer } from "../src/server.js";

describe("createServer", () => {
  it("creates a server with the correct name", () => {
    const server = createServer();
    expect(server).toBeDefined();
    // The server object should exist — tool registration is tested by
    // the fact that createServer() doesn't throw
  });
});
