import { GoogleGenerativeAI } from '@google/generative-ai';
import { getGeminiConfig } from '../config/gemini.config';
import logger from '../logger/logger';
import { ExternalServiceError } from '../errors/custom-errors';

export interface SplitExperienceRequest {
  productName: string;
  productBrand?: string;
  productDescription?: string;
  experienceText: string;
}

export interface SplitExperienceResponse {
  priceAndShopping: {
    content: string;
    rating: number;
  } | null;
  productAndUsage: {
    content: string;
    rating: number;
  } | null;
}

export class GeminiService {
  private static instance: GeminiService;
  private genAI: GoogleGenerativeAI;
  private model: any;
  private config: ReturnType<typeof getGeminiConfig>;

  private constructor() {
    this.config = getGeminiConfig();
    this.genAI = new GoogleGenerativeAI(this.config.apiKey);
    this.model = this.genAI.getGenerativeModel({ model: this.config.model });
  }

  public static getInstance(): GeminiService {
    if (!GeminiService.instance) {
      GeminiService.instance = new GeminiService();
    }
    return GeminiService.instance;
  }

  /**
   * Kullanıcının deneyim metnini Gemini AI ile iki kategoriye ayır:
   * 1. Price and Shopping Experience (Fiyat ve Alışveriş Deneyimi)
   * 2. Product and Usage Experience (Ürün ve Kullanım Deneyimi)
   */
  async splitExperience(request: SplitExperienceRequest): Promise<SplitExperienceResponse> {
    const startTime = Date.now();

    try {
      const prompt = this.buildSplitExperiencePrompt(request);

      logger.info({
        message: 'Gemini API isteği gönderiliyor',
        productName: request.productName,
        experienceLength: request.experienceText.length,
      });

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      const parsedResponse = this.parseSplitExperienceResponse(text);

      const duration = Date.now() - startTime;
      logger.info({
        message: 'Gemini AI deneyim ayrıştırması başarılı',
        productName: request.productName,
        duration: `${duration}ms`,
        hasPriceAndShopping: !!parsedResponse.priceAndShopping,
        hasProductAndUsage: !!parsedResponse.productAndUsage,
      });

      return parsedResponse;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      // Detaylı hata bilgisi
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      
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
        throw new ExternalServiceError('Gemini API rate limit aşıldı');
      } else if (errorMessage.includes('network') || errorMessage.includes('timeout')) {
        throw new ExternalServiceError('Gemini API\'ye bağlanılamadı');
      }

      throw new ExternalServiceError(`AI servisi hatası: ${errorMessage}`);
    }
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
Bir kullanıcının ürün deneyimi metni var. Bu metni analiz edip iki kategoriye ayırman gerekiyor:

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

ÖNEMLI KURALLAR:
- Metni dikkatlice oku ve ilgili kategorilere ayır
- Her kategori için 1-5 arası bir rating (derecelendirme) ver
- Eğer metinde bir kategoriye ait bilgi yoksa, o kategoriyi null olarak döndür
- Metni olduğu gibi koru, sadece kategorilere ayır (yeniden yazma)
- Türkçe dilbilgisi ve yazım kurallarına dikkat et

Lütfen aşağıdaki JSON formatında yanıt ver:

\`\`\`json
{
  "priceAndShopping": {
    "content": "Fiyat ve alışveriş deneyimi metni buraya...",
    "rating": 4
  },
  "productAndUsage": {
    "content": "Ürün ve kullanım deneyimi metni buraya...",
    "rating": 5
  }
}
\`\`\`

Eğer bir kategori yoksa:
\`\`\`json
{
  "priceAndShopping": null,
  "productAndUsage": {
    "content": "...",
    "rating": 5
  }
}
\`\`\`
`.trim();
  }

  /**
   * Gemini AI yanıtını parse et
   */
  private parseSplitExperienceResponse(text: string): SplitExperienceResponse {
    try {
      // JSON kısmını çıkar (```json ... ``` formatındaysa)
      const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
      const jsonText = jsonMatch ? jsonMatch[1] : text;

      const parsed = JSON.parse(jsonText);

      // Validasyon
      const result: SplitExperienceResponse = {
        priceAndShopping: null,
        productAndUsage: null,
      };

      if (parsed.priceAndShopping && typeof parsed.priceAndShopping === 'object') {
        result.priceAndShopping = {
          content: String(parsed.priceAndShopping.content || '').trim(),
          rating: this.normalizeRating(parsed.priceAndShopping.rating),
        };
      }

      if (parsed.productAndUsage && typeof parsed.productAndUsage === 'object') {
        result.productAndUsage = {
          content: String(parsed.productAndUsage.content || '').trim(),
          rating: this.normalizeRating(parsed.productAndUsage.rating),
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

