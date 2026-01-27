/**
 * AdminMintService - NFT Mint İşlemleri (Owner Private Key ile)
 * 
 * NFT contract owner'ı için server-side mint işlemleri.
 * ⚠️ SADECE server-side (API routes) kullanılmalı!
 * 
 * Detaylı dokümantasyon: @see ./README.md
 * Tip tanımları: @see ./types.ts
 */

import { 
  createThirdwebClient, 
  getContract, 
  sendTransaction, 
  waitForReceipt, 
  prepareContractCall, 
  estimateGas, 
  eth_getBalance, 
  getRpcClient,
  type Chain
} from "thirdweb";
import { privateKeyToAccount } from "thirdweb/wallets";
import { sepoliaChain, CONTRACT_ADDRESSES, ERC721_ABI } from "../../infrastructure/config/web3-config";

// Tip tanımlarını import et
import type {
  ContractAbi,
  AdminMintConfig,
  GasEstimate,
  AdminMintResult,
  LazyMintResult,
  NFTMetadata,
  GasLimitCheck,
  BatchMintRecipient,
} from "./types";

// ============================================================================
// ADMIN MINT SERVICE CLASS
// ============================================================================

/**
 * AdminMintService
 * 
 * NFT contract owner'ı için mint işlemlerini yöneten servis.
 * Private key kullanarak server-side'da çalışır.
 * 
 * @example
 * ```typescript
 * // Config objesi ile oluşturma (önerilen)
 * const service = new AdminMintService({
 *   privateKey: "0x...",
 *   secretKey: "...",
 *   contractAddress: "0x...",
 *   chain: sepoliaChain,
 *   abi: ERC721_ABI
 * });
 * 
 * // veya factory function ile
 * const service = createAdminMintService();
 * ```
 */
export class AdminMintService {
  /** Thirdweb client instance */
  private client: ReturnType<typeof createThirdwebClient>;
  
  /** NFT contract instance */
  private contract: ReturnType<typeof getContract>;
  
  /** Admin wallet account (private key'den oluşturulur) */
  private adminAccount: ReturnType<typeof privateKeyToAccount> | null = null;

  /** Kullanılan chain */
  private chain: Chain;

  /** Contract adresi */
  private contractAddress: string;

  /** Contract ABI */
  private contractAbi: ContractAbi;

  /** Maksimum gas fee limiti (ETH cinsinden). null = limit yok */
  private maxGasFeeEth: number | null = null;

  /**
   * AdminMintService Constructor
   * 
   * @param config - Yapılandırma objesi veya private key (geriye uyumluluk için)
   * @param secretKey - Thirdweb secret key (config objesi kullanılmıyorsa)
   * @param nftAddress - NFT contract adresi (config objesi kullanılmıyorsa)
   * 
   * @example
   * ```typescript
   * // YENİ: Config objesi ile (önerilen)
   * const service = new AdminMintService({
   *   privateKey: process.env.ADMIN_PRIVATE_KEY,
   *   secretKey: process.env.THIRDWEB_SECRET_KEY,
   *   contractAddress: "0xB7b9dfdB0291510e4677aADD2b03a39B9d46d235",
   *   chain: sepoliaChain,
   *   abi: ERC721_ABI
   * });
   * 
   * // ESKİ: Parametre ile (geriye uyumluluk)
   * const service = new AdminMintService(
   *   process.env.ADMIN_PRIVATE_KEY,
   *   process.env.THIRDWEB_SECRET_KEY,
   *   "0xCustomNFTAddress..."
   * );
   * ```
   */
  constructor(
    config?: AdminMintConfig | string,
    secretKey?: string,
    nftAddress?: string
  ) {
    // Config objesi mi yoksa eski format mı kontrol et
    let privateKey: string | undefined;
    let secret: string | undefined;
    let contractAddr: string;
    let chain: Chain;
    let abi: ContractAbi;

    if (typeof config === "object" && config !== null) {
      // Yeni format: Config objesi
      privateKey = config.privateKey;
      secret = config.secretKey;
      contractAddr = config.contractAddress || CONTRACT_ADDRESSES.tipboxBadge;
      chain = config.chain || sepoliaChain;
      abi = config.abi || ERC721_ABI;
      // Gas fee limiti
      this.maxGasFeeEth = config.maxGasFeeEth ?? null;
    } else {
      // Eski format: Ayrı parametreler (geriye uyumluluk)
      privateKey = config; // config aslında privateKey string
      secret = secretKey;
      contractAddr = nftAddress || CONTRACT_ADDRESSES.tipboxBadge;
      chain = sepoliaChain;
      abi = ERC721_ABI;
      // Eski formatta gas limiti yok
      this.maxGasFeeEth = null;
    }

    // Değerleri sakla
    this.chain = chain;
    this.contractAddress = contractAddr;
    this.contractAbi = abi;

    // Thirdweb client oluştur
    // secretKey sunucu tarafı işlemler için gerekli
    this.client = createThirdwebClient({
      secretKey: secret || process.env.THIRDWEB_SECRET_KEY || "",
    });

    // NFT Contract instance oluştur
    // ABI ile birlikte tanımlanır - safeMint fonksiyonu için gerekli
    this.contract = getContract({
      client: this.client,
      chain: this.chain,
      address: this.contractAddress,
      abi: this.contractAbi,
    });

    // Private key varsa admin account oluştur
    // Bu account mint işlemlerini imzalamak için kullanılır
    if (privateKey) {
      this.adminAccount = privateKeyToAccount({
        client: this.client,
        // Private key 0x ile başlamalı
        privateKey: privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`,
      });
    }
  }

  // ==========================================================================
  // YAPILANDIRMA FONKSİYONLARI
  // ==========================================================================

  /**
   * Private key'i sonradan ayarlar
   * Constructor'da verilmediyse bu fonksiyon ile ayarlanabilir
   * 
   * @param privateKey - Owner wallet private key
   * 
   * @example
   * ```typescript
   * const service = new AdminMintService();
   * service.setPrivateKey("0x...");
   * ```
   */
  setPrivateKey(privateKey: string): void {
    this.adminAccount = privateKeyToAccount({
      client: this.client,
      privateKey: privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`,
    });
  }

  /**
   * Admin wallet adresini döndürür
   * Private key'den türetilen public address
   * 
   * @returns Admin wallet adresi veya null
   * 
   * @example
   * ```typescript
   * const address = service.getAdminAddress();
   * console.log("Admin:", address); // 0x1234...5678
   * ```
   */
  getAdminAddress(): string | null {
    return this.adminAccount?.address || null;
  }

  /**
   * Kullanılan chain'i döndürür
   * 
   * @returns Chain objesi
   * 
   * @example
   * ```typescript
   * const chain = service.getChain();
   * console.log("Chain ID:", chain.id); // 11155111 (Sepolia)
   * ```
   */
  getChain(): Chain {
    return this.chain;
  }

  /**
   * Contract adresini döndürür
   * 
   * @returns NFT contract adresi
   * 
   * @example
   * ```typescript
   * const address = service.getContractAddress();
   * console.log("Contract:", address); // 0xB7b9...
   * ```
   */
  getContractAddress(): string {
    return this.contractAddress;
  }

  /**
   * Contract ABI'sini döndürür
   * 
   * @returns Contract ABI
   */
  getContractAbi(): ContractAbi {
    return this.contractAbi;
  }

  /**
   * Maksimum gas fee limitini döndürür
   * 
   * @returns Gas limiti (ETH) veya null (limit yok)
   */
  getMaxGasFee(): number | null {
    return this.maxGasFeeEth;
  }

  /**
   * Maksimum gas fee limitini ayarlar
   * Bu değerin üzerindeki gas ücretlerinde mint işlemi reddedilir.
   * 
   * @param maxFeeEth - Maksimum gas fee (ETH cinsinden), null = limit kaldır
   */
  setMaxGasFee(maxFeeEth: number | null): void {
    this.maxGasFeeEth = maxFeeEth;
  }

  /**
   * Gas fee'nin limit içinde olup olmadığını kontrol eder
   * 
   * @param estimatedGasEth - Tahmini gas fee (ETH cinsinden)
   * @returns GasLimitCheck objesi
   */
  checkGasLimit(estimatedGasEth: number): GasLimitCheck {
    if (this.maxGasFeeEth === null) {
      return { withinLimit: true, limit: null, estimated: estimatedGasEth };
    }

    const withinLimit = estimatedGasEth <= this.maxGasFeeEth;
    
    return {
      withinLimit,
      limit: this.maxGasFeeEth,
      estimated: estimatedGasEth,
      message: withinLimit 
        ? undefined 
        : `Gas fee limiti aşıldı! Limit: ${this.maxGasFeeEth} ETH, Tahmini: ${estimatedGasEth.toFixed(6)} ETH`
    };
  }

  // ==========================================================================
  // MİNT FONKSİYONLARI
  // ==========================================================================

  /**
   * NFT'yi metadata objesi ile mint eder
   * 
   * Bu fonksiyon en yaygın kullanılan mint yöntemidir.
   * Metadata otomatik olarak base64 data URI'ye dönüştürülür.
   * 
   * @param toAddress - NFT'nin gönderileceği cüzdan adresi
   * @param metadata - NFT metadata objesi (name, description, image vb.)
   * @returns Mint sonucu (success, transactionHash veya error)
   * 
   * @example
   * ```typescript
   * const result = await service.mintWithMetadata(
   *   "0x1234567890123456789012345678901234567890",
   *   {
   *     name: "TipBox Badge #1",
   *     description: "TipBox topluluk rozeti",
   *     image: "ipfs://QmXxx...",
   *     attributes: [
   *       { trait_type: "Tier", value: "Gold" },
   *       { trait_type: "Points", value: 100 }
   *     ]
   *   }
   * );
   * 
   * if (result.success) {
   *   console.log("Tx:", result.transactionHash);
   * }
   * ```
   */
  async mintWithMetadata(toAddress: string, metadata: NFTMetadata): Promise<AdminMintResult> {
    // Metadata'yı base64 data URI'ye dönüştür
    const tokenURI = this.metadataToURI(metadata);
    // safeMint fonksiyonunu çağır
    return this.safeMint(toAddress, tokenURI);
  }

  /**
   * NFT'yi direkt token URI ile mint eder (safeMint)
   * 
   * Bu fonksiyon contract'ın safeMint fonksiyonunu çağırır.
   * Sadece contract owner bu fonksiyonu çağırabilir.
   * 
   * @param toAddress - NFT'nin gönderileceği adres
   * @param tokenURI - Token metadata URI (IPFS, HTTPS veya data URI)
   * @returns Mint sonucu
   * 
   * @example
   * ```typescript
   * // IPFS URI ile
   * const result = await service.safeMint(
   *   "0x...",
   *   "ipfs://QmXxxYyyZzz..."
   * );
   * 
   * // HTTPS URI ile
   * const result = await service.safeMint(
   *   "0x...",
   *   "https://api.example.com/metadata/1"
   * );
   * ```
   */
  async safeMint(toAddress: string, tokenURI: string): Promise<AdminMintResult> {
    try {
      // Admin account kontrolü
      if (!this.adminAccount) {
        return { 
          success: false, 
          error: "Admin private key ayarlanmamış. .env dosyasına ADMIN_PRIVATE_KEY ekleyin." 
        };
      }

      // Adres format kontrolü
      if (!this.isValidAddress(toAddress)) {
        return { 
          success: false, 
          error: "Geçersiz alıcı adresi. 0x ile başlayan 40 karakterlik hex string olmalı." 
        };
      }

      // Transaction hazırla
      // method: Human-readable ABI formatı kullanılmalı (Thirdweb v5 gereksinimi)
      const tx = prepareContractCall({
        contract: this.contract,
        method: "function safeMint(address to, string uri) returns (uint256)",
        params: [toAddress, tokenURI],
      });

      // Gas fee limit kontrolü (eğer limit ayarlandıysa)
      if (this.maxGasFeeEth !== null) {
        try {
          // Gas estimate al
          const gasLimit = await estimateGas({
            transaction: tx,
            account: this.adminAccount,
          });

          // Varsayılan gas price (30 Gwei)
          const gasPrice = BigInt(30_000_000_000);
          const estimatedCostWei = gasLimit * gasPrice;
          const estimatedCostEth = Number(estimatedCostWei) / 1e18;

          // Limit kontrolü
          const gasCheck = this.checkGasLimit(estimatedCostEth);
          if (!gasCheck.withinLimit) {
            return {
              success: false,
              error: gasCheck.message || `Gas fee limiti aşıldı! Limit: ${this.maxGasFeeEth} ETH, Tahmini: ${estimatedCostEth.toFixed(6)} ETH`,
            };
          }

          console.log(`Gas check passed: ${estimatedCostEth.toFixed(6)} ETH <= ${this.maxGasFeeEth} ETH limit`);
        } catch (gasError) {
          console.warn("Gas estimate failed, proceeding without limit check:", gasError);
          // Gas tahmini başarısız olursa devam et (opsiyonel: burada da hata verilebilir)
        }
      }

      // Transaction'ı admin wallet ile imzala ve gönder
      const result = await sendTransaction({
        transaction: tx,
        account: this.adminAccount,
      });

      // Transaction'ın blockchain'e yazılmasını bekle
      const receipt = await waitForReceipt(result);

      return {
        success: true,
        transactionHash: receipt.transactionHash,
      };
    } catch (error) {
      // Hata mesajını çıkar ve kullanıcı dostu formata çevir
      const errorMessage = this.extractErrorMessage(error);
      console.error("Admin safeMint error:", error);
      console.error("Extracted message:", errorMessage);
      return {
        success: false,
        error: this.parseError(errorMessage),
      };
    }
  }

  /**
   * mintTo - mintWithMetadata için alias
   * Geriye dönük uyumluluk için
   */
  async mintTo(toAddress: string, metadata: NFTMetadata): Promise<AdminMintResult> {
    return this.mintWithMetadata(toAddress, metadata);
  }

  /**
   * IPFS URI ile NFT mint eder
   * 
   * Metadata'yı önceden IPFS'e yüklediyseniz bu fonksiyonu kullanın.
   * 
   * @param toAddress - Alıcı adresi
   * @param ipfsURI - IPFS URI (ipfs://Qm... formatında)
   * @returns Mint sonucu
   * 
   * @example
   * ```typescript
   * // Metadata IPFS'e yüklendi: ipfs://QmXyz123...
   * const result = await service.mintWithIPFS(
   *   "0x...",
   *   "ipfs://QmXyz123..."
   * );
   * ```
   */
  async mintWithIPFS(toAddress: string, ipfsURI: string): Promise<AdminMintResult> {
    return this.safeMint(toAddress, ipfsURI);
  }

  /**
   * Toplu mint - Birden fazla adrese NFT mint eder
   * 
   * Her mint arasında 2 saniye bekleme yapılır (rate limiting).
   * Tüm sonuçlar array olarak döndürülür.
   * 
   * @param recipients - Alıcı listesi
   * @returns Tüm mint sonuçları
   * 
   * @example
   * ```typescript
   * const recipients = [
   *   { address: "0xAAA...", metadata: { name: "Badge #1" } },
   *   { address: "0xBBB...", metadata: { name: "Badge #2" } },
   * ];
   * 
   * const results = await service.batchMint(recipients);
   * 
   * const successful = results.filter(r => r.success).length;
   * console.log(`${successful}/${results.length} başarılı`);
   * ```
   */
  async batchMint(
    recipients: BatchMintRecipient[]
  ): Promise<AdminMintResult[]> {
    const results: AdminMintResult[] = [];

    for (const recipient of recipients) {
      const result = await this.mintWithMetadata(recipient.address, recipient.metadata);
      results.push(result);

      // Rate limiting - blockchain işlemleri arasında bekleme
      // Nonce çakışmalarını önlemek için gerekli
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    return results;
  }

  /**
   * Lazy mint - Metadata'ları hazırlar ve URI'ları döndürür
   * 
   * Bu fonksiyon metadata'ları base64 data URI'ye dönüştürür.
   * Gerçek mint işlemi daha sonra claim ile yapılabilir.
   * 
   * @param metadatas - NFT metadata listesi
   * @returns İşlem sonucu ve hazırlanan URI'lar
   * 
   * @example
   * ```typescript
   * const metadatas = [
   *   { name: "Badge #1", description: "First badge" },
   *   { name: "Badge #2", description: "Second badge" },
   * ];
   * 
   * const result = await service.lazyMint(metadatas);
   * console.log("Prepared URIs:", result.tokenURIs);
   * ```
   */
  async lazyMint(metadatas: NFTMetadata[]): Promise<LazyMintResult> {
    try {
      if (!this.adminAccount) {
        return {
          success: false,
          error: "Admin private key ayarlanmamış.",
        };
      }

      // Metadata'ları URI'ye dönüştür
      const tokenURIs: string[] = [];
      for (const metadata of metadatas) {
        const uri = this.metadataToURI(metadata);
        tokenURIs.push(uri);
      }

      // Lazy mint başarılı - URI'lar hazır
      // Gerçek uygulamada bunlar IPFS'e yüklenebilir veya veritabanına kaydedilebilir
      return {
        success: true,
        tokenURIs,
        transactionHash: undefined, // Lazy mint'te henüz tx yok
      };
    } catch (error) {
      const errorMessage = this.extractErrorMessage(error);
      return {
        success: false,
        error: this.parseError(errorMessage),
      };
    }
  }

  // ==========================================================================
  // YARDIMCI FONKSİYONLAR
  // ==========================================================================

  /**
   * Admin cüzdan bakiyesini sorgular
   * 
   * Mint işlemi için yeterli gas olup olmadığını kontrol etmek için kullanılır.
   * 
   * @returns Bakiye bilgisi (wei ve ETH cinsinden)
   * 
   * @example
   * ```typescript
   * const { balance, balanceEth } = await service.getAdminBalance();
   * console.log("Bakiye:", balanceEth, "ETH");
   * 
   * if (balance < BigInt("100000000000000")) { // 0.0001 ETH
   *   console.warn("Düşük bakiye uyarısı!");
   * }
   * ```
   */
  async getAdminBalance(): Promise<{ balance: bigint; balanceEth: string }> {
    if (!this.adminAccount) {
      return { balance: BigInt(0), balanceEth: "0" };
    }

    try {
      // RPC client oluştur
      const rpcRequest = getRpcClient({
        client: this.client,
        chain: this.chain,
      });

      // ETH bakiyesini sorgula
      const balance = await eth_getBalance(rpcRequest, {
        address: this.adminAccount.address,
      });

      // Wei'den ETH'e çevir (18 decimal)
      const balanceEth = (Number(balance) / 1e18).toFixed(6);
      return { balance, balanceEth };
    } catch (error) {
      console.error("Balance fetch error:", error);
      return { balance: BigInt(0), balanceEth: "0" };
    }
  }

  /**
   * Mint işlemi için gas ücreti tahmini yapar
   * 
   * Mint öncesi tahmini maliyeti görmek için kullanılır.
   * Bakiyenin yeterli olup olmadığını da kontrol eder.
   * 
   * @param toAddress - Hedef adres
   * @param metadata - Mint edilecek NFT metadata'sı
   * @returns Gas tahmini veya null (hata durumunda)
   * 
   * @example
   * ```typescript
   * const estimate = await service.estimateGasFee("0x...", { name: "Test" });
   * 
   * if (estimate) {
   *   console.log("Tahmini maliyet:", estimate.estimatedCostEth, "ETH");
   *   
   *   if (!estimate.hasEnoughBalance) {
   *     console.error("Yetersiz bakiye! Gereken:", estimate.estimatedCostEth);
   *   }
   * }
   * ```
   */
  async estimateGasFee(toAddress: string, metadata: NFTMetadata): Promise<GasEstimate | null> {
    try {
      if (!this.adminAccount) {
        console.error("Admin account not set");
        return null;
      }

      // Geçersiz adres ise admin adresini kullan
      const targetAddress = this.isValidAddress(toAddress) ? toAddress : this.adminAccount.address;
      const tokenURI = this.metadataToURI(metadata);

      // Transaction hazırla (göndermeden)
      const tx = prepareContractCall({
        contract: this.contract,
        method: "function safeMint(address to, string uri) returns (uint256)",
        params: [targetAddress, tokenURI],
      });

      // Gas limit tahmin et
      const gasLimit = await estimateGas({
        transaction: tx,
        account: this.adminAccount,
      });

      // RPC client
      const rpcRequest = getRpcClient({
        client: this.client,
        chain: this.chain,
      });

      // Varsayılan gas price (ortalama ~30 Gwei)
      // Production'da eth_gasPrice kullanılmalı
      const gasPrice = BigInt(30_000_000_000); // 30 Gwei

      // Toplam maliyet hesapla
      const estimatedCostWei = gasLimit * gasPrice;
      const estimatedCostEth = (Number(estimatedCostWei) / 1e18).toFixed(6);

      // Admin bakiye kontrolü
      const { balance, balanceEth } = await this.getAdminBalance();
      const hasEnoughBalance = balance >= estimatedCostWei;

      return {
        gasLimit: gasLimit.toString(),
        gasPrice: gasPrice.toString(),
        estimatedCostWei: estimatedCostWei.toString(),
        estimatedCostEth,
        adminBalance: balance.toString(),
        adminBalanceEth: balanceEth,
        hasEnoughBalance,
      };
    } catch (error) {
      console.error("Gas estimate error:", error);
      return null;
    }
  }

  /**
   * Contract owner adresini döndürür
   * Not: Admin service'de read işlemi yok, bu sadece admin adresini döndürür
   */
  async getContractOwner(): Promise<string> {
    return this.adminAccount?.address || "";
  }

  // ==========================================================================
  // PRİVATE YARDIMCI FONKSİYONLAR
  // ==========================================================================

  /**
   * Metadata objesini base64 data URI'ye dönüştürür
   * 
   * Bu format blockchain üzerinde on-chain metadata saklamak için kullanılır.
   * IPFS kullanmak istemiyorsanız bu yöntem tercih edilebilir.
   * 
   * @param metadata - NFT metadata objesi
   * @returns data:application/json;base64,... formatında URI
   */
  private metadataToURI(metadata: NFTMetadata): string {
    // JSON string oluştur
    const metadataJson = JSON.stringify({
      name: metadata.name,
      description: metadata.description || "",
      image: metadata.image || "",
      external_url: metadata.external_url || "",
      animation_url: metadata.animation_url || "",
      attributes: metadata.attributes || [],
    });

    // Base64'e encode et
    const base64Metadata = Buffer.from(metadataJson).toString("base64");
    
    // Data URI formatında döndür
    return `data:application/json;base64,${base64Metadata}`;
  }

  /**
   * Ethereum adres formatı kontrolü
   * 
   * @param address - Kontrol edilecek adres
   * @returns Geçerli mi?
   */
  private isValidAddress(address: string): boolean {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  }

  /**
   * Error objesinden anlamlı mesaj çıkarır
   * 
   * Thirdweb ve blockchain hataları genellikle iç içe objeler içerir.
   * Bu fonksiyon en anlamlı hata mesajını bulmaya çalışır.
   */
  private extractErrorMessage(error: unknown): string {
    // String ise direkt döndür
    if (typeof error === "string") {
      return error;
    }

    // Error instance ise
    if (error instanceof Error) {
      // Thirdweb hataları cause içinde detay barındırır
      const cause = (error as Error & { cause?: unknown }).cause;
      if (cause) {
        return this.extractErrorMessage(cause);
      }
      return error.message;
    }

    // Object ise - yaygın hata property'lerini kontrol et
    if (error && typeof error === "object") {
      const errorObj = error as Record<string, unknown>;
      
      // Yaygın error property'leri
      if (typeof errorObj.message === "string") return errorObj.message;
      if (typeof errorObj.error === "string") return errorObj.error;
      if (typeof errorObj.reason === "string") return errorObj.reason;
      if (typeof errorObj.shortMessage === "string") return errorObj.shortMessage;
      if (typeof errorObj.details === "string") return errorObj.details;
      
      // Nested error objesi
      if (errorObj.error && typeof errorObj.error === "object") {
        return this.extractErrorMessage(errorObj.error);
      }
      
      // Data içinde hata
      if (errorObj.data && typeof errorObj.data === "object") {
        const data = errorObj.data as Record<string, unknown>;
        if (typeof data.message === "string") return data.message;
      }

      // Son çare: JSON stringify
      try {
        return JSON.stringify(error, null, 2);
      } catch {
        return "Bilinmeyen hata oluştu";
      }
    }

    return "Bilinmeyen hata oluştu";
  }

  /**
   * Hata mesajlarını kullanıcı dostu Türkçe formata çevirir
   * 
   * @param error - Ham hata mesajı
   * @returns Kullanıcı dostu hata mesajı
   */
  private parseError(error: string): string {
    // Yetersiz bakiye
    if (error.includes("insufficient funds")) {
      return "Yetersiz bakiye. Admin cüzdanında yeterli ETH olmalı. Sepolia faucet'ten ETH alın.";
    }
    // Owner yetkisi hatası
    if (error.includes("OwnableUnauthorizedAccount") || error.includes("not owner") || error.includes("Ownable")) {
      return "Bu işlem için contract owner yetkisi gerekli. Private key doğru mu kontrol edin.";
    }
    // Private key format hatası
    if (error.includes("invalid private key") || error.includes("privateKey")) {
      return "Geçersiz private key formatı. 0x ile başlayan 64 karakterlik hex string olmalı.";
    }
    // Soulbound transfer hatası
    if (error.includes("Transfers are not allowed")) {
      return "Bu NFT soulbound - transfer edilemez. Doğru adrese mint edildiğinden emin olun.";
    }
    // Nonce hatası
    if (error.includes("nonce")) {
      return "İşlem sırası hatası. Lütfen birkaç saniye bekleyip tekrar deneyin.";
    }
    // Bilinmeyen hata - ham mesajı döndür
    return error;
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Environment variables'dan AdminMintService oluşturur
 * 
 * Bu fonksiyon .env dosyasındaki değerleri otomatik okur.
 * API routes içinde kullanım için idealdir.
 * 
 * Gerekli environment variables:
 * - ADMIN_PRIVATE_KEY: NFT contract owner private key
 * - THIRDWEB_SECRET_KEY: Thirdweb secret (opsiyonel)
 * 
 * @returns Yapılandırılmış AdminMintService instance
 * 
 * @example
 * ```typescript
 * // API route içinde
 * import { createAdminMintService } from "@/services/admin-mint";
 * 
 * export async function POST(request: Request) {
 *   const service = createAdminMintService();
 *   const result = await service.mintWithMetadata("0x...", metadata);
 *   return Response.json(result);
 * }
 * ```
 */
export function createAdminMintService(): AdminMintService {
  const privateKey = process.env.ADMIN_PRIVATE_KEY;
  const secretKey = process.env.THIRDWEB_SECRET_KEY;

  return new AdminMintService(privateKey, secretKey);
}
