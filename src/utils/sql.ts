/**
 * Read-only SQL classification for cf_d1_query (AUD-04-03).
 *
 * Conservative allowlist classifier: a query is accepted only when it is a
 * SINGLE statement whose top-level form is one of:
 *   - SELECT ...
 *   - WITH ... SELECT ...        (CTEs whose main statement is SELECT)
 *   - EXPLAIN [QUERY PLAN] <read statement>
 *   - PRAGMA <name>[(args)]      (read form — `PRAGMA x = y` assignment rejected)
 *
 * Everything else (INSERT/UPDATE/DELETE/DDL/multi-statement/unparseable) is
 * rejected; callers are pointed at cf_d1_execute, which carries the
 * confirm=true write gate.
 */

export type SqlVerdict = { ok: true } | { ok: false; reason: string };

/**
 * Strip comments, mask string/identifier literal contents, and split into
 * top-level statements on semicolons. Literal contents are masked (not
 * removed) so keywords and `;`/`=` inside strings cannot influence
 * classification. Returns null when a literal or block comment is
 * unterminated (conservative reject).
 */
function stripAndSplit(sql: string): string[] | null {
  const statements: string[] = [];
  let current = "";
  let i = 0;
  const n = sql.length;

  while (i < n) {
    const ch = sql[i];
    const next = i + 1 < n ? sql[i + 1] : "";

    // Line comment: -- to end of line
    if (ch === "-" && next === "-") {
      while (i < n && sql[i] !== "\n") i++;
      current += " ";
      continue;
    }

    // Block comment: /* ... */ (SQLite block comments do not nest)
    if (ch === "/" && next === "*") {
      const close = sql.indexOf("*/", i + 2);
      if (close === -1) return null; // unterminated
      i = close + 2;
      current += " ";
      continue;
    }

    // String literal 'x' or quoted identifiers "x", `x` — mask contents.
    // A doubled closing quote ('') simply reads as two adjacent literals,
    // which is fine for classification purposes.
    if (ch === "'" || ch === '"' || ch === "`") {
      const close = sql.indexOf(ch, i + 1);
      if (close === -1) return null; // unterminated
      current += ch + ch;
      i = close + 1;
      continue;
    }

    // Bracket-quoted identifier [x]
    if (ch === "[") {
      const close = sql.indexOf("]", i + 1);
      if (close === -1) return null; // unterminated
      current += "[]";
      i = close + 1;
      continue;
    }

    // Top-level statement separator
    if (ch === ";") {
      statements.push(current);
      current = "";
      i++;
      continue;
    }

    current += ch;
    i++;
  }

  statements.push(current);
  return statements.map((s) => s.trim()).filter((s) => s.length > 0);
}

/** Classify a single comment-stripped, literal-masked statement. */
function classifyStatement(stmt: string): SqlVerdict {
  const verbMatch = stmt.match(/^[A-Za-z_]+/);
  if (!verbMatch) {
    return { ok: false, reason: "Statement does not start with a SQL keyword." };
  }
  const verb = verbMatch[0].toUpperCase();

  if (verb === "SELECT") return { ok: true };

  if (verb === "EXPLAIN") {
    // EXPLAIN [QUERY PLAN] <statement> — only allow explaining a statement
    // that is itself read-only.
    const rest = stmt
      .slice(verbMatch[0].length)
      .replace(/^\s+QUERY\s+PLAN\b/i, "")
      .trim();
    if (rest.length === 0) {
      return { ok: false, reason: "EXPLAIN requires a statement to explain." };
    }
    return classifyStatement(rest);
  }

  if (verb === "PRAGMA") {
    // Read forms only: `PRAGMA name` / `PRAGMA schema.name` / `PRAGMA name(args)`.
    // The assignment form `PRAGMA name = value` mutates settings — reject.
    if (/^PRAGMA\s+[A-Za-z_][\w]*(\.[A-Za-z_][\w]*)?\s*(\([^()]*\))?\s*$/i.test(stmt)) {
      return { ok: true };
    }
    return {
      ok: false,
      reason: "Only read-form PRAGMA statements (PRAGMA name or PRAGMA name(arg)) are allowed.",
    };
  }

  if (verb === "WITH") {
    // Find the main statement verb at paren-depth 0 after the CTE list.
    // CTE bodies live inside parentheses, so the first depth-0 occurrence of
    // a statement verb is the main statement.
    let depth = 0;
    const tokenRe = /[A-Za-z_]+|[()]/g;
    let m: RegExpExecArray | null;
    let first = true;
    while ((m = tokenRe.exec(stmt)) !== null) {
      const tok = m[0];
      if (tok === "(") { depth++; continue; }
      if (tok === ")") { depth--; continue; }
      if (depth !== 0) continue;
      if (first) { first = false; continue; } // skip leading WITH
      const upper = tok.toUpperCase();
      if (upper === "SELECT") return { ok: true };
      if (["INSERT", "UPDATE", "DELETE", "REPLACE", "VALUES"].includes(upper)) {
        return { ok: false, reason: `WITH ... ${upper} is a write statement.` };
      }
    }
    return { ok: false, reason: "Could not find a SELECT main statement after WITH." };
  }

  return { ok: false, reason: `${verb} is not a read-only statement.` };
}

/**
 * Classify a SQL string as read-only (allowlist) or not.
 * Conservative: anything unparseable or ambiguous is rejected.
 */
export function classifyReadOnlySql(sql: string): SqlVerdict {
  const statements = stripAndSplit(sql);
  if (statements === null) {
    return { ok: false, reason: "Unterminated string literal or comment." };
  }
  if (statements.length === 0) {
    return { ok: false, reason: "Empty SQL statement." };
  }
  if (statements.length > 1) {
    return { ok: false, reason: "Multi-statement SQL is not allowed." };
  }
  return classifyStatement(statements[0]);
}
