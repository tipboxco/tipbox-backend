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
    placeholder?: string;
  } | null;
  productAndUsage: {
    content: string;
    rating: number;
    placeholder?: string;
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

      // Token bilgisini al
      const usageMetadata = response.usageMetadata;
      const tokensUsed = usageMetadata?.totalTokenCount || null;

      const parsedResponse = this.parseSplitExperienceResponse(text);

      const duration = Date.now() - startTime;
      
      // Metadata ekle
      const responseWithMetadata: SplitExperienceResponse = {
        ...parsedResponse,
        metadata: {
          tokensUsed,
          processingTimeMs: duration,
          model: this.config.model,
          promptVersion: 'v2.0'
        }
      };

      logger.info({
        message: 'Gemini AI deneyim ayrıştırması başarılı',
        productName: request.productName,
        duration: `${duration}ms`,
        tokensUsed,
        hasPriceAndShopping: !!parsedResponse.priceAndShopping,
        hasProductAndUsage: !!parsedResponse.productAndUsage,
      });

      return responseWithMetadata;
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

KRİTİK KURALLAR:
- Metni dikkatlice oku ve SADECE ilgili kategoriye ait bilgileri ayır
- Aynı metni her iki kategoriye de KOPYALAMA - bu kesinlikle yasak!
- Eğer metin sadece bir kategoriye aitse, diğer kategoriyi mutlaka null yap
- Eğer metin çok kısa ve belirsizse, metni en uygun kategoriye koy, diğerini null yap
- Her kategori için 1-5 arası bir rating (derecelendirme) ver
- Metni olduğu gibi koru, sadece kategorilere ayır (yeniden yazma)
- Türkçe dilbilgisi ve yazım kurallarına dikkat et

ÖRNEKLER:

Örnek 1 - Sadece Fiyat:
Girdi: "Çok pahalı buldum, 18.000 TL verdim."
Çıktı:
\`\`\`json
{
  "priceAndShopping": {
    "content": "Çok pahalı buldum, 18.000 TL verdim.",
    "rating": 2
  },
  "productAndUsage": null
}
\`\`\`

Örnek 2 - Sadece Ürün:
Girdi: "Pil ömrü kötü."
Çıktı:
\`\`\`json
{
  "priceAndShopping": null,
  "productAndUsage": {
    "content": "Pil ömrü kötü.",
    "rating": 2
  }
}
\`\`\`

Örnek 3 - Karışık Uzun Metin:
Girdi: "Dyson'dan 949 TL'ye aldım. Teslimat hızlıydı. Ürün çok iyi, lazer teknolojisi harika. Pil ömrü 60 dakika."
Çıktı:
\`\`\`json
{
  "priceAndShopping": {
    "content": "Dyson'dan 949 TL'ye aldım. Teslimat hızlıydı.",
    "rating": 5
  },
  "productAndUsage": {
    "content": "Ürün çok iyi, lazer teknolojisi harika. Pil ömrü 60 dakika.",
    "rating": 5
  }
}
\`\`\`

Lütfen aşağıdaki JSON formatında yanıt ver:

\`\`\`json
{
  "priceAndShopping": {
    "content": "...",
    "rating": 1-5
  } | null,
  "productAndUsage": {
    "content": "...",
    "rating": 1-5
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

      // Placeholder metinleri
      const placeholders = {
        priceAndShopping: 'Ürünün fiyatı, teslimat süreci veya satın alma deneyiminiz hakkında bilgi ekleyin...',
        productAndUsage: 'Ürünün performansı, kullanım deneyimi veya özellikler hakkında bilgi ekleyin...',
      };

      if (parsed.priceAndShopping && typeof parsed.priceAndShopping === 'object') {
        const content = String(parsed.priceAndShopping.content || '').trim();
        result.priceAndShopping = {
          content,
          rating: this.normalizeRating(parsed.priceAndShopping.rating),
        };
      } else {
        // Boş kategori - placeholder ekle
        result.priceAndShopping = {
          content: '',
          rating: 0,
          placeholder: placeholders.priceAndShopping,
        };
      }

      if (parsed.productAndUsage && typeof parsed.productAndUsage === 'object') {
        const content = String(parsed.productAndUsage.content || '').trim();
        result.productAndUsage = {
          content,
          rating: this.normalizeRating(parsed.productAndUsage.rating),
        };
      } else {
        // Boş kategori - placeholder ekle
        result.productAndUsage = {
          content: '',
          rating: 0,
          placeholder: placeholders.productAndUsage,
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

