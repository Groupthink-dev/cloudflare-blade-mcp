export function formatAiGateway(gateway: Record<string, unknown>): Record<string, unknown> {
  return {
    id: String(gateway.id ?? ""),
    name: String(gateway.name ?? ""),
    created_at: String(gateway.created_at ?? gateway.createdAt ?? ""),
    modified_at: String(gateway.modified_at ?? gateway.modifiedAt ?? ""),
  };
}

export function formatAiGateways(gateways: Record<string, unknown>[]): Record<string, unknown>[] {
  return gateways.map(formatAiGateway);
}

export function formatWorkersAiModel(model: Record<string, unknown>): Record<string, unknown> {
  return {
    id: String(model.id ?? model.name ?? ""),
    name: String(model.name ?? model.id ?? ""),
    task: String(model.task ?? ""),
    author: String(model.author ?? ""),
    description: String(model.description ?? ""),
  };
}

export function formatWorkersAiModels(models: Record<string, unknown>[]): Record<string, unknown>[] {
  return models.map(formatWorkersAiModel);
}
