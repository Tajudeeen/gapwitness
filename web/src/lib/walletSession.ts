import type { Eip1193Provider } from 'ethers';

export type WalletProvider = Eip1193Provider & {
  on?: (event: string, listener: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, listener: (...args: unknown[]) => void) => void;
};
export type WalletMode = 'auto' | 'browser' | 'metamask';
type WalletChange = { address: string | null; chainId: bigint | null };
type Observer = { handler: (state: WalletChange) => void; stop: () => void };
type MobileClient = {
  connect: (options: { chainIds: `0x${string}`[] }) => Promise<unknown>;
  getProvider: () => unknown;
  disconnect: () => Promise<void>;
};
let active: WalletProvider | null = null;
let mobile: Promise<MobileClient> | null = null;
let generation = 0;
const observers = new Set<Observer>();

export function walletSessionVersion(): number { return generation; }

function injected(): WalletProvider | null {
  return (globalThis.window as (Window & { ethereum?: WalletProvider }) | undefined)?.ethereum ?? null;
}

export function currentWalletProvider(): WalletProvider | null {
  return active ?? injected();
}

function bind(provider: WalletProvider | null, handler: Observer['handler']): () => void {
  if (!provider?.on || !provider.removeListener) return () => undefined;
  const accounts = (...args: unknown[]) => {
    const address = Array.isArray(args[0]) && typeof args[0][0] === 'string' ? args[0][0] : null;
    handler({ address, chainId: null });
  };
  const chain = (...args: unknown[]) => {
    const value = args[0];
    if (typeof value !== 'string' || !/^0x[0-9a-f]+$/i.test(value)) {
      handler({ address: null, chainId: 0n });
      return;
    }
    handler({ address: null, chainId: BigInt(value) });
  };
  const disconnected = () => handler({ address: null, chainId: 0n });
  provider.on('accountsChanged', accounts);
  provider.on('chainChanged', chain);
  provider.on('disconnect', disconnected);
  return () => {
    provider.removeListener?.('accountsChanged', accounts);
    provider.removeListener?.('chainChanged', chain);
    provider.removeListener?.('disconnect', disconnected);
  };
}

function select(provider: WalletProvider | null) {
  active = provider;
  for (const observer of observers) {
    observer.stop();
    observer.stop = bind(provider, observer.handler);
  }
}

export function observeWallet(handler: Observer['handler']): () => void {
  const observer = { handler, stop: bind(currentWalletProvider(), handler) };
  observers.add(observer);
  return () => { observer.stop(); observers.delete(observer); };
}

// Imported only after a user chooses mobile pairing. No relay is contacted during inspection.
async function mobileClient(): Promise<MobileClient> {
  if (!mobile) {
    mobile = import('@metamask/connect-evm').then(({ createEVMClient }) => createEVMClient({
      dapp: { name: 'GapWitness', url: window.location.origin, iconUrl: window.location.origin + '/gapwitness-logo.svg' },
      api: { supportedNetworks: {
        '0x1': 'https://ethereum-rpc.publicnode.com',
        '0xaa36a7': (import.meta.env ?? {}).VITE_SEPOLIA_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com',
      } },
      ui: { preferExtension: true, showInstallModal: false },
      analytics: { enabled: false },
    })).catch(error => { mobile = null; throw error; });
  }
  return mobile;
}

export async function chooseWallet(mode: WalletMode = 'auto'): Promise<WalletProvider> {
  const id = ++generation;
  if (mode !== 'metamask') {
    const provider = mode === 'auto' ? currentWalletProvider() : injected();
    if (provider) { select(provider); return provider; }
    throw new Error('No browser wallet found. Choose Pair MetaMask mobile / QR, or open this site inside your wallet browser.');
  }
  const client = await mobileClient();
  if (id !== generation) throw new Error('Wallet connection cancelled.');
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      client.connect({ chainIds: ['0xaa36a7'] }),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error('MetaMask pairing timed out. Unlock the app and retry, or use a browser wallet.')), 45000);
      }),
    ]);
  } catch (error) {
    if (id === generation) {
      generation += 1;
      void client.disconnect().catch(() => undefined);
    }
    throw error;
  } finally { if (timeout !== undefined) clearTimeout(timeout); }
  if (id !== generation) throw new Error('Wallet connection cancelled.');
  const provider = client.getProvider() as WalletProvider;
  select(provider);
  return provider;
}

export async function disconnectWallet(): Promise<void> {
  generation += 1;
  select(null);
  for (const observer of observers) observer.handler({ address: null, chainId: 0n });
  // Forgetting an injected connection locally never revokes unrelated wallet permissions.
  if (mobile) {
    const client = await mobile;
    await client.disconnect();
  }
}
