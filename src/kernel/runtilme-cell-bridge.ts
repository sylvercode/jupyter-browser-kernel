const RUNTILME_CELL_BRIDGE_KEY_PREFIX = "__jbkRuntilmeCellBridge:";

export function createRuntilmeCellBridgeKey(): string {
  return `${RUNTILME_CELL_BRIDGE_KEY_PREFIX}${crypto.randomUUID()}`;
}

export function getRuntilmeCellBridgeHelperPrelude(): string {
  return "globalThis.$cell = globalThis.$cell ?? Object.freeze({ log: () => undefined });";
}

export function createRuntilmeCellBridgeSetupExpression(
  bridgeKey: string,
): string {
  return [
    "(() => {",
    `  const bridgeKey = ${JSON.stringify(bridgeKey)};`,
    "  const globalScope = globalThis;",
    '  const hasOwnCell = Object.prototype.hasOwnProperty.call(globalScope, "$cell");',
    "  const previousCell = hasOwnCell ? globalScope.$cell : undefined;",
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
    "  const helper = Object.freeze({",
    "    log: (...values) => {",
    "      const rendered =",
    "        values.length === 0",
    '          ? ""',
    '          : values.map((value) => toDeterministicString(value)).join(" ");',
    "      logs.push(rendered);",
    "    },",
    "  });",
    "",
    "  globalScope.$cell = helper;",
    "  globalScope[bridgeKey] = {",
    "    hasOwnCell,",
    "    previousCell,",
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
    "  if (bridgeState?.hasOwnCell) {",
    "    globalScope.$cell = bridgeState.previousCell;",
    "  } else {",
    "    delete globalScope.$cell;",
    "  }",
    "",
    "  delete globalScope[bridgeKey];",
    "  return logs;",
    "})()",
  ].join("\n");
}
