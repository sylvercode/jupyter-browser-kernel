export interface BuildCellExpressionOptions {
  isolate: boolean;
  runtimeCellBridgeKey?: string;
}

function buildRuntimeCellBridgePrefix(
  runtimeCellBridgeKey: string | undefined,
): string {
  if (!runtimeCellBridgeKey) {
    return "";
  }

  return `const $cell = globalThis[${JSON.stringify(runtimeCellBridgeKey)}].cellBridge; `;
}

export function buildCellExpression(
  userCode: string,
  sourceUri: string,
  options: BuildCellExpressionOptions,
): string {
  const runtimeCellBridgePrefix = buildRuntimeCellBridgePrefix(
    options.isolate ? options.runtimeCellBridgeKey : undefined,
  );

  if (!options.isolate) {
    return `${runtimeCellBridgePrefix}${userCode}\n//# sourceURL=${sourceUri}\n`;
  }

  const isolationStart = "await (async()=>{";
  const isolationEnd = `})()\n//# sourceURL=${sourceUri}\n`;
  const wrappedUserCode = `${runtimeCellBridgePrefix}${userCode}`;

  if (wrappedUserCode.length === 0) {
    return `${isolationStart}${isolationEnd}`;
  }

  const lines = wrappedUserCode.split("\n");

  if (lines.length === 1) {
    const onlyLine = lines[0] ?? "";
    return `${isolationStart}${onlyLine}${isolationEnd}`;
  }

  const firstLine = lines[0] ?? "";
  const lastIndex = lines.length - 1;
  const currentLastLine = lines[lastIndex] ?? "";

  lines[0] = `${isolationStart}${firstLine}`;
  lines[lastIndex] = `${currentLastLine}${isolationEnd}`;

  return `${lines.join("\n")}`;
}
