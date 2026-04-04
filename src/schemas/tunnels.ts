import { z } from "zod";
import { AccountIdSchema } from "./common.js";

// ─── List / Get ────────────────────────────────────────────────────

export const ListTunnelsSchema = AccountIdSchema.extend({
  name: z
    .string()
    .optional()
    .describe("Filter tunnels by name (exact match)."),
  is_deleted: z
    .boolean()
    .default(false)
    .describe("Include deleted tunnels (default: false, excludes deleted)."),
  page: z
    .number()
    .int()
    .min(1)
    .default(1)
    .describe("Page number (starts at 1)."),
  per_page: z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(50)
    .describe("Tunnels per page (default: 50, max: 100)."),
}).strict();

export type ListTunnelsInput = z.infer<typeof ListTunnelsSchema>;

export const GetTunnelSchema = AccountIdSchema.extend({
  tunnel_id: z.string().describe("Cloudflare Tunnel ID (UUID)."),
}).strict();

export type GetTunnelInput = z.infer<typeof GetTunnelSchema>;

// ─── Create ────────────────────────────────────────────────────────

export const CreateTunnelSchema = AccountIdSchema.extend({
  name: z
    .string()
    .min(1)
    .describe("Name for the tunnel (must be unique within the account)."),
  tunnel_secret: z
    .string()
    .min(1)
    .describe(
      "Base64-encoded secret for the tunnel. Generate with: openssl rand -base64 32"
    ),
  config_src: z
    .enum(["local", "cloudflare"])
    .default("cloudflare")
    .describe(
      "Configuration source: 'cloudflare' (managed via API/dashboard) or 'local' (managed by cloudflared config file). Default: cloudflare."
    ),
}).strict();

export type CreateTunnelInput = z.infer<typeof CreateTunnelSchema>;

// ─── Delete ────────────────────────────────────────────────────────

export const DeleteTunnelSchema = AccountIdSchema.extend({
  tunnel_id: z.string().describe("Cloudflare Tunnel ID to delete (UUID)."),
  confirm: z
    .literal(true)
    .describe(
      "Safety gate: must be explicitly set to true. " +
        "This prevents accidental deletions. The tunnel is permanently removed."
    ),
}).strict();

export type DeleteTunnelInput = z.infer<typeof DeleteTunnelSchema>;

// ─── Configuration ─────────────────────────────────────────────────

export const ListConfigsSchema = AccountIdSchema.extend({
  tunnel_id: z.string().describe("Cloudflare Tunnel ID (UUID)."),
}).strict();

export type ListConfigsInput = z.infer<typeof ListConfigsSchema>;

export const UpdateConfigSchema = AccountIdSchema.extend({
  tunnel_id: z.string().describe("Cloudflare Tunnel ID (UUID)."),
  ingress: z
    .array(
      z.object({
        hostname: z.string().describe("Public hostname (e.g. 'app.example.com'). Empty string for the catch-all rule."),
        service: z.string().describe("Origin service URL (e.g. 'http://localhost:8080' or 'http_status:404' for catch-all)."),
        path: z.string().optional().describe("Optional path prefix to match."),
      })
    )
    .min(1)
    .describe(
      "Ingress rules for the tunnel. Order matters — first match wins. " +
        "The LAST entry MUST be a catch-all rule with an empty hostname and service 'http_status:404' " +
        "(or another default service). Example: [{hostname: 'app.example.com', service: 'http://localhost:8080'}, " +
        "{hostname: '', service: 'http_status:404'}]"
    ),
  confirm: z
    .literal(true)
    .describe(
      "Safety gate: must be explicitly set to true. " +
        "Updating ingress replaces ALL existing rules."
    ),
}).strict();

export type UpdateConfigInput = z.infer<typeof UpdateConfigSchema>;

// ─── Connections ───────────────────────────────────────────────────

export const ListConnectionsSchema = AccountIdSchema.extend({
  tunnel_id: z.string().describe("Cloudflare Tunnel ID (UUID)."),
}).strict();

export type ListConnectionsInput = z.infer<typeof ListConnectionsSchema>;
