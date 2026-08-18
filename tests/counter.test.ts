import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import { describe, it, expect } from "vitest";
import { CounterSimulator } from "./counter-simulator.js";

setNetworkId("undeployed");

const KEY_A = new Uint8Array(32).fill(7);
const KEY_B = new Uint8Array(32).fill(9);

describe("guarded counter", () => {
  it("starts at zero with no guard set", () => {
    const sim = new CounterSimulator(KEY_A);
    const state = sim.getLedger();
    expect(state.count).toEqual(0n);
  });

  it("lets the right key set the guard, then unlock and increment", () => {
    const sim = new CounterSimulator(KEY_A);
    sim.setGuard();
    const afterUnlock = sim.unlock();
    expect(afterUnlock.count).toEqual(1n);
  });

  it("rejects unlock from a caller with the wrong key", () => {
    const sim = new CounterSimulator(KEY_A);
    sim.setGuard();
    // Same contract state, different key — this is what a stranger
    // trying to steal the counter would actually be doing.
    expect(() => sim.unlockAs(KEY_B)).toThrow();
  });

  it("never exposes the raw secret key through ledger state", () => {
    const sim = new CounterSimulator(KEY_A);
    sim.setGuard();
    const state = sim.getLedger();
    const serialized = JSON.stringify(state, (_key, value) =>
      typeof value === "bigint" ? value.toString() : value,
    );
    expect(serialized).not.toContain(Buffer.from(KEY_A).toString("hex"));
  });
});
