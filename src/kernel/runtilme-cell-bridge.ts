const RUNTILME_CELL_BRIDGE_KEY_PREFIX = "__jbkRuntilmeCellBridge:";
const CELL_BRIDGE_REFERENCE_PATTERN = /\$cell\s*\./;

export function createRuntilmeCellBridgeKey(): string {
  return `${RUNTILME_CELL_BRIDGE_KEY_PREFIX}${crypto.randomUUID()}`;
}

export function referencesRuntimeCellBridge(userCode: string): boolean {
  return CELL_BRIDGE_REFERENCE_PATTERN.test(userCode);
}

export function createRuntilmeCellBridgeSetupExpression(
  bridgeKey: string,
): string {
  return [
    "(() => {",
    `  const bridgeKey = ${JSON.stringify(bridgeKey)};`,
    "  const globalScope = globalThis;",
    "  const logs = [];",
    "",
    "  const toDeterministicString = (value) => {",
    '    if (typeof value === "string") {',
    "      return value;",
    "    }",
    "",
    "    if (value === undefined) {",
    '      return "undefined";',
    "    }",
    "",
    "    if (value === null) {",
    '      return "null";',
    "    }",
    "",
    "    if (",
    '      typeof value === "number" ||',
    '      typeof value === "boolean" ||',
    '      typeof value === "bigint" ||',
    '      typeof value === "symbol"',
    "    ) {",
    "      return String(value);",
    "    }",
    "",
    "    try {",
    "      const serialized = JSON.stringify(value);",
    "      return serialized ?? String(value);",
    "    } catch {",
    "      return String(value);",
    "    }",
    "  };",
    "",
    "  const bridge = Object.freeze({",
    "    log: (...values) => {",
    "      const rendered =",
    "        values.length === 0",
    '          ? ""',
    '          : values.map((value) => toDeterministicString(value)).join(" ");',
    "      logs.push(rendered);",
    "    },",
    "  });",
    "",
    "  globalScope[bridgeKey] = {",
    "    cellBridge: bridge,",
    "    logs,",
    "  };",
    "",
    "  return bridgeKey;",
    "})()",
  ].join("\n");
}

export function createRuntilmeCellBridgeTeardownExpression(
  bridgeKey: string,
): string {
  return [
    "(() => {",
    "  const globalScope = globalThis;",
    `  const bridgeKey = ${JSON.stringify(bridgeKey)};`,
    "  const bridgeState = globalScope[bridgeKey];",
    "",
    "  const logs = Array.isArray(bridgeState?.logs)",
    '    ? bridgeState.logs.filter((entry) => typeof entry === "string")',
    "    : [];",
    "",
    "  delete globalScope[bridgeKey];",
    "  return logs;",
    "})()",
  ].join("\n");
}
