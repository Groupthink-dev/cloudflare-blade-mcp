import { describe, expect, it } from "vitest";
import { classifyReadOnlySql } from "../src/utils/sql.js";

describe("classifyReadOnlySql — accepted read statements", () => {
  it("accepts a plain SELECT", () => {
    expect(classifyReadOnlySql("SELECT * FROM users").ok).toBe(true);
  });

  it("accepts lowercase select with leading whitespace", () => {
    expect(classifyReadOnlySql("   \n select 1").ok).toBe(true);
  });

  it("accepts SELECT with a trailing semicolon", () => {
    expect(classifyReadOnlySql("SELECT 1;").ok).toBe(true);
  });

  it("accepts SELECT with trailing semicolon + trailing comment", () => {
    expect(classifyReadOnlySql("SELECT 1; -- done").ok).toBe(true);
  });

  it("accepts comment-prefixed SELECT (line comment)", () => {
    expect(classifyReadOnlySql("-- fetch rows\nSELECT id FROM t").ok).toBe(true);
  });

  it("accepts comment-prefixed SELECT (block comment)", () => {
    expect(classifyReadOnlySql("/* fetch */ SELECT id FROM t").ok).toBe(true);
  });

  it("accepts WITH ... SELECT", () => {
    expect(
      classifyReadOnlySql("WITH recent AS (SELECT * FROM t WHERE ts > 0) SELECT * FROM recent").ok
    ).toBe(true);
  });

  it("accepts WITH RECURSIVE ... SELECT", () => {
    expect(
      classifyReadOnlySql(
        "WITH RECURSIVE cnt(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM cnt WHERE x<10) SELECT x FROM cnt"
      ).ok
    ).toBe(true);
  });

  it("accepts EXPLAIN of a SELECT", () => {
    expect(classifyReadOnlySql("EXPLAIN SELECT 1").ok).toBe(true);
  });

  it("accepts EXPLAIN QUERY PLAN of a SELECT", () => {
    expect(classifyReadOnlySql("EXPLAIN QUERY PLAN SELECT * FROM t").ok).toBe(true);
  });

  it("accepts read-form PRAGMA", () => {
    expect(classifyReadOnlySql('PRAGMA table_info("users")').ok).toBe(true);
    expect(classifyReadOnlySql("PRAGMA integrity_check").ok).toBe(true);
  });

  it("is not fooled by keywords or semicolons inside string literals", () => {
    expect(classifyReadOnlySql("SELECT 'DROP TABLE t; --' AS note FROM t").ok).toBe(true);
    expect(classifyReadOnlySql("SELECT * FROM t WHERE name = 'a;b'").ok).toBe(true);
  });
});

describe("classifyReadOnlySql — rejected statements", () => {
  it("rejects INSERT", () => {
    const v = classifyReadOnlySql("INSERT INTO users (name) VALUES ('x')");
    expect(v.ok).toBe(false);
  });

  it("rejects UPDATE", () => {
    expect(classifyReadOnlySql("UPDATE users SET name = 'x'").ok).toBe(false);
  });

  it("rejects DELETE", () => {
    expect(classifyReadOnlySql("DELETE FROM users").ok).toBe(false);
  });

  it("rejects DROP TABLE", () => {
    expect(classifyReadOnlySql("DROP TABLE users").ok).toBe(false);
  });

  it("rejects CREATE / ALTER DDL", () => {
    expect(classifyReadOnlySql("CREATE TABLE t (id INT)").ok).toBe(false);
    expect(classifyReadOnlySql("ALTER TABLE t ADD COLUMN x INT").ok).toBe(false);
  });

  it("rejects multi-statement input", () => {
    expect(classifyReadOnlySql("SELECT 1; DROP TABLE users").ok).toBe(false);
    expect(classifyReadOnlySql("SELECT 1;;DELETE FROM t").ok).toBe(false);
  });

  it("rejects comment-prefixed mutation", () => {
    expect(classifyReadOnlySql("-- harmless\nINSERT INTO t VALUES (1)").ok).toBe(false);
    expect(classifyReadOnlySql("/* harmless */ DELETE FROM t").ok).toBe(false);
  });

  it("rejects WITH ... INSERT/UPDATE/DELETE", () => {
    expect(classifyReadOnlySql("WITH x AS (SELECT 1) INSERT INTO t SELECT * FROM x").ok).toBe(false);
    expect(classifyReadOnlySql("WITH x AS (SELECT 1) DELETE FROM t").ok).toBe(false);
  });

  it("rejects EXPLAIN of a write statement", () => {
    expect(classifyReadOnlySql("EXPLAIN INSERT INTO t VALUES (1)").ok).toBe(false);
  });

  it("rejects PRAGMA assignment form", () => {
    expect(classifyReadOnlySql("PRAGMA journal_mode = DELETE").ok).toBe(false);
  });

  it("rejects empty / comment-only / unterminated input", () => {
    expect(classifyReadOnlySql("").ok).toBe(false);
    expect(classifyReadOnlySql("  -- nothing here").ok).toBe(false);
    expect(classifyReadOnlySql("SELECT 'unterminated").ok).toBe(false);
    expect(classifyReadOnlySql("/* unterminated SELECT 1").ok).toBe(false);
  });

  it("rejects other non-read verbs", () => {
    expect(classifyReadOnlySql("REPLACE INTO t VALUES (1)").ok).toBe(false);
    expect(classifyReadOnlySql("VACUUM").ok).toBe(false);
    expect(classifyReadOnlySql("ATTACH DATABASE 'x' AS y").ok).toBe(false);
  });
});
