export type ConnectionState =
  | "disconnected"
  | "connecting"
  | "connected"
  | "error";

export interface ConnectionStateStore {
  getState: () => ConnectionState;
  setState: (state: ConnectionState) => void;
  getHistory: () => ConnectionState[];
}

export function createConnectionStateStore(
  initialState: ConnectionState = "disconnected",
): ConnectionStateStore {
  let state = initialState;
  const history: ConnectionState[] = [initialState];

  return {
    getState: () => state,
    setState: (nextState) => {
      state = nextState;
      history.push(nextState);
    },
    getHistory: () => [...history],
  };
}

export async function withConnectTransition<T>(
  store: Pick<ConnectionStateStore, "setState">,
  connectAttempt: () => Promise<T>,
  isSuccess: (result: T) => boolean,
): Promise<T> {
  store.setState("connecting");

  try {
    const result = await connectAttempt();
    store.setState(isSuccess(result) ? "connected" : "error");
    return result;
  } catch (error) {
    store.setState("error");
    throw error;
  }
}
