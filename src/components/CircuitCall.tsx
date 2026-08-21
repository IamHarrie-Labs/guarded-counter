import type { useMidnight } from "../hooks/useMidnight";

type Props = Pick<ReturnType<typeof useMidnight>, "status" | "busyCircuit" | "lastResult" | "error" | "callCircuit">;

export function CircuitCall({ status, busyCircuit, lastResult, error, callCircuit }: Props) {
  const disabled = status !== "connected" || busyCircuit !== null;

  return (
    <div className="circuit-call">
      <div className="circuit-buttons">
        <button disabled={disabled} onClick={() => callCircuit("setGuard")}>
          {busyCircuit === "setGuard" ? "Generating proof…" : "Set Guard"}
        </button>
        <button disabled={disabled} onClick={() => callCircuit("unlock")}>
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
