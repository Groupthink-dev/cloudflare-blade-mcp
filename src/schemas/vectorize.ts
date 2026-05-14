import { z } from "zod";
import { AccountIdSchema } from "./common.js";

export const VectorizeMetricSchema = z.enum(["cosine", "euclidean", "dot-product"]);
export const MetadataIndexTypeSchema = z.enum(["string", "number", "boolean"]);

export const ListIndexesSchema = AccountIdSchema.extend({}).strict();
export type ListIndexesInput = z.infer<typeof ListIndexesSchema>;

export const IndexNameSchema = AccountIdSchema.extend({
  index_name: z.string().min(1).describe("Vectorize index name."),
}).strict();
export type IndexNameInput = z.infer<typeof IndexNameSchema>;

export const CreateIndexSchema = AccountIdSchema.extend({
  name: z.string().min(1).describe("Name for the new Vectorize index."),
  dimensions: z
    .number()
    .int()
    .min(1)
    .max(1536)
    .describe("Number of vector dimensions."),
  metric: VectorizeMetricSchema.describe("Distance metric for the index."),
  description: z.string().optional().describe("Optional index description."),
  confirm: z.literal(true).describe("Safety gate: must be explicitly set to true to create an index."),
}).strict();
export type CreateIndexInput = z.infer<typeof CreateIndexSchema>;

export const DeleteIndexSchema = AccountIdSchema.extend({
  index_name: z.string().min(1).describe("Vectorize index name."),
  confirm_name: z
    .string()
    .min(1)
    .describe("Exact index name repeated for deletion confirmation."),
  confirm: z.literal(true).describe("Safety gate: must be explicitly set to true to delete an index."),
}).strict();
export type DeleteIndexInput = z.infer<typeof DeleteIndexSchema>;

export const CreateMetadataIndexSchema = AccountIdSchema.extend({
  index_name: z.string().min(1).describe("Vectorize index name."),
  property_name: z.string().min(1).describe("Metadata property to index."),
  index_type: MetadataIndexTypeSchema.describe("Metadata property type."),
  confirm: z
    .literal(true)
    .describe("Safety gate: must be explicitly set to true to create a metadata index."),
}).strict();
export type CreateMetadataIndexInput = z.infer<typeof CreateMetadataIndexSchema>;

export const DeleteMetadataIndexSchema = AccountIdSchema.extend({
  index_name: z.string().min(1).describe("Vectorize index name."),
  property_name: z.string().min(1).describe("Metadata property index to delete."),
  confirm: z
    .literal(true)
    .describe("Safety gate: must be explicitly set to true to delete a metadata index."),
}).strict();
export type DeleteMetadataIndexInput = z.infer<typeof DeleteMetadataIndexSchema>;
