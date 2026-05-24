/**
 * D1 database tools: cf_d1_list_databases, cf_d1_get_database, cf_d1_query,
 * cf_d1_execute, cf_d1_export, cf_d1_list_tables, cf_d1_describe_table
 */
import { createHash } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getClient, getAccountId, cloudflareRequest } from "../services/cloudflare.js";
import { formatDatabase, formatDatabases, formatQueryResult } from "../formatters/d1.js";
import { truncateIfNeeded } from "../utils/pagination.js";
import { handleApiError } from "../utils/errors.js";
import { formatMetaLine, appendMeta, type MetaEnvelope } from "stallari-mcp-helpers";
import {
  ListDatabasesSchema,
  GetDatabaseSchema,
  CreateDatabaseSchema,
  DeleteDatabaseSchema,
  QuerySchema,
  ExecuteSchema,
  ExportSchema,
  ListTablesSchema,
  DescribeTableSchema,
} from "../schemas/d1.js";
import type {
  ListDatabasesInput,
  GetDatabaseInput,
  CreateDatabaseInput,
  DeleteDatabaseInput,
  QueryInput,
  ExecuteInput,
  ExportInput,
  ListTablesInput,
  DescribeTableInput,
} from "../schemas/d1.js";

/**
 * Hash a SQL string to a privacy-safe, token-bound digest for use in
 * `_meta.filtered_by` per DD-338 Phase C Wave 3 spec § OQ-6.
 * sha256 + base64 + first 12 chars (urlsafe; strips +/=).
 */
function sqlHash(sql: string): string {
  return createHash("sha256")
    .update(sql, "utf8")
    .digest("base64")
    .replace(/[+/=]/g, "")
    .slice(0, 12);
}

export function registerD1Tools(server: McpServer): void {
  // ─── cf_d1_list_databases ───────────────────────────────────────
  server.registerTool(
    "cf_d1_list_databases",
    {
      title: "List D1 Databases",
      description:
        `List D1 databases in the account.\n\n` +
        `Returns: { databases[], pagination } with concise fields by default ` +
        `(uuid, name, version, num_tables, file_size, created_at).`,
      inputSchema: ListDatabasesSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: ListDatabasesInput) => {
      try {
        const t0 = performance.now();
        const client = getClient();
        const accountId = getAccountId(params.account_id);

        const result = client.d1.database.list({
          account_id: accountId,
          page: params.page,
          per_page: params.per_page,
        } as Parameters<typeof client.d1.database.list>[0]);

        const databases: Record<string, unknown>[] = [];
        for await (const db of result) {
          databases.push(db as unknown as Record<string, unknown>);
        }

        const formatted = formatDatabases(databases);
        const output = {
          pagination: {
            total: databases.length,
            page: params.page,
            per_page: params.per_page,
          },
          databases: formatted,
        };

        const text = truncateIfNeeded(JSON.stringify(output, null, 2));
        const metaLine = formatMetaLine({
          matched_total: databases.length,
          returned: databases.length,
          filtered_by: [`page=${params.page}`, `per_page=${params.per_page}`],
          latency_ms: Math.round(performance.now() - t0),
          redactions: [],
          next_cursor: null,
        });
        return { content: [{ type: "text" as const, text: appendMeta(text, metaLine) }] };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: handleApiError(error) }],
          isError: true,
        };
      }
    }
  );

  // ─── cf_d1_create_database ─────────────────────────────────────
  server.registerTool(
    "cf_d1_create_database",
    {
      title: "Create D1 Database",
      description:
        `Create a D1 database in the account.\n\n` +
        `Safety: You MUST set confirm=true to proceed.\n\n` +
        `Returns: { created: true, database: { uuid, name, version, num_tables, file_size, created_at } }`,
      inputSchema: CreateDatabaseSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (params: CreateDatabaseInput) => {
      try {
        const accountId = getAccountId(params.account_id);
        const body: Record<string, unknown> = { name: params.name };
        if (params.jurisdiction) body.jurisdiction = params.jurisdiction;
        if (params.primary_location_hint) body.primary_location_hint = params.primary_location_hint;

        const database = await cloudflareRequest<Record<string, unknown>>(
          "POST",
          `/accounts/${accountId}/d1/database`,
          { body }
        );
        const formatted = formatDatabase(database);
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ created: true, database: formatted }, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: handleApiError(error) }],
          isError: true,
        };
      }
    }
  );

  // ─── cf_d1_delete_database ─────────────────────────────────────
  server.registerTool(
    "cf_d1_delete_database",
    {
      title: "Delete D1 Database",
      description:
        `Permanently delete a D1 database. THIS IS IRREVERSIBLE.\n\n` +
        `Safety: You MUST set confirm=true and provide the exact database name.\n\n` +
        `Returns: { deleted: true, database_id, name }`,
      inputSchema: DeleteDatabaseSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (params: DeleteDatabaseInput) => {
      try {
        const accountId = getAccountId(params.account_id);
        const path = `/accounts/${accountId}/d1/database/${encodeURIComponent(params.database_id)}`;
        const database = await cloudflareRequest<Record<string, unknown>>("GET", path);
        const actualName = String(database.name ?? "");
        if (actualName !== params.name) {
          return {
            content: [{
              type: "text" as const,
              text: `Delete aborted. Database name mismatch: expected "${params.name}", got "${actualName}".`,
            }],
            isError: true,
          };
        }

        await cloudflareRequest<unknown>("DELETE", path);
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({ deleted: true, database_id: params.database_id, name: params.name }, null, 2),
          }],
        };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: handleApiError(error) }],
          isError: true,
        };
      }
    }
  );

  // ─── cf_d1_get_database ─────────────────────────────────────────
  server.registerTool(
    "cf_d1_get_database",
    {
      title: "Get D1 Database",
      description:
        `Get details for a D1 database (name, size, table count, version).\n\n` +
        `Returns: { database: { uuid, name, version, num_tables, file_size, created_at } }`,
      inputSchema: GetDatabaseSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: GetDatabaseInput) => {
      try {
        const client = getClient();
        const accountId = getAccountId(params.account_id);

        const db = await client.d1.database.get(params.database_id, {
          account_id: accountId,
        });

        const formatted = formatDatabase(db as unknown as Record<string, unknown>);
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ database: formatted }, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: handleApiError(error) }],
          isError: true,
        };
      }
    }
  );

  // ─── cf_d1_query ────────────────────────────────────────────────
  server.registerTool(
    "cf_d1_query",
    {
      title: "Query D1 Database (Read-Only)",
      description:
        `Execute a read-only SQL query against a D1 database.\n\n` +
        `Use for SELECT queries. For write operations (INSERT, UPDATE, DELETE, ` +
        `CREATE TABLE), use cf_d1_execute instead.\n\n` +
        `Params: Use ?1, ?2, ... placeholders with the params array for safe binding.\n\n` +
        `Returns: { rows[], meta: { changes, duration, rows_read, rows_written } }`,
      inputSchema: QuerySchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: QueryInput) => {
      try {
        const t0 = performance.now();
        const client = getClient();
        const accountId = getAccountId(params.account_id);

        const payload: Record<string, unknown> = {
          account_id: accountId,
          sql: params.sql,
        };
        if (params.params) payload.params = params.params;

        const result = await client.d1.database.query(
          params.database_id,
          payload as unknown as Parameters<typeof client.d1.database.query>[1],
        );
        const latencyMs = Math.round(performance.now() - t0);

        // D1 query returns an array of result objects
        const results = Array.isArray(result) ? result : [result];
        const formatted = results.map((r) =>
          formatQueryResult(r as unknown as Record<string, unknown>)
        );

        // Sum row counts across statements for envelope cardinality.
        let totalRows = 0;
        for (const r of formatted) {
          if (Array.isArray(r.rows)) totalRows += r.rows.length;
        }

        // For single-statement queries, unwrap the array
        const output = formatted.length === 1 ? formatted[0] : formatted;
        const text = truncateIfNeeded(JSON.stringify(output, null, 2));

        const metaLine = formatMetaLine({
          matched_total: totalRows,
          returned: totalRows,
          filtered_by: [
            `database_id=${params.database_id}`,
            `sql=${sqlHash(params.sql)}`,
          ],
          latency_ms: latencyMs,
          redactions: [],
          next_cursor: null,
        });
        return { content: [{ type: "text" as const, text: appendMeta(text, metaLine) }] };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: handleApiError(error) }],
          isError: true,
        };
      }
    }
  );

  // ─── cf_d1_execute ──────────────────────────────────────────────
  server.registerTool(
    "cf_d1_execute",
    {
      title: "Execute D1 SQL Statement (Write)",
      description:
        `Execute a write SQL statement against a D1 database.\n\n` +
        `Supports INSERT, UPDATE, DELETE, CREATE TABLE, ALTER TABLE, and other DDL/DML.\n` +
        `DROP DATABASE is blocked for safety.\n\n` +
        `Safety: You MUST set confirm=true to proceed.\n\n` +
        `Returns: { executed: true, meta: { changes, duration, rows_read, rows_written } }`,
      inputSchema: ExecuteSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (params: ExecuteInput) => {
      try {
        // Safety: confirm must be true (enforced by Zod z.literal(true))
        if (!params.confirm) {
          return {
            content: [{
              type: "text" as const,
              text: "Execute aborted. You must set confirm=true to run write operations.",
            }],
            isError: true,
          };
        }

        // Block DROP DATABASE
        if (/drop\s+database/i.test(params.sql)) {
          return {
            content: [{
              type: "text" as const,
              text: "Execute blocked: DROP DATABASE is not permitted via this tool. " +
                "Use the Cloudflare dashboard to delete databases.",
            }],
            isError: true,
          };
        }

        const client = getClient();
        const accountId = getAccountId(params.account_id);

        const payload: Record<string, unknown> = {
          account_id: accountId,
          sql: params.sql,
        };
        if (params.params) payload.params = params.params;

        const result = await client.d1.database.query(
          params.database_id,
          payload as unknown as Parameters<typeof client.d1.database.query>[1],
        );

        const results = Array.isArray(result) ? result : [result];
        const firstResult = results[0] as unknown as Record<string, unknown>;
        const meta = (firstResult?.meta ?? {}) as Record<string, unknown>;

        const output = {
          executed: true,
          meta: {
            changes: Number(meta.changes ?? 0),
            duration: Number(meta.duration ?? 0),
            rows_read: Number(meta.rows_read ?? 0),
            rows_written: Number(meta.rows_written ?? 0),
          },
        };

        return {
          content: [{ type: "text" as const, text: JSON.stringify(output, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: handleApiError(error) }],
          isError: true,
        };
      }
    }
  );

  // ─── cf_d1_export ───────────────────────────────────────────────
  server.registerTool(
    "cf_d1_export",
    {
      title: "Export D1 Database Schema",
      description:
        `Export all table schemas and row counts from a D1 database.\n\n` +
        `Queries sqlite_master for table definitions and counts rows in each table.\n\n` +
        `Returns: { tables: [{ name, sql, row_count }] }`,
      inputSchema: ExportSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: ExportInput) => {
      try {
        const t0 = performance.now();
        const client = getClient();
        const accountId = getAccountId(params.account_id);

        // Get all table schemas from sqlite_master
        const schemaResult = await client.d1.database.query(
          params.database_id,
          {
            account_id: accountId,
            sql: "SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
          } as Parameters<typeof client.d1.database.query>[1],
        );

        const schemaResults = Array.isArray(schemaResult) ? schemaResult : [schemaResult];
        const firstResult = schemaResults[0] as unknown as Record<string, unknown>;
        const tables = Array.isArray(firstResult?.results) ? firstResult.results : [];

        // Get row counts for each table
        const tableInfo: Array<{ name: string; sql: string; row_count: number }> = [];
        const countFailed: string[] = [];
        for (const table of tables) {
          const t = table as Record<string, unknown>;
          const tableName = String(t.name ?? "");

          let rowCount = 0;
          try {
            const countResult = await client.d1.database.query(
              params.database_id,
              {
                account_id: accountId,
                sql: `SELECT COUNT(*) as count FROM "${tableName}"`,
              } as Parameters<typeof client.d1.database.query>[1],
            );
            const countResults = Array.isArray(countResult) ? countResult : [countResult];
            const countFirst = countResults[0] as unknown as Record<string, unknown>;
            const countRows = Array.isArray(countFirst?.results) ? countFirst.results : [];
            if (countRows.length > 0) {
              rowCount = Number((countRows[0] as Record<string, unknown>).count ?? 0);
            }
          } catch {
            // If count fails (e.g. virtual table), use -1 to indicate unknown
            rowCount = -1;
            countFailed.push(tableName);
          }

          tableInfo.push({
            name: tableName,
            sql: String(t.sql ?? ""),
            row_count: rowCount,
          });
        }

        const latencyMs = Math.round(performance.now() - t0);
        const output = { tables: tableInfo };
        const text = truncateIfNeeded(JSON.stringify(output, null, 2));

        const errorNotes = countFailed.map((n) => `count_failed:${n}`);
        const metaLine = formatMetaLine({
          matched_total: tableInfo.length,
          returned: tableInfo.length,
          filtered_by: [`database_id=${params.database_id}`],
          latency_ms: latencyMs,
          redactions: [],
          next_cursor: null,
          error_notes: errorNotes,
        });
        return { content: [{ type: "text" as const, text: appendMeta(text, metaLine) }] };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: handleApiError(error) }],
          isError: true,
        };
      }
    }
  );

  // ─── cf_d1_list_tables ──────────────────────────────────────────
  server.registerTool(
    "cf_d1_list_tables",
    {
      title: "List D1 Tables",
      description:
        `List all tables in a D1 database with row counts.\n\n` +
        `Convenience wrapper around sqlite_master queries.\n\n` +
        `Returns: { tables: [{ name, row_count }] }`,
      inputSchema: ListTablesSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: ListTablesInput) => {
      try {
        const t0 = performance.now();
        const client = getClient();
        const accountId = getAccountId(params.account_id);

        // Get table names
        const nameResult = await client.d1.database.query(
          params.database_id,
          {
            account_id: accountId,
            sql: "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
          } as Parameters<typeof client.d1.database.query>[1],
        );

        const nameResults = Array.isArray(nameResult) ? nameResult : [nameResult];
        const firstResult = nameResults[0] as unknown as Record<string, unknown>;
        const tableRows = Array.isArray(firstResult?.results) ? firstResult.results : [];

        // Get row counts
        const tables: Array<{ name: string; row_count: number }> = [];
        const countFailed: string[] = [];
        for (const row of tableRows) {
          const tableName = String((row as Record<string, unknown>).name ?? "");

          let rowCount = 0;
          try {
            const countResult = await client.d1.database.query(
              params.database_id,
              {
                account_id: accountId,
                sql: `SELECT COUNT(*) as count FROM "${tableName}"`,
              } as Parameters<typeof client.d1.database.query>[1],
            );
            const countResults = Array.isArray(countResult) ? countResult : [countResult];
            const countFirst = countResults[0] as unknown as Record<string, unknown>;
            const countRows = Array.isArray(countFirst?.results) ? countFirst.results : [];
            if (countRows.length > 0) {
              rowCount = Number((countRows[0] as Record<string, unknown>).count ?? 0);
            }
          } catch {
            rowCount = -1;
            countFailed.push(tableName);
          }

          tables.push({ name: tableName, row_count: rowCount });
        }

        const latencyMs = Math.round(performance.now() - t0);
        const output = { tables };
        const text = JSON.stringify(output, null, 2);
        const metaLine = formatMetaLine({
          matched_total: tables.length,
          returned: tables.length,
          filtered_by: [`database_id=${params.database_id}`],
          latency_ms: latencyMs,
          redactions: [],
          next_cursor: null,
          error_notes: countFailed.map((n) => `count_failed:${n}`),
        });
        return {
          content: [{ type: "text" as const, text: appendMeta(text, metaLine) }],
        };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: handleApiError(error) }],
          isError: true,
        };
      }
    }
  );

  // ─── cf_d1_describe_table ───────────────────────────────────────
  server.registerTool(
    "cf_d1_describe_table",
    {
      title: "Describe D1 Table",
      description:
        `Describe a table's schema in a D1 database using PRAGMA table_info.\n\n` +
        `Returns: { table, columns: [{ cid, name, type, notnull, default_value, pk }] }`,
      inputSchema: DescribeTableSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: DescribeTableInput) => {
      try {
        const t0 = performance.now();
        const client = getClient();
        const accountId = getAccountId(params.account_id);

        const result = await client.d1.database.query(
          params.database_id,
          {
            account_id: accountId,
            sql: `PRAGMA table_info("${params.table_name}")`,
          } as Parameters<typeof client.d1.database.query>[1],
        );
        const latencyMs = Math.round(performance.now() - t0);

        const results = Array.isArray(result) ? result : [result];
        const firstResult = results[0] as unknown as Record<string, unknown>;
        const rows = Array.isArray(firstResult?.results) ? firstResult.results : [];

        const columns = rows.map((row) => {
          const r = row as Record<string, unknown>;
          return {
            cid: Number(r.cid ?? 0),
            name: String(r.name ?? ""),
            type: String(r.type ?? ""),
            notnull: Boolean(r.notnull),
            default_value: r.dflt_value ?? null,
            pk: Boolean(r.pk),
          };
        });

        const output = {
          table: params.table_name,
          columns,
        };
        const text = JSON.stringify(output, null, 2);
        const metaLine = formatMetaLine({
          matched_total: columns.length,
          returned: columns.length,
          filtered_by: [
            `database_id=${params.database_id}`,
            `table_name=${params.table_name}`,
          ],
          latency_ms: latencyMs,
          redactions: [],
          next_cursor: null,
        });
        return {
          content: [{ type: "text" as const, text: appendMeta(text, metaLine) }],
        };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: handleApiError(error) }],
          isError: true,
        };
      }
    }
  );
}
