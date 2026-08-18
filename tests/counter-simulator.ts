import {
  type CircuitContext,
  sampleContractAddress,
  createConstructorContext,
  createCircuitContext,
} from "@midnight-ntwrk/compact-runtime";
import { Contract, type Ledger, ledger } from "../managed/counter/contract/index.js";
import { type CounterPrivateState, witnesses } from "../contracts/witnesses.js";

// Thin wrapper around the compiled contract so tests can call circuits
// and check ledger state without spinning up a real network connection.
export class CounterSimulator {
  readonly contract: Contract<CounterPrivateState>;
  circuitContext: CircuitContext<CounterPrivateState>;

  constructor(secretKey: Uint8Array) {
    this.contract = new Contract<CounterPrivateState>(witnesses);
    const { currentPrivateState, currentContractState, currentZswapLocalState } =
      this.contract.initialState(
        createConstructorContext({ secretKey }, "0".repeat(64)),
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

  public getPrivateState(): CounterPrivateState {
    return this.circuitContext.currentPrivateState;
  }

  public setGuard(): Ledger {
    this.circuitContext = this.contract.impureCircuits.setGuard(this.circuitContext).context;
    return ledger(this.circuitContext.currentQueryContext.state);
  }

  public unlock(): Ledger {
    this.circuitContext = this.contract.impureCircuits.unlock(this.circuitContext).context;
    return ledger(this.circuitContext.currentQueryContext.state);
  }

  // Swaps in a different key before calling unlock, without touching the
  // contract's own state. This is how we simulate a second caller trying
  // their own key against a counter someone else already guarded.
  public unlockAs(secretKey: Uint8Array): Ledger {
    this.circuitContext = {
      ...this.circuitContext,
      currentPrivateState: { secretKey },
    };
    this.circuitContext = this.contract.impureCircuits.unlock(this.circuitContext).context;
    return ledger(this.circuitContext.currentQueryContext.state);
  }
}
