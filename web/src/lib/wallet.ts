import { DEFAULT_DEPLOYMENT } from "./deployment.ts";
import {
  AbiCoder,
  BrowserProvider,
  Contract,
  Interface,
  keccak256,
  isAddress,
} from "ethers";
import type { Eip1193Provider } from "ethers";
import type { ChainCommitment } from "./checker";

const config = import.meta.env ?? {};

export const SEPOLIA_CHAIN_ID = 11155111n;
export const SEPOLIA_CHAIN_HEX = "0xaa36a7";
export const CONTRACT_ADDRESS = (
  config.VITE_CONTRACT_V2 || (DEFAULT_DEPLOYMENT.version === 2 ? DEFAULT_DEPLOYMENT.address : config.VITE_CONTRACT || DEFAULT_DEPLOYMENT.address)
).trim();

// The live deployment block is a public fallback for the current Sepolia contract.
// VITE_CONTRACT_DEPLOYMENT_BLOCK remains the preferred override for future deployments.
export const DEPLOYMENT_BLOCK = Number(
  config.VITE_CONTRACT_DEPLOYMENT_BLOCK_V2 || (DEFAULT_DEPLOYMENT.version === 2 ? String(DEFAULT_DEPLOYMENT.blockNumber) : config.VITE_CONTRACT_DEPLOYMENT_BLOCK || String(DEFAULT_DEPLOYMENT.blockNumber)),
);

export const CONTRACT_VERSION = config.VITE_CONTRACT_V2 ? 2 : DEFAULT_DEPLOYMENT.version;
const EXPLORER_BASE = "https://sepolia.etherscan.io";

export const GAP_WITNESS_ABI = [
  "error GapPaperedOver(bytes32 priorGap,bytes32 nextGap)",
  "error CommitmentChanged(bytes32 priorSeries,bytes32 nextSeries,bytes32 priorPolicy,bytes32 nextPolicy,uint8 priorVerdict,uint8 nextVerdict)",
  "error WindowTooWide()",
  "error EmptyStation()",
  "error EmptyPolicy()",
  "function version() view returns (uint256)",
  "error EmptySeries()",
  "error InvalidHourBoundary()",
  "error InvalidVerdict()",
  "function commit(bytes32 stationId,uint64 windowStart,uint64 windowEnd,bytes32 seriesHash,bytes32 gapHash,bytes32 policyHash,uint8 verdict)",
  "function commitments(bytes32) view returns (bytes32 seriesHash,bytes32 gapHash,bytes32 policyHash,uint8 verdict,uint64 committedAt,address submitter)",
  "event Committed(bytes32 indexed commitmentKey,bytes32 indexed seriesHash,bytes32 gapHash,bytes32 policyHash,uint8 verdict,address indexed submitter)",
] as const;

export type CommitReceipt = {
  transactionHash: string;
  blockNumber: number;
  publisher: string;
  created: boolean;
};

export type ConflictDetails = {
  code: "GAP_PAPERED_OVER";
  priorGap: string;
  nextGap: string;
  priorTransactionHash: string | null;
};

export class WalletError extends Error {
  readonly code: "NO_WALLET" | "WRONG_NETWORK" | "CONTRACT_NOT_CONFIGURED" | "CONTRACT_NOT_DEPLOYED" | "WALLET_REJECTED" | "SEPOLIA_UNAVAILABLE";

  constructor(
    code: WalletError["code"],
    message: string,
  ) {
    super(message);
    this.name = "WalletError";
    this.code = code;
  }
}

export class CommitmentError extends Error {
  readonly conflict?: ConflictDetails;

  constructor(message: string, conflict?: ConflictDetails) {
    super(message);
    this.name = "CommitmentError";
    this.conflict = conflict;
  }
}

type EthereumWindow = Window & {
  ethereum?: Eip1193EventsProvider;
};

type Eip1193EventsProvider = Eip1193Provider & {
  on?: (event: string, listener: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, listener: (...args: unknown[]) => void) => void;
};

function getInjectedProvider(): BrowserProvider {
  const ethereum = (window as EthereumWindow).ethereum;
  if (!ethereum) {
    throw new WalletError(
      "NO_WALLET",
      "No EVM wallet was detected. Install or open a browser wallet, then retry.",
    );
  }
  return new BrowserProvider(ethereum);
}

async function ensureSepolia(provider: BrowserProvider): Promise<void> {
  const network = await provider.getNetwork();
  if (network.chainId === SEPOLIA_CHAIN_ID) return;

  try {
    await provider.send("wallet_switchEthereumChain", [
      { chainId: SEPOLIA_CHAIN_HEX },
    ]);
  } catch (error) {
    const code = (error as { code?: number }).code;
    if (code === 4001) {
      throw new WalletError(
        "WALLET_REJECTED",
        "Network switch was rejected. Stay on the verdict and retry when ready.",
      );
    }
    if (code === 4902) {
      throw new WalletError(
        "SEPOLIA_UNAVAILABLE",
        "Sepolia is not available in this wallet. Add Sepolia, then retry.",
      );
    }
    throw new WalletError(
      "WRONG_NETWORK",
      "This commitment requires Ethereum Sepolia.",
    );
  }
}

export function extractRevertData(error: unknown, seen = new Set<object>()): string | null {
  if (!error || typeof error !== "object") return null;
  if (seen.has(error)) return null;
  seen.add(error);

  const candidate = error as {
    data?: unknown;
    error?: unknown;
    info?: unknown;
    revert?: unknown;
  };

  if (typeof candidate.data === "string" && candidate.data.startsWith("0x")) {
    return candidate.data;
  }

  for (const nested of [candidate.data, candidate.error, candidate.info, candidate.revert]) {
    const value = extractRevertData(nested, seen);
    if (value) return value;
  }

  return null;
}

function commitmentKey(commitment: ChainCommitment, publisher?: string): string {
  if (CONTRACT_VERSION === 2 && (!publisher || !isAddress(publisher))) throw new CommitmentError("Publisher address is required for a V2 record.");
  return keccak256(
    AbiCoder.defaultAbiCoder().encode(
      CONTRACT_VERSION === 2 ? ["address", "bytes32", "uint64", "uint64"] : ["bytes32", "uint64", "uint64"],
      [
        ...(CONTRACT_VERSION === 2 ? [publisher] : []),
        stationBytes32(commitment.stationId),
        BigInt(commitment.windowStart),
        BigInt(commitment.windowEnd),
      ],
    ),
  );
}

function stationBytes32(stationId: string): string {
  const bytes = new TextEncoder().encode(stationId);
  if (!bytes.length || bytes.length > 31 || stationId.includes("\0")) {
    throw new WalletError(
      "CONTRACT_NOT_CONFIGURED",
      "Station ID must contain 1–31 UTF-8 bytes and no NUL character.",
    );
  }

  const padded = new Uint8Array(32);
  padded.set(bytes);
  return `0x${Array.from(padded, byte => byte.toString(16).padStart(2, "0")).join("")}`;
}

async function findPriorTransaction(
  provider: BrowserProvider,
  key: string,
): Promise<string | null> {
  const latest = await provider.getBlockNumber();
  const fromBlock = DEPLOYMENT_BLOCK > 0
    ? Math.min(DEPLOYMENT_BLOCK, latest)
    : Math.max(0, latest - 20_000);

  const iface = new Interface(GAP_WITNESS_ABI);
  const event = iface.getEvent("Committed");
  if (!event) return null;

  // Public RPCs often prune old history or limit log ranges. This link is optional.
  for (let end = latest; end >= Math.max(fromBlock, latest - 20000); end -= 2000) {
    const start = Math.max(fromBlock, latest - 20000, end - 1999);
    const logs = await provider.getLogs({address: CONTRACT_ADDRESS, fromBlock: start,
      toBlock: end, topics: [event.topicHash, key]});
    if (logs.length) return logs[0].transactionHash;
  }
  return null;
}

export function watchWalletEvents(
  handler: (state: { address: string | null; chainId: bigint | null }) => void,
): () => void {
  const ethereum = (window as EthereumWindow).ethereum;
  if (!ethereum?.on || !ethereum.removeListener) return () => undefined;

  const accountsChanged = (...args: unknown[]) => {
    const accounts = Array.isArray(args[0]) ? args[0] as string[] : [];
    handler({
      address: accounts[0] ?? null,
      chainId: null,
    });
  };

  const chainChanged = (...args: unknown[]) => {
    const raw = typeof args[0] === "string" ? args[0] : "0x0";
    handler({
      address: null,
      chainId: BigInt(raw),
    });
  };

  ethereum.on("accountsChanged", accountsChanged);
  ethereum.on("chainChanged", chainChanged);

  return () => {
    ethereum.removeListener?.("accountsChanged", accountsChanged);
    ethereum.removeListener?.("chainChanged", chainChanged);
  };
}

export async function connectWallet(): Promise<{
  address: string;
  chainId: bigint;
}> {
  const provider = getInjectedProvider();
  try {
    await provider.send("eth_requestAccounts", []);
  } catch {
    throw new WalletError(
      "WALLET_REJECTED",
      "Wallet connection was rejected.",
    );
  }

  await ensureSepolia(provider);
  const signer = await provider.getSigner();
  return {
    address: await signer.getAddress(),
    chainId: SEPOLIA_CHAIN_ID,
  };
}

export async function commitEvidence(
  commitment: ChainCommitment,
): Promise<CommitReceipt> {
  if (!CONTRACT_ADDRESS) {
    throw new WalletError(
      "CONTRACT_NOT_CONFIGURED",
      "Sepolia contract address is not configured yet.",
    );
  }

  const provider = getInjectedProvider();
  await provider.send("eth_requestAccounts", []);
  await ensureSepolia(provider);

  const code = await provider.getCode(CONTRACT_ADDRESS);
  if (code === "0x") {
    throw new WalletError(
      "CONTRACT_NOT_DEPLOYED",
      "No contract code exists at the configured Sepolia address.",
    );
  }

  if (CONTRACT_ADDRESS.toLowerCase() === DEFAULT_DEPLOYMENT.address.toLowerCase()
      && DEFAULT_DEPLOYMENT.runtimeHash && keccak256(code) !== DEFAULT_DEPLOYMENT.runtimeHash) {
    throw new CommitmentError("Deployed contract bytecode does not match the recorded deployment.");
  }
  const signer = await provider.getSigner();
  const publisher = await signer.getAddress();
  const contract = new Contract(CONTRACT_ADDRESS, GAP_WITNESS_ABI, signer);
  if (CONTRACT_VERSION === 2 && await contract.version() !== 2n) throw new CommitmentError("Configured contract is not publisher-scoped V2.");

  try {
    const tx = await contract.commit(
      stationBytes32(commitment.stationId),
      BigInt(commitment.windowStart),
      BigInt(commitment.windowEnd),
      commitment.seriesHash,
      commitment.gapHash,
      commitment.policyHash,
      commitment.verdict,
    );
    const receipt = await tx.wait();

    if (!receipt) {
      throw new CommitmentError("Commitment transaction was not mined.");
    }

    const record = await contract.commitments(commitmentKey(commitment, publisher));
    if (record.seriesHash !== commitment.seriesHash || record.gapHash !== commitment.gapHash
        || record.policyHash !== commitment.policyHash || Number(record.verdict) !== commitment.verdict
        || (CONTRACT_VERSION === 2 && record.submitter.toLowerCase() !== publisher.toLowerCase())) {
      throw new CommitmentError("Mined transaction did not establish the expected publisher evidence.");
    }
    const iface = new Interface(GAP_WITNESS_ABI);
    const created = receipt.logs.some((log: {address: string; topics: string[]; data: string}) => {
      if (log.address.toLowerCase() !== CONTRACT_ADDRESS.toLowerCase()) return false;
      try { return iface.parseLog(log)?.name === "Committed"; } catch { return false; }
    });
    return {transactionHash: receipt.hash, blockNumber: receipt.blockNumber, publisher, created};
  } catch (error) {
    const data = extractRevertData(error);
    if (data) {
      const iface = new Interface(GAP_WITNESS_ABI);
      let decoded = null;
      try { decoded = iface.parseError(data); } catch { /* Preserve the original failure for unknown data. */ }
      if (decoded?.name === "GapPaperedOver") {
        const priorGap = String(decoded.args[0]);
        const nextGap = String(decoded.args[1]);
        const priorTransactionHash = await findPriorTransaction(
          provider,
          commitmentKey(commitment, publisher),
        ).catch(() => null);

        throw new CommitmentError(
          "GapPaperedOver: this exact window was already committed with a different gap.",
          {
            code: "GAP_PAPERED_OVER",
            priorGap,
            nextGap,
            priorTransactionHash,
          },
        );
      }

      if (decoded?.name === "CommitmentChanged") {
        throw new CommitmentError(
          "CommitmentChanged: the exact window already has different evidence.",
        );
      }
    }

    const code = (error as { code?: number | string; info?: { error?: { code?: number } } }).code;
    if (code === 4001 || code === "ACTION_REJECTED" || (error as { info?: { error?: { code?: number } } }).info?.error?.code === 4001) {
      throw new WalletError(
        "WALLET_REJECTED",
        "Transaction was rejected. The evidence remains unchanged.",
      );
    }

    throw new CommitmentError(
      error instanceof Error ? error.message : "Commitment transaction failed.",
    );
  }
}

export function explorerTransactionUrl(hash: string): string {
  return `${EXPLORER_BASE}/tx/${hash}`;
}

export function explorerAddressUrl(address: string): string {
  return `${EXPLORER_BASE}/address/${address}`;
}

export function isContractConfigured(): boolean {
  return isAddress(CONTRACT_ADDRESS);
}

export function getCommitmentKey(commitment: ChainCommitment, publisher?: string): string {
  return commitmentKey(commitment, publisher);
}
