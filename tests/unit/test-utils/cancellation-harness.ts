export interface CancellationTokenLike {
  readonly isCancellationRequested: boolean;
  onCancellationRequested: (listener: () => void) => { dispose: () => void };
}

export interface CancellationHarness {
  token: CancellationTokenLike;
  cancel: () => void;
}

export function createCancellationToken(
  isCancellationRequested = false,
): CancellationTokenLike {
  return {
    isCancellationRequested,
    onCancellationRequested: () => ({
      dispose: () => undefined,
    }),
  };
}

export function createCancellationHarness(): CancellationHarness {
  let isCancellationRequested = false;
  const listeners = new Set<() => void>();

  return {
    token: {
      get isCancellationRequested(): boolean {
        return isCancellationRequested;
      },
      onCancellationRequested: (listener: () => void) => {
        if (isCancellationRequested) {
          queueMicrotask(listener);
          return {
            dispose: () => undefined,
          };
        }

        listeners.add(listener);
        return {
          dispose: () => {
            listeners.delete(listener);
          },
        };
      },
    },
    cancel: () => {
      isCancellationRequested = true;
      for (const listener of listeners) {
        listener();
      }
    },
  };
}
