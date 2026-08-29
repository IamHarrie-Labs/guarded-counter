# Anonymous Survey

[![CI](https://github.com/IamHarrie-Labs/guarded-counter/actions/workflows/ci.yml/badge.svg)](https://github.com/IamHarrie-Labs/guarded-counter/actions/workflows/ci.yml)

> A survey where every response is provably from an eligible member — and nobody, including whoever ran it, can tell which one.

## Live Demo

https://guarded-counter.vercel.app

Connect Lace (set to the Preview network), paste in a member key from the roster, and submit a response. Each key works exactly once — try it again and the contract rejects it, same as it would for a stranger trying to guess their way onto the roster.

## Contract address

| Network | Address |
|---------|---------|
| Preview | d2549a8f19f9bea396225d835cd54b5df552acf12649bb64260ee6dcad8e6765 |

**A note on the network:** the live demo runs against Preview instead of Preprod. Preprod's own RPC/indexer has been down every time I've checked over several weeks — every deploy attempt hangs indefinitely at wallet sync. Midnight's own forum confirms Preprod is mid-reset for mainnet prep and "intermittently unavailable during testing." Preview is fully functional and this is the same contract, same circuits, same frontend — only the network target differs.

## What this does

A survey with a fixed roster of 8 members, set once at deploy time. Each member gets a secret key generated for them — nobody, including the person running the survey, ever sees another member's key. To respond, a member proves their key hashes to one of the 8 commitments published on the roster, without saying which one. That same commitment doubles as a one-time nullifier: submit once and the contract remembers you responded, without remembering who you are.

No individual response is ever stored. Submitting just increments one of three tally counters — "Going well," "Mixed," or "Needs work" — so there's nothing on the ledger to unlink a person from an answer, because the two were never linked in the first place.

This is the Level 4 build of the idea proposed in [PROPOSAL.md](PROPOSAL.md): an anonymous feedback tool for groups that already have a roster — teams, classes, DAOs — where the value isn't hiding from a stranger, it's hiding from the person who'll actually read the results.

## Privacy model

**What an on-chain observer can learn:**

- The 8 member commitments, published once at deploy time.
- The response count and the three tally totals.
- That some committed member responded, and which of the three tallies grew — never which member.

**What an on-chain observer cannot learn:**

- Any member's secret key. It's a private witness, read only inside a proof generated on that member's own machine — never in the transaction, never in the ledger.
- Which of the 8 members submitted any given response.
- Whether two responses came from the same member or two different ones (impossible anyway — one response per member is enforced on-chain).

**What is proved without being revealed:** that the caller holds a key on this survey's roster, and that this key hasn't responded before. That's the entire access control and anti-double-voting mechanism, and neither ever puts a key on chain.

Results stay hidden in the frontend until the response count reaches a threshold set at deploy time (3, for the live demo). That's a display choice, not a cryptographic seal — the tallies are always on the public ledger, so anyone querying the indexer directly could read them early. The point of the threshold is that a handful of early answers can't be pinned on individuals by process of elimination; it doesn't add a second layer of on-chain hiding beyond the anonymity that already exists between commitment and vote.

## Tech stack

Midnight network, Compact, Midnight.js SDK, React + Vite, Lace wallet, Node.js v22, Docker (for the local proof server).

## Prerequisites

- Node.js v22
- Docker Desktop, running
- The Compact toolchain (see setup below — on Windows this needs WSL2)
- The Lace wallet browser extension, with a Preview account

## Setup

```
git clone <your repo url>
cd guarded-counter
npm install
```

Compile the contracts:

```
npm run compact
```

This generates `managed/counter` and `managed/survey` with the compiled circuits and keys.

Start the proof server in a separate terminal (leave it running):

```
docker run -p 6300:6300 midnightntwrk/proof-server:8.1.0 midnight-proof-server -v
```

## Run tests

```
npm test
```

Or with each test named:

```
npm run test:verbose
```

20 tests across both contracts, each split into circuit logic / state transitions / privacy:

- **Survey** — a committed member can respond once; a non-member is rejected; a second response from the same member is rejected; tallies match the chosen option; no raw member key ever appears in ledger state.
- **Counter** (Level 1-3 foundation) — `setGuard` publishes a commitment and refuses to run twice; `unlock` only succeeds for a caller holding the matching key; the raw key never appears in ledger state.

## CI/CD

Every push and pull request to `main` runs [`.github/workflows/ci.yml`](.github/workflows/ci.yml), which checks out the repo, installs Node 22 and the Compact toolchain, compiles both contracts from source, and runs the full test suite. The badge at the top of this README reflects the latest run.

## Run the frontend locally

```
npm run dev
```

Opens at `http://localhost:5173`. `VITE_NETWORK_ID`, `VITE_SURVEY_CONTRACT_ADDRESS`, and `VITE_CONTRACT_ADDRESS` in `.env` control which network and contracts the UI points at — make sure Lace is unlocked and set to the matching network.

## Deploy your own survey

```
npm run deploy-survey -- --network preview
```

Generates 8 fresh member keys, deploys with their commitments baked in, and writes the keys to a local `.survey-roster-keys.<network>.json` (gitignored — never commit it). Distribute one key per real member out of band, then delete the unused ones from your copy.

## Where this came from

Levels 1-3 built the guarded counter as a rehearsal: prove you hold a secret without ever showing it, and the chain only ever sees a hash of it. This survey is that same pattern turned into an actual product — the kind of access control that matters anywhere you need to prove you're allowed to do something without revealing who you are, not just for counters but for feedback that people will only give honestly if they know it can't be traced back to them.

## Demo video

https://drive.google.com/file/d/1X8G094y0o9922s8zEqa4BfwiFlBLhPnv/view?usp=drive_link

## Screenshots

Compile output, both circuits building clean:

![Compile output](screenshots/compile-output.png)

Contract live on Preview, confirmed on the block explorer:

![Contract deployed on Preview](screenshots/contract-deployed.png)
