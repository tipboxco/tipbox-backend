/**
 * Thirdweb SDK – Contract error mapping and user-facing messages.
 * Maps revert selectors and error names to human-readable strings.
 */

import { TIPBOX_ERROR_NAMES } from "./types";

// ============================================================================
// ENCODED ERROR SELECTORS (used when not found in viem ABI)
// ============================================================================

export const KNOWN_ERROR_SELECTORS: Record<string, string> = {
  "0xfb8f41b2": "ERC20InsufficientAllowance",
  "0xe450d38c": "ERC20InsufficientBalance",
};

// ============================================================================
// USER-FACING MESSAGES (English, aligned with common Web3/API conventions)
// ============================================================================

export const CONTRACT_ERROR_MESSAGES: Record<string, string> = {
  NoBadgeOwned:
    "Required badge not found. Mint a badge to this account before claiming tips.",
  NoPendingTips: "No pending tips to claim.",
  InvalidAddress: "Invalid address.",
  InvalidFeePercentage: "Invalid fee percentage.",
  OwnableInvalidOwner: "Invalid owner.",
  OwnableUnauthorizedAccount: "Unauthorized account.",
  SafeERC20FailedOperation:
    "Token transfer failed. Check allowance and balance.",
  ERC20InsufficientAllowance:
    "Insufficient token allowance. Approve the Tipbox contract to spend tokens.",
  ERC20InsufficientBalance:
    "Insufficient token balance in Smart Account. Send tokens to the Smart Account address first.",
  AA21Prefund:
    "Insufficient Sepolia ETH in Smart Account for gas. Send Sepolia ETH to the Smart Account or set THIRDWEB_SPONSOR_GAS=true.",
  AA25InvalidNonce:
    "Account nonce error (AA25). Previous transaction may still be pending or nonce mismatch. Wait a few seconds and retry.",
  InsufficientFunds:
    "Insufficient balance. Owner wallet must have enough ETH for gas.",
  TransfersNotAllowed:
    "This NFT is soulbound and cannot be transferred. Ensure it was minted to the correct address.",
  InvalidPrivateKey:
    "Invalid private key format. Must be 64 hex characters, optionally prefixed with 0x.",
  OwnerKeyNotSet:
    "OWNER_PRIVATE_KEY (or ADMIN_PRIVATE_KEY) environment variable is not set.",
  ContractDecodeError:
    "Contract response could not be decoded. The RPC or contract may be returning unexpected data; try again later or check the chain.",
};

// ============================================================================
// PARSER & MESSAGE HELPERS
// ============================================================================

/**
 * Extracts a known contract error name from a Viem/Thirdweb revert message.
 * @param message - Raw error string from contract or SDK.
 * @returns Matched error name from TIPBOX_ERROR_NAMES or derived (e.g. AA21Prefund), or null.
 */
export function parseContractError(message: string): string | null {
  for (const name of TIPBOX_ERROR_NAMES) {
    if (message.includes(name)) return name;
  }
  if (message.includes("AA21") || message.includes("didn't pay prefund")) {
    return "AA21Prefund";
  }
  if (message.includes("AA25") || message.includes("invalid account nonce")) {
    return "AA25InvalidNonce";
  }
  if (message.toLowerCase().includes("insufficient funds")) {
    return "InsufficientFunds";
  }
  if (message.includes("Transfers are not allowed")) {
    return "TransfersNotAllowed";
  }
  if (message.toLowerCase().includes("invalid private key")) {
    return "InvalidPrivateKey";
  }
  if (message.includes("OWNER_PRIVATE_KEY") && message.includes("not set")) {
    return "OwnerKeyNotSet";
  }
  if (
    (message.includes("Position") && message.includes("out of bounds")) ||
    (message.includes("out of bounds") && message.includes("viem"))
  ) {
    return "ContractDecodeError";
  }
  if (message.includes("viem") && message.includes("decode")) {
    return "ContractDecodeError";
  }
  for (const [selector, errorName] of Object.entries(KNOWN_ERROR_SELECTORS)) {
    if (message.includes(selector)) return errorName;
  }
  if (
    message.includes("AbiErrorSignatureNotFoundError") ||
    message.includes("not found on ABI")
  ) {
    const match = message.match(/0x[a-fA-F0-9]{8}/);
    if (match && KNOWN_ERROR_SELECTORS[match[0]])
      return KNOWN_ERROR_SELECTORS[match[0]];
  }
  return null;
}

/**
 * Converts a contract error name or raw message into a user-displayable string.
 * Uses CONTRACT_ERROR_MESSAGES when available, otherwise returns the input as-is.
 */
export function toUserMessage(contractErrorOrMessage: string): string {
  return (
    CONTRACT_ERROR_MESSAGES[contractErrorOrMessage] ?? contractErrorOrMessage
  );
}
