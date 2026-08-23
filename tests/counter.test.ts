import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import { describe, it, expect } from "vitest";
import { CounterSimulator } from "./counter-simulator.js";

setNetworkId("undeployed");

const KEY_A = new Uint8Array(32).fill(7);
const KEY_B = new Uint8Array(32).fill(9);

const toHex = (bytes: Uint8Array) => Buffer.from(bytes).toString("hex");

// The value the constructor writes before anyone has claimed the counter:
// "no-guard-set" padded out to 32 bytes.
const UNSET_SENTINEL = (() => {
  const label = Buffer.from("no-guard-set", "utf8");
  const padded = new Uint8Array(32);
  padded.set(label);
  return toHex(padded);
})();

describe("circuit logic", () => {
  it("setGuard publishes a commitment derived from the private key", () => {
    const sim = new CounterSimulator(KEY_A);
    const after = sim.setGuard();
    expect(toHex(after.guardCommitment)).not.toEqual(UNSET_SENTINEL);
    expect(after.guardCommitment.length).toEqual(32);
  });

  it("setGuard refuses to run twice on the same counter", () => {
    const sim = new CounterSimulator(KEY_A);
    sim.setGuard();
    expect(() => sim.setGuard()).toThrow();
  });

  it("unlock succeeds when the caller holds the key behind the commitment", () => {
    const sim = new CounterSimulator(KEY_A);
    sim.setGuard();
    expect(() => sim.unlock()).not.toThrow();
  });

  it("unlock refuses to run before a guard has been set", () => {
    const sim = new CounterSimulator(KEY_A);
    expect(() => sim.unlock()).toThrow();
  });
});

describe("state transitions", () => {
  it("starts at zero with the guard commitment unset", () => {
    const sim = new CounterSimulator(KEY_A);
    const state = sim.getLedger();
    expect(state.count).toEqual(0n);
    expect(toHex(state.guardCommitment)).toEqual(UNSET_SENTINEL);
  });

  it("increments the count once per successful unlock", () => {
    const sim = new CounterSimulator(KEY_A);
    sim.setGuard();
    expect(sim.unlock().count).toEqual(1n);
    expect(sim.unlock().count).toEqual(2n);
    expect(sim.unlock().count).toEqual(3n);
  });

  it("leaves the count untouched when unlock is rejected", () => {
    const sim = new CounterSimulator(KEY_A);
    sim.setGuard();
    sim.unlock();
    expect(() => sim.unlockAs(KEY_B)).toThrow();
    expect(sim.getLedger().count).toEqual(1n);
  });
});

describe("privacy", () => {
  it("never exposes the raw key through ledger state", () => {
    const sim = new CounterSimulator(KEY_A);
    sim.setGuard();
    sim.unlock();
    const serialized = JSON.stringify(sim.getLedger(), (_key, value) =>
      typeof value === "bigint" ? value.toString() : value,
    );
    expect(serialized).not.toContain(toHex(KEY_A));
  });

  it("rejects a caller who does not hold the guard key", () => {
    const sim = new CounterSimulator(KEY_A);
    sim.setGuard();
    // Same on-chain state, different private key: exactly what someone
    // trying to bump a counter they do not own would be doing.
    expect(() => sim.unlockAs(KEY_B)).toThrow();
  });

  it("commits the same key to the same value, and different keys apart", () => {
    const first = new CounterSimulator(KEY_A);
    const second = new CounterSimulator(KEY_A);
    const other = new CounterSimulator(KEY_B);

    const firstCommitment = toHex(first.setGuard().guardCommitment);
    const secondCommitment = toHex(second.setGuard().guardCommitment);
    const otherCommitment = toHex(other.setGuard().guardCommitment);

    expect(firstCommitment).toEqual(secondCommitment);
    expect(firstCommitment).not.toEqual(otherCommitment);
  });
});
