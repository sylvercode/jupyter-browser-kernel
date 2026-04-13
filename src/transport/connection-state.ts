export type ConnectionState =
  | "disconnected"
  | "connecting"
  | "connected"
  | "error";

export interface ConnectionErrorContext {
  category: string;
  guidance: string;
}

export interface ConnectionStateStoreTransitionHandler {
  beginTransition: (newState: ConnectionState) => number;
  transitionTo: (transitionId: number, state: ConnectionState) => boolean;
  cancelTransitions?: () => void;
  onTransitionsCanceled?: (listener: () => void) => () => void;
}

export interface ConnectionStateStore extends Required<ConnectionStateStoreTransitionHandler> {
  getState: () => ConnectionState;
  setState: (state: ConnectionState) => void;
  getHistory: () => ConnectionState[];
  getErrorContext: () => ConnectionErrorContext | undefined;
  setErrorContext: (context: ConnectionErrorContext | undefined) => void;
}

export interface ConnectionStoreHandler {
  connectionStateStore: ConnectionStateStore;
  onConnectionStateChanged?: (state: ConnectionState) => void;
  onErrorContextChanged?: (context: ConnectionErrorContext | undefined) => void;
}

export function createConnectionStateStore({
  initialState,
  onConnectionStateChanged,
  onErrorContextChanged,
}: {
  initialState?: ConnectionState;
  onConnectionStateChanged?: (state: ConnectionState) => void;
  onErrorContextChanged?: (context: ConnectionErrorContext | undefined) => void;
} = {}): ConnectionStateStore {
  let state = initialState;
  let errorContext: ConnectionErrorContext | undefined;
  const history: ConnectionState[] = [initialState ?? "disconnected"];
  let activeTransitionId = 0;
  const transitionCancelListeners = new Set<() => void>();

  const setState = (nextState: ConnectionState) => {
    state = nextState;
    history.push(nextState);
    onConnectionStateChanged?.(nextState);
  };

  const setErrorContext = (context: ConnectionErrorContext | undefined) => {
    errorContext = context;
    onErrorContextChanged?.(context);
  };

  return {
    getState: () => state ?? "disconnected",
    setState,
    getHistory: () => [...history],
    getErrorContext: () => errorContext,
    setErrorContext,
    beginTransition: (newState: ConnectionState) => {
      activeTransitionId += 1;
      setState(newState);
      return activeTransitionId;
    },
    transitionTo: (transitionId, state) => {
      if (transitionId === activeTransitionId) {
        setState(state);
        return true;
      }
      return false;
    },
    cancelTransitions: () => {
      activeTransitionId += 1;
      for (const listener of transitionCancelListeners) {
        listener();
      }
    },
    onTransitionsCanceled: (listener) => {
      transitionCancelListeners.add(listener);
      return () => {
        transitionCancelListeners.delete(listener);
      };
    },
  };
}

export async function withConnectTransition<T>(
  store: ConnectionStateStoreTransitionHandler,
  connectAttempt: (abortSignal: AbortSignal) => Promise<T>,
  isSuccess: (result: T) => boolean,
  onAborted: () => void,
): Promise<T> {
  const transitionId = store.beginTransition("connecting");
  const abortController = new AbortController();
  let aborted = false;

  const emitAborted = () => {
    if (aborted) {
      return;
    }

    aborted = true;
    onAborted();
  };

  const unsubscribeCanceled =
    store.onTransitionsCanceled?.(() => {
      abortController.abort();
      emitAborted();
    }) ?? (() => undefined);

  try {
    const result = await connectAttempt(abortController.signal);

    const transitionApplied = store.transitionTo(
      transitionId,
      isSuccess(result) ? "connected" : "error",
    );

    if (!transitionApplied) {
      emitAborted();
    }

    return result;
  } catch (error) {
    const transitionApplied = store.transitionTo(transitionId, "error");

    if (!transitionApplied) {
      emitAborted();
    }

    throw error;
  } finally {
    unsubscribeCanceled();
  }
}
