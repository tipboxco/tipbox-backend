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
    isEnhanced?: boolean;
  } | null;
  productAndUsage: {
    content: string;
    rating: number;
    placeholder?: string;
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
          promptVersion: 'v2.1'
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
        const placeholder = parsed.priceAndShopping.placeholder 
          ? String(parsed.priceAndShopping.placeholder).trim() 
          : undefined;
        
        result.priceAndShopping = {
          content,
          rating: this.normalizeRating(parsed.priceAndShopping.rating),
          placeholder, // AI'ın ürettiği placeholder (varsa)
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
        const placeholder = parsed.productAndUsage.placeholder 
          ? String(parsed.productAndUsage.placeholder).trim() 
          : undefined;
        
        result.productAndUsage = {
          content,
          rating: this.normalizeRating(parsed.productAndUsage.rating),
          placeholder, // AI'ın ürettiği placeholder (varsa)
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


