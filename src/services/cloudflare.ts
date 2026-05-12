import Cloudflare from "cloudflare";

let _client: Cloudflare | null = null;

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
