import type { useMidnight } from "../hooks/useMidnight";

type Props = Pick<ReturnType<typeof useMidnight>, "status" | "address" | "error" | "connect" | "disconnect">;

function shorten(address: string): string {
  return address.length > 20 ? `${address.slice(0, 12)}…${address.slice(-6)}` : address;
}

export function WalletConnect({ status, address, error, connect, disconnect }: Props) {
  if (status === "connected" && address) {
    return (
      <div className="wallet-connect wallet-connect--connected">
        <span className="wallet-dot" />
        <span title={address}>{shorten(address)}</span>
        <button onClick={disconnect}>Disconnect</button>
      </div>
    );
  }

  return (
    <div className="wallet-connect">
      <button onClick={connect} disabled={status === "connecting"}>
        {status === "connecting" ? "Connecting…" : "Connect Lace"}
      </button>
      {status === "error" && error && (
        <p className="wallet-error">
          {error.includes("No Midnight wallet found")
            ? "Couldn't find a wallet. Install the Lace extension and unlock it, then try again."
            : error}
        </p>
      )}
    </div>
  );
}
