/**
 * Pages formatters — token-efficiency layer for Cloudflare Pages.
 */

interface ConciseProject {
  name: string;
  subdomain: string;
  production_branch: string;
  domains: string[];
  created_on: string;
  latest_deployment: ConcisePageDeployment | null;
}

interface ConcisePageDeployment {
  id: string;
  environment: string;
  url: string;
  created_on: string;
  modified_on: string;
  is_skipped: boolean;
  latest_stage: ConciseStage | null;
  trigger: ConciseTrigger | null;
  short_id: string;
}

interface ConciseStage {
  name: string;
  status: string;
  started_on: string;
  ended_on: string;
}

interface ConciseTrigger {
  type: string;
  branch: string;
  commit_hash: string;
  commit_message: string;
}

interface ConciseDomain {
  name: string;
  status: string;
  created_on: string;
}

function formatStage(stage: Record<string, unknown> | null | undefined): ConciseStage | null {
  if (!stage) return null;
  return {
    name: String(stage.name ?? ""),
    status: String(stage.status ?? ""),
    started_on: String(stage.started_on ?? ""),
    ended_on: String(stage.ended_on ?? ""),
  };
}

function formatTrigger(deployment: Record<string, unknown>): ConciseTrigger | null {
  const trigger = deployment.deployment_trigger as Record<string, unknown> | undefined;
  if (!trigger) return null;
  const metadata = trigger.metadata as Record<string, unknown> | undefined;
  return {
    type: String(trigger.type ?? ""),
    branch: String(metadata?.branch ?? ""),
    commit_hash: String(metadata?.commit_hash ?? ""),
    commit_message: String(metadata?.commit_message ?? ""),
  };
}

export function formatPageDeployment(
  deployment: Record<string, unknown>
): ConcisePageDeployment {
  return {
    id: String(deployment.id ?? ""),
    environment: String(deployment.environment ?? ""),
    url: String(deployment.url ?? ""),
    created_on: String(deployment.created_on ?? ""),
    modified_on: String(deployment.modified_on ?? ""),
    is_skipped: Boolean(deployment.is_skipped ?? false),
    latest_stage: formatStage(deployment.latest_stage as Record<string, unknown> | undefined),
    trigger: formatTrigger(deployment),
    short_id: String(deployment.short_id ?? ""),
  };
}

export function formatPageDeployments(
  deployments: Record<string, unknown>[]
): ConcisePageDeployment[] {
  return deployments.map(formatPageDeployment);
}

export function formatProject(project: Record<string, unknown>): ConciseProject {
  const latestDep = project.latest_deployment as Record<string, unknown> | null | undefined;
  return {
    name: String(project.name ?? ""),
    subdomain: String(project.subdomain ?? ""),
    production_branch: String(project.production_branch ?? ""),
    domains: Array.isArray(project.domains) ? project.domains.map(String) : [],
    created_on: String(project.created_on ?? ""),
    latest_deployment: latestDep ? formatPageDeployment(latestDep) : null,
  };
}

export function formatProjects(
  projects: Record<string, unknown>[]
): ConciseProject[] {
  return projects.map(formatProject);
}

export function formatDomain(domain: Record<string, unknown>): ConciseDomain {
  return {
    name: String(domain.name ?? ""),
    status: String(domain.status ?? ""),
    created_on: String(domain.created_on ?? ""),
  };
}

export function formatDomains(
  domains: Record<string, unknown>[]
): ConciseDomain[] {
  return domains.map(formatDomain);
}
