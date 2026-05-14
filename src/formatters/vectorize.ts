interface ConciseVectorizeIndex {
  name: string;
  dimensions?: number;
  metric?: string;
  description?: string;
  created_on?: string;
  modified_on?: string;
}

interface ConciseMetadataIndex {
  property_name: string;
  index_type: string;
}

export function formatVectorizeIndex(index: Record<string, unknown>): ConciseVectorizeIndex {
  const config = (index.config ?? {}) as Record<string, unknown>;
  return {
    name: String(index.name ?? ""),
    ...(config.dimensions !== undefined ? { dimensions: Number(config.dimensions) } : {}),
    ...(config.metric !== undefined ? { metric: String(config.metric) } : {}),
    ...(index.description !== undefined ? { description: String(index.description) } : {}),
    ...(index.created_on !== undefined ? { created_on: String(index.created_on) } : {}),
    ...(index.modified_on !== undefined ? { modified_on: String(index.modified_on) } : {}),
  };
}

export function formatVectorizeIndexes(indexes: Record<string, unknown>[]): ConciseVectorizeIndex[] {
  return indexes.map(formatVectorizeIndex);
}

export function formatMetadataIndex(index: Record<string, unknown>): ConciseMetadataIndex {
  return {
    property_name: String(index.propertyName ?? index.property_name ?? ""),
    index_type: String(index.indexType ?? index.index_type ?? ""),
  };
}

export function formatMetadataIndexes(indexes: Record<string, unknown>[]): ConciseMetadataIndex[] {
  return indexes.map(formatMetadataIndex);
}
