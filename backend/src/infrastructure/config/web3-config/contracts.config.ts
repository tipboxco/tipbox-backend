export const CONTRACT_ADDRESSES = {
  tipbox: "0xC833d64f06eDB3B03051D7CEE263b27D0f05047b",
  tipsToken: "0xa6352D525BeBFd87F3De30DB7D42D08f6Ca015C6",
  tipboxBadge: "0xB7b9dfdB0291510e4677aADD2b03a39B9d46d235",
} as const;

export type ContractName = keyof typeof CONTRACT_ADDRESSES;
