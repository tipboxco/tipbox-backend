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
 *     CreatePostRequest:
 *       type: object
 *       required:
 *         - contextType
 *         - contextId
 *         - description
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
 *     CreateUpdatePostRequest:
 *       type: object
 *       required:
 *         - contextType
 *         - contextId
 *         - content
 *       properties:
 *         contextType:
 *           $ref: '#/components/schemas/ContextType'
 *         contextId:
 *           type: string
 *         content:
 *           type: string
 *         images:
 *           type: array
 *           items:
 *             type: string
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
 *         rating:
 *           type: number
 *           minimum: 0
 *           maximum: 5
 *         placeholder:
 *           type: string
 *           description: Kategori boşsa, kullanıcıya gösterilecek ipucu metni
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
  contextId: string;
  description: string;
  images?: string[];
}

export interface CreateTipsAndTricksPostRequest {
  contextType: ContextType;
  contextId: string;
  description: string;
  benefitCategory: TipsAndTricksBenefitCategory;
  images?: string[];
}

export interface BoostOption {
  id: string;
  image: string;
  title: string;
  description: string;
  amount: number;
  isPopular: boolean;
}

export interface CreateQuestionPostRequest {
  contextType: ContextType;
  contextId: string;
  description: string;
  images?: string[];
  selectedBoostOptionId: string;
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
}

export interface Experience {
  type: ExperienceType;
  content: string;
  rating: number;
}

export interface CreateExperiencePostRequest {
  contextType: ContextType;
  contextId: string;
  selectedDurationId: string;
  selectedLocationId: string;
  selectedPurposeId: string;
  content: string;
  experience: Experience[];
  status: ExperienceStatus;
  images?: string[];
  aiSplitId?: string; // AI split sonucunun ID'si (optional)
}

export interface CreateUpdatePostRequest {
  contextType: ContextType;
  contextId: string;
  content: string;
  images?: string[];
}

export interface SplitExperienceRequest {
  userId: string;
  productId: string;
  content: string;
}

export interface ExperienceCategory {
  content: string;
  rating: number;
  placeholder?: string;
}

export interface SplitExperienceResponse {
  priceAndShopping: ExperienceCategory | null;
  productAndUsage: ExperienceCategory | null;
  metadata: {
    tokensUsed: number | null;
    processingTimeMs: number;
    model: string;
    promptVersion: string;
  };
}

