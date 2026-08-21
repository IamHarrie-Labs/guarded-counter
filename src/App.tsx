import { useEffect, useState } from "react";
import { useMidnight, type LedgerView } from "./hooks/useMidnight";
import { WalletConnect } from "./components/WalletConnect";
import { CircuitCall } from "./components/CircuitCall";
import "./App.css";

function App() {
  const midnight = useMidnight();
  const [ledger, setLedger] = useState<LedgerView | null>(null);

  useEffect(() => {
    if (midnight.status !== "connected") return;
    let cancelled = false;
    midnight.readLedger().then((view) => {
      if (!cancelled) setLedger(view);
    });
    return () => {
      cancelled = true;
    };
    // Refetch after any call attempt settles — a "failed assert" error can
    // still mean an earlier attempt actually landed on-chain, so the ledger
    // needs re-reading on error too, not just on success.
  }, [midnight.status, midnight.lastResult, midnight.error]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="app">
      <header>
        <h1>Guarded Counter</h1>
        <WalletConnect {...midnight} />
      </header>

      <main>
        <section className="ledger">
          <div>
            <span className="label">Count</span>
            <span className="value">{ledger ? ledger.count.toString() : "—"}</span>
          </div>
          <div>
            <span className="label">Guard commitment</span>
            <span className="value value--mono">
              {ledger ? `${ledger.guardCommitment.slice(0, 16)}…` : "—"}
            </span>
          </div>
        </section>

        <CircuitCall {...midnight} />

        <p className="network-note">
          Network: {midnight.networkId}
          {midnight.contractAddress ? ` · Contract: ${midnight.contractAddress.slice(0, 12)}…` : " · No contract configured"}
        </p>
      </main>
    </div>
  );
}

export default App;
