import { useState } from "react";
import type { useSurvey, SurveyLedgerView } from "../hooks/useSurvey";
import { WalletConnect } from "./WalletConnect";

type Props = ReturnType<typeof useSurvey> & { ledger: SurveyLedgerView | null };

const OPTION_LABELS: Record<"respondA" | "respondB" | "respondC", string> = {
  respondA: "Going well",
  respondB: "Mixed",
  respondC: "Needs work",
};

export function SurveyPanel(props: Props) {
  const { status, busyOption, lastResult, error, memberKeyHex, hasResponded, setMemberKey, respond, ledger } = props;
  const [draftKey, setDraftKey] = useState("");
  const disabled = status !== "connected" || busyOption !== null || !memberKeyHex || hasResponded;

  return (
    <div className="survey-panel">
      <header>
        <h1>Anonymous Survey</h1>
        <WalletConnect {...props} />
      </header>

      <p className="survey-question">"How's this cycle going?" — one response per member, nobody can tell who picked what.</p>

      {!memberKeyHex && (
        <div className="member-key-form">
          <input
            type="text"
            placeholder="Paste your member key"
            value={draftKey}
            onChange={(e) => setDraftKey(e.target.value)}
          />
          <button onClick={() => setMemberKey(draftKey)} disabled={!draftKey.trim()}>
            Save key
          </button>
        </div>
      )}

      <section className="ledger">
        <div>
          <span className="label">Responses</span>
          <span className="value">{ledger ? ledger.responseCount.toString() : "—"}</span>
        </div>
        <div>
          <span className="label">Reveal at</span>
          <span className="value">{ledger ? ledger.revealThreshold.toString() : "—"}</span>
        </div>
      </section>

      {ledger?.revealed ? (
        <div className="survey-results">
          <ResultBar label={OPTION_LABELS.respondA} count={ledger.tallyA} total={ledger.responseCount} />
          <ResultBar label={OPTION_LABELS.respondB} count={ledger.tallyB} total={ledger.responseCount} />
          <ResultBar label={OPTION_LABELS.respondC} count={ledger.tallyC} total={ledger.responseCount} />
        </div>
      ) : (
        <p className="circuit-hint">
          Results stay hidden until {ledger ? ledger.revealThreshold.toString() : "the threshold"} responses are
          in — not a cryptographic seal, just how this frontend chooses to display it, so a handful of early
          answers can't be traced back to whoever gave them.
        </p>
      )}

      <div className="circuit-buttons">
        {(["respondA", "respondB", "respondC"] as const).map((option) => (
          <button key={option} disabled={disabled} onClick={() => respond(option)}>
            {busyOption === option ? "Generating proof…" : OPTION_LABELS[option]}
          </button>
        ))}
      </div>

      <p className="privacy-label">Proved without revealing your input</p>

      {hasResponded && <p className="circuit-status">You've already responded from this browser.</p>}
      {lastResult && <p className="circuit-result">{lastResult}</p>}
      {error && <p className="circuit-error">{error}</p>}
      {status !== "connected" && <p className="circuit-hint">Connect your wallet first.</p>}
    </div>
  );
}

function ResultBar({ label, count, total }: { label: string; count: bigint; total: bigint }) {
  const pct = total > 0n ? Number((count * 100n) / total) : 0;
  return (
    <div className="result-bar">
      <div className="result-bar-label">
        <span>{label}</span>
        <span>{count.toString()}</span>
      </div>
      <div className="result-bar-track">
        <div className="result-bar-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
