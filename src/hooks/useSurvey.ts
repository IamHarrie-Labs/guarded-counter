// Wallet connection + survey contract interaction. Self-contained, mirroring
// useMidnight.ts's shape rather than sharing code with it — each level of
// this project has stood on its own rather than reaching for a shared
// abstraction that only one other file would use.

import { useCallback, useMemo, useState } from "react";
import type { ConnectedAPI, InitialAPI } from "@midnight-ntwrk/dapp-connector-api";
import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import { findDeployedContract } from "@midnight-ntwrk/midnight-js-contracts";
import { httpClientProofProvider } from "@midnight-ntwrk/midnight-js-http-client-proof-provider";
import { indexerPublicDataProvider } from "@midnight-ntwrk/midnight-js-indexer-public-data-provider";
import { FetchZkConfigProvider } from "@midnight-ntwrk/midnight-js-fetch-zk-config-provider";
import { CompiledContract } from "@midnight-ntwrk/midnight-js-protocol/compact-js";
import { fromHex, toHex } from "@midnight-ntwrk/midnight-js-protocol/compact-runtime";
import { Binding, Proof, SignatureEnabled, Transaction } from "@midnight-ntwrk/midnight-js-protocol/ledger";
import satisfies from "semver/functions/satisfies.js";

import * as SurveyContract from "../../managed/survey/contract/index.js";
import { inMemoryPrivateStateProvider } from "../in-memory-private-state-provider";

function humanizeError(raw: string): string {
  const assertMatch = raw.match(/failed assert:\s*(.+)$/);
  const message = assertMatch ? assertMatch[1].trim() : raw;

  if (message.includes("not on this survey's member list")) {
    return "That key isn't on this survey's member list.";
  }
  if (message.includes("already responded")) {
    return "That key has already responded to this survey — one response per member.";
  }
  if (raw.includes("disconnected from") || raw.includes("ECONNREFUSED")) {
    return "Lost the connection mid-request. This is usually transient — try again.";
  }
  return message;
}

const NETWORK_ID = (import.meta.env.VITE_NETWORK_ID as string) || "preprod";
const SURVEY_CONTRACT_ADDRESS = import.meta.env.VITE_SURVEY_CONTRACT_ADDRESS as string | undefined;
const PRIVATE_STATE_ID = "surveyPrivateState";
const MEMBER_KEY_STORAGE_KEY = "guarded-counter:survey-member-key";
const RESPONDED_STORAGE_KEY = "guarded-counter:survey-responded";

setNetworkId(NETWORK_ID as never);

function getLocalMemberKey(): Uint8Array | null {
  const stored = localStorage.getItem(MEMBER_KEY_STORAGE_KEY);
  if (!stored) return null;
  return new Uint8Array(stored.match(/.{2}/g)!.map((b) => parseInt(b, 16)));
}

function setLocalMemberKey(hex: string): void {
  localStorage.setItem(MEMBER_KEY_STORAGE_KEY, hex.trim());
}

const COMPATIBLE_API_VERSION = "4.x";

function findCompatibleWallet(): InitialAPI | undefined {
  const injected = (window as unknown as { midnight?: Record<string, InitialAPI> }).midnight;
  if (!injected) return undefined;
  return Object.values(injected).find(
    (wallet) => !!wallet && typeof wallet === "object" && "apiVersion" in wallet && satisfies(wallet.apiVersion, COMPATIBLE_API_VERSION),
  );
}

export type SurveyOption = "respondA" | "respondB" | "respondC";

export interface SurveyLedgerView {
  tallyA: bigint;
  tallyB: bigint;
  tallyC: bigint;
  responseCount: bigint;
  revealThreshold: bigint;
  revealed: boolean;
}

type WalletStatus = "disconnected" | "connecting" | "connected" | "error";

export function useSurvey() {
  const [status, setStatus] = useState<WalletStatus>("disconnected");
  const [address, setAddress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connectedApi, setConnectedApi] = useState<ConnectedAPI | null>(null);
  const [busyOption, setBusyOption] = useState<SurveyOption | null>(null);
  const [lastResult, setLastResult] = useState<string | null>(null);
  const [memberKeyHex, setMemberKeyHex] = useState<string | null>(() => {
    const key = getLocalMemberKey();
    return key ? toHex(key) : null;
  });
  const [hasResponded, setHasResponded] = useState<boolean>(
    () => localStorage.getItem(RESPONDED_STORAGE_KEY) === "true",
  );

  const setMemberKey = useCallback((hex: string) => {
    setLocalMemberKey(hex);
    setMemberKeyHex(hex.trim());
  }, []);

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
          return Transaction.deserialize("signature", "proof", "binding", fromHex(balanced));
        },
      },
      midnightProvider: {
        submitTx: async (tx: Transaction<SignatureEnabled, Proof, Binding>) => {
          await connectedApi.submitTransaction(toHex(tx.serialize()));
          return tx.identifiers()[0];
        },
      },
    };
  }, [connectedApi]);

  const compiledContract = useMemo(() => {
    const witnesses = {
      secretKey: ({ privateState }: { privateState: { secretKey: Uint8Array } }) => [
        privateState,
        privateState.secretKey,
      ],
    };
    return CompiledContract.make("survey", SurveyContract.Contract).pipe(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      CompiledContract.withWitnesses(witnesses as any),
    );
  }, []);

  const respond = useCallback(
    async (option: SurveyOption) => {
      if (!SURVEY_CONTRACT_ADDRESS) {
        setError("No survey contract address configured. Set VITE_SURVEY_CONTRACT_ADDRESS.");
        return;
      }
      const memberKey = getLocalMemberKey();
      if (!memberKey) {
        setError("Paste your member key first.");
        return;
      }
      setBusyOption(option);
      setError(null);
      setLastResult(null);
      try {
        const providers = await getProviders();
        const deployed = await findDeployedContract(providers as never, {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          compiledContract: compiledContract as any,
          contractAddress: SURVEY_CONTRACT_ADDRESS,
          privateStateId: PRIVATE_STATE_ID,
          initialPrivateState: { secretKey: memberKey },
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const tx = await (deployed.callTx as any)[option]();
        setLastResult(`Submitted. Transaction id: ${tx.public.txId}`);
        localStorage.setItem(RESPONDED_STORAGE_KEY, "true");
        setHasResponded(true);
      } catch (e) {
        const raw = e instanceof Error ? e.message : `Failed to submit response`;
        setError(humanizeError(raw));
      } finally {
        setBusyOption(null);
      }
    },
    [compiledContract, getProviders],
  );

  const readLedger = useCallback(async (): Promise<SurveyLedgerView | null> => {
    if (!SURVEY_CONTRACT_ADDRESS) return null;
    const providers = await getProviders();
    const state = await providers.publicDataProvider.queryContractState(SURVEY_CONTRACT_ADDRESS);
    if (!state) return null;
    const ledgerState = SurveyContract.ledger(state.data);
    return {
      tallyA: ledgerState.tallyA,
      tallyB: ledgerState.tallyB,
      tallyC: ledgerState.tallyC,
      responseCount: ledgerState.responseCount,
      revealThreshold: ledgerState.revealThreshold,
      revealed: ledgerState.responseCount >= ledgerState.revealThreshold,
    };
  }, [getProviders]);

  return {
    status,
    address,
    error,
    busyOption,
    lastResult,
    memberKeyHex,
    hasResponded,
    setMemberKey,
    connect,
    disconnect,
    respond,
    readLedger,
    contractAddress: SURVEY_CONTRACT_ADDRESS,
    networkId: NETWORK_ID,
  };
}
