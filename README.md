# Guarded Counter

> A counter that only moves for whoever can prove they hold the key — without that key ever touching the chain.

## Contract address

| Network | Address |
|---------|---------|
| Preview | 8b6708729b6a9c25948f1b7a3b94ff47b02f65787d5757f6a892cb291ecbd0ef |

## What this does

It's a counter with a lock on it. The first person to call `setGuard` picks a secret key and the contract stores a hash of it on-chain — not the key itself, just the hash. After that, anyone who wants to call `unlock` and bump the counter has to prove they know a key that hashes to the same value. If the hash doesn't match, the call fails and the counter stays put.

It's deliberately small. The point of Level 1 is proving out the pattern (public state, a private witness, one disclosed value) before building anything real on top of it.

## Privacy model

- Public: the counter value, and the commitment (hash) of whoever's key is guarding it.
- Private: the actual key. It's passed in as a witness, so it's only ever used inside the proof generated on the caller's own machine.
- Proved without revealing: that the caller knows a key matching the stored commitment, without ever putting that key on-chain.

## Tech stack

Midnight network, Compact, Node.js v22, Docker (for the local proof server).

## Prerequisites

- Node.js v22
- Docker Desktop, running
- The Compact toolchain (see setup below — on Windows this needs WSL2)

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

## Initial idea

Most on-chain access control just checks if you're a specific wallet address. I wanted to try the opposite: you prove you know a secret without ever showing it, and the chain only ever sees a hash of it. A counter is about the simplest thing you can gate, so that's what I built first. The real idea behind it is anywhere you need to prove you're allowed to do something without revealing who you are, like private raffles, gated communities, or commit reveal games.

## Screenshots

Compile output, both circuits building clean:

![Compile output](screenshots/compile-output.png)

Contract live on Preview, confirmed on the block explorer:

![Contract deployed on Preview](screenshots/contract-deployed.png)
