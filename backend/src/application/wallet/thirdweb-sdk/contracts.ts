/**
 * Thirdweb SDK – Chain and contract instance helpers.
 * Contract addresses come from core config (fixed when core is defined).
 */

import { defineChain, getContract } from "thirdweb";
import {
  CONFIG,
  ERC20_ABI,
  ERC20_ABI_NAME_SYMBOL_BYTES32,
  ERC721_BADGE_ABI,
  TIPBOX_ABI,
} from "../config/config";

export type SepoliaChain = ReturnType<typeof defineChain>;

/** Sepolia chain definition (id and RPC from CONFIG). */
export const sepoliaChain = defineChain({
  id: CONFIG.chainId,
  rpc: CONFIG.rpcUrl,
});

/** Returns Tipbox contract instance. Address is from core config (fixed when core is defined). */
export function getTipboxContract(
  client: Parameters<typeof getContract>[0]["client"],
  chain: SepoliaChain,
  address: `0x${string}`
) {
  return getContract({
    address,
    abi: TIPBOX_ABI,
    chain,
    client,
  });
}

/** Returns ERC20 tips token contract instance. Address is from core config. */
export function getTokenContract(
  client: Parameters<typeof getContract>[0]["client"],
  chain: SepoliaChain,
  address: `0x${string}`
) {
  return getContract({
    address,
    abi: ERC20_ABI,
    chain,
    client,
  });
}

/**
 * Returns ERC20 token contract with name/symbol as bytes32 for tokens that return fixed 32-byte strings.
 * Use when readContract with string ABI fails with viem "Position out of bounds" decode error.
 */
export function getTokenContractNameSymbolBytes32(
  client: Parameters<typeof getContract>[0]["client"],
  chain: SepoliaChain,
  address: `0x${string}`
) {
  return getContract({
    address,
    abi: ERC20_ABI_NAME_SYMBOL_BYTES32,
    chain,
    client,
  });
}

/** Returns ERC721 Badge contract instance. Address is from core config. */
export function getBadgeContract(
  client: Parameters<typeof getContract>[0]["client"],
  chain: SepoliaChain,
  address: `0x${string}`
) {
  return getContract({
    address,
    abi: ERC721_BADGE_ABI,
    chain,
    client,
  });
}
