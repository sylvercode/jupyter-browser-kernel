import test from "node:test";
import assert from "node:assert/strict";

import {
  registerKernelController,
  resetExecutionOrderForTests,
} from "../../../src/notebook/kernel-controller.js";
import { createCancellationToken } from "../test-utils/cancellation-harness.js";
import {
  FakeNotebookCellOutput,
  FakeNotebookCellOutputItem,
} from "../test-utils/fake-notebook-output.js";
import { createLocalizeMock } from "../test-utils/localize-mock.js";

type FakeNotebookCell = { document: { getText: () => string } };

type FakeNotebookExecutionController = {
  createNotebookCellExecution: (cell: unknown) => unknown;
};

type FakeExecuteHandler = (
  cells: FakeNotebookCell[],
  notebook: unknown,
  controller: FakeNotebookExecutionController,
) => Promise<void> | void;

interface FakeNotebookController {
  id: string;
  notebookType: string;
  label: string;
  supportedLanguages: string[];
  executeHandler?: FakeExecuteHandler;
}

test("registerKernelController creates expected notebook controller", () => {
  const created: { id?: string; notebookType?: string; label?: string } = {};
  const controller: FakeNotebookController = {
    id: "",
    notebookType: "",
    label: "",
    supportedLanguages: [],
  };

  const api = {
    notebooks: {
      createNotebookController: (
        id: string,
        notebookType: string,
        label: string,
      ) => {
        created.id = id;
        created.notebookType = notebookType;
        created.label = label;

        controller.id = id;
        controller.notebookType = notebookType;
        controller.label = label;

        return controller;
      },
    },
    l10n: {
      t: createLocalizeMock(),
    },
    NotebookCellOutput: FakeNotebookCellOutput,
    NotebookCellOutputItem: FakeNotebookCellOutputItem,
  };

  const registered = registerKernelController(api as never);

  assert.equal(created.id, "jupyter-browser-kernel");
  assert.equal(created.notebookType, "jupyter-notebook");
  assert.equal(created.label, "Browser Kernel");
  assert.deepEqual(controller.supportedLanguages, ["javascript"]);
  assert.equal(registered, controller);
});

test("executeHandler dispatches each cell to kernel execution", async () => {
  resetExecutionOrderForTests();

  const controller: FakeNotebookController = {
    id: "",
    notebookType: "",
    label: "",
    supportedLanguages: [],
  };

  const api = {
    notebooks: {
      createNotebookController: () => controller,
    },
    l10n: {
      t: createLocalizeMock(),
    },
    NotebookCellOutput: FakeNotebookCellOutput,
    NotebookCellOutputItem: FakeNotebookCellOutputItem,
  };

  registerKernelController(api as never);

  const executionOrders: number[] = [];

  const executionController = {
    createNotebookCellExecution: () => ({
      start: () => undefined,
      end: () => undefined,
      replaceOutput: async () => undefined,
      token: createCancellationToken(),
      set executionOrder(order: number) {
        executionOrders.push(order);
      },
    }),
  };

  await controller.executeHandler?.(
    [
      { document: { getText: () => "1 + 1" } },
      { document: { getText: () => "2 + 2" } },
    ],
    {},
    executionController,
  );

  assert.deepEqual(executionOrders, [1, 2]);
});

test("executeHandler stops dispatching remaining cells after cancellation", async () => {
  resetExecutionOrderForTests();

  const controller: FakeNotebookController = {
    id: "",
    notebookType: "",
    label: "",
    supportedLanguages: [],
  };

  const api = {
    notebooks: {
      createNotebookController: () => controller,
    },
    l10n: {
      t: createLocalizeMock(),
    },
    NotebookCellOutput: FakeNotebookCellOutput,
    NotebookCellOutputItem: FakeNotebookCellOutputItem,
  };

  registerKernelController(api as never);

  let executionCount = 0;
  const executionOrders: number[] = [];

  const executionController = {
    createNotebookCellExecution: () => {
      executionCount += 1;

      return {
        start: () => undefined,
        end: () => undefined,
        replaceOutput: async () => undefined,
        token: createCancellationToken(true),
        set executionOrder(order: number) {
          executionOrders.push(order);
        },
      };
    },
  };

  await controller.executeHandler?.(
    [
      { document: { getText: () => "1 + 1" } },
      { document: { getText: () => "2 + 2" } },
    ],
    {},
    executionController,
  );

  assert.equal(executionCount, 1);
  assert.deepEqual(executionOrders, [1]);
});

test("executeHandler skips execution when session preflight blocks run", async () => {
  resetExecutionOrderForTests();

  const controller: FakeNotebookController = {
    id: "",
    notebookType: "",
    label: "",
    supportedLanguages: [],
  };

  const api = {
    notebooks: {
      createNotebookController: () => controller,
    },
    l10n: {
      t: createLocalizeMock(),
    },
    NotebookCellOutput: FakeNotebookCellOutput,
    NotebookCellOutputItem: FakeNotebookCellOutputItem,
  };

  registerKernelController(api as never, {
    ensureSessionReady: async () => ({ ready: false }),
  });

  let executionCount = 0;
  const executionController = {
    createNotebookCellExecution: () => {
      executionCount += 1;
      return {
        start: () => undefined,
        end: () => undefined,
        replaceOutput: async () => undefined,
        token: createCancellationToken(),
      };
    },
  };

  await controller.executeHandler?.(
    [{ document: { getText: () => "1 + 1" } }],
    {},
    executionController,
  );

  assert.equal(executionCount, 0);
});

test("executeHandler waits for session preflight readiness before dispatch", async () => {
  resetExecutionOrderForTests();

  const controller: FakeNotebookController = {
    id: "",
    notebookType: "",
    label: "",
    supportedLanguages: [],
  };

  const api = {
    notebooks: {
      createNotebookController: () => controller,
    },
    l10n: {
      t: createLocalizeMock(),
    },
    NotebookCellOutput: FakeNotebookCellOutput,
    NotebookCellOutputItem: FakeNotebookCellOutputItem,
  };

  let releasePreflight: (() => void) | undefined;

  registerKernelController(api as never, {
    ensureSessionReady: async () => {
      await new Promise<void>((resolve) => {
        releasePreflight = resolve;
      });

      return { ready: true };
    },
  });

  let executionCount = 0;
  const executionController = {
    createNotebookCellExecution: () => {
      executionCount += 1;
      return {
        start: () => undefined,
        end: () => undefined,
        replaceOutput: async () => undefined,
        token: createCancellationToken(),
      };
    },
  };

  const runPromise = controller.executeHandler?.(
    [{ document: { getText: () => "1 + 1" } }],
    {},
    executionController,
  );

  await Promise.resolve();

  assert.equal(executionCount, 0);

  releasePreflight?.();
  await runPromise;

  assert.equal(executionCount, 1);
});
