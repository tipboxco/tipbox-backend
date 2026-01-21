import { thirdwebPost } from './tipbox.contract.api';

type ThirdwebReadCall = {
  contractAddress: string;
  method: string;
  params: unknown[];
};

type ThirdwebWriteCall = {
  contractAddress: string;
  method: string;
  params: unknown[];
};

type ThirdwebReadResultItem = {
  success: boolean;
  data: unknown;
  error: string | null;
};

type ThirdwebReadResponse = {
  result: ThirdwebReadResultItem[];
};

type ThirdwebWriteResponse = {
  result?: {
    transactionIds?: unknown;
  };
};

export type TipboxContractSnapshot = {
  badgesContract: string;
  tokenContract: string;
  feeRecipient: string;
  owner: string;
  feePercentage: bigint;
  pendingTips?: bigint;
};

export type TipboxContractWriteResult = {
  transactionIds: string[];
};

export class TipboxContractService {
  private readonly thirdwebBaseUrl = process.env.THIRDWEB_API_BASE_URL || 'https://api.thirdweb.com/v1';
  private readonly thirdwebSecretKey = process.env.THIRDWEB_SECRET_KEY || null;

  private readonly chainId = Number(process.env.TIPBOX_CHAIN_ID || 11155111);
  private readonly tipboxContractAddress =
    process.env.TIPBOX_CONTRACT_ADDRESS || '0xC833d64f06eDB3B03051D7CEE263b27D0f05047b';

  private readonly requestTimeoutMs = Number(process.env.THIRDWEB_REQUEST_TIMEOUT_MS || 10000);

  private readonly methods = {
    badgesContract: 'function badgesContract() view returns (address)',
    tokenContract: 'function tokenContract() view returns (address)',
    feeRecipient: 'function feeRecipient() view returns (address)',
    owner: 'function owner() view returns (address)',
    feePercentage: 'function feePercentage() view returns (uint256)',
    pendingTips: 'function pendingTips(address) view returns (uint256)',
    claim: 'function claim()',
    renounceOwnership: 'function renounceOwnership()',
    setFeePercentage: 'function setFeePercentage(uint256 _feePercentage)',
    setFeeRecipient: 'function setFeeRecipient(address _feeRecipient)',
    tip: 'function tip(uint256 amount, address target)',
    transferOwnership: 'function transferOwnership(address newOwner)',
  } as const;

  /**
   * Thirdweb API anahtarının set edilmesini zorunlu tutar.
   * Not: Bu servis runtime'da çağrıldığı için, server boot'ta fail etmek yerine
   * ilgili endpoint çağrısında net hata vermeyi tercih ediyoruz.
   */
  private requireSecretKey(): string {
    if (!this.thirdwebSecretKey) {
      throw new Error('THIRDWEB_SECRET_KEY tanımlı değil!');
    }
    return this.thirdwebSecretKey;
  }

  private assertEthAddress(value: unknown, fieldName: string): string {
    if (typeof value !== 'string') {
      throw new Error(`${fieldName} beklenen type string, gelen: ${typeof value}`);
    }
    const ethAddressRegex = /^0x[a-fA-F0-9]{40}$/;
    if (!ethAddressRegex.test(value)) {
      throw new Error(`${fieldName} geçersiz address formatı: ${value}`);
    }
    return value;
  }

  private call(method: string, params: unknown[] = []): { contractAddress: string; method: string; params: unknown[] } {
    return { contractAddress: this.tipboxContractAddress, method, params };
  }

  private toUint256Param(value: unknown, fieldName: string): string {
    const asBigInt = this.toBigInt(value, fieldName);
    if (asBigInt < 0n) {
      throw new Error(`${fieldName} negatif olamaz`);
    }
    return asBigInt.toString();
  }

  private toBigInt(value: unknown, fieldName: string): bigint {
    try {
      if (typeof value === 'bigint') return value;
      if (typeof value === 'number') return BigInt(value);
      if (typeof value === 'string') return BigInt(value);
      // bazı durumlarda { ... } gelebilir — bunu desteklemiyoruz
      throw new Error(`Unsupported type: ${typeof value}`);
    } catch (error) {
      throw new Error(
        `${fieldName} bigint'e çevrilemedi. value=${JSON.stringify(value)} error=${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  private async thirdwebRead(calls: ThirdwebReadCall[]): Promise<ThirdwebReadResultItem[]> {
    const data = await thirdwebPost<ThirdwebReadResponse>({
      baseUrl: this.thirdwebBaseUrl,
      secretKey: this.requireSecretKey(),
      timeoutMs: this.requestTimeoutMs,
      path: 'contracts/read',
      body: { calls, chainId: this.chainId },
    });
    if (!data || !Array.isArray(data.result)) {
      throw new Error('Thirdweb response beklenmeyen formatta (result yok)');
    }
    return data.result;
  }

  private async thirdwebWrite(calls: ThirdwebWriteCall[], from: string): Promise<TipboxContractWriteResult> {
    const fromAddress = this.assertEthAddress(from?.trim(), 'from');
    const data = await thirdwebPost<ThirdwebWriteResponse>({
      baseUrl: this.thirdwebBaseUrl,
      secretKey: this.requireSecretKey(),
      timeoutMs: this.requestTimeoutMs,
      path: 'contracts/write',
      body: { calls, chainId: this.chainId, from: fromAddress },
    });

    const txIds = data?.result?.transactionIds;
    if (!Array.isArray(txIds) || !txIds.every((x) => typeof x === 'string' && x.length > 0)) {
      throw new Error('Thirdweb write response beklenmeyen formatta (transactionIds yok)');
    }
    return { transactionIds: txIds };
  }

  private async thirdwebReadSingle(method: string, params: unknown[]): Promise<unknown> {
    const [first] = await this.thirdwebRead([this.call(method, params)]);

    if (!first) {
      throw new Error('Thirdweb response boş (result[0] yok)');
    }
    if (!first.success) {
      throw new Error(first.error || 'Thirdweb read call failed');
    }
    return first.data;
  }

  /**
   * @summary badgesContract adresini okur.
   */
  async getBadgesContract(): Promise<string> {
    return this.assertEthAddress(await this.thirdwebReadSingle(this.methods.badgesContract, []), 'badgesContract');
  }

  /**
   * @summary tokenContract adresini okur.
   */
  async getTokenContract(): Promise<string> {
    return this.assertEthAddress(await this.thirdwebReadSingle(this.methods.tokenContract, []), 'tokenContract');
  }

  /**
   * @summary feeRecipient adresini okur.
   */
  async getFeeRecipient(): Promise<string> {
    return this.assertEthAddress(await this.thirdwebReadSingle(this.methods.feeRecipient, []), 'feeRecipient');
  }

  /**
   * @summary owner adresini okur.
   */
  async getOwner(): Promise<string> {
    return this.assertEthAddress(await this.thirdwebReadSingle(this.methods.owner, []), 'owner');
  }

  /**
   * @summary feePercentage (uint256) değerini okur.
   */
  async getFeePercentage(): Promise<bigint> {
    return this.toBigInt(await this.thirdwebReadSingle(this.methods.feePercentage, []), 'feePercentage');
  }

  /**
   * @summary Bir cüzdanın pendingTips (uint256) değerini okur.
   */
  async getPendingTips(walletAddress: string): Promise<bigint> {
    const normalized = walletAddress.trim();
    this.assertEthAddress(normalized, 'walletAddress');

    return this.toBigInt(await this.thirdwebReadSingle(this.methods.pendingTips, [normalized]), 'pendingTips');
  }

  /**
   * @summary Contract konfigürasyonunu toplu okur (opsiyonel pendingTips).
   */
  async getContractSnapshot(options?: { walletAddress?: string }): Promise<TipboxContractSnapshot> {
    const walletAddress = options?.walletAddress?.trim();

    if (walletAddress) {
      this.assertEthAddress(walletAddress, 'walletAddress');
    }

    const calls: ThirdwebReadCall[] = [
      this.call(this.methods.badgesContract, []),
      this.call(this.methods.tokenContract, []),
      this.call(this.methods.feeRecipient, []),
      this.call(this.methods.owner, []),
      this.call(this.methods.feePercentage, []),
    ];

    if (walletAddress) {
      calls.push(this.call(this.methods.pendingTips, [walletAddress]));
    }

    const results = await this.thirdwebRead(calls);
    const expectIndex = (i: number): ThirdwebReadResultItem => {
      const item = results[i];
      if (!item) throw new Error(`Thirdweb result[${i}] yok`);
      if (!item.success) throw new Error(item.error || `Thirdweb result[${i}] failed`);
      return item;
    };

    const badgesContract = this.assertEthAddress(expectIndex(0).data, 'badgesContract');
    const tokenContract = this.assertEthAddress(expectIndex(1).data, 'tokenContract');
    const feeRecipient = this.assertEthAddress(expectIndex(2).data, 'feeRecipient');
    const owner = this.assertEthAddress(expectIndex(3).data, 'owner');
    const feePercentage = this.toBigInt(expectIndex(4).data, 'feePercentage');
    const pendingTips = walletAddress ? this.toBigInt(expectIndex(5).data, 'pendingTips') : undefined;

    return {
      badgesContract,
      tokenContract,
      feeRecipient,
      owner,
      feePercentage,
      ...(pendingTips !== undefined ? { pendingTips } : {}),
    };
  }

  /**
   * @summary Claim işlemini tetikler.
   */
  async claim(from: string): Promise<TipboxContractWriteResult> {
    return this.thirdwebWrite([this.call(this.methods.claim, [])], from);
  }

  /**
   * @summary Ownership’ten vazgeçer.
   */
  async renounceOwnership(from: string): Promise<TipboxContractWriteResult> {
    return this.thirdwebWrite([this.call(this.methods.renounceOwnership, [])], from);
  }

  /**
   * @summary Fee yüzdesini günceller.
   */
  async setFeePercentage(from: string, feePercentage: bigint | number | string): Promise<TipboxContractWriteResult> {
    const fee = this.toUint256Param(feePercentage, 'feePercentage');
    return this.thirdwebWrite([this.call(this.methods.setFeePercentage, [fee])], from);
  }

  /**
   * @summary Fee alıcısını günceller.
   */
  async setFeeRecipient(from: string, feeRecipient: string): Promise<TipboxContractWriteResult> {
    const recipient = this.assertEthAddress(feeRecipient?.trim(), 'feeRecipient');
    return this.thirdwebWrite([this.call(this.methods.setFeeRecipient, [recipient])], from);
  }

  /**
   * @summary Bir adrese tip gönderir.
   */
  async tip(from: string, amount: bigint | number | string, target: string): Promise<TipboxContractWriteResult> {
    const amt = this.toUint256Param(amount, 'amount');
    const tgt = this.assertEthAddress(target?.trim(), 'target');

    return this.thirdwebWrite([this.call(this.methods.tip, [amt, tgt])], from);
  }

  /**
   * @summary Ownership’i yeni adrese devreder.
   */
  async transferOwnership(from: string, newOwner: string): Promise<TipboxContractWriteResult> {
    const owner = this.assertEthAddress(newOwner?.trim(), 'newOwner');
    return this.thirdwebWrite([this.call(this.methods.transferOwnership, [owner])], from);
  }
}

