import { getRuntilmeCellBridgeHelperPrelude } from "./runtilme-cell-bridge";

export interface BuildCellExpressionOptions {
  isolate: boolean;
}

export function buildCellExpression(
  userCode: string,
  sourceUri: string,
  options: BuildCellExpressionOptions,
): string {
  const helperPrelude = getRuntilmeCellBridgeHelperPrelude();

  if (!options.isolate) {
    return `${helperPrelude}\n${userCode}\n//# sourceURL=${sourceUri}\n`;
  }

  const isolationStart = "await (async()=>{";
  const isolationEnd = `})()\n//# sourceURL=${sourceUri}\n`;
  const wrappedUserCode =
    userCode.length === 0 ? helperPrelude : `${helperPrelude}\n${userCode}`;

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
