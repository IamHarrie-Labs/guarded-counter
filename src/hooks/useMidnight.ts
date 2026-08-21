// Wallet connection + contract interaction, built for the browser instead of
// a local seed like scripts/deploy.ts uses. The wallet (Lace) holds the keys
// and does the signing; this hook only ever hands it a transaction to
// balance and submit, never a private key.

import { useCallback, useMemo, useState } from "react";
import type { ConnectedAPI, InitialAPI } from "@midnight-ntwrk/dapp-connector-api";
import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import { findDeployedContract } from "@midnight-ntwrk/midnight-js-contracts";
import { httpClientProofProvider } from "@midnight-ntwrk/midnight-js-http-client-proof-provider";
import { indexerPublicDataProvider } from "@midnight-ntwrk/midnight-js-indexer-public-data-provider";
import { FetchZkConfigProvider } from "@midnight-ntwrk/midnight-js-fetch-zk-config-provider";
import { CompiledContract } from "@midnight-ntwrk/midnight-js-protocol/compact-js";
import { fromHex, toHex } from "@midnight-ntwrk/midnight-js-protocol/compact-runtime";
import satisfies from "semver/functions/satisfies.js";

import * as CounterContract from "../../managed/counter/contract/index.js";
import { inMemoryPrivateStateProvider } from "../in-memory-private-state-provider";

const NETWORK_ID = (import.meta.env.VITE_NETWORK_ID as string) || "preprod";
const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS as string | undefined;
const PRIVATE_STATE_ID = "counterPrivateState";
const GUARD_KEY_STORAGE_KEY = "guarded-counter:local-key";

setNetworkId(NETWORK_ID as never);

// The key that proves you're allowed to unlock the counter. It's generated
// once in the browser and kept in localStorage — it never leaves this
// machine, and it's never part of any transaction we build. Only the proof
// that "I know a key matching the on-chain commitment" leaves the browser.
function getOrCreateLocalGuardKey(): Uint8Array {
  const stored = localStorage.getItem(GUARD_KEY_STORAGE_KEY);
  if (stored) {
    return new Uint8Array(stored.match(/.{2}/g)!.map((b) => parseInt(b, 16)));
  }
  const key = crypto.getRandomValues(new Uint8Array(32));
  localStorage.setItem(GUARD_KEY_STORAGE_KEY, toHex(key));
  return key;
}

type WalletStatus = "disconnected" | "connecting" | "connected" | "error";

export interface LedgerView {
  count: bigint;
  guardCommitment: string;
}

const COMPATIBLE_API_VERSION = "4.x";

function findCompatibleWallet(): InitialAPI | undefined {
  const injected = (window as unknown as { midnight?: Record<string, InitialAPI> }).midnight;
  if (!injected) return undefined;
  return Object.values(injected).find(
    (wallet) => !!wallet && typeof wallet === "object" && "apiVersion" in wallet && satisfies(wallet.apiVersion, COMPATIBLE_API_VERSION),
  );
}

export function useMidnight() {
  const [status, setStatus] = useState<WalletStatus>("disconnected");
  const [address, setAddress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connectedApi, setConnectedApi] = useState<ConnectedAPI | null>(null);
  const [busyCircuit, setBusyCircuit] = useState<"setGuard" | "unlock" | null>(null);
  const [lastResult, setLastResult] = useState<string | null>(null);

  const connect = useCallback(async () => {
    setStatus("connecting");
    setError(null);
    try {
      const wallet = findCompatibleWallet();
      if (!wallet) {
        throw new Error("No Midnight wallet found. Is the Lace extension installed and unlocked?");
      }
      const api = await wallet.connect(NETWORK_ID);
      const connectionStatus = await api.getConnectionStatus();
      if (connectionStatus.status !== "connected") {
        throw new Error("Wallet did not confirm the connection. Did you approve it in Lace?");
      }
      const { unshieldedAddress } = await api.getUnshieldedAddress();
      setConnectedApi(api);
      setAddress(unshieldedAddress);
      setStatus("connected");
    } catch (e) {
      setStatus("error");
      setError(e instanceof Error ? e.message : "Failed to connect to wallet");
    }
  }, []);

  const disconnect = useCallback(() => {
    setConnectedApi(null);
    setAddress(null);
    setStatus("disconnected");
    setError(null);
  }, []);

  const getProviders = useCallback(async () => {
    if (!connectedApi) throw new Error("Wallet not connected");
    const config = await connectedApi.getConfiguration();
    const zkConfigProvider = new FetchZkConfigProvider(window.location.origin, fetch.bind(window));

    // The SDK calls getCoinPublicKey/getEncryptionPublicKey synchronously and
    // expects a plain string back — not a Promise. Fetch both once, upfront,
    // rather than making these async (an async version type-checks fine but
    // hands the SDK an unawaited Promise object, which then fails deep inside
    // bech32 decoding with a confusing "string expected" error).
    const { shieldedCoinPublicKey, shieldedEncryptionPublicKey } = await connectedApi.getShieldedAddresses();

    return {
      privateStateProvider: inMemoryPrivateStateProvider(),
      zkConfigProvider,
      proofProvider: httpClientProofProvider(config.proverServerUri ?? "http://127.0.0.1:6300", zkConfigProvider),
      publicDataProvider: indexerPublicDataProvider(config.indexerUri, config.indexerWsUri),
      walletProvider: {
        getCoinPublicKey: () => shieldedCoinPublicKey,
        getEncryptionPublicKey: () => shieldedEncryptionPublicKey,
        balanceTx: async (tx: { serialize: () => Uint8Array }) => {
          const { tx: balanced } = await connectedApi.balanceUnsealedTransaction(toHex(tx.serialize()));
          return balanced;
        },
      },
      midnightProvider: {
        submitTx: async (tx: string) => {
          await connectedApi.submitTransaction(tx);
        },
      },
    };
  }, [connectedApi]);

  const compiledContract = useMemo(() => {
    const guardKey = getOrCreateLocalGuardKey();
    const witnesses = {
      secretKey: ({ privateState }: { privateState: { secretKey: Uint8Array } }) => [
        privateState,
        privateState?.secretKey ?? guardKey,
      ],
    };
    return CompiledContract.make("counter", CounterContract.Contract).pipe(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      CompiledContract.withWitnesses(witnesses as any),
    );
  }, []);

  const callCircuit = useCallback(
    async (circuit: "setGuard" | "unlock") => {
      if (!CONTRACT_ADDRESS) {
        setError("No contract address configured. Set VITE_CONTRACT_ADDRESS.");
        return;
      }
      setBusyCircuit(circuit);
      setError(null);
      setLastResult(null);
      try {
        const providers = await getProviders();
        const guardKey = getOrCreateLocalGuardKey();
        const deployed = await findDeployedContract(providers as never, {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          compiledContract: compiledContract as any,
          contractAddress: CONTRACT_ADDRESS,
          privateStateId: PRIVATE_STATE_ID,
          initialPrivateState: { secretKey: guardKey },
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const tx = await (deployed.callTx as any)[circuit]();
        setLastResult(`Submitted. Transaction id: ${tx.public.txId}`);
      } catch (e) {
        setError(e instanceof Error ? e.message : `Failed to call ${circuit}`);
      } finally {
        setBusyCircuit(null);
      }
    },
    [compiledContract, getProviders],
  );

  const readLedger = useCallback(async (): Promise<LedgerView | null> => {
    if (!CONTRACT_ADDRESS) return null;
    const providers = await getProviders();
    const state = await providers.publicDataProvider.queryContractState(CONTRACT_ADDRESS);
    if (!state) return null;
    const ledgerState = CounterContract.ledger(state.data);
    return {
      count: ledgerState.count,
      guardCommitment: toHex(ledgerState.guardCommitment),
    };
  }, [getProviders]);

  return {
    status,
    address,
    error,
    busyCircuit,
    lastResult,
    connect,
    disconnect,
    callCircuit,
    readLedger,
    contractAddress: CONTRACT_ADDRESS,
    networkId: NETWORK_ID,
  };
}
