import Cloudflare from "cloudflare";

let _client: Cloudflare | null = null;

const API_BASE = "https://api.cloudflare.com/client/v4";

/**
 * Returns a singleton Cloudflare SDK client.
 * Reads CLOUDFLARE_API_TOKEN from the environment.
 */
export function getClient(): Cloudflare {
  if (_client) return _client;

  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  if (!apiToken) {
    throw new Error(
      "CLOUDFLARE_API_TOKEN environment variable is required. " +
        "Create a token at https://dash.cloudflare.com/profile/api-tokens with Zone:Read and DNS:Edit permissions."
    );
  }

  _client = new Cloudflare({ apiToken, timeout: 15_000, maxRetries: 1 });
  return _client;
}

/**
 * Returns the Cloudflare Account ID, preferring an explicit override
 * over the CLOUDFLARE_ACCOUNT_ID environment variable.
 *
 * KV, D1, and Tunnel APIs all require account_id.
 */
export function getAccountId(override?: string): string {
  const accountId = override || process.env.CLOUDFLARE_ACCOUNT_ID;
  if (!accountId) {
    throw new Error(
      "account_id is required. Set CLOUDFLARE_ACCOUNT_ID environment variable " +
        "or pass account_id as a parameter."
    );
  }
  return accountId;
}

interface CloudflareEnvelope<T> {
  success: boolean;
  result: T;
  errors?: Array<{ code?: number; message?: string }>;
  messages?: Array<{ code?: number; message?: string }>;
  result_info?: Record<string, unknown>;
}

interface RequestOptions {
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
}

/**
 * Calls a Cloudflare v4 REST endpoint and returns the envelope result.
 * Use this for APIs not covered cleanly by the pinned Cloudflare SDK.
 */
export async function cloudflareRequest<T>(
  method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE",
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  if (!apiToken) {
    throw new Error(
      "CLOUDFLARE_API_TOKEN environment variable is required. " +
        "Create a scoped token at https://dash.cloudflare.com/profile/api-tokens."
    );
  }

  const url = new URL(`${API_BASE}${path}`);
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }

  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  const text = await response.text();
  const parsed = text ? (JSON.parse(text) as CloudflareEnvelope<T>) : undefined;

  if (!response.ok || parsed?.success === false) {
    const details =
      parsed?.errors?.map((err) => err.message || err.code).filter(Boolean).join("; ") ||
      response.statusText;
    throw new Error(`Cloudflare API ${method} ${path} failed (${response.status}): ${details}`);
  }

  return parsed?.result as T;
}

/**
 * Validates the API token on startup by calling the verify endpoint.
 * Returns the token status or throws with an actionable message.
 */
export async function validateToken(): Promise<{ status: string; id: string }> {
  const client = getClient();
  try {
    const result = await client.user.tokens.verify();
    if (result.status !== "active") {
      throw new Error(
        `API token is not active (status: ${result.status}). Create a new token at https://dash.cloudflare.com/profile/api-tokens`
      );
    }
    return { status: result.status, id: result.id };
  } catch (error) {
    if (error instanceof Error && error.message.includes("not active")) {
      throw error;
    }
    throw new Error(
      `Failed to verify API token: ${error instanceof Error ? error.message : String(error)}. ` +
        `Ensure CLOUDFLARE_API_TOKEN is a valid API token (not a global API key).`
    );
  }
}

/**
 * Resets the client singleton (useful for testing).
 */
export function resetClient(): void {
  _client = null;
}
