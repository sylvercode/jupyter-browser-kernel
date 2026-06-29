import test from "node:test";
import assert from "node:assert/strict";

import { registerCellIsolationStatusBarProvider } from "../../../src/notebook/cell-isolation-status-bar.js";
import { createLocalizeMock } from "../test-utils/localize-mock.js";

class FakeNotebookCellStatusBarItem {
  public command: unknown;
  public tooltip: unknown;
  public accessibilityInformation: { label: string; role?: string } | undefined;
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

interface FakeNotebookCell {
  kind: number;
  document: {
    languageId: string;
  };
  metadata: unknown;
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

function createHarness(options?: { defaultCellIsolation?: boolean }) {
  let capturedNotebookType: string | undefined;
  let capturedProvider: FakeProvider | undefined;
  let configurationListener:
    | ((event: { affectsConfiguration: (section: string) => boolean }) => void)
    | undefined;

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
      onDidChangeConfiguration: (
        listener: (event: {
          affectsConfiguration: (section: string) => boolean;
        }) => void,
      ) => {
        configurationListener = listener;
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

  const disposable = registerCellIsolationStatusBarProvider(api as never, {
    getDefaultCellIsolation: () => options?.defaultCellIsolation ?? false,
  });

  assert.equal(capturedNotebookType, "jupyter-notebook");
  assert.ok(capturedProvider);

  const createCell = (
    metadata: unknown,
    languageId = "javascript",
  ): FakeNotebookCell => ({
    kind: 1,
    document: {
      languageId,
    },
    metadata,
  });

  return {
    provider: capturedProvider,
    configurationListener,
    createCell,
    disposable,
  };
}

test("shows isolated icon-only status on the right for explicit isolated mode", () => {
  const harness = createHarness();
  const cell = harness.createCell({ jupyterBrowserKernel: { isolated: true } });

  const items = harness.provider?.provideCellStatusBarItems(cell, undefined) as
    | FakeNotebookCellStatusBarItem[]
    | undefined;

  assert.ok(items);
  assert.equal(items.length, 1);
  assert.equal(items[0]?.text, "$(package)");
  assert.equal(items[0]?.alignment, 2);
  assert.equal(items[0]?.tooltip, "Mode: Isolated. Click to toggle.");
  assert.deepEqual(items[0]?.accessibilityInformation, {
    label: "Mode: Isolated. Click to toggle.",
  });
  assert.equal(
    (items[0]?.command as { command: string }).command,
    "jupyterBrowserKernel.toggleCellIsolation",
  );
  assert.equal(
    (items[0]?.command as { arguments: unknown[] }).arguments[0],
    cell,
  );
});

test("shows global icon-only status on the right for explicit global mode", () => {
  const harness = createHarness();
  const cell = harness.createCell({
    jupyterBrowserKernel: { isolated: false },
  });

  const items = harness.provider?.provideCellStatusBarItems(cell, undefined) as
    | FakeNotebookCellStatusBarItem[]
    | undefined;

  assert.ok(items);
  assert.equal(items.length, 1);
  assert.equal(items[0]?.text, "$(window)");
  assert.equal(items[0]?.alignment, 2);
  assert.equal(items[0]?.tooltip, "Mode: Global. Click to toggle.");
  assert.deepEqual(items[0]?.accessibilityInformation, {
    label: "Mode: Global. Click to toggle.",
  });
});

test("shows isolated icon with default marker in tooltip when inherited from default", () => {
  const harness = createHarness({ defaultCellIsolation: true });
  const cell = harness.createCell({});

  const items = harness.provider?.provideCellStatusBarItems(cell, undefined) as
    | FakeNotebookCellStatusBarItem[]
    | undefined;

  assert.ok(items);
  assert.equal(items.length, 1);
  assert.equal(items[0]?.text, "$(package)");
  assert.equal(items[0]?.tooltip, "Mode: Isolated (default). Click to toggle.");
  assert.deepEqual(items[0]?.accessibilityInformation, {
    label: "Mode: Isolated (default). Click to toggle.",
  });
});

test("shows global icon with default marker in tooltip when inherited from default", () => {
  const harness = createHarness({ defaultCellIsolation: false });
  const cell = harness.createCell({});

  const items = harness.provider?.provideCellStatusBarItems(cell, undefined) as
    | FakeNotebookCellStatusBarItem[]
    | undefined;

  assert.ok(items);
  assert.equal(items.length, 1);
  assert.equal(items[0]?.text, "$(window)");
  assert.equal(items[0]?.tooltip, "Mode: Global (default). Click to toggle.");
  assert.deepEqual(items[0]?.accessibilityInformation, {
    label: "Mode: Global (default). Click to toggle.",
  });
});

test("returns no status item for non-javascript cells", () => {
  const harness = createHarness();
  const cell = harness.createCell({}, "python");

  const items = harness.provider?.provideCellStatusBarItems(cell, undefined) as
    | FakeNotebookCellStatusBarItem[]
    | undefined;

  assert.ok(items);
  assert.equal(items.length, 0);
});

test("fires status refresh when default isolation setting changes", () => {
  const harness = createHarness();

  let changed = false;
  harness.provider?.onDidChangeCellStatusBarItems?.(() => {
    changed = true;
  });

  harness.configurationListener?.({
    affectsConfiguration: (section: string) =>
      section === "jupyterBrowserKernel.defaultCellIsolation",
  });

  assert.equal(changed, true);
  harness.disposable.dispose();
});
