import { defineChain } from "thirdweb/chains";

export const CHAIN_CONFIG = {
  chainId: 11155111, // Ethereum Sepolia
  rpcUrl: "https://ethereum-sepolia-rpc.publicnode.com",//"https://ethereum-sepolia.rpc.subquery.network/public",
  name: "Sepolia",
  nativeCurrency: {
    name: "Sepolia Ether",
    symbol: "ETH",
    decimals: 18,
  },
  blockExplorer: "https://sepolia.etherscan.io",
} as const;

export const sepoliaChain = defineChain({
  id: CHAIN_CONFIG.chainId,
  rpc: CHAIN_CONFIG.rpcUrl,
});
