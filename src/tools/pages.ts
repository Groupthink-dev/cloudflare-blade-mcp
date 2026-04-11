/**
 * Cloudflare Pages tools: cf_pages_list_projects, cf_pages_get_project,
 * cf_pages_list_deployments, cf_pages_get_deployment, cf_pages_rollback,
 * cf_pages_list_domains, cf_pages_purge_build_cache
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getClient, getAccountId } from "../services/cloudflare.js";
import {
  formatProject,
  formatProjects,
  formatPageDeployment,
  formatPageDeployments,
  formatDomains,
} from "../formatters/pages.js";
import { truncateIfNeeded } from "../utils/pagination.js";
import { handleApiError } from "../utils/errors.js";
import {
  ListProjectsSchema,
  GetProjectSchema,
  ListPagesDeploymentsSchema,
  GetPagesDeploymentSchema,
  RollbackDeploymentSchema,
  ListPagesDomainsSchema,
  PurgeBuildCacheSchema,
} from "../schemas/pages.js";
import type {
  ListProjectsInput,
  GetProjectInput,
  ListPagesDeploymentsInput,
  GetPagesDeploymentInput,
  RollbackDeploymentInput,
  ListPagesDomainsInput,
  PurgeBuildCacheInput,
} from "../schemas/pages.js";

export function registerPagesTools(server: McpServer): void {
  // ─── cf_pages_list_projects ─────────────────────────────────────
  server.registerTool(
    "cf_pages_list_projects",
    {
      title: "List Pages Projects",
      description:
        `List all Pages projects in your account.\n\n` +
        `Returns: { projects[] } with name, subdomain, production_branch, domains, latest_deployment.`,
      inputSchema: ListProjectsSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: ListProjectsInput) => {
      try {
        const client = getClient();
        const accountId = getAccountId(params.account_id);

        const projects: Record<string, unknown>[] = [];
        for await (const project of client.pages.projects.list({ account_id: accountId })) {
          projects.push(project as unknown as Record<string, unknown>);
        }

        const formatted = formatProjects(projects);
        const output = { total: formatted.length, projects: formatted };
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

  // ─── cf_pages_get_project ───────────────────────────────────────
  server.registerTool(
    "cf_pages_get_project",
    {
      title: "Get Pages Project Details",
      description:
        `Get details for a Pages project by name.\n\n` +
        `Returns: { project: { name, subdomain, production_branch, domains, latest_deployment } }`,
      inputSchema: GetProjectSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: GetProjectInput) => {
      try {
        const client = getClient();
        const accountId = getAccountId(params.account_id);

        const project = await client.pages.projects.get(params.project_name, {
          account_id: accountId,
        });

        const formatted = formatProject(project as unknown as Record<string, unknown>);
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ project: formatted }, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: handleApiError(error) }],
          isError: true,
        };
      }
    }
  );

  // ─── cf_pages_list_deployments ──────────────────────────────────
  server.registerTool(
    "cf_pages_list_deployments",
    {
      title: "List Pages Deployments",
      description:
        `List deployments for a Pages project. Optionally filter by environment (production/preview).\n\n` +
        `Returns: { deployments[] } with id, environment, url, stages, trigger info.`,
      inputSchema: ListPagesDeploymentsSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: ListPagesDeploymentsInput) => {
      try {
        const client = getClient();
        const accountId = getAccountId(params.account_id);

        const queryParams: Record<string, unknown> = { account_id: accountId };
        if (params.env) queryParams.env = params.env;

        const deployments: Record<string, unknown>[] = [];
        for await (const dep of client.pages.projects.deployments.list(
          params.project_name,
          queryParams as unknown as Parameters<typeof client.pages.projects.deployments.list>[1]
        )) {
          deployments.push(dep as unknown as Record<string, unknown>);
        }

        const formatted = formatPageDeployments(deployments);
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

  // ─── cf_pages_get_deployment ────────────────────────────────────
  server.registerTool(
    "cf_pages_get_deployment",
    {
      title: "Get Pages Deployment Details",
      description:
        `Get details for a specific Pages deployment by ID.\n\n` +
        `Returns: { deployment: { id, environment, url, stages, trigger } }`,
      inputSchema: GetPagesDeploymentSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: GetPagesDeploymentInput) => {
      try {
        const client = getClient();
        const accountId = getAccountId(params.account_id);

        const deployment = await client.pages.projects.deployments.get(
          params.project_name,
          params.deployment_id,
          { account_id: accountId }
        );

        const formatted = formatPageDeployment(deployment as unknown as Record<string, unknown>);
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ deployment: formatted }, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: "text" as const, text: handleApiError(error) }],
          isError: true,
        };
      }
    }
  );

  // ─── cf_pages_rollback ──────────────────────────────────────────
  server.registerTool(
    "cf_pages_rollback",
    {
      title: "Rollback Pages Deployment",
      description:
        `Rollback the production deployment to a previous successful deployment.\n\n` +
        `Safety: You MUST set confirm=true to proceed.\n\n` +
        `Tip: Use cf_pages_list_deployments with env='production' first to find the deployment ID.\n\n` +
        `Returns: { rolled_back: true, deployment: { ... } }`,
      inputSchema: RollbackDeploymentSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (params: RollbackDeploymentInput) => {
      try {
        if (!params.confirm) {
          return {
            content: [{
              type: "text" as const,
              text: "Rollback aborted. You must set confirm=true to rollback a production deployment.",
            }],
            isError: true,
          };
        }

        const client = getClient();
        const accountId = getAccountId(params.account_id);

        const result = await client.pages.projects.deployments.rollback(
          params.project_name,
          params.deployment_id,
          { account_id: accountId, body: {} }
        );

        const formatted = formatPageDeployment(result as unknown as Record<string, unknown>);
        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({ rolled_back: true, deployment: formatted }, null, 2),
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

  // ─── cf_pages_list_domains ──────────────────────────────────────
  server.registerTool(
    "cf_pages_list_domains",
    {
      title: "List Pages Custom Domains",
      description:
        `List custom domains associated with a Pages project.\n\n` +
        `Returns: { domains: [{ name, status, created_on }] }`,
      inputSchema: ListPagesDomainsSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: ListPagesDomainsInput) => {
      try {
        const client = getClient();
        const accountId = getAccountId(params.account_id);

        const domains: Record<string, unknown>[] = [];
        for await (const domain of client.pages.projects.domains.list(params.project_name, {
          account_id: accountId,
        })) {
          domains.push(domain as unknown as Record<string, unknown>);
        }

        const formatted = formatDomains(domains);
        const output = { total: formatted.length, domains: formatted };
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

  // ─── cf_pages_purge_build_cache ─────────────────────────────────
  server.registerTool(
    "cf_pages_purge_build_cache",
    {
      title: "Purge Pages Build Cache",
      description:
        `Purge all cached build artifacts for a Pages project. Useful when builds are stale or broken.\n\n` +
        `Safety: You MUST set confirm=true to proceed.\n\n` +
        `Returns: { purged: true, project_name }`,
      inputSchema: PurgeBuildCacheSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: PurgeBuildCacheInput) => {
      try {
        if (!params.confirm) {
          return {
            content: [{
              type: "text" as const,
              text: "Purge aborted. You must set confirm=true to purge the build cache.",
            }],
            isError: true,
          };
        }

        const client = getClient();
        const accountId = getAccountId(params.account_id);

        await client.pages.projects.purgeBuildCache(params.project_name, {
          account_id: accountId,
        });

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              purged: true,
              project_name: params.project_name,
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
