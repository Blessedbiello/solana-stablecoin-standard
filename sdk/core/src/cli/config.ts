import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { Connection, Keypair, clusterApiUrl, Cluster } from "@solana/web3.js";
import { AnchorProvider, Wallet } from "@coral-xyz/anchor";

export const DEFAULT_WALLET_PATH = path.join(
  os.homedir(),
  ".config",
  "solana",
  "id.json"
);

export const DEFAULT_CLUSTER = "devnet";

export const CLUSTER_URLS: Record<string, string> = {
  devnet: clusterApiUrl("devnet"),
  mainnet: clusterApiUrl("mainnet-beta"),
  localnet: "http://localhost:8899",
};

export interface CliContext {
  connection: Connection;
  wallet: Keypair;
  provider: AnchorProvider;
  programId: string | undefined;
  jsonOutput: boolean;
  cluster: string;
}

export function loadWallet(walletPath: string): Keypair {
  const resolved = walletPath.startsWith("~")
    ? path.join(os.homedir(), walletPath.slice(1))
    : walletPath;

  if (!fs.existsSync(resolved)) {
    throw new Error(
      `Wallet file not found: ${resolved}\n` +
        `Generate one with: solana-keygen new --outfile ${resolved}`
    );
  }

  try {
    const raw = fs.readFileSync(resolved, "utf-8");
    const secretKey = Uint8Array.from(JSON.parse(raw));
    return Keypair.fromSecretKey(secretKey);
  } catch (err: any) {
    throw new Error(`Failed to load wallet from ${resolved}: ${err.message}`);
  }
}

export function getConnection(cluster: string): Connection {
  const url = CLUSTER_URLS[cluster];
  if (!url) {
    throw new Error(
      `Unknown cluster: "${cluster}". Valid values: devnet, mainnet, localnet`
    );
  }
  return new Connection(url, "confirmed");
}

export function getProvider(
  connection: Connection,
  wallet: Keypair
): AnchorProvider {
  const anchorWallet = new Wallet(wallet);
  return new AnchorProvider(connection, anchorWallet, {
    commitment: "confirmed",
    preflightCommitment: "confirmed",
  });
}

export function buildContext(opts: {
  cluster?: string;
  wallet?: string;
  programId?: string;
  json?: boolean;
}): CliContext {
  const cluster = opts.cluster ?? DEFAULT_CLUSTER;
  const walletPath = opts.wallet ?? DEFAULT_WALLET_PATH;
  const wallet = loadWallet(walletPath);
  const connection = getConnection(cluster);
  const provider = getProvider(connection, wallet);

  return {
    connection,
    wallet,
    provider,
    programId: opts.programId,
    jsonOutput: opts.json ?? false,
    cluster,
  };
}

export function output(ctx: CliContext, data: object | string): void {
  if (ctx.jsonOutput) {
    if (typeof data === "string") {
      console.log(JSON.stringify({ message: data }));
    } else {
      console.log(JSON.stringify(data, null, 2));
    }
  } else {
    if (typeof data === "string") {
      console.log(data);
    } else {
      for (const [key, value] of Object.entries(data)) {
        console.log(`${key}: ${value}`);
      }
    }
  }
}

export function handleError(err: unknown, jsonOutput: boolean): never {
  const message =
    err instanceof Error ? err.message : String(err);

  if (jsonOutput) {
    console.error(JSON.stringify({ error: message }));
  } else {
    console.error(`Error: ${message}`);
  }

  process.exit(1);
}
