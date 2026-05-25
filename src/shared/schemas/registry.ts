import { Schema } from "effect";
import { agentProviderIdSchema } from "./agents";
import { isoString, mutableArray, nonEmptyString, numberSchema, passthroughStruct, withDefault, type SchemaType } from "./common";
import { themePreferenceSchema } from "./primitives";

export const appRegistrySchema = passthroughStruct({
  schemaVersion: Schema.Literal(1),
  projects: mutableArray(
    Schema.Struct({
      path: nonEmptyString,
      pinned: Schema.Boolean,
      lastOpenedAt: isoString,
      sidebarPosition: numberSchema
    })
  ),
  selectedProviderId: withDefault(agentProviderIdSchema, () => "codex" as const),
  voiceInput: withDefault(
    Schema.Struct({
      whisperCommandPath: Schema.NullOr(Schema.String)
    }),
    () => ({
      whisperCommandPath: null
    })
  ),
  ui: Schema.Struct({
    lastProjectPath: Schema.NullOr(Schema.String),
    theme: themePreferenceSchema
  })
});
export type AppRegistry = SchemaType<typeof appRegistrySchema>;
