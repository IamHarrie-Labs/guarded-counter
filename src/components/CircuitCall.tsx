import type { useMidnight } from "../hooks/useMidnight";

type Props = Pick<ReturnType<typeof useMidnight>, "status" | "busyCircuit" | "lastResult" | "error" | "callCircuit"> & {
  isGuardSet: boolean | null;
};

export function CircuitCall({ status, busyCircuit, lastResult, error, callCircuit, isGuardSet }: Props) {
  const disabled = status !== "connected" || busyCircuit !== null;
  // Once a guard exists, setGuard always fails (it's one-time-only by
  // design) — disable it instead of letting people hit that error.
  const setGuardDisabled = disabled || isGuardSet === true;
  const unlockDisabled = disabled || isGuardSet !== true;

  return (
    <div className="circuit-call">
      <div className="circuit-buttons">
        <button
          disabled={setGuardDisabled}
          title={isGuardSet === true ? "Already set — this only works once per counter" : undefined}
          onClick={() => callCircuit("setGuard")}
        >
          {busyCircuit === "setGuard" ? "Generating proof…" : isGuardSet === true ? "Guard already set" : "Set Guard"}
        </button>
        <button
          disabled={unlockDisabled}
          title={isGuardSet === false ? "Set a guard first" : undefined}
          onClick={() => callCircuit("unlock")}
        >
          {busyCircuit === "unlock" ? "Generating proof…" : "Unlock"}
        </button>
      </div>

      <p className="privacy-label">Proved without revealing your input</p>

      {busyCircuit && <p className="circuit-status">Proof is being generated locally in your browser…</p>}
      {lastResult && <p className="circuit-result">{lastResult}</p>}
      {error && <p className="circuit-error">{error}</p>}

      {status !== "connected" && <p className="circuit-hint">Connect your wallet first.</p>}
    </div>
  );
}
