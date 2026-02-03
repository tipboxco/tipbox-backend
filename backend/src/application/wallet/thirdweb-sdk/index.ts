/**
 * Thirdweb SDK module – Public API.
 * Re-exports types, contract helpers, error utilities, core, and chain/contract definitions.
 */

export {
  type ThirdwebSdkAuthResult,
  type ThirdwebSdkConfig,
  type TipParams,
  type TipResult,
  type ClaimParams,
  type ClaimResult,
  type PendingTipsParams,
  type PendingTipsResult,
  TIPBOX_ERROR_NAMES,
  type TipboxErrorName,
} from "./types";

export {
  KNOWN_ERROR_SELECTORS,
  CONTRACT_ERROR_MESSAGES,
  parseContractError,
  toUserMessage,
} from "./contract-errors";

export {
  ThirdwebCore,
  decodeBytes32ToString,
  type ThirdwebCoreConfig,
  type ThirdwebCoreContracts,
  type ThirdwebClient,
  type ThirdwebChain,
} from "./thirdweb.core";

export {
  sepoliaChain,
  getTipboxContract,
  getTokenContract,
  getTokenContractNameSymbolBytes32,
  getBadgeContract,
  type SepoliaChain,
} from "./contracts";
