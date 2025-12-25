import { GoogleGenerativeAI } from '@google/generative-ai';
import { getGeminiConfig } from '../config/gemini.config';
import logger from '../logger/logger';
import { ExternalServiceError } from '../errors/custom-errors';
import { CacheService } from '../cache/cache.service';
import { CACHE_KEYS } from '../cache/cache-keys';
import { CACHE_TTL } from '../cache/cache-ttl';
import { AIMetricsService } from './ai-metrics.service';
import crypto from 'crypto';

// Input validation constants
const MIN_EXPERIENCE_LENGTH = 3;
const MAX_EXPERIENCE_LENGTH = 5000;
const MAX_TOKENS_ESTIMATE = 2000; // Gemini token limit için güvenli değer

export interface SplitExperienceRequest {
  productId?: string; // Cache key için
  productName: string;
  productBrand?: string;
  productDescription?: string;
  experienceText: string;
}

export interface SplitExperienceResponse {
  priceAndShopping: {
    content: string;
    rating: number;
    placeholder?: string | null;
    isEnhanced?: boolean;
  } | null;
  productAndUsage: {
    content: string;
    rating: number;
    placeholder?: string | null;
    isEnhanced?: boolean;
  } | null;
  metadata: {
    tokensUsed: number | null;
    processingTimeMs: number;
    model: string;
    promptVersion: string;
  };
}

export class GeminiService {
  private static instance: GeminiService;
  private genAI: GoogleGenerativeAI;
  private model: any;
  private config: ReturnType<typeof getGeminiConfig>;
  private cache: CacheService;
  private metrics: AIMetricsService;
  private requestCount: number = 0;
  private lastRequestTime: number = 0;

  private constructor() {
    this.config = getGeminiConfig();
    this.genAI = new GoogleGenerativeAI(this.config.apiKey);
    this.model = this.genAI.getGenerativeModel({ model: this.config.model });
    this.cache = CacheService.getInstance();
    this.metrics = AIMetricsService.getInstance();
  }

  public static getInstance(): GeminiService {
    if (!GeminiService.instance) {
      GeminiService.instance = new GeminiService();
    }
    return GeminiService.instance;
  }

  /**
   * Get AI metrics
   */
  public getMetrics() {
    return this.metrics.getMetrics();
  }

  /**
   * Get cost analysis
   */
  public getCostAnalysis() {
    return this.metrics.getCostAnalysis();
  }

  /**
   * Generate metrics report
   */
  public generateMetricsReport(): string {
    return this.metrics.generateReport();
  }

  /**
   * Kullanıcının deneyim metnini Gemini AI ile iki kategoriye ayır:
   * 1. Price and Shopping Experience (Fiyat ve Alışveriş Deneyimi)
   * 2. Product and Usage Experience (Ürün ve Kullanım Deneyimi)
   */
  async splitExperience(request: SplitExperienceRequest): Promise<SplitExperienceResponse> {
    const startTime = Date.now();

    try {
      // 1. Input Validation
      this.validateInput(request);

      // 2. Rate Limiting Check
      await this.checkRateLimit();

      // 3. Generate Cache Key
      const cacheKey = this.generateCacheKey(request);

      // 4. Check Cache
      const cachedResult = await this.cache.get<SplitExperienceResponse>(cacheKey);
      if (cachedResult) {
        this.metrics.recordSuccess(
          cachedResult.metadata.tokensUsed,
          Date.now() - startTime,
          true // from cache
        );
        
        logger.info({
          message: 'Gemini AI cache hit',
          productName: request.productName,
          cacheKey,
        });
        return cachedResult;
      }

      // 5. Call AI with Retry & Timeout
      const aiResponse = await this.callAIWithRetry(request);
      
      const duration = Date.now() - startTime;
      
      // 6. Build Response with Metadata
      const responseWithMetadata: SplitExperienceResponse = {
        ...aiResponse,
        metadata: {
          tokensUsed: aiResponse.metadata.tokensUsed,
          processingTimeMs: duration,
          model: this.config.model,
          promptVersion: 'v2.1'
        }
      };

      // 7. Cache Result
      await this.cache.set(cacheKey, responseWithMetadata, CACHE_TTL.AI_SPLIT_EXPERIENCE);

      // 8. Record Metrics
      this.metrics.recordSuccess(
        aiResponse.metadata.tokensUsed,
        duration,
        false // not from cache
      );

      logger.info({
        message: 'Gemini AI deneyim ayrıştırması başarılı',
        productName: request.productName,
        duration: `${duration}ms`,
        tokensUsed: aiResponse.metadata.tokensUsed,
        hasPriceAndShopping: !!aiResponse.priceAndShopping?.content,
        hasProductAndUsage: !!aiResponse.productAndUsage?.content,
        cached: true,
      });

      return responseWithMetadata;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      // Detaylı hata bilgisi
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      
      // Record metrics for failure
      if (errorMessage.includes('rate limit')) {
        this.metrics.recordFailure('rate-limit');
      } else if (errorMessage.includes('timeout')) {
        this.metrics.recordFailure('timeout');
      } else if (errorMessage.includes('network')) {
        this.metrics.recordFailure('network');
      } else if (errorMessage.includes('validation')) {
        this.metrics.recordFailure('validation');
      } else {
        this.metrics.recordFailure('other');
      }
      
      logger.error({
        message: 'Gemini AI deneyim ayrıştırması hatası',
        productName: request.productName,
        duration: `${duration}ms`,
        error: errorMessage,
        errorStack: errorStack,
        errorDetails: error,
      });

      // Kullanıcıya daha açıklayıcı hata mesajı
      if (errorMessage.includes('API key')) {
        throw new ExternalServiceError('Gemini API key tanımlı değil veya geçersiz');
      } else if (errorMessage.includes('quota') || errorMessage.includes('rate limit')) {
        throw new ExternalServiceError('Gemini API rate limit aşıldı, lütfen daha sonra tekrar deneyin');
      } else if (errorMessage.includes('network') || errorMessage.includes('timeout')) {
        throw new ExternalServiceError('Gemini API\'ye bağlanılamadı, lütfen tekrar deneyin');
      } else if (errorMessage.includes('validation')) {
        throw new ExternalServiceError(errorMessage);
      }

      throw new ExternalServiceError(`AI servisi hatası: ${errorMessage}`);
    }
  }

  /**
   * Input validation
   */
  private validateInput(request: SplitExperienceRequest): void {
    // Experience text validation
    if (!request.experienceText || typeof request.experienceText !== 'string') {
      throw new Error('validation: Experience text gereklidir');
    }

    const trimmedText = request.experienceText.trim();
    
    if (trimmedText.length < MIN_EXPERIENCE_LENGTH) {
      throw new Error(`validation: Experience text en az ${MIN_EXPERIENCE_LENGTH} karakter olmalıdır`);
    }

    if (trimmedText.length > MAX_EXPERIENCE_LENGTH) {
      throw new Error(`validation: Experience text en fazla ${MAX_EXPERIENCE_LENGTH} karakter olabilir`);
    }

    // Token estimate validation (rough estimate: 1 token ≈ 4 chars)
    const estimatedTokens = Math.ceil(trimmedText.length / 4);
    if (estimatedTokens > MAX_TOKENS_ESTIMATE) {
      throw new Error(`validation: Metin çok uzun (tahmini ${estimatedTokens} token). Lütfen daha kısa bir metin girin`);
    }

    // Product name validation
    if (!request.productName || typeof request.productName !== 'string') {
      throw new Error('validation: Product name gereklidir');
    }
  }

  /**
   * Rate limiting check (simple implementation)
   * 60 requests per minute limit
   */
  private async checkRateLimit(): Promise<void> {
    const now = Date.now();
    const oneMinute = 60 * 1000;

    // Reset counter every minute
    if (now - this.lastRequestTime > oneMinute) {
      this.requestCount = 0;
      this.lastRequestTime = now;
    }

    this.requestCount++;

    // Check limit (60 requests per minute - Gemini free tier)
    if (this.requestCount > 60) {
      const waitTime = oneMinute - (now - this.lastRequestTime);
      logger.warn({
        message: 'Rate limit reached',
        requestCount: this.requestCount,
        waitTime: `${waitTime}ms`,
      });
      throw new Error('rate limit: Çok fazla istek gönderildi. Lütfen 1 dakika bekleyin');
    }
  }

  /**
   * Generate cache key from request
   */
  private generateCacheKey(request: SplitExperienceRequest): string {
    // Create a hash of experience text for cache key
    const hash = crypto
      .createHash('sha256')
      .update(request.experienceText.trim().toLowerCase())
      .digest('hex')
      .substring(0, 16); // İlk 16 karakter yeterli

    return CACHE_KEYS.AI_SPLIT_EXPERIENCE(hash, request.productId || 'unknown');
  }

  /**
   * Call AI with retry mechanism
   */
  private async callAIWithRetry(
    request: SplitExperienceRequest
  ): Promise<Omit<SplitExperienceResponse, 'metadata'> & { metadata: { tokensUsed: number | null } }> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        logger.info({
          message: 'Gemini API isteği gönderiliyor',
          productName: request.productName,
          experienceLength: request.experienceText.length,
          attempt,
          maxRetries: this.config.maxRetries,
        });

        // Call with timeout
        const result = await this.callAIWithTimeout(request);
        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        logger.warn({
          message: `Gemini API attempt ${attempt} failed`,
          error: lastError.message,
          willRetry: attempt < this.config.maxRetries,
        });

        // Exponential backoff: 1s, 2s, 4s
        if (attempt < this.config.maxRetries) {
          const backoffMs = Math.pow(2, attempt - 1) * 1000;
          await this.sleep(backoffMs);
        }
      }
    }

    throw lastError || new Error('AI request failed after all retries');
  }

  /**
   * Call AI with timeout
   */
  private async callAIWithTimeout(
    request: SplitExperienceRequest
  ): Promise<Omit<SplitExperienceResponse, 'metadata'> & { metadata: { tokensUsed: number | null } }> {
    const prompt = this.buildSplitExperiencePrompt(request);

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`timeout: AI request timed out after ${this.config.timeout}ms`));
      }, this.config.timeout);
    });

    const aiPromise = (async () => {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      // Token bilgisini al
      const usageMetadata = response.usageMetadata;
      const tokensUsed = usageMetadata?.totalTokenCount || null;

      const parsedResponse = this.parseSplitExperienceResponse(text);

      return {
        ...parsedResponse,
        metadata: {
          tokensUsed,
        },
      };
    })();

    return Promise.race([aiPromise, timeoutPromise]);
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Prompt oluştur
   */
  private buildSplitExperiencePrompt(request: SplitExperienceRequest): string {
    const productInfo = [
      `Ürün: ${request.productName}`,
      request.productBrand ? `Marka: ${request.productBrand}` : null,
      request.productDescription ? `Açıklama: ${request.productDescription}` : null,
    ]
      .filter(Boolean)
      .join('\n');

    return `
Bir kullanıcının ürün deneyimi metni var. Bu metni analiz edip iki kategoriye ayırman ve standartlaştırman gerekiyor:

1. **Price and Shopping Experience (Fiyat ve Alışveriş Deneyimi)**
   - Ürünün fiyatı, satın alma süreci, teslimat, kargo, ambalaj
   - Ödeme seçenekleri, indirimler, kampanyalar
   - Satıcı deneyimi, müşteri hizmetleri

2. **Product and Usage Experience (Ürün ve Kullanım Deneyimi)**
   - Ürünün performansı, kalitesi, özellikleri
   - Kullanım deneyimi, dayanıklılık
   - Ürünün beklentileri karşılama durumu

${productInfo}

Kullanıcı Deneyimi:
"""
${request.experienceText}
"""

KRİTİK KURALLAR:

1. **İÇERİK STANDARTLAŞTIRMA:**
   - Kısa ve öz metinleri, kategorinin standardına göre daha anlamlı ve düzgün cümleler haline getir
   - Argo, kaba veya özensiz ifadeleri düzelt
   - Türkçe dilbilgisi ve yazım kurallarına uy
   - Metni profesyonel ama samimi bir tonda yeniden ifade et
   - Anlamı koruyarak eksik bağlamları tamamla

2. **KATEGORİ AYIRMA:**
   - Metni dikkatlice oku ve SADECE ilgili kategoriye ait bilgileri ayır
   - Aynı metni her iki kategoriye de KOPYALAMA - bu kesinlikle yasak!
   - Eğer metin sadece bir kategoriye aitse, diğer kategoriyi mutlaka null yap
   - Her kategori için 1-5 arası bir rating (derecelendirme) ver

3. **PLACEHOLDER OLUŞTURMA:**
   - Eğer bir kategori için bilgi YOKSA, o kategoriyi null yap
   - Eğer bir kategori için bilgi VAR AMA EKSİKSE, dinamik bir placeholder üret
   - Placeholder, kullanıcıyı o kategorinin eksik kısımlarını doldurmaya yönlendirmeli
   - Placeholder örnekleri:
     * Fiyat kesiti varsa ama teslimat yoksa: "Teslimat sürecinden ve paketleme kalitesinden de bahsedin..."
     * Ürün kesiti varsa ama kullanım süresi yoksa: "Ne kadar süredir kullanıyorsunuz? Uzun vadeli performansından bahsedin..."
     * Fiyat kesiti varsa ama satın alma yeri yoksa: "Nereden satın aldınız? Satıcı deneyiminiz nasıldı?"

ÖRNEKLER:

Örnek 1 - Kısa Fiyat Metni (İyileştirme + Placeholder):
Girdi: "Çok pahalı buldum, 18.000 TL verdim."
Çıktı:
\`\`\`json
{
  "priceAndShopping": {
    "content": "Ürünü 18.000 TL'ye satın aldım ve fiyatını oldukça yüksek buldum.",
    "rating": 2,
    "placeholder": "Teslimat süreci, ödeme seçenekleri veya satıcı deneyiminiz hakkında da bilgi ekleyin..."
  },
  "productAndUsage": null
}
\`\`\`

Örnek 2 - Kısa Ürün Metni (İyileştirme + Placeholder):
Girdi: "Pil ömrü kötü."
Çıktı:
\`\`\`json
{
  "priceAndShopping": null,
  "productAndUsage": {
    "content": "Ürünün pil ömrü beklentilerimi karşılamadı ve yetersiz buldum.",
    "rating": 2,
    "placeholder": "Ürünün diğer özelliklerinden, performansından veya kullanım deneyiminizden de bahsedin..."
  }
}
\`\`\`

Örnek 3 - Sadece Teslimat (İyileştirme + Placeholder):
Girdi: "Kargo çok hızlıydı, 2 günde geldi."
Çıktı:
\`\`\`json
{
  "priceAndShopping": {
    "content": "Ürünün teslimatı oldukça hızlıydı, sipariş verdikten sadece 2 gün sonra elime ulaştı.",
    "rating": 5,
    "placeholder": "Ürünün fiyatından, satın alma sürecinden veya paketleme kalitesinden de bahsedin..."
  },
  "productAndUsage": null
}
\`\`\`

Örnek 4 - Kapsamlı Metin (Her İki Kategori Tam):
Girdi: "Dyson'dan 949 TL'ye aldım. Teslimat hızlıydı. Ürün çok iyi, lazer teknolojisi harika. Pil ömrü 60 dakika, evimi rahatça temizliyorum."
Çıktı:
\`\`\`json
{
  "priceAndShopping": {
    "content": "Ürünü Dyson'dan 949 TL'ye satın aldım ve teslimat süreci oldukça hızlı gerçekleşti.",
    "rating": 5
  },
  "productAndUsage": {
    "content": "Ürünün performansından çok memnunum. Özellikle yeşil lazer teknolojisi oldukça etkili. Pil ömrü normal modda yaklaşık 60 dakika sürdüğü için evimi tek şarjda rahatça temizleyebiliyorum.",
    "rating": 5
  }
}
\`\`\`

ÖNEMLI:
- İçeriği standartlaştır ama anlamı değiştirme
- Kısa metinleri daha anlamlı hale getir
- Eksik kategoriler için dinamik placeholder üret
- Tam kategoriler için placeholder ekleme

Lütfen aşağıdaki JSON formatında yanıt ver:

\`\`\`json
{
  "priceAndShopping": {
    "content": "...",
    "rating": 1-5,
    "placeholder": "..." (opsiyonel, sadece kategori eksikse)
  } | null,
  "productAndUsage": {
    "content": "...",
    "rating": 1-5,
    "placeholder": "..." (opsiyonel, sadece kategori eksikse)
  } | null
}
\`\`\`
`.trim();
  }

  /**
   * Gemini AI yanıtını parse et
   */
  private parseSplitExperienceResponse(text: string): Omit<SplitExperienceResponse, 'metadata'> {
    try {
      // JSON kısmını çıkar (```json ... ``` formatındaysa)
      const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
      const jsonText = jsonMatch ? jsonMatch[1] : text;

      const parsed = JSON.parse(jsonText);

      // Validasyon
      const result: Omit<SplitExperienceResponse, 'metadata'> = {
        priceAndShopping: null,
        productAndUsage: null,
      };

      // Fallback placeholder metinleri (sadece tamamen null kategoriler için)
      const fallbackPlaceholders = {
        priceAndShopping: 'Ürünün fiyatı, teslimat süreci veya satın alma deneyiminiz hakkında bilgi ekleyin...',
        productAndUsage: 'Ürünün performansı, kullanım deneyimi veya özellikler hakkında bilgi ekleyin...',
      };

      // Price and Shopping kategorisi
      if (parsed.priceAndShopping && typeof parsed.priceAndShopping === 'object') {
        const content = String(parsed.priceAndShopping.content || '').trim();
        
        // Placeholder: AI'dan gelen veya fallback
        let placeholder = parsed.priceAndShopping.placeholder 
          ? String(parsed.priceAndShopping.placeholder).trim() 
          : null;
        
        // Eğer içerik varsa ama placeholder yoksa, içerik eksik demektir - fallback kullan
        if (content && !placeholder) {
          placeholder = fallbackPlaceholders.priceAndShopping;
        }
        
        result.priceAndShopping = {
          content,
          rating: this.normalizeRating(parsed.priceAndShopping.rating),
          placeholder, // AI'ın ürettiği veya fallback placeholder
          isEnhanced: content.length > 0, // İçerik varsa iyileştirilmiştir
        };
      } else {
        // Kategori tamamen null - fallback placeholder kullan
        result.priceAndShopping = {
          content: '',
          rating: 0,
          placeholder: fallbackPlaceholders.priceAndShopping,
          isEnhanced: false,
        };
      }

      // Product and Usage kategorisi
      if (parsed.productAndUsage && typeof parsed.productAndUsage === 'object') {
        const content = String(parsed.productAndUsage.content || '').trim();
        
        // Placeholder: AI'dan gelen veya fallback
        let placeholder = parsed.productAndUsage.placeholder 
          ? String(parsed.productAndUsage.placeholder).trim() 
          : null;
        
        // Eğer içerik varsa ama placeholder yoksa, içerik eksik demektir - fallback kullan
        if (content && !placeholder) {
          placeholder = fallbackPlaceholders.productAndUsage;
        }
        
        result.productAndUsage = {
          content,
          rating: this.normalizeRating(parsed.productAndUsage.rating),
          placeholder, // AI'ın ürettiği veya fallback placeholder
          isEnhanced: content.length > 0,
        };
      } else {
        // Kategori tamamen null - fallback placeholder kullan
        result.productAndUsage = {
          content: '',
          rating: 0,
          placeholder: fallbackPlaceholders.productAndUsage,
          isEnhanced: false,
        };
      }

      return result;
    } catch (error) {
      logger.error({
        message: 'Gemini AI yanıtı parse edilemedi',
        error: error instanceof Error ? error.message : String(error),
        rawText: text,
      });

      throw new Error('AI yanıtı işlenemedi');
    }
  }

  /**
   * Rating'i 1-5 arasına normalize et
   */
  private normalizeRating(rating: any): number {
    const num = Number(rating);
    if (isNaN(num)) return 3;
    return Math.max(1, Math.min(5, Math.round(num)));
  }
}


