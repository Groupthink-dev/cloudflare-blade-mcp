/**
 * Cloudflare Workers tools: cf_workers_list_scripts, cf_workers_get_script,
 * cf_workers_list_deployments, cf_workers_create_deployment, cf_workers_list_versions,
 * cf_workers_list_secrets, cf_workers_put_secret, cf_workers_delete_secret,
 * cf_workers_get_schedules, cf_workers_put_schedules
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getClient, getAccountId } from "../services/cloudflare.js";
import {
  formatScript,
  formatScripts,
  formatDeployment,
  formatDeployments,
  formatVersion,
  formatVersions,
  formatSecret,
  formatSecrets,
  formatSchedule,
  formatSchedules,
} from "../formatters/workers.js";
import { truncateIfNeeded } from "../utils/pagination.js";
import { handleApiError } from "../utils/errors.js";
import {
  ListScriptsSchema,
  GetScriptSchema,
  ListDeploymentsSchema,
  CreateDeploymentSchema,
  ListVersionsSchema,
  ListSecretsSchema,
  PutSecretSchema,
  DeleteSecretSchema,
  GetSchedulesSchema,
  PutSchedulesSchema,
} from "../schemas/workers.js";
import type {
  ListScriptsInput,
  GetScriptInput,
  ListDeploymentsInput,
  CreateDeploymentInput,
  ListVersionsInput,
  ListSecretsInput,
  PutSecretInput,
  DeleteSecretInput,
  GetSchedulesInput,
  PutSchedulesInput,
} from "../schemas/workers.js";

export function registerWorkersTools(server: McpServer): void {
  // ─── cf_workers_list_scripts ────────────────────────────────────
  server.registerTool(
    "cf_workers_list_scripts",
    {
      title: "List Worker Scripts",
      description:
        `List all Worker scripts in your account.\n\n` +
        `Returns: { scripts[] } with concise output (id, created_on, modified_on, has_modules, has_assets).`,
      inputSchema: ListScriptsSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: ListScriptsInput) => {
      try {
        const client = getClient();
        const accountId = getAccountId(params.account_id);

        const scripts: Record<string, unknown>[] = [];
        for await (const script of client.workers.scripts.list({ account_id: accountId })) {
          scripts.push(script as unknown as Record<string, unknown>);
        }

        const formatted = formatScripts(scripts);
        const output = { total: formatted.length, scripts: formatted };
        const text = truncateIfNeeded(JSON.stringify(output, null, 2));
        return { content: [{ type: "text" as const, text }] };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: handleApiError(error) }],
          isError: true,
        };
      }
    }
  );

  // ─── cf_workers_get_script ──────────────────────────────────────
  server.registerTool(
    "cf_workers_get_script",
    {
      title: "Get Worker Script Details",
      description:
        `Get metadata for a single Worker script by name.\n\n` +
        `Returns the script's settings, bindings summary, and schedule info. ` +
        `Does NOT return source code (use wrangler for that).`,
      inputSchema: GetScriptSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: GetScriptInput) => {
      try {
        const client = getClient();
        const accountId = getAccountId(params.account_id);

        // Get settings for the script (bindings, compatibility info)
        const settings = await client.workers.scripts.settings.get(params.script_name, {
          account_id: accountId,
        });

        // Get schedules
        let schedules: Record<string, unknown>[] = [];
        try {
          const schedResult = await client.workers.scripts.schedules.get(params.script_name, {
            account_id: accountId,
          });
          const schedObj = schedResult as unknown as Record<string, unknown>;
          schedules = Array.isArray(schedObj.schedules) ? schedObj.schedules : [];
        } catch {
          // Script may have no schedules
        }

        // Get current deployment
        let deployment: Record<string, unknown> | null = null;
        try {
          const depResult = await client.workers.scripts.deployments.get(params.script_name, {
            account_id: accountId,
          });
          const depObj = depResult as unknown as Record<string, unknown>;
          const deployments = Array.isArray(depObj.deployments) ? depObj.deployments : [];
          if (deployments.length > 0) {
            deployment = formatDeployment(deployments[0] as Record<string, unknown>) as unknown as Record<string, unknown>;
          }
        } catch {
          // May not have deployments
        }

        const settingsObj = settings as unknown as Record<string, unknown>;

        const output = {
          script_name: params.script_name,
          settings: {
            logpush: settingsObj.logpush ?? false,
            tail_consumers: settingsObj.tail_consumers ?? [],
          },
          schedules: formatSchedules(schedules),
          current_deployment: deployment,
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

  // ─── cf_workers_list_deployments ────────────────────────────────
  server.registerTool(
    "cf_workers_list_deployments",
    {
      title: "List Worker Deployments",
      description:
        `List deployments for a Worker script. The first deployment is the latest (actively serving traffic).\n\n` +
        `Returns: { deployments[] } with id, created_on, author_email, source, versions.`,
      inputSchema: ListDeploymentsSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: ListDeploymentsInput) => {
      try {
        const client = getClient();
        const accountId = getAccountId(params.account_id);

        const result = await client.workers.scripts.deployments.get(params.script_name, {
          account_id: accountId,
        });

        const resultObj = result as unknown as Record<string, unknown>;
        const deployments = Array.isArray(resultObj.deployments) ? resultObj.deployments : [];
        const formatted = formatDeployments(deployments as Record<string, unknown>[]);

        const output = { total: formatted.length, deployments: formatted };
        const text = truncateIfNeeded(JSON.stringify(output, null, 2));
        return { content: [{ type: "text" as const, text }] };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: handleApiError(error) }],
          isError: true,
        };
      }
    }
  );

  // ─── cf_workers_create_deployment ───────────────────────────────
  server.registerTool(
    "cf_workers_create_deployment",
    {
      title: "Deploy Worker Version",
      description:
        `Deploy one or two Worker versions to traffic with percentage-based routing.\n\n` +
        `Use one version at 100% for a full rollout, or two versions for gradual rollout.\n\n` +
        `Safety: You MUST set confirm=true to proceed.\n\n` +
        `Tip: Use cf_workers_list_versions first to get available version IDs.\n\n` +
        `Returns: { deployed: true, deployment: { id, versions, ... } }`,
      inputSchema: CreateDeploymentSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (params: CreateDeploymentInput) => {
      try {
        if (!params.confirm) {
          return {
            content: [{
              type: "text" as const,
              text: "Deploy aborted. You must set confirm=true to deploy a Worker version.",
            }],
            isError: true,
          };
        }

        const client = getClient();
        const accountId = getAccountId(params.account_id);

        const body: Record<string, unknown> = {
          account_id: accountId,
          strategy: "percentage" as const,
          versions: params.versions.map((v) => ({
            version_id: v.version_id,
            percentage: v.percentage,
          })),
        };

        if (params.message) {
          body.annotations = { "workers/message": params.message };
        }

        const result = await client.workers.scripts.deployments.create(
          params.script_name,
          body as unknown as Parameters<typeof client.workers.scripts.deployments.create>[1]
        );

        const formatted = formatDeployment(result as unknown as Record<string, unknown>);
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({ deployed: true, deployment: formatted }, null, 2),
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

  // ─── cf_workers_list_versions ───────────────────────────────────
  server.registerTool(
    "cf_workers_list_versions",
    {
      title: "List Worker Versions",
      description:
        `List versions for a Worker script. The first version is the latest.\n\n` +
        `Returns: { versions[] } with id, number, created_on, metadata.`,
      inputSchema: ListVersionsSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: ListVersionsInput) => {
      try {
        const client = getClient();
        const accountId = getAccountId(params.account_id);

        const versions: Record<string, unknown>[] = [];
        for await (const version of client.workers.scripts.versions.list(params.script_name, {
          account_id: accountId,
          page: params.page,
          per_page: params.per_page,
        })) {
          versions.push(version as unknown as Record<string, unknown>);
        }

        const formatted = formatVersions(versions);
        const output = { total: formatted.length, versions: formatted };
        const text = truncateIfNeeded(JSON.stringify(output, null, 2));
        return { content: [{ type: "text" as const, text }] };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: handleApiError(error) }],
          isError: true,
        };
      }
    }
  );

  // ─── cf_workers_list_secrets ────────────────────────────────────
  server.registerTool(
    "cf_workers_list_secrets",
    {
      title: "List Worker Secrets",
      description:
        `List secret bindings for a Worker script. Returns names and types only — values are never exposed.\n\n` +
        `Returns: { secrets: [{ name, type }] }`,
      inputSchema: ListSecretsSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: ListSecretsInput) => {
      try {
        const client = getClient();
        const accountId = getAccountId(params.account_id);

        const secrets: Record<string, unknown>[] = [];
        for await (const secret of client.workers.scripts.secrets.list(params.script_name, {
          account_id: accountId,
        })) {
          secrets.push(secret as unknown as Record<string, unknown>);
        }

        const formatted = formatSecrets(secrets);
        const output = { total: formatted.length, secrets: formatted };
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

  // ─── cf_workers_put_secret ──────────────────────────────────────
  server.registerTool(
    "cf_workers_put_secret",
    {
      title: "Set Worker Secret",
      description:
        `Set or update a secret binding on a Worker script.\n\n` +
        `Safety: You MUST set confirm=true to proceed.\n\n` +
        `Returns: { updated: true, name, type }`,
      inputSchema: PutSecretSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: PutSecretInput) => {
      try {
        if (!params.confirm) {
          return {
            content: [{
              type: "text" as const,
              text: "Update aborted. You must set confirm=true to set/update a secret.",
            }],
            isError: true,
          };
        }

        const client = getClient();
        const accountId = getAccountId(params.account_id);

        const result = await client.workers.scripts.secrets.update(params.script_name, {
          account_id: accountId,
          name: params.name,
          text: params.text,
          type: "secret_text",
        });

        const resultObj = result as unknown as Record<string, unknown>;
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              updated: true,
              name: String(resultObj.name ?? params.name),
              type: String(resultObj.type ?? "secret_text"),
            }, null, 2),
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

  // ─── cf_workers_delete_secret ───────────────────────────────────
  server.registerTool(
    "cf_workers_delete_secret",
    {
      title: "Delete Worker Secret",
      description:
        `Delete a secret binding from a Worker script. THIS IS IRREVERSIBLE.\n\n` +
        `Safety: You MUST set confirm=true to proceed.\n\n` +
        `Returns: { deleted: true, name }`,
      inputSchema: DeleteSecretSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: DeleteSecretInput) => {
      try {
        if (!params.confirm) {
          return {
            content: [{
              type: "text" as const,
              text: "Delete aborted. You must set confirm=true to delete a secret.",
            }],
            isError: true,
          };
        }

        const client = getClient();
        const accountId = getAccountId(params.account_id);

        await client.workers.scripts.secrets.delete(
          params.script_name,
          params.secret_name,
          { account_id: accountId }
        );

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              deleted: true,
              script: params.script_name,
              name: params.secret_name,
            }, null, 2),
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

  // ─── cf_workers_get_schedules ───────────────────────────────────
  server.registerTool(
    "cf_workers_get_schedules",
    {
      title: "Get Worker Cron Triggers",
      description:
        `Get the cron triggers (schedules) for a Worker script.\n\n` +
        `Returns: { script_name, schedules: [{ cron, created_on, modified_on }] }`,
      inputSchema: GetSchedulesSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: GetSchedulesInput) => {
      try {
        const client = getClient();
        const accountId = getAccountId(params.account_id);

        const result = await client.workers.scripts.schedules.get(params.script_name, {
          account_id: accountId,
        });

        const resultObj = result as unknown as Record<string, unknown>;
        const schedules = Array.isArray(resultObj.schedules) ? resultObj.schedules : [];
        const formatted = formatSchedules(schedules);

        const output = {
          script_name: params.script_name,
          schedules: formatted,
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

  // ─── cf_workers_put_schedules ───────────────────────────────────
  server.registerTool(
    "cf_workers_put_schedules",
    {
      title: "Set Worker Cron Triggers",
      description:
        `Set cron triggers for a Worker script. THIS REPLACES ALL EXISTING SCHEDULES.\n\n` +
        `Safety: You MUST set confirm=true to proceed.\n\n` +
        `Returns: { updated: true, script_name, schedules: [...] }`,
      inputSchema: PutSchedulesSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: PutSchedulesInput) => {
      try {
        if (!params.confirm) {
          return {
            content: [{
              type: "text" as const,
              text: "Update aborted. You must set confirm=true to replace cron triggers.",
            }],
            isError: true,
          };
        }

        const client = getClient();
        const accountId = getAccountId(params.account_id);

        const result = await client.workers.scripts.schedules.update(params.script_name, {
          account_id: accountId,
          body: params.schedules.map((s) => ({ cron: s.cron })),
        });

        const resultObj = result as unknown as Record<string, unknown>;
        const schedules = Array.isArray(resultObj.schedules) ? resultObj.schedules : [];
        const formatted = formatSchedules(schedules);

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              updated: true,
              script_name: params.script_name,
              schedules: formatted,
            }, null, 2),
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
}
