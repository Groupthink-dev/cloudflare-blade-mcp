import { z } from "zod";
import { AccountIdSchema } from "./common.js";

export const ListBucketsSchema = AccountIdSchema.extend({
  name_contains: z
    .string()
    .optional()
    .describe("Filter buckets by name substring."),
  per_page: z
    .number()
    .int()
    .min(1)
    .max(1000)
    .default(50)
    .describe("Maximum buckets to return (default: 50, max: 1000)."),
  cursor: z
    .string()
    .optional()
    .describe("Pagination cursor from a previous response."),
}).strict();
export type ListBucketsInput = z.infer<typeof ListBucketsSchema>;

export const GetBucketSchema = AccountIdSchema.extend({
  bucket_name: z
    .string()
    .min(1)
    .describe("R2 bucket name."),
  jurisdiction: z
    .enum(["default", "eu", "fedramp"])
    .optional()
    .describe("Jurisdiction hint (default, eu, fedramp)."),
}).strict();
export type GetBucketInput = z.infer<typeof GetBucketSchema>;

export const CreateBucketSchema = AccountIdSchema.extend({
  name: z
    .string()
    .min(1)
    .describe("Name for the new R2 bucket. Must be globally unique."),
  location: z
    .enum(["apac", "eeur", "enam", "weur", "wnam", "oc"])
    .optional()
    .describe("Location hint for the bucket (apac, eeur, enam, weur, wnam, oc)."),
  storage_class: z
    .enum(["Standard", "InfrequentAccess"])
    .default("Standard")
    .describe("Default storage class for new objects (Standard or InfrequentAccess)."),
  jurisdiction: z
    .enum(["default", "eu", "fedramp"])
    .optional()
    .describe("Jurisdiction guarantee for stored objects (default, eu, fedramp)."),
  confirm: z
    .literal(true)
    .describe("Safety gate: must be explicitly set to true to create a bucket."),
}).strict();
export type CreateBucketInput = z.infer<typeof CreateBucketSchema>;

export const DeleteBucketSchema = AccountIdSchema.extend({
  bucket_name: z
    .string()
    .min(1)
    .describe("R2 bucket name to delete."),
  jurisdiction: z
    .enum(["default", "eu", "fedramp"])
    .optional()
    .describe("Jurisdiction hint (required if bucket was created in a non-default jurisdiction)."),
  confirm: z
    .literal(true)
    .describe(
      "Safety gate: must be explicitly set to true. " +
        "The bucket must be empty before deletion. THIS IS IRREVERSIBLE."
    ),
}).strict();
export type DeleteBucketInput = z.infer<typeof DeleteBucketSchema>;
