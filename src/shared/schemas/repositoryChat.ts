import { Schema } from "effect";
import {
  RELAY_SCHEMA_VERSION,
  mutableArray,
  nonEmptyString,
  passthroughStruct,
  withDefault,
  type SchemaType
} from "./common";

export const repositoryChatMessageSchema = passthroughStruct({
  id: nonEmptyString,
  role: Schema.Literals(["user", "assistant"]),
  text: Schema.String
});
export type RepositoryChatMessage = SchemaType<typeof repositoryChatMessageSchema>;

export const repositoryChatStoreSchema = passthroughStruct({
  schemaVersion: Schema.Literal(RELAY_SCHEMA_VERSION),
  threadId: withDefault(Schema.NullOr(Schema.String), () => null),
  messages: withDefault(mutableArray(repositoryChatMessageSchema), () => []),
  draft: withDefault(Schema.String, () => "")
});
export type RepositoryChatStore = SchemaType<typeof repositoryChatStoreSchema>;

export const repositoryChatSaveInputSchema = passthroughStruct({
  projectPath: Schema.String,
  threadId: Schema.optional(Schema.NullOr(Schema.String)),
  messages: withDefault(mutableArray(repositoryChatMessageSchema), () => []),
  draft: Schema.optional(Schema.String)
});
export type RepositoryChatSaveInput = SchemaType<typeof repositoryChatSaveInputSchema>;
