import { useEffect, useState } from "react";
import { useMidnight, type LedgerView } from "./hooks/useMidnight";
import { useSurvey, type SurveyLedgerView } from "./hooks/useSurvey";
import { WalletConnect } from "./components/WalletConnect";
import { CircuitCall } from "./components/CircuitCall";
import { SurveyPanel } from "./components/SurveyPanel";
import "./App.css";

function CounterDemo() {
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
    <>
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

        <CircuitCall {...midnight} isGuardSet={ledger?.isGuardSet ?? null} />

        <p className="network-note">
          Network: {midnight.networkId}
          {midnight.contractAddress ? ` · Contract: ${midnight.contractAddress.slice(0, 12)}…` : " · No contract configured"}
        </p>
      </main>
    </>
  );
}

function SurveyDemo() {
  const survey = useSurvey();
  const [ledger, setLedger] = useState<SurveyLedgerView | null>(null);

  useEffect(() => {
    if (survey.status !== "connected") return;
    let cancelled = false;
    survey.readLedger().then((view) => {
      if (!cancelled) setLedger(view);
    });
    return () => {
      cancelled = true;
    };
  }, [survey.status, survey.lastResult, survey.error]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <main>
      <SurveyPanel {...survey} ledger={ledger} />
      <p className="network-note">
        Network: {survey.networkId}
        {survey.contractAddress ? ` · Contract: ${survey.contractAddress.slice(0, 12)}…` : " · No contract configured"}
      </p>
    </main>
  );
}

function App() {
  const [tab, setTab] = useState<"survey" | "counter">("survey");

  return (
    <div className="app">
      <nav className="tabs">
        <button className={tab === "survey" ? "tab tab--active" : "tab"} onClick={() => setTab("survey")}>
          Survey
        </button>
        <button className={tab === "counter" ? "tab tab--active" : "tab"} onClick={() => setTab("counter")}>
          Counter (Level 1-3)
        </button>
      </nav>

      {tab === "survey" ? <SurveyDemo /> : <CounterDemo />}
    </div>
  );
}

export default App;
