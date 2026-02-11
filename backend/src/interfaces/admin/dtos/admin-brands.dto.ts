/* ========== Brands ========== */

export type AdminBrandStatsResponse = {
  total: number;
  totalFollowers: number;
  activeSurveys: number;
  mostPopular: {
    brandId: string;
    brandName: string;
    followerCount: number;
  }[];
};

export type AdminBrandListItem = {
  id: string;
  name: string;
  description: string | null;
  logoUrl: string | null;
  category: string | null;
  categoryId: string | null;
  categoryName: string | null;
  isPopular: boolean | null;
  rank: number | null;
  followerCount: number;
  postCount: number;
  createdAt: string;
};

export type AdminBrandDetailResponse = AdminBrandListItem & {
  updatedAt: string;
  imageUrl: string | null;
  bannerUrl: string | null;
  externalId: string | null;
  tags: unknown;
  recentFollowers: {
    userId: string;
    username: string | null;
    followedAt: string;
  }[];
  recentPosts: {
    id: string;
    userId: string;
    username: string | null;
    createdAt: string;
  }[];
};

/* ========== Brand Categories ========== */

export type AdminBrandCategoryListItem = {
  id: string;
  name: string;
  imageUrl: string | null;
  categoryId: string | null;
  categoryName: string | null;
  brandCount: number;
  createdAt: string;
};

export type AdminBrandCategoryDetailResponse = AdminBrandCategoryListItem & {
  updatedAt: string;
};

/* ========== Brand Surveys ========== */

export type AdminBrandSurveyStatsResponse = {
  total: number;
  active: number;
  totalResponses: number;
  avgResponseRate: number;
  endingSoon: {
    surveyId: string;
    title: string;
    brandName: string;
    endsAt: string;
  }[];
};

export type AdminBrandSurveyListItem = {
  id: string;
  brandId: string;
  brandName: string;
  title: string;
  description: string | null;
  startsAt: string;
  endsAt: string;
  status: string; // ACTIVE | UPCOMING | ENDED
  questionCount: number;
  responseCount: number;
  createdAt: string;
};

export type AdminBrandSurveyDetailResponse = AdminBrandSurveyListItem & {
  updatedAt: string;
  questions: {
    id: string;
    questionText: string;
    type: string;
    answerCount: number;
  }[];
};

export type AdminBrandSurveyResponsesResponse = {
  surveyId: string;
  surveyTitle: string;
  totalResponses: number;
  questions: {
    id: string;
    questionText: string;
    type: string;
    answers: {
      id: string;
      userId: string;
      username: string | null;
      answerText: string;
      createdAt: string;
    }[];
  }[];
};

/* ========== Input Types (inferred from schemas) ========== */

import type {
  AdminCreateBrandSchema,
  AdminUpdateBrandSchema,
  AdminCreateBrandCategorySchema,
  AdminUpdateBrandCategorySchema,
  AdminCreateBrandSurveySchema,
  AdminUpdateBrandSurveySchema,
} from '../schemas/admin-brands.schemas';
import type { z } from 'zod';

export type AdminCreateBrandInput = z.infer<typeof AdminCreateBrandSchema>;
export type AdminUpdateBrandInput = z.infer<typeof AdminUpdateBrandSchema>;
export type AdminCreateBrandCategoryInput = z.infer<typeof AdminCreateBrandCategorySchema>;
export type AdminUpdateBrandCategoryInput = z.infer<typeof AdminUpdateBrandCategorySchema>;
export type AdminCreateBrandSurveyInput = z.infer<typeof AdminCreateBrandSurveySchema>;
export type AdminUpdateBrandSurveyInput = z.infer<typeof AdminUpdateBrandSurveySchema>;
