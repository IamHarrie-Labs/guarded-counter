import {
  type CircuitContext,
  sampleContractAddress,
  createConstructorContext,
  createCircuitContext,
} from "@midnight-ntwrk/compact-runtime";
import { Contract, type Ledger, ledger } from "../managed/survey/contract/index.js";
import { type SurveyPrivateState, surveyWitnesses } from "../contracts/survey-witnesses.js";

// Thin wrapper mirroring CounterSimulator, sized for the survey's fixed
// 8-member roster and 3 response options.
export class SurveySimulator {
  readonly contract: Contract<SurveyPrivateState>;
  circuitContext: CircuitContext<SurveyPrivateState>;

  constructor(members: Uint8Array[], threshold: bigint, callerSecretKey: Uint8Array) {
    if (members.length !== 8) throw new Error("SurveySimulator needs exactly 8 member commitments");
    this.contract = new Contract<SurveyPrivateState>(surveyWitnesses);
    const { currentPrivateState, currentContractState, currentZswapLocalState } =
      this.contract.initialState(
        createConstructorContext({ secretKey: callerSecretKey }, "0".repeat(64)),
        members[0],
        members[1],
        members[2],
        members[3],
        members[4],
        members[5],
        members[6],
        members[7],
        threshold,
      );
    this.circuitContext = createCircuitContext(
      sampleContractAddress(),
      currentZswapLocalState,
      currentContractState,
      currentPrivateState,
    );
  }

  public getLedger(): Ledger {
    return ledger(this.circuitContext.currentQueryContext.state);
  }

  private respondWith(circuit: "respondA" | "respondB" | "respondC", secretKey: Uint8Array): Ledger {
    this.circuitContext = {
      ...this.circuitContext,
      currentPrivateState: { secretKey },
    };
    this.circuitContext = this.contract.impureCircuits[circuit](this.circuitContext).context;
    return ledger(this.circuitContext.currentQueryContext.state);
  }

  public respondA(secretKey: Uint8Array): Ledger {
    return this.respondWith("respondA", secretKey);
  }

  public respondB(secretKey: Uint8Array): Ledger {
    return this.respondWith("respondB", secretKey);
  }

  public respondC(secretKey: Uint8Array): Ledger {
    return this.respondWith("respondC", secretKey);
  }
}
