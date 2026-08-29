// Private state for the survey — one member's secret key. Same shape as
// the counter's witnesses.ts, kept as a separate file because the two
// contracts have separate private state and separate compiled artifacts.

import type { Ledger } from "../managed/survey/contract/index.js";
import type { WitnessContext } from "@midnight-ntwrk/midnight-js-protocol/compact-runtime";

export type SurveyPrivateState = {
  readonly secretKey: Uint8Array;
};

export const createSurveyPrivateState = (secretKey: Uint8Array): SurveyPrivateState => ({
  secretKey,
});

export const surveyWitnesses = {
  secretKey: ({
    privateState,
  }: WitnessContext<Ledger, SurveyPrivateState>): [SurveyPrivateState, Uint8Array] => [
    privateState,
    privateState.secretKey,
  ],
};
