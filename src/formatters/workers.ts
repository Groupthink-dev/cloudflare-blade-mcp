/**
 * Workers formatters — token-efficiency layer for Cloudflare Workers.
 */

interface ConciseScript {
  id: string;
  created_on: string;
  modified_on: string;
  has_modules: boolean;
  has_assets: boolean;
  logpush: boolean;
  usage_model: string;
}

interface ConciseDeployment {
  id: string;
  created_on: string;
  author_email: string;
  source: string;
  versions: Array<{ version_id: string; percentage: number }>;
}

interface ConciseVersion {
  id: string;
  number: number;
  created_on: string;
  metadata: Record<string, unknown> | null;
}

interface ConciseSecret {
  name: string;
  type: string;
}

interface ConciseSchedule {
  cron: string;
  created_on: string;
  modified_on: string;
}

export function formatScript(script: Record<string, unknown>): ConciseScript {
  return {
    id: String(script.id ?? ""),
    created_on: String(script.created_on ?? ""),
    modified_on: String(script.modified_on ?? ""),
    has_modules: Boolean(script.has_modules ?? false),
    has_assets: Boolean(script.has_assets ?? false),
    logpush: Boolean(script.logpush ?? false),
    usage_model: String(script.usage_model ?? "standard"),
  };
}

export function formatScripts(
  scripts: Record<string, unknown>[]
): ConciseScript[] {
  return scripts.map(formatScript);
}

export function formatDeployment(
  deployment: Record<string, unknown>
): ConciseDeployment {
  const versions = Array.isArray(deployment.versions)
    ? deployment.versions.map((v: Record<string, unknown>) => ({
        version_id: String(v.version_id ?? ""),
        percentage: Number(v.percentage ?? 0),
      }))
    : [];

  const annotations = deployment.annotations as Record<string, unknown> | undefined;

  return {
    id: String(deployment.id ?? ""),
    created_on: String(deployment.created_on ?? ""),
    author_email: String(deployment.author_email ?? ""),
    source: String(deployment.source ?? ""),
    versions,
  };
}

export function formatDeployments(
  deployments: Record<string, unknown>[]
): ConciseDeployment[] {
  return deployments.map(formatDeployment);
}

export function formatVersion(
  version: Record<string, unknown>
): ConciseVersion {
  const metadata = version.metadata as Record<string, unknown> | null;
  return {
    id: String(version.id ?? ""),
    number: Number(version.number ?? 0),
    created_on: String(version.created_on ?? ""),
    metadata: metadata ?? null,
  };
}

export function formatVersions(
  versions: Record<string, unknown>[]
): ConciseVersion[] {
  return versions.map(formatVersion);
}

export function formatSecret(
  secret: Record<string, unknown>
): ConciseSecret {
  return {
    name: String(secret.name ?? ""),
    type: String(secret.type ?? ""),
  };
}

export function formatSecrets(
  secrets: Record<string, unknown>[]
): ConciseSecret[] {
  return secrets.map(formatSecret);
}

export function formatSchedule(
  schedule: Record<string, unknown>
): ConciseSchedule {
  return {
    cron: String(schedule.cron ?? ""),
    created_on: String(schedule.created_on ?? ""),
    modified_on: String(schedule.modified_on ?? ""),
  };
}

export function formatSchedules(
  schedules: Record<string, unknown>[]
): ConciseSchedule[] {
  return schedules.map(formatSchedule);
}
