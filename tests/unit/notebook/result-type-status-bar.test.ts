import test from "node:test";
import assert from "node:assert/strict";

import { registerResultTypeStatusBarProvider } from "../../../src/notebook/result-type-status-bar.js";
import { createLocalizeMock } from "../test-utils/localize-mock.js";

class FakeNotebookCellStatusBarItem {
  public priority: number | undefined;

  constructor(
    public text: string,
    public alignment: number,
  ) {}
}

type Listener<T> = (event: T) => void;

class FakeEventEmitter<T> {
  private listeners: Array<Listener<T>> = [];

  public readonly event = (listener: Listener<T>) => {
    this.listeners.push(listener);
    return {
      dispose: () => {
        this.listeners = this.listeners.filter(
          (registered) => registered !== listener,
        );
      },
    };
  };

  public fire(event: T): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  public dispose(): void {
    this.listeners = [];
  }
}

interface FakeNotebookCellOutput {
  metadata?: Record<string, unknown>;
}

interface FakeNotebookCell {
  kind: number;
  document: {
    languageId: string;
  };
  outputs: FakeNotebookCellOutput[];
}

interface FakeProvider {
  onDidChangeCellStatusBarItems?: (listener: () => void) => {
    dispose: () => void;
  };
  provideCellStatusBarItems: (
    cell: FakeNotebookCell,
    token: unknown,
  ) => unknown;
}

function createHarness() {
  let capturedNotebookType: string | undefined;
  let capturedProvider: FakeProvider | undefined;
  let documentChangeListener: ((event: unknown) => void) | undefined;

  const api = {
    notebooks: {
      registerNotebookCellStatusBarItemProvider: (
        notebookType: string,
        provider: FakeProvider,
      ) => {
        capturedNotebookType = notebookType;
        capturedProvider = provider;
        return { dispose: () => undefined };
      },
    },
    workspace: {
      onDidChangeNotebookDocument: (listener: (event: unknown) => void) => {
        documentChangeListener = listener;
        return { dispose: () => undefined };
      },
    },
    NotebookCellKind: {
      Code: 1,
      Markup: 2,
    } as never,
    NotebookCellStatusBarAlignment: {
      Left: 1,
      Right: 2,
    } as never,
    NotebookCellStatusBarItem: FakeNotebookCellStatusBarItem as never,
    EventEmitter: FakeEventEmitter as never,
    l10n: {
      t: createLocalizeMock(),
    },
  };

  const disposable = registerResultTypeStatusBarProvider(api as never, {});

  assert.equal(capturedNotebookType, "jupyter-notebook");
  assert.ok(capturedProvider);

  const createCell = (
    outputs: FakeNotebookCellOutput[] = [],
    languageId = "javascript",
  ): FakeNotebookCell => ({
    kind: 1,
    document: {
      languageId,
    },
    outputs,
  });

  return {
    provider: capturedProvider,
    documentChangeListener,
    createCell,
    disposable,
  };
}

test("shows result type status item on the left", () => {
  const harness = createHarness();
  const cell = harness.createCell([
    {
      metadata: {
        "jupyterBrowserKernel.resultType": "string",
      },
    },
  ]);

  const items = harness.provider?.provideCellStatusBarItems(cell, undefined) as
    | FakeNotebookCellStatusBarItem[]
    | undefined;

  assert.ok(items);
  assert.equal(items.length, 1);
  assert.equal(items[0]?.text, "Result Type: string");
  assert.equal(items[0]?.alignment, 1); // Left alignment
});

test("disambiguates null type", () => {
  const harness = createHarness();
  const cell = harness.createCell([
    {
      metadata: {
        "jupyterBrowserKernel.resultType": "null",
      },
    },
  ]);

  const items = harness.provider?.provideCellStatusBarItems(cell, undefined) as
    | FakeNotebookCellStatusBarItem[]
    | undefined;

  assert.ok(items);
  assert.equal(items.length, 1);
  assert.equal(items[0]?.text, "Result Type: null");
});

test("disambiguates undefined type", () => {
  const harness = createHarness();
  const cell = harness.createCell([
    {
      metadata: {
        "jupyterBrowserKernel.resultType": "undefined",
      },
    },
  ]);

  const items = harness.provider?.provideCellStatusBarItems(cell, undefined) as
    | FakeNotebookCellStatusBarItem[]
    | undefined;

  assert.ok(items);
  assert.equal(items.length, 1);
  assert.equal(items[0]?.text, "Result Type: undefined");
});

test("returns no status item when no result type metadata exists", () => {
  const harness = createHarness();
  const cell = harness.createCell([{}]);

  const items = harness.provider?.provideCellStatusBarItems(cell, undefined) as
    | FakeNotebookCellStatusBarItem[]
    | undefined;

  assert.ok(items);
  assert.equal(items.length, 0);
});

test("returns no status item when cell has no outputs", () => {
  const harness = createHarness();
  const cell = harness.createCell([]);

  const items = harness.provider?.provideCellStatusBarItems(cell, undefined) as
    | FakeNotebookCellStatusBarItem[]
    | undefined;

  assert.ok(items);
  assert.equal(items.length, 0);
});

test("returns no status item for non-javascript cells", () => {
  const harness = createHarness();
  const cell = harness.createCell(
    [
      {
        metadata: {
          "jupyterBrowserKernel.resultType": "number",
        },
      },
    ],
    "python",
  );

  const items = harness.provider?.provideCellStatusBarItems(cell, undefined) as
    | FakeNotebookCellStatusBarItem[]
    | undefined;

  assert.ok(items);
  assert.equal(items.length, 0);
});

test("returns no status item for non-code cells", () => {
  const harness = createHarness();
  const cell = harness.createCell(
    [
      {
        metadata: {
          "jupyterBrowserKernel.resultType": "number",
        },
      },
    ],
    "javascript",
  );
  cell.kind = 2; // Markup

  const items = harness.provider?.provideCellStatusBarItems(cell, undefined) as
    | FakeNotebookCellStatusBarItem[]
    | undefined;

  assert.ok(items);
  assert.equal(items.length, 0);
});

test("fires refresh when notebook document changes", () => {
  const harness = createHarness();

  let changed = false;
  harness.provider?.onDidChangeCellStatusBarItems?.(() => {
    changed = true;
  });

  harness.documentChangeListener?.({});

  assert.equal(changed, true);
  harness.disposable.dispose();
});

test("shows object result type", () => {
  const harness = createHarness();
  const cell = harness.createCell([
    {
      metadata: {
        "jupyterBrowserKernel.resultType": "object",
      },
    },
  ]);

  const items = harness.provider?.provideCellStatusBarItems(cell, undefined) as
    | FakeNotebookCellStatusBarItem[]
    | undefined;

  assert.ok(items);
  assert.equal(items.length, 1);
  assert.equal(items[0]?.text, "Result Type: object");
});

test("shows array result type", () => {
  const harness = createHarness();
  const cell = harness.createCell([
    {
      metadata: {
        "jupyterBrowserKernel.resultType": "array",
      },
    },
  ]);

  const items = harness.provider?.provideCellStatusBarItems(cell, undefined) as
    | FakeNotebookCellStatusBarItem[]
    | undefined;

  assert.ok(items);
  assert.equal(items.length, 1);
  assert.equal(items[0]?.text, "Result Type: array");
});

test("has priority set for status bar item", () => {
  const harness = createHarness();
  const cell = harness.createCell([
    {
      metadata: {
        "jupyterBrowserKernel.resultType": "boolean",
      },
    },
  ]);

  const items = harness.provider?.provideCellStatusBarItems(cell, undefined) as
    | FakeNotebookCellStatusBarItem[]
    | undefined;

  assert.ok(items);
  assert.equal(items.length, 1);
  assert.equal(items[0]?.priority, 100);
});
