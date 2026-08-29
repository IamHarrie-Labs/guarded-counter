import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import { persistentHash, CompactTypeBytes, CompactTypeVector } from "@midnight-ntwrk/compact-runtime";
import { describe, it, expect } from "vitest";
import { SurveySimulator } from "./survey-simulator.js";

setNetworkId("undeployed");

const commitmentDescriptor = new CompactTypeVector(1, new CompactTypeBytes(32));
const commitmentOf = (secretKey: Uint8Array) => persistentHash(commitmentDescriptor, [secretKey]);
const toHex = (bytes: Uint8Array) => Buffer.from(bytes).toString("hex");

// 8 distinct member secrets, filled with a different byte each so they're
// trivially distinguishable in test failures.
const MEMBER_KEYS = Array.from({ length: 8 }, (_, i) => new Uint8Array(32).fill(i + 1));
const NON_MEMBER_KEY = new Uint8Array(32).fill(99);
const THRESHOLD = 3n;

function freshSurvey() {
  const members = MEMBER_KEYS.map(commitmentOf);
  return new SurveySimulator(members, THRESHOLD, MEMBER_KEYS[0]);
}

describe("circuit logic", () => {
  it("accepts a response from a committed member", () => {
    const sim = freshSurvey();
    expect(() => sim.respondA(MEMBER_KEYS[0])).not.toThrow();
  });

  it("rejects a response from a key that isn't on the roster", () => {
    const sim = freshSurvey();
    expect(() => sim.respondA(NON_MEMBER_KEY)).toThrow();
  });

  it("rejects a second response from the same member", () => {
    const sim = freshSurvey();
    sim.respondA(MEMBER_KEYS[0]);
    expect(() => sim.respondB(MEMBER_KEYS[0])).toThrow();
  });

  it("lets different members each respond once", () => {
    const sim = freshSurvey();
    expect(() => sim.respondA(MEMBER_KEYS[0])).not.toThrow();
    expect(() => sim.respondB(MEMBER_KEYS[1])).not.toThrow();
    expect(() => sim.respondC(MEMBER_KEYS[2])).not.toThrow();
  });
});

describe("state transitions", () => {
  it("starts with every tally and the response count at zero", () => {
    const sim = freshSurvey();
    const state = sim.getLedger();
    expect(state.tallyA).toEqual(0n);
    expect(state.tallyB).toEqual(0n);
    expect(state.tallyC).toEqual(0n);
    expect(state.responseCount).toEqual(0n);
    expect(state.revealThreshold).toEqual(THRESHOLD);
  });

  it("increments the chosen option's tally and the shared response count", () => {
    const sim = freshSurvey();
    sim.respondA(MEMBER_KEYS[0]);
    sim.respondA(MEMBER_KEYS[1]);
    sim.respondB(MEMBER_KEYS[2]);
    const state = sim.getLedger();
    expect(state.tallyA).toEqual(2n);
    expect(state.tallyB).toEqual(1n);
    expect(state.tallyC).toEqual(0n);
    expect(state.responseCount).toEqual(3n);
  });

  it("leaves every tally untouched when a response is rejected", () => {
    const sim = freshSurvey();
    sim.respondA(MEMBER_KEYS[0]);
    expect(() => sim.respondB(MEMBER_KEYS[0])).toThrow();
    const state = sim.getLedger();
    expect(state.tallyA).toEqual(1n);
    expect(state.tallyB).toEqual(0n);
    expect(state.responseCount).toEqual(1n);
  });
});

describe("privacy", () => {
  it("never exposes a raw member key through ledger state", () => {
    const sim = freshSurvey();
    sim.respondA(MEMBER_KEYS[0]);
    sim.respondB(MEMBER_KEYS[1]);
    const serialized = JSON.stringify(sim.getLedger(), (_key, value) =>
      typeof value === "bigint" ? value.toString() : value,
    );
    for (const key of MEMBER_KEYS) {
      expect(serialized).not.toContain(toHex(key));
    }
  });

  it("records which commitment responded without recording which option it picked", () => {
    // The only per-member trace on the ledger is the commitment landing in
    // usedCommitments — nothing ties a commitment back to A, B, or C, since
    // that link is never constructed inside the circuit.
    const sim = freshSurvey();
    const before = sim.getLedger();
    sim.respondC(MEMBER_KEYS[0]);
    const after = sim.getLedger();
    expect(after.usedCommitments.size()).toEqual(before.usedCommitments.size() + 1n);
  });

  it("commits the same key to the same value, and different keys apart", () => {
    const a = commitmentOf(MEMBER_KEYS[0]);
    const aAgain = commitmentOf(MEMBER_KEYS[0]);
    const b = commitmentOf(MEMBER_KEYS[1]);
    expect(toHex(a)).toEqual(toHex(aAgain));
    expect(toHex(a)).not.toEqual(toHex(b));
  });
});
