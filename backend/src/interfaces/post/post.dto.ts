import { ContextType } from '../../domain/content/context-type.enum';
import { TipsAndTricksBenefitCategory } from '../../domain/content/tips-and-tricks-benefit-category.enum';
import { ExperienceType } from '../../domain/content/experience-type.enum';
import { ExperienceStatus } from '../../domain/content/experience-status.enum';

/**
 * @openapi
 * components:
 *   schemas:
 *     ContextType:
 *       type: string
 *       enum: [product_group, product, sub_category]
 *     TipsAndTricksBenefitCategory:
 *       type: string
 *       enum: [time_saving, energy_efficiency, durability, better_result]
 *     ExperienceType:
 *       type: string
 *       enum: [price_and_shopping, product_and_usage]
 *     ExperienceStatus:
 *       type: string
 *       enum: [own, tested]
 *     ProductStatus:
 *       type: string
 *       enum: [own, tried]
 *     CreatePostRequest:
 *       type: object
 *       required:
 *         - contextType
 *         - contextId
 *       properties:
 *         contextType:
 *           $ref: '#/components/schemas/ContextType'
 *         contextId:
 *           type: string
 *         description:
 *           type: string
 *           description: Post description (deprecated, use 'body' instead)
 *         body:
 *           type: string
 *           maxLength: 2000
 *           description: Post content/body (preferred field)
 *         title:
 *           type: string
 *           description: Optional post title
 *         images:
 *           type: array
 *           items:
 *             type: string
 *         eventId:
 *           type: string
 *           description: Optional event ID to link post to event
 *           example: "01ARZ3NDEKTSV4RRFFQ69G5FAV"
 *         productStatus:
 *           $ref: '#/components/schemas/ProductStatus'
 *           description: (Roasts) Product status for the event post
 *     CreateTipsAndTricksPostRequest:
 *       type: object
 *       required:
 *         - contextType
 *         - contextId
 *         - description
 *         - benefitCategory
 *       properties:
 *         contextType:
 *           $ref: '#/components/schemas/ContextType'
 *         contextId:
 *           type: string
 *         description:
 *           type: string
 *         benefitCategory:
 *           $ref: '#/components/schemas/TipsAndTricksBenefitCategory'
 *         images:
 *           type: array
 *           items:
 *             type: string
 *         eventId:
 *           type: string
 *           description: Optional event ID to link post to event
 *     BoostOption:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         image:
 *           type: string
 *         title:
 *           type: string
 *         description:
 *           type: string
 *         amount:
 *           type: number
 *         isPopular:
 *           type: boolean
 *     CreateQuestionPostRequest:
 *       type: object
 *       required:
 *         - contextType
 *         - contextId
 *         - description
 *         - selectedBoostOptionId
 *       properties:
 *         contextType:
 *           $ref: '#/components/schemas/ContextType'
 *         contextId:
 *           type: string
 *         description:
 *           type: string
 *         images:
 *           type: array
 *           items:
 *             type: string
 *         selectedBoostOptionId:
 *           type: string
 *         eventId:
 *           type: string
 *           description: Optional event ID to link post to event
 *     Product:
 *       type: object
 *       required:
 *         - productId
 *         - isSelected
 *       properties:
 *         productId:
 *           type: string
 *         isSelected:
 *           type: boolean
 *     CreateBenchmarkPostRequest:
 *       type: object
 *       required:
 *         - contextType
 *         - contextId
 *         - products
 *         - description
 *       properties:
 *         contextType:
 *           $ref: '#/components/schemas/ContextType'
 *         contextId:
 *           type: string
 *         products:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Product'
 *         description:
 *           type: string
 *         images:
 *           type: array
 *           items:
 *             type: string
 *         eventId:
 *           type: string
 *           description: Optional event ID to link post to event
 *     Experience:
 *       type: object
 *       required:
 *         - type
 *         - content
 *         - rating
 *       properties:
 *         type:
 *           $ref: '#/components/schemas/ExperienceType'
 *         content:
 *           type: string
 *         rating:
 *           type: number
 *           minimum: 1
 *           maximum: 5
 *     CreateExperiencePostRequest:
 *       type: object
 *       required:
 *         - contextType
 *         - contextId
 *         - selectedDurationId
 *         - selectedLocationId
 *         - selectedPurposeId
 *         - content
 *         - experience
 *         - status
 *       properties:
 *         contextType:
 *           $ref: '#/components/schemas/ContextType'
 *         contextId:
 *           type: string
 *         selectedDurationId:
 *           type: string
 *         selectedLocationId:
 *           type: string
 *         selectedPurposeId:
 *           type: string
 *         content:
 *           type: string
 *         experience:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Experience'
 *         status:
 *           $ref: '#/components/schemas/ExperienceStatus'
 *         images:
 *           type: array
 *           items:
 *             type: string
 *         eventId:
 *           type: string
 *           description: Optional event ID to link post to event
 *     CreateUpdatePostRequest:
 *       type: object
 *       required:
 *         - experiencePostId
 *         - content
 *       properties:
 *         experiencePostId:
 *           type: string
 *           description: Experience post ID (ULID/UUID) that this update is related to
 *         content:
 *           type: string
 *           description: Update post content
 *         contextType:
 *           $ref: '#/components/schemas/ContextType'
 *           description: Optional, always normalized to PRODUCT for update posts
 *         contextId:
 *           type: string
 *           description: Optional product ID, derived from experience post if not provided
 *         images:
 *           type: array
 *           items:
 *             type: string
 *           description: Optional image URLs (max 10)
 *         eventId:
 *           type: string
 *           description: Optional event ID to link post to event
 *     SplitExperienceRequest:
 *       type: object
 *       required:
 *         - productId
 *         - content
 *       properties:
 *         productId:
 *           type: string
 *         content:
 *           type: string
 *     ExperienceCategory:
 *       type: object
 *       properties:
 *         content:
 *           type: string
 *           description: Kategori içeriği (AI tarafından standartlaştırılmış)
 *         rating:
 *           type: number
 *           minimum: 0
 *           maximum: 5
 *           description: Deneyim puanı (0-5 arası)
 *         placeholder:
 *           type: string
 *           description: Kategori boş veya eksikse, kullanıcıya gösterilecek ipucu metni (AI tarafından dinamik üretilir)
 *         isEnhanced:
 *           type: boolean
 *           description: İçeriğin AI tarafından iyileştirilip iyileştirilmediği
 *     SplitExperienceResponse:
 *       type: object
 *       properties:
 *         priceAndShopping:
 *           oneOf:
 *             - $ref: '#/components/schemas/ExperienceCategory'
 *             - type: 'null'
 *         productAndUsage:
 *           oneOf:
 *             - $ref: '#/components/schemas/ExperienceCategory'
 *             - type: 'null'
 *         metadata:
 *           type: object
 *           properties:
 *             tokensUsed:
 *               type: number
 *               nullable: true
 *             processingTimeMs:
 *               type: number
 *             model:
 *               type: string
 *             promptVersion:
 *               type: string
 */

export interface CreatePostRequest {
  contextType: ContextType;
  contextId: string; // Can be productId OR inventoryId (will be resolved in service)
  inventoryId?: string; // ✅ YENİ: If provided, productId will be fetched from inventory
  description?: string; // Optional for backward compatibility
  body?: string; // New field for event posts
  title?: string; // Optional title field
  images?: string[];
  eventId?: string; // Optional event ID to link post to event
  productStatus?: 'own' | 'tried'; // ✅ YENİ: Roast event post product status
}

export interface CreateTipsAndTricksPostRequest {
  contextType: ContextType;
  contextId: string;
  description: string;
  benefitCategory: TipsAndTricksBenefitCategory;
  images?: string[];
  eventId?: string; // Optional event ID to link post to event
}

export interface BoostOption {
  id: string;
  image: string;
  title: string;
  description: string;
  amount: number;
  isPopular: boolean;
}

/** GET /posts/boost-price response: single TIPS price for boosting a question post */
export interface GetBoostPriceResponse {
  price: number;
  currency: string;
  factors?: {
    onlineUsers?: number;
    activityLevel?: string;
    timeOfDay?: string;
  };
}

export interface CreateQuestionPostRequest {
  contextType: ContextType;
  contextId: string;
  description: string;
  images?: string[];
  /** When true, post is boosted and TIPS are deducted at current boost price */
  boostEnabled?: boolean;
  /** Optional: legacy boost option ID; when boostEnabled is used, this is not required */
  selectedBoostOptionId?: string;
  eventId?: string; // Optional event ID to link post to event
}

export interface Product {
  productId: string;
  isSelected: boolean;
}

export interface CreateBenchmarkPostRequest {
  contextType: ContextType;
  contextId: string;
  products: Product[];
  description: string;
  choiceProductId?: string; // Product the user picked as their choice/winner
  images?: string[]; // Images support for benchmark posts
  eventId?: string; // Optional event ID to link post to event
}

export interface Experience {
  type: ExperienceType;
  content: string;
  rating: number;
}

export interface CreateExperiencePostRequest {
  contextType: ContextType;
  contextId: string;
  productId?: string; // Optional: When contextType is sub_category/product_group, specify the product
  selectedDurationId: string | null; // Resolved UUID or null if lookup fails
  selectedLocationId: string | null; // Resolved UUID or null if lookup fails
  selectedPurposeId: string | null; // Resolved UUID or null if lookup fails
  content: string;
  experience: Experience[];
  status: ExperienceStatus;
  images?: string[];
  // Tags = duration, location, purpose seçimlerinden türetilir (request'te ayrı tags yok)
  experienceSnippetId: string; // Experience snippet ID (zorunlu)
  eventId?: string; // Optional event ID to link post to event
}

export interface CreateUpdatePostRequest {
  contextType?: ContextType; // Optional, default PRODUCT. Medusa: tek category tablosu ile category/subcategory/product group aynı yapıda.
  contextId?: string; // Optional. Boşsa experience post'taki productId kullanılır (Medusa'da zorunlu değil).
  experiencePostId: string; // Experience post ID that this update is related to
  content: string;
  images?: string[];
  eventId?: string; // Optional event ID to link post to event
}

export interface SplitExperienceRequest {
  userId: string;
  productId: string;
  content: string;
}

export interface ExperienceCategory {
  content: string;
  rating: number;
  placeholder?: string | null;
  isEnhanced?: boolean;
}

export interface SplitExperienceResponse {
  experienceSnippetId: string;
  priceAndShopping: ExperienceCategory | null;
  productAndUsage: ExperienceCategory | null;
  metadata: {
    tokensUsed: number | null;
    processingTimeMs: number;
    model: string;
    promptVersion: string;
  };
}

