# Guarded Counter

> A counter that only moves for whoever can prove they hold the key — without that key ever touching the chain.

## Live Demo

https://guarded-counter.vercel.app

Connect Lace (set to the Preview network) to try it — click "Set Guard" once to lock the counter with a key generated in your browser, then "Unlock" to prove you hold it and bump the count.

## Contract address

| Network | Address |
|---------|---------|
| Preview | 8b6708729b6a9c25948f1b7a3b94ff47b02f65787d5757f6a892cb291ecbd0ef |

**A note on the network:** the frontend runs against Preview instead of Preprod. Preprod's own RPC/indexer has been down every time I've checked over several days — every attempt hangs indefinitely at wallet sync, before ever reaching a deploy. Midnight's own forum confirms Preprod is mid-reset for mainnet prep and "intermittently unavailable during testing." Preview is fully functional and this is the same contract, same circuits, same frontend — only the network target differs.

## What this does

It's a counter with a lock on it. The first person to call `setGuard` picks a secret key and the contract stores a hash of it on-chain — not the key itself, just the hash. After that, anyone who wants to call `unlock` and bump the counter has to prove they know a key that hashes to the same value. If the hash doesn't match, the call fails and the counter stays put.

Level 2 wires this up to an actual frontend: connect Lace, call `setGuard` or `unlock` straight from the browser, and watch the proof get generated locally before anything is submitted.

## Privacy model

- Public: the counter value, and the commitment (hash) of whoever's key is guarding it.
- Private: the actual key. It's passed in as a witness, so it's only ever used inside the proof generated on the caller's own machine.
- Proved without revealing: that the caller knows a key matching the stored commitment, without ever putting that key on-chain.

## Privacy claim

An on-chain observer watching this contract sees: the counter incrementing, a hash committed once by `setGuard`, and transactions arriving from a wallet address. What they never see, in the transaction data or anywhere on-chain: the actual key. Every `unlock` call proves knowledge of a value matching the stored hash without that value ever being transmitted, logged, or stored anywhere outside the caller's own browser (it lives in `localStorage`, generated client-side, never sent in any request body).

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

Compile the contract:

```
npm run compact
```

This generates the `managed/counter` folder with the compiled circuits and keys.

Start the proof server in a separate terminal (leave it running):

```
docker run -p 6300:6300 midnightntwrk/proof-server:8.1.0 midnight-proof-server -v
```

## Run tests

```
npm test
```

## Run the frontend locally

```
npm run dev
```

Opens at `http://localhost:5173`. `VITE_NETWORK_ID` and `VITE_CONTRACT_ADDRESS` in `.env` control which network and contract the UI points at — make sure Lace is unlocked and set to the matching network.

## Initial idea

Most on-chain access control just checks if you're a specific wallet address. I wanted to try the opposite: you prove you know a secret without ever showing it, and the chain only ever sees a hash of it. A counter is about the simplest thing you can gate, so that's what I built first. The real idea behind it is anywhere you need to prove you're allowed to do something without revealing who you are, like private raffles, gated communities, or commit reveal games.

## Demo video

https://drive.google.com/file/d/1f6jjt3UtLLpEBAbq41HIJkB9jyUsFhwx/view?usp=sharing

## Screenshots

Compile output, both circuits building clean:

![Compile output](screenshots/compile-output.png)

Contract live on Preview, confirmed on the block explorer:

![Contract deployed on Preview](screenshots/contract-deployed.png)
