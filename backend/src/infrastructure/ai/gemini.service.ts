import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import { getGeminiConfig } from '../config/gemini.config';
import logger from '../logger/logger';
import { ExternalServiceError } from '../errors/custom-errors';
import { CacheService } from '../cache/cache.service';
import { CACHE_KEYS } from '../cache/cache-keys';
import { CACHE_TTL } from '../cache/cache-ttl';
import { AIMetricsService } from './ai-metrics.service';
import { AIPipelineLogger } from './ai-pipeline-logger';
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

export interface GeneratePostContentRequest {
  postType: string;
  persona: string;
  productName?: string;
  productBrand?: string;
  productDescription?: string;
}

export interface GeneratePostContentResponse {
  title: string;
  body: string;
  metadata: {
    tokensUsed: number | null;
    processingTimeMs: number;
    model: string;
  };
}

export interface BatchGeneratePostContentRequest {
  requests: GeneratePostContentRequest[];
}

export interface BatchGeneratePostContentResponse {
  results: Array<{
    title: string;
    body: string;
    success: boolean;
    error?: string;
  }>;
  metadata: {
    tokensUsed: number | null;
    processingTimeMs: number;
    model: string;
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
  };
}

export class GeminiService {
  private static instance: GeminiService;
  private genAI: GoogleGenerativeAI;
  private model: GenerativeModel;
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
    const pipeline = new AIPipelineLogger({
      pipelineName: 'GeminiService',
      operationName: 'splitExperience',
      totalStages: 6,
      metadata: { productName: request.productName, textLength: request.experienceText.length },
    });

    try {
      // [1/6] Input Validation
      await pipeline.runStage('Validating input', () => this.validateInput(request));

      // [2/6] Rate Limiting Check
      await pipeline.runStage('Checking rate limit', () => this.checkRateLimit());

      // [3/6] Check Cache
      const cacheKey = this.generateCacheKey(request);
      const cachedResult = await pipeline.runStage(
        'Checking cache',
        () => this.cache.get<SplitExperienceResponse>(cacheKey),
      );

      if (cachedResult) {
        this.metrics.recordSuccess(cachedResult.metadata.tokensUsed, pipeline.elapsed, true);
        pipeline.skipStage('Calling Gemini API');
        pipeline.skipStage('Parsing response');
        pipeline.skipStage('Caching result');
        pipeline.complete({ tokens: cachedResult.metadata.tokensUsed, cacheHit: true });
        return cachedResult;
      }

      // [4/6] Call AI with Retry & Timeout
      const aiResponse = await pipeline.runStage('Calling Gemini API', () =>
        this.callAIWithRetry(request),
      );

      // [5/6] Build Response with Metadata
      const duration = pipeline.elapsed;
      const responseWithMetadata = await pipeline.runStage('Parsing response', () => {
        const result: SplitExperienceResponse = {
          ...aiResponse,
          metadata: {
            tokensUsed: aiResponse.metadata.tokensUsed,
            processingTimeMs: duration,
            model: this.config.model,
            promptVersion: 'v2.1',
          },
        };
        return result;
      });

      // [6/6] Cache Result
      await pipeline.runStage('Caching result', () =>
        this.cache.set(cacheKey, responseWithMetadata, CACHE_TTL.AI_SPLIT_EXPERIENCE),
      );

      this.metrics.recordSuccess(aiResponse.metadata.tokensUsed, duration, false);
      pipeline.complete({ tokens: aiResponse.metadata.tokensUsed });

      return responseWithMetadata;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

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

      pipeline.fail(errorMessage, { productName: request.productName });

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
        logger.info(`  [AI Pipeline] Gemini API attempt ${attempt}/${this.config.maxRetries}...`, {
          productName: request.productName,
          experienceLength: request.experienceText.length,
          attempt,
          maxRetries: this.config.maxRetries,
        });

        const result = await this.callAIWithTimeout(request);

        if (attempt > 1) {
          logger.info(`  [AI Pipeline] Gemini API attempt ${attempt}/${this.config.maxRetries} ✓ (recovered after ${attempt - 1} retries)`);
        }

        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < this.config.maxRetries) {
          const backoffMs = Math.pow(2, attempt - 1) * 1000;
          logger.warn(`  [AI Pipeline] Gemini API attempt ${attempt}/${this.config.maxRetries} ✗ | ${lastError.message} | retry in ${backoffMs}ms`, {
            attempt,
            backoffMs,
            error: lastError.message,
          });
          await this.sleep(backoffMs);
        } else {
          logger.error(`  [AI Pipeline] Gemini API attempt ${attempt}/${this.config.maxRetries} ✗ | ${lastError.message} | no more retries`, {
            attempt,
            error: lastError.message,
          });
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
  private normalizeRating(rating: unknown): number {
    const num = Number(rating);
    if (isNaN(num)) return 3;
    return Math.max(1, Math.min(5, Math.round(num)));
  }

  /**
   * Post içeriği üret (title ve body)
   */
  async generatePostContent(
    request: GeneratePostContentRequest,
  ): Promise<GeneratePostContentResponse> {
    const pipeline = new AIPipelineLogger({
      pipelineName: 'GeminiService',
      operationName: 'generatePostContent',
      totalStages: 4,
      metadata: { postType: request.postType, persona: request.persona },
    });

    try {
      // [1/4] Rate limiting check
      await pipeline.runStage('Checking rate limit', () => this.checkRateLimit());

      // [2/4] Build prompt
      const prompt = await pipeline.runStage('Building prompt', () =>
        this.buildPostContentPrompt(request),
      );

      // [3/4] Call AI with timeout
      const aiResult = await pipeline.runStage('Calling Gemini API', async () => {
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => {
            reject(new Error(`timeout: AI request timed out after ${this.config.timeout}ms`));
          }, this.config.timeout);
        });

        const aiPromise = (async () => {
          const result = await this.model.generateContent({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.8,
              topP: 0.95,
              topK: 40,
              maxOutputTokens: 4000,
            },
          });

          const response = await result.response;

          let text = '';
          let candidates: Array<{
            content?: { parts?: Array<{ text?: string }> };
            finishReason?: string;
          }> = [];

          try {
            text = response.text();
          } catch {
            const responseRecord = response as unknown as Record<string, unknown>;
            candidates = (
              Array.isArray(responseRecord.candidates) ? responseRecord.candidates : []
            ) as typeof candidates;
            if (candidates.length > 0) {
              const candidate = candidates[0];
              const content = candidate.content;
              if (content && content.parts) {
                text = content.parts.map((part) => part.text || '').join('\n');
              }
            }
          }

          if (candidates.length === 0) {
            const responseRecord = response as unknown as Record<string, unknown>;
            candidates = (
              Array.isArray(responseRecord.candidates) ? responseRecord.candidates : []
            ) as typeof candidates;
          }
          if (candidates.length > 0) {
            const finishReason = candidates[0].finishReason;
            if (finishReason === 'MAX_TOKENS') {
              logger.warn({
                message: 'Gemini API MAX_TOKENS limitine ulaştı',
                finishReason,
                maxOutputTokens: 4000,
                thoughtsTokenCount: (
                  response as unknown as Record<string, Record<string, unknown>>
                ).usageMetadata?.thoughtsTokenCount,
              });
            }
          }

          if (!text || text.trim().length === 0) {
            throw new Error('AI response boş geldi');
          }

          const usageMetadata = response.usageMetadata;
          const tokensUsed = usageMetadata?.totalTokenCount || null;

          return { text, tokensUsed };
        })();

        return Promise.race([aiPromise, timeoutPromise]);
      });

      // [4/4] Parse response
      const result = await pipeline.runStage('Parsing response', () => {
        const parsed = this.parsePostContentResponse(aiResult.text);
        return {
          ...parsed,
          metadata: {
            tokensUsed: aiResult.tokensUsed,
            processingTimeMs: pipeline.elapsed,
            model: this.config.model,
          },
        };
      });

      this.metrics.recordSuccess(result.metadata.tokensUsed, result.metadata.processingTimeMs, false);
      pipeline.complete({ tokens: result.metadata.tokensUsed });

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      if (errorMessage.includes('rate limit')) {
        this.metrics.recordFailure('rate-limit');
      } else if (errorMessage.includes('timeout')) {
        this.metrics.recordFailure('timeout');
      } else {
        this.metrics.recordFailure('other');
      }

      pipeline.fail(errorMessage, { postType: request.postType });

      throw new ExternalServiceError(`AI içerik üretim hatası: ${errorMessage}`);
    }
  }

  /**
   * Post içeriği için prompt oluştur
   */
  private buildPostContentPrompt(request: GeneratePostContentRequest): string {
    const postTypePrompts: Record<string, string> = {
      QUESTION: 'Bir soru formatında içerik yaz. Kullanıcı bir ürün hakkında soru soruyor gibi görünsün.',
      TIPS: 'Bir ipucu veya tavsiye formatında içerik yaz. Kullanıcı deneyimlerinden yola çıkarak pratik öneriler sunuyor gibi görünsün.',
      FREE: 'Genel bilgilendirici bir içerik yaz. Kullanıcı ürün hakkında bilgi paylaşıyor gibi görünsün.',
      EXPERIENCE: 'Bir deneyim paylaşımı formatında içerik yaz. Kullanıcı ürünü kullanma deneyimini anlatıyor gibi görünsün.',
      COMPARE: 'Bir karşılaştırma formatında içerik yaz. Kullanıcı ürünü başka ürünlerle karşılaştırıyor gibi görünsün.',
      UPDATE: 'Bir güncelleme veya haber formatında içerik yaz. Kullanıcı ürün hakkında güncel bilgi paylaşıyor gibi görünsün.',
    };

    const productContext = [];
    if (request.productName) {
      productContext.push(`Ürün: ${request.productName}`);
    }
    if (request.productBrand) {
      productContext.push(`Marka: ${request.productBrand}`);
    }
    if (request.productDescription) {
      productContext.push(`Açıklama: ${request.productDescription}`);
    }

    const productInfo = productContext.length > 0
      ? `\nÜrün Bilgileri (Sadece context için, içerikte tam isim geçirme):\n${productContext.join('\n')}\n`
      : '';

    return `Sen bir içerik yazarısın. Türkçe olarak ${postTypePrompts[request.postType] || 'genel bir içerik'} yaz.

${productInfo}
Persona: ${request.persona}

Lütfen şunları hazırla:
1. İlgi çekici bir başlık (maksimum 100 karakter, doğal ve samimi)
2. 1-2 paragraf uzunluğunda, doğal ve akıcı bir içerik metni (150-300 kelime arası)

KRİTİK KURALLAR:
- Ürün ismini içerikte tam olarak geçirme, sadece context olarak kullan
- "Muhteşem", "harika" gibi aşırı pozitif ifadelerden kaçın
- "İşimi gördü", "beklentimin üzerindeydi", "kurulumu zordu" gibi gerçekçi ifadeler kullan
- Persona'nın bakış açısını yansıt
- Doğal, samimi ve akıcı bir dil kullan
- Türkçe dilbilgisi ve yazım kurallarına uy

Sadece başlık ve içerik metnini döndür. Format:
BAŞLIK: [başlık buraya]
İÇERİK: [içerik metni buraya]`.trim();
  }

  /**
   * Post içeriği yanıtını parse et
   */
  private parsePostContentResponse(text: string): { title: string; body: string } {
    try {
      // Eğer text boşsa hata fırlat
      if (!text || text.trim().length === 0) {
        throw new Error('Response metni boş');
      }

      // Başlık ve içeriği parse et - farklı formatları dene
      let titleMatch = text.match(/BAŞLIK:\s*(.+?)(?:\n|İÇERİK:)/i);
      let contentMatch = text.match(/İÇERİK:\s*(.+)/is);

      // Alternatif formatlar
      if (!titleMatch) {
        titleMatch = text.match(/^Başlık:\s*(.+?)(?:\n|İçerik:)/i);
      }
      if (!contentMatch) {
        contentMatch = text.match(/İçerik:\s*(.+)/is);
      }
      if (!contentMatch) {
        contentMatch = text.match(/İÇERİK:\s*(.+)/is);
      }

      // Eğer hala bulunamazsa, satır bazlı parse dene
      const lines = text.split('\n').filter(line => line.trim());
      
      let title = titleMatch?.[1]?.trim();
      let body = contentMatch?.[1]?.trim();

      // Eğer format bulunamazsa, ilk satırı başlık, geri kalanını body yap
      if (!title && lines.length > 0) {
        title = lines[0].substring(0, 100).trim();
      }
      if (!body && lines.length > 1) {
        body = lines.slice(1).join('\n').trim();
      }

      // Eğer hala boşsa, tüm metni body yap
      if (!body) {
        body = text.trim();
      }
      if (!title) {
        title = body.split('\n')[0]?.substring(0, 100) || 'Başlıksız İçerik';
      }

      // Son kontrol
      if (!title || !body) {
        throw new Error('Title veya body bulunamadı');
      }

      return {
        title: title.substring(0, 200), // Maksimum 200 karakter
        body: body.substring(0, 5000), // Maksimum 5000 karakter
      };
    } catch (error) {
      logger.error({
        message: 'Post içeriği yanıtı parse edilemedi',
        error: error instanceof Error ? error.message : String(error),
        rawText: text ? text.substring(0, 500) : 'BOŞ',
        textLength: text?.length || 0,
      });

      // Fallback: İlk satırı başlık, geri kalanını body yap
      if (text && text.trim().length > 0) {
        const lines = text.split('\n').filter(line => line.trim());
        return {
          title: lines[0]?.substring(0, 200) || 'Başlıksız İçerik',
          body: lines.slice(1).join('\n').substring(0, 5000) || text.substring(0, 5000),
        };
      }

      // Son çare: Boş değerler döndür
      return {
        title: 'Başlıksız İçerik',
        body: 'İçerik üretilemedi',
      };
    }
  }

  /**
   * Birden fazla post içeriğini tek bir istekte üret (batch processing)
   * Title gerektirmez, sadece body üretir
   */
  async batchGeneratePostContent(
    batchRequest: BatchGeneratePostContentRequest,
  ): Promise<BatchGeneratePostContentResponse> {
    const pipeline = new AIPipelineLogger({
      pipelineName: 'GeminiService',
      operationName: 'batchGeneratePostContent',
      totalStages: 5,
      metadata: { batchSize: batchRequest.requests.length },
    });

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        // [1/5] Rate limiting check
        if (attempt === 1) {
          await pipeline.runStage('Checking rate limit', () => this.checkRateLimit());
        } else {
          await this.checkRateLimit();
        }

        // [2/5] Batch size kontrolü
        if (attempt === 1) {
          await pipeline.runStage('Validating batch size', () => {
            const MAX_BATCH_SIZE = 10;
            if (batchRequest.requests.length > MAX_BATCH_SIZE) {
              throw new Error(
                `Batch size ${batchRequest.requests.length} çok büyük. Maksimum ${MAX_BATCH_SIZE} istek destekleniyor.`,
              );
            }
          });
        }

        // [3/5] Build batch prompt
        const prompt = attempt === 1
          ? await pipeline.runStage('Building batch prompt', () =>
              this.buildBatchPostContentPrompt(batchRequest.requests),
            )
          : this.buildBatchPostContentPrompt(batchRequest.requests);

        // [4/5] Call AI with timeout
        const batchTimeout = this.config.timeout * 2;

        logger.info(`  [AI Pipeline] Gemini API batch attempt ${attempt}/${this.config.maxRetries}...`, {
          batchSize: batchRequest.requests.length,
          attempt,
        });

        const aiResult = await (async () => {
          const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => {
              reject(new Error(`timeout: AI request timed out after ${batchTimeout}ms`));
            }, batchTimeout);
          });

          const aiPromise = (async () => {
            const result = await this.model.generateContent({
              contents: [{ role: 'user', parts: [{ text: prompt }] }],
              generationConfig: {
                temperature: 0.8,
                topP: 0.95,
                topK: 40,
                maxOutputTokens: 8000,
              },
            });

            const response = await result.response;
            let text = '';
            let candidates: Array<{
              content?: { parts?: Array<{ text?: string }> };
              finishReason?: string;
            }> = [];

            try {
              text = response.text();
            } catch {
              candidates = (
                response as unknown as {
                  candidates?: Array<{
                    content?: { parts?: Array<{ text?: string }> };
                    finishReason?: string;
                  }>;
                }
              ).candidates || [];
              if (candidates.length > 0) {
                const candidate = candidates[0];
                const content = candidate.content;
                if (content && content.parts) {
                  text = content.parts.map((part: { text?: string }) => part.text || '').join('\n');
                }
              }
            }

            if (!text || text.trim().length === 0) {
              throw new Error('AI response boş geldi');
            }

            const usageMetadata = response.usageMetadata;
            const tokensUsed = usageMetadata?.totalTokenCount || null;

            return { text, tokensUsed };
          })();

          return Promise.race([aiPromise, timeoutPromise]);
        })();

        if (attempt === 1) {
          // Stage 4 log on first attempt only (retry logs are separate)
          logger.info(`  [4/5] Calling Gemini API ✓ (${pipeline.elapsed}ms)`, {
            pipeline: 'GeminiService',
            operation: 'batchGeneratePostContent',
            stage: 4,
          });
        }

        // [5/5] Parse batch response
        const parsed = attempt === 1
          ? await pipeline.runStage('Parsing batch response', () =>
              this.parseBatchPostContentResponse(aiResult.text, batchRequest.requests.length),
            )
          : this.parseBatchPostContentResponse(aiResult.text, batchRequest.requests.length);

        const result: BatchGeneratePostContentResponse = {
          results: parsed,
          metadata: {
            tokensUsed: aiResult.tokensUsed,
            processingTimeMs: pipeline.elapsed,
            model: this.config.model,
            totalRequests: batchRequest.requests.length,
            successfulRequests: parsed.filter((r) => r.success).length,
            failedRequests: parsed.filter((r) => !r.success).length,
          },
        };

        this.metrics.recordSuccess(result.metadata.tokensUsed, result.metadata.processingTimeMs, false);
        pipeline.complete({
          tokens: result.metadata.tokensUsed,
          successful: result.metadata.successfulRequests,
          failed: result.metadata.failedRequests,
        });

        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        const errorMessage = lastError.message;

        const isRetryable =
          errorMessage.includes('timeout') ||
          errorMessage.includes('network') ||
          (errorMessage.includes('rate limit') && attempt < this.config.maxRetries);

        if (isRetryable && attempt < this.config.maxRetries) {
          const backoffMs = Math.pow(2, attempt - 1) * 1000;
          logger.warn(
            `  [AI Pipeline] batch attempt ${attempt}/${this.config.maxRetries} ✗ | ${errorMessage} | retry in ${backoffMs}ms`,
            { attempt, backoffMs, batchSize: batchRequest.requests.length },
          );
          await this.sleep(backoffMs);
          continue;
        }

        // Tüm retry'lar tükendi veya retry yapılamaz hata
        if (errorMessage.includes('rate limit')) {
          this.metrics.recordFailure('rate-limit');
        } else if (errorMessage.includes('timeout')) {
          this.metrics.recordFailure('timeout');
        } else {
          this.metrics.recordFailure('other');
        }

        pipeline.fail(errorMessage, { attempts: attempt, batchSize: batchRequest.requests.length });

        // Fallback: Her istek için boş body döndür
        const fallbackResults = batchRequest.requests.map(() => ({
          title: '',
          body: '',
          success: false,
          error: errorMessage,
        }));

        return {
          results: fallbackResults,
          metadata: {
            tokensUsed: null,
            processingTimeMs: pipeline.elapsed,
            model: this.config.model,
            totalRequests: batchRequest.requests.length,
            successfulRequests: 0,
            failedRequests: batchRequest.requests.length,
          },
        };
      }
    }

    throw lastError || new Error('Batch generation failed after all retries');
  }

  /**
   * Batch post içeriği için prompt oluştur
   */
  private buildBatchPostContentPrompt(requests: GeneratePostContentRequest[]): string {
    const postTypePrompts: Record<string, string> = {
      QUESTION: 'Bir soru formatında içerik yaz. Kullanıcı bir ürün hakkında soru soruyor gibi görünsün.',
      TIPS: 'Bir ipucu veya tavsiye formatında içerik yaz. Kullanıcı deneyimlerinden yola çıkarak pratik öneriler sunuyor gibi görünsün.',
      FREE: 'Genel bilgilendirici bir içerik yaz. Kullanıcı ürün hakkında bilgi paylaşıyor gibi görünsün.',
      EXPERIENCE: 'Bir deneyim paylaşımı formatında içerik yaz. Kullanıcı ürünü kullanma deneyimini anlatıyor gibi görünsün.',
      COMPARE: 'Bir karşılaştırma formatında içerik yaz. Kullanıcı ürünü başka ürünlerle karşılaştırıyor gibi görünsün.',
      UPDATE: 'Bir güncelleme veya haber formatında içerik yaz. Kullanıcı ürün hakkında güncel bilgi paylaşıyor gibi görünsün.',
    };

    // Her istek için context oluştur
    const requestContexts = requests.map((req, index) => {
      const productContext = [];
      if (req.productName) {
        productContext.push(`Ürün: ${req.productName}`);
      }
      if (req.productBrand) {
        productContext.push(`Marka: ${req.productBrand}`);
      }
      if (req.productDescription) {
        productContext.push(`Açıklama: ${req.productDescription.substring(0, 200)}`); // Kısa tut
      }

      const productInfo = productContext.length > 0
        ? `\n${productContext.join('\n')}`
        : '';

      return `
İSTEK ${index + 1}:
Post Tipi: ${req.postType}
${postTypePrompts[req.postType] || 'Genel içerik'}
Persona: ${req.persona}
${productInfo}
`.trim();
    });

    return `Sen bir içerik yazarısın. Aşağıdaki ${requests.length} farklı post için sadece içerik metni (body) üret. BAŞLIK GEREKMİYOR, sadece içerik metni yaz.

KRİTİK KURALLAR:
- Her istek için 1-2 paragraf uzunluğunda, doğal ve akıcı bir içerik metni (150-300 kelime arası)
- Ürün ismini içerikte tam olarak geçirme, sadece context olarak kullan
- "Muhteşem", "harika" gibi aşırı pozitif ifadelerden kaçın
- "İşimi gördü", "beklentimin üzerindeydi", "kurulumu zordu" gibi gerçekçi ifadeler kullan
- Persona'nın bakış açısını yansıt
- Doğal, samimi ve akıcı bir dil kullan
- Türkçe dilbilgisi ve yazım kurallarına uy

${requestContexts.join('\n\n---\n\n')}

Lütfen her istek için sadece içerik metnini döndür. Format:
İSTEK 1:
İÇERİK: [içerik metni buraya]

İSTEK 2:
İÇERİK: [içerik metni buraya]

...

Her istek için ayrı bir İÇERİK bloğu oluştur. Toplam ${requests.length} adet içerik üretmelisin.`.trim();
  }

  /**
   * Batch post içeriği yanıtını parse et
   */
  private parseBatchPostContentResponse(text: string, expectedCount: number): Array<{
    title: string;
    body: string;
    success: boolean;
    error?: string;
  }> {
    const results: Array<{
      title: string;
      body: string;
      success: boolean;
      error?: string;
    }> = [];

    try {
      // Her istek için içeriği ayır
      const requestPattern = /İSTEK\s+(\d+):\s*\n?İÇERİK:\s*([\s\S]*?)(?=\n\n?İSTEK\s+\d+:|$)/gi;
      const matches = Array.from(text.matchAll(requestPattern));

      // Eşleşmeleri index'e göre sırala
      const sortedMatches = matches.sort((a, b) => parseInt(a[1]) - parseInt(b[1]));

      // Her eşleşme için result oluştur
      for (let i = 0; i < expectedCount; i++) {
        const match = sortedMatches[i];
        
        if (match && match[2]) {
          const body = match[2].trim();
          if (body.length > 0) {
            results.push({
              title: '', // Title gerekmeyecek
              body: body.substring(0, 5000), // Maksimum 5000 karakter
              success: true,
            });
          } else {
            results.push({
              title: '',
              body: '',
              success: false,
              error: 'İçerik boş',
            });
          }
        } else {
          // Eşleşme bulunamadı, alternatif parse dene
          // Tüm metni satırlara böl ve her istek için bir bölüm bul
          const lines = text.split('\n');
          const startIndex = i * Math.floor(lines.length / expectedCount);
          const endIndex = (i + 1) * Math.floor(lines.length / expectedCount);
          const section = lines.slice(startIndex, endIndex).join('\n').trim();
          
          // İÇERİK: etiketini kaldır
          const body = section.replace(/İÇERİK:\s*/i, '').trim();
          
          if (body.length > 0) {
            results.push({
              title: '',
              body: body.substring(0, 5000),
              success: true,
            });
          } else {
            results.push({
              title: '',
              body: '',
              success: false,
              error: 'İçerik parse edilemedi',
            });
          }
        }
      }

      // Eğer hala eksikse, kalanları boş ekle
      while (results.length < expectedCount) {
        results.push({
          title: '',
          body: '',
          success: false,
          error: 'İçerik üretilemedi',
        });
      }

      return results;
    } catch (error) {
      logger.error({
        message: 'Batch post içeriği yanıtı parse edilemedi',
        error: error instanceof Error ? error.message : String(error),
        rawText: text ? text.substring(0, 1000) : 'BOŞ',
        expectedCount,
      });

      // Hata durumunda tüm sonuçları boş döndür
      return Array(expectedCount).fill(null).map(() => ({
        title: '',
        body: '',
        success: false,
        error: 'Parse hatası',
      }));
    }
  }

  /**
   * Generate raw text content from a prompt.
   * Lightweight method for simple AI tasks like keyword matching.
   */
  async generateRawContent(prompt: string): Promise<string> {
    await this.checkRateLimit();

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`timeout: AI request timed out after ${this.config.timeout}ms`));
      }, this.config.timeout);
    });

    const aiPromise = (async () => {
      const result = await this.model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 100,
        },
      });
      const response = await result.response;
      return response.text();
    })();

    return Promise.race([aiPromise, timeoutPromise]);
  }
}


