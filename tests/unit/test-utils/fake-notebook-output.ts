export class FakeNotebookCellOutputItem {
  public readonly kind: "text" | "error";
  public readonly value: string | Error;
  public readonly mime?: string;

  private constructor(
    kind: "text" | "error",
    value: string | Error,
    mime?: string,
  ) {
    this.kind = kind;
    this.value = value;
    this.mime = mime;
  }

  public static text(value: string, mime: string): FakeNotebookCellOutputItem {
    return new FakeNotebookCellOutputItem("text", value, mime);
  }

  public static error(error: Error): FakeNotebookCellOutputItem {
    return new FakeNotebookCellOutputItem("error", error);
  }
}

export class FakeNotebookCellOutput {
  public constructor(
    public readonly items: FakeNotebookCellOutputItem[],
    public readonly metadata?: Record<string, unknown>,
  ) {}
}
