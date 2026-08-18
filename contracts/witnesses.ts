// Private state for the guarded counter, plus the one witness function
// the contract needs. Nothing in here ever gets sent on-chain — the
// compiled circuit only sees whatever the witness function returns for
// a given call, and even that stays inside the proof.

import type { Ledger } from "../managed/counter/contract/index.js";
import type { WitnessContext } from "@midnight-ntwrk/midnight-js-protocol/compact-runtime";

export type CounterPrivateState = {
  readonly secretKey: Uint8Array;
};

export const createCounterPrivateState = (secretKey: Uint8Array): CounterPrivateState => ({
  secretKey,
});

export const witnesses = {
  secretKey: ({
    privateState,
  }: WitnessContext<Ledger, CounterPrivateState>): [CounterPrivateState, Uint8Array] => [
    privateState,
    privateState.secretKey,
  ],
};
