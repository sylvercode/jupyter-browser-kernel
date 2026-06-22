import type { VariableStore } from "../../../src/debugger/variable-store.js";

export function createFakeVariableStore(
  overrides: Partial<VariableStore> = {},
): VariableStore {
  return {
    reserve: overrides.reserve ?? (() => 0),
    resolve: overrides.resolve ?? (() => undefined),
    clearForPause: overrides.clearForPause ?? (async () => undefined),
    dispose: overrides.dispose ?? (async () => undefined),
  };
}
