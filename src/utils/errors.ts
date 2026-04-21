import Cloudflare from "cloudflare";

/**
 * Extracts an actionable error message from Cloudflare SDK or generic errors.
 * Returns a string suitable for MCP tool response content.
 */
export function handleApiError(error: unknown): string {
  // Cloudflare SDK errors have .status and .message
  if (error instanceof Cloudflare.APIError) {
    const status = error.status;
    switch (status) {
      case 400:
        return `Error (400 Bad Request): ${error.message}. Check your parameters — a required field may be missing or malformed.`;
      case 401:
        return `Error (401 Unauthorized): Invalid or expired API token. Verify CLOUDFLARE_API_TOKEN is set and has Zone:Read + DNS:Edit permissions.`;
      case 403:
        return `Error (403 Forbidden): Token lacks required permissions. Ensure it has Zone:Read and DNS:Edit scopes for the target zone.`;
      case 404:
        return `Error (404 Not Found): The requested resource does not exist. Double-check the zone_id and record_id.`;
      case 409:
        return `Error (409 Conflict): A record with this name and type may already exist. Use cf_dns_list_records to check.`;
      case 429:
        return `Error (429 Rate Limited): Cloudflare API rate limit hit (1,200 req / 5 min). Wait a moment and retry.`;
      default:
        return `Error (${status}): ${error.message}`;
    }
  }

  if (error instanceof Cloudflare.APIConnectionError) {
    const cause = error.cause instanceof Error ? ` (${error.cause.message})` : "";
    return `Error: Could not connect to Cloudflare API${cause}. Retried once — check network connectivity.`;
  }

  if (error instanceof Cloudflare.RateLimitError) {
    return `Error: Rate limit exceeded. Cloudflare allows 1,200 requests per 5-minute window. Wait and retry.`;
  }

  if (error instanceof Cloudflare.AuthenticationError) {
    return `Error: Authentication failed. Verify your CLOUDFLARE_API_TOKEN is valid and not expired.`;
  }

  if (error instanceof Error) {
    return `Error: ${error.message}`;
  }

  return `Error: An unexpected error occurred: ${String(error)}`;
}

/**
 * Wraps a tool handler with consistent error handling.
 * Returns { content, isError } for MCP tool responses.
 */
export async function withErrorHandling<T>(
  fn: () => Promise<T>
): Promise<T | { content: Array<{ type: "text"; text: string }>; isError: true }> {
  try {
    return await fn();
  } catch (error) {
    return {
      content: [{ type: "text" as const, text: handleApiError(error) }],
      isError: true,
    };
  }
}
