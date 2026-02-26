export enum TransactionActionType {
  TIP_SEND = 'TIP_SEND',
  TIP_RECEIVE = 'TIP_RECEIVE',
  CLAIM_REWARD = 'CLAIM_REWARD',
  CLAIM_BADGE = 'CLAIM_BADGE',
  NFT_BUY = 'NFT_BUY',
  NFT_SELL = 'NFT_SELL',
  SWAP_TIP_TO_SOL = 'SWAP_TIP_TO_SOL',
  SWAP_SOL_TO_TIP = 'SWAP_SOL_TO_TIP',
  AIRDROP = 'AIRDROP',
  FEE = 'FEE',
  // External wallet işlemleri
  DEPOSIT = 'DEPOSIT',       // External wallet'tan (Metamask vb.) gelen token
  WITHDRAW = 'WITHDRAW'      // External wallet'a gönderilen token
  BOOST_POST = 'BOOST_POST'
}

