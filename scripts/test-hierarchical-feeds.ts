/**
 * Hiyerarşik Feed Test Senaryosu
 * 
 * Electronics ve Cosmetics kategorileri altında hiyerarşik yapıda test gönderileri oluşturup
 * feed endpoint'lerini test eder.
 * 
 * Senaryo:
 * - 2 Category (Electronics, Cosmetics)
 * - 4 Sub Category (her category'de 2'şer)
 * - 8 Product Group (her sub category'de 2'şer)
 * - 16 Product (her product group'ta 2'şer)
 * 
 * Her seviyede gönderiler oluşturulur ve feed endpoint'leri test edilir.
 */

import axios, { AxiosInstance } from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';
import { S3Service } from '../src/infrastructure/s3/s3.service';
import { ListObjectsV2Command } from '@aws-sdk/client-s3';
import { s3Config } from '../src/infrastructure/config/s3.config';
import { ContextType } from '../src/domain/content/context-type.enum';
import { TipsAndTricksBenefitCategory } from '../src/domain/content/tips-and-tricks-benefit-category.enum';
import { ExperienceStatus } from '../src/domain/content/experience-status.enum';
import { v4 as uuidv4 } from 'uuid';

// FormData için try-catch (paket yüklü olmayabilir)
let FormData: any;
try {
  FormData = require('form-data');
} catch (error) {
  console.warn('⚠️  form-data paketi yüklü değil, görseller opsiyonel olacak');
  FormData = null;
}

// ==================== CONFIGURATION ====================

// Docker compose içinde backend container'ından localhost kullanılmalı
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const USER_EMAIL = 'omer@tipbox.co';
const USER_PASSWORD = 'password123';

const TEST_HIERARCHY = {
  electronics: {
    categoryId: '3968a741-6ebe-4d97-b853-62b04198c91e',
    categoryName: 'Electronics',
    subCategories: [
      {
        subCategoryId: '079262b2-a70e-494d-aa69-d2746543caec',
        subCategoryName: 'cameras',
        productGroups: [
          {
            productGroupId: '3bff32d3-2e8f-436c-b30c-70e5d59425bf',
            productGroupName: 'cameras',
            products: [
              { productId: '5b839ba6-7869-40ab-8540-8c91cfd1932e', productName: '2 In 1 Laptops' },
              { productId: '2c1bbc03-d55c-4df2-b4d2-aa34c9ad1d4d', productName: 'Acer Nitro 16' },
            ],
          },
        ],
      },
      {
        subCategoryId: '8fb311e1-9c72-4054-8f1a-4116c1c159b4',
        subCategoryName: 'drones',
        productGroups: [],
      },
    ],
  },
  cosmetics: {
    categoryId: '2ec1c38f-a3e2-4228-87a0-d6e0067ac206',
    categoryName: 'Cosmetics',
    subCategories: [
      {
        subCategoryId: 'f4e84c4d-d09a-4e41-ae40-5ad23990a4f5',
        subCategoryName: 'Bath body',
        productGroups: [
          {
            productGroupId: 'cfde64de-52ce-4c88-b57e-e129f4d6b12c',
            productGroupName: 'Bath body',
            products: [
              { productId: '00b369a7-394a-455c-a04d-58c3280db6ba', productName: 'BaBylissPRO Nano Titanium Portofino' },
              { productId: '1fe389b4-003d-4004-aabd-455fda354425', productName: 'Bath Body' },
            ],
          },
        ],
      },
      {
        subCategoryId: 'b496203a-58a6-499b-a9be-997522cae2af',
        subCategoryName: 'Facial tools',
        productGroups: [],
      },
    ],
  },
};

// ==================== TYPES ====================

interface AuthResult {
  token: string;
  userId: string;
}

interface BoostOption {
  id: string;
  title: string;
  amount: number;
}

interface ExperienceOptions {
  durations: Array<{ id: string; name: string }>;
  locations: Array<{ id: string; name: string }>;
  purposes: Array<{ id: string; name: string }>;
}

interface CreatedPost {
  id: string;
  type: string;
  contextType: ContextType;
  contextId: string;
}

interface FeedTestResult {
  endpoint: string;
  expectedCount: number;
  actualCount: number;
  success: boolean;
  items?: any[];
  error?: string;
}

interface TestSummary {
  postsCreated: {
    product: number;
    productGroup: number;
    subCategory: number;
    total: number;
  };
  testsRun: number;
  testsPassed: number;
  testsFailed: number;
  errors: string[];
}

// ==================== IMAGE HELPERS ====================

const ASSETS_BASE_DIR = path.join(__dirname, '../tests/assets');
const PRODUCT_IMAGES_DIR = path.join(ASSETS_BASE_DIR, 'product');
const APPLE_PRODUCTS_DIR = path.join(ASSETS_BASE_DIR, 'Apple_Products');

/**
 * Görsel klasörlerinden dosya listeleme
 */
function getImageFiles(category: 'electronics' | 'cosmetics'): string[] {
  const images: string[] = [];

  if (category === 'electronics') {
    // Electronic post görselleri
    for (let i = 1; i <= 10; i++) {
      const filePath = path.join(PRODUCT_IMAGES_DIR, `electronic-post-${i}.jpg`);
      if (fs.existsSync(filePath)) {
        images.push(filePath);
      }
    }
    // Apple Products görselleri
    if (fs.existsSync(APPLE_PRODUCTS_DIR)) {
      const appleFiles = fs.readdirSync(APPLE_PRODUCTS_DIR).filter((f) => f.endsWith('.png'));
      appleFiles.forEach((file) => {
        images.push(path.join(APPLE_PRODUCTS_DIR, file));
      });
    }
    // Diğer elektronik görselleri
    const otherElectronics = ['phone1.png', 'phone2.png', 'phone3.png', 'phone4.png', 'phone5.png', 'phone6.png', 'headphone.png', 'smartwatch.png', 'macbook.png'];
    otherElectronics.forEach((file) => {
      const filePath = path.join(PRODUCT_IMAGES_DIR, file);
      if (fs.existsSync(filePath)) {
        images.push(filePath);
      }
    });
  } else {
    // Makeup post görselleri
    for (let i = 1; i <= 10; i++) {
      const filePath = path.join(PRODUCT_IMAGES_DIR, `makeup-post-${i}.jpg`);
      if (fs.existsSync(filePath)) {
        images.push(filePath);
      }
    }
  }

  return images;
}

/**
 * Rastgele görsel seç
 */
function getRandomImage(category: 'electronics' | 'cosmetics'): string | null {
  const images = getImageFiles(category);
  if (images.length === 0) {
    return null;
  }
  return images[Math.floor(Math.random() * images.length)];
}

/**
 * Görsel yükleme (multipart/form-data)
 * Not: Bu script görselleri direkt olarak multipart/form-data ile gönderecek
 * FormData paketi yoksa görseller opsiyonel olacak
 */
function createFormDataWithImage(imagePath: string | null): any | null {
  if (!FormData) {
    return null; // FormData paketi yoksa görsel gönderilmez
  }

  if (!imagePath || !fs.existsSync(imagePath)) {
    return null;
  }

  try {
    const formData = new FormData();
    formData.append('images', fs.createReadStream(imagePath));
    return formData;
  } catch (error) {
    console.warn(`⚠️  Görsel yüklenemedi: ${imagePath}`);
    return null;
  }
}

// ==================== AUTHENTICATION HELPER ====================

/**
 * Login ve token alma
 */
async function authenticate(api: AxiosInstance): Promise<AuthResult> {
  try {
    const response = await api.post('/auth/login', {
      email: USER_EMAIL,
      password: USER_PASSWORD,
    });

    if (!response.data.token) {
      throw new Error('Token alınamadı');
    }

    return {
      token: response.data.token,
      userId: response.data.id || response.data.userId || '',
    };
  } catch (error: any) {
    throw new Error(`Authentication failed: ${error.message}`);
  }
}

// ==================== PRISMA & S3 SETUP ====================

const prisma = new PrismaClient();
const s3Service = new S3Service();

// ==================== MINIO HELPERS ====================

/**
 * MinIO'dan product-catalog görsellerini listeler
 */
async function listCatalogImagesFromMinIO(prefix: string = 'product-catalog/'): Promise<string[]> {
  try {
    const images: string[] = [];
    let continuationToken: string | undefined;

    do {
      const listCommand = new ListObjectsV2Command({
        Bucket: s3Config.bucketName,
        Prefix: prefix,
        ContinuationToken: continuationToken,
        MaxKeys: 1000,
      });

      const result = await (s3Service as any).s3Client.send(listCommand);

      if (result.Contents) {
        for (const obj of result.Contents) {
          if (obj.Key && (obj.Key.endsWith('.jpg') || obj.Key.endsWith('.jpeg') || obj.Key.endsWith('.png'))) {
            images.push(obj.Key);
          }
        }
      }

      continuationToken = result.NextContinuationToken;
    } while (continuationToken);

    return images;
  } catch (error: any) {
    console.warn(`⚠️  MinIO'dan görsel listesi alınamadı: ${error.message}`);
    return [];
  }
}

/**
 * MinIO'dan rastgele bir catalog görseli seçer
 */
async function getRandomCatalogImage(): Promise<string | null> {
  try {
    const images = await listCatalogImagesFromMinIO('product-catalog/');
    if (images.length === 0) {
      // Alternatif olarak product-group prefix'ini dene
      const productGroupImages = await listCatalogImagesFromMinIO('product-groups/');
      if (productGroupImages.length > 0) {
        const randomImage = productGroupImages[Math.floor(Math.random() * productGroupImages.length)];
        return s3Service.getFileUrl(randomImage);
      }
      return null;
    }
    const randomImage = images[Math.floor(Math.random() * images.length)];
    return s3Service.getFileUrl(randomImage);
  } catch (error: any) {
    console.warn(`⚠️  Rastgele görsel seçilemedi: ${error.message}`);
    return null;
  }
}

// ==================== CATALOG HELPERS ====================

/**
 * Mevcut verileri listeleme ve eksik veri tespiti
 */
async function getCatalogData(api: AxiosInstance, token: string) {
  const headers = { Authorization: `Bearer ${token}` };

  // Categories
  const categoriesRes = await api.get('/catalog/categories', { headers });
  console.log(`📋 Categories found: ${categoriesRes.data.length}`);

  // Sub categories for Electronics
  const electronicsSubCategoriesRes = await api.get(
    `/catalog/categories/${TEST_HIERARCHY.electronics.categoryId}/sub-categories`,
    { headers }
  );
  console.log(`📋 Electronics sub-categories: ${electronicsSubCategoriesRes.data.length}`);

  // Sub categories for Cosmetics
  const cosmeticsSubCategoriesRes = await api.get(
    `/catalog/categories/${TEST_HIERARCHY.cosmetics.categoryId}/sub-categories`,
    { headers }
  );
  console.log(`📋 Cosmetics sub-categories: ${cosmeticsSubCategoriesRes.data.length}`);

  // Product groups ve products kontrolü
  for (const category of [TEST_HIERARCHY.electronics, TEST_HIERARCHY.cosmetics]) {
    for (const subCategory of category.subCategories) {
      if (subCategory.productGroups.length === 0) {
        console.log(`⚠️  Sub category ${subCategory.subCategoryName} için product group bulunamadı`);
      } else {
        for (const productGroup of subCategory.productGroups) {
          const productsRes = await api.get(
            `/catalog/product-groups/${productGroup.productGroupId}/products`,
            { headers }
          );
          console.log(`📋 Product group ${productGroup.productGroupName} products: ${productsRes.data.length}`);
        }
      }
    }
  }
}

// ==================== POST CREATION HELPERS ====================

let cachedBoostOptions: BoostOption[] | null = null;
let cachedExperienceOptions: ExperienceOptions | null = null;

/**
 * Boost options alma
 */
async function getBoostOptions(api: AxiosInstance, token: string): Promise<BoostOption[]> {
  if (cachedBoostOptions && cachedBoostOptions.length > 0) {
    return cachedBoostOptions;
  }

  try {
    const response = await api.get('/posts/boost-options', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const options = response.data || [];
    cachedBoostOptions = options;
    return options;
  } catch (error: any) {
    console.warn(`⚠️  Boost options alınamadı: ${error.message}`);
    cachedBoostOptions = [];
    return [];
  }
}

/**
 * Experience options alma
 */
async function getExperienceOptions(api: AxiosInstance, token: string): Promise<ExperienceOptions> {
  if (cachedExperienceOptions && cachedExperienceOptions.durations) {
    return cachedExperienceOptions;
  }

  try {
    const response = await api.get('/posts/experience/options', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const options: ExperienceOptions = response.data || {
      durations: [],
      locations: [],
      purposes: [],
    };
    cachedExperienceOptions = options;
    return options;
  } catch (error: any) {
    console.warn(`⚠️  Experience options alınamadı: ${error.message}`);
    const defaultOptions: ExperienceOptions = {
      durations: [],
      locations: [],
      purposes: [],
    };
    cachedExperienceOptions = defaultOptions;
    return defaultOptions;
  }
}

/**
 * Free post oluştur
 */
async function createFreePost(
  api: AxiosInstance,
  token: string,
  contextType: ContextType,
  contextId: string,
  category: 'electronics' | 'cosmetics'
): Promise<CreatedPost | null> {
  try {
    const imagePath = getRandomImage(category);
    const formData = createFormDataWithImage(imagePath);

    const data: any = {
      contextType,
      contextId,
      description: `Free post for ${contextType} ${contextId}`,
    };

    let response;
    if (formData) {
      formData.append('contextType', contextType);
      formData.append('contextId', contextId);
      formData.append('description', data.description);

      response = await api.post('/posts/free', formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          ...formData.getHeaders(),
        },
      });
    } else {
      response = await api.post('/posts/free', data, {
        headers: { Authorization: `Bearer ${token}` },
      });
    }

    return {
      id: response.data.id,
      type: 'FREE',
      contextType,
      contextId,
    };
  } catch (error: any) {
    console.error(`❌ Free post oluşturulamadı: ${error.message}`);
    return null;
  }
}

/**
 * Tips post oluştur
 */
async function createTipsPost(
  api: AxiosInstance,
  token: string,
  contextType: ContextType,
  contextId: string,
  category: 'electronics' | 'cosmetics',
  benefitCategory: TipsAndTricksBenefitCategory = TipsAndTricksBenefitCategory.TIME
): Promise<CreatedPost | null> {
  try {
    const imagePath = getRandomImage(category);
    const formData = createFormDataWithImage(imagePath);

    const data: any = {
      contextType,
      contextId,
      description: `Tips post for ${contextType} ${contextId}`,
      benefitCategory,
    };

    let response;
    if (formData) {
      formData.append('contextType', contextType);
      formData.append('contextId', contextId);
      formData.append('description', data.description);
      formData.append('benefitCategory', benefitCategory);

      response = await api.post('/posts/tips-and-tricks', formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          ...formData.getHeaders(),
        },
      });
    } else {
      response = await api.post('/posts/tips-and-tricks', data, {
        headers: { Authorization: `Bearer ${token}` },
      });
    }

    return {
      id: response.data.id,
      type: 'TIPS',
      contextType,
      contextId,
    };
  } catch (error: any) {
    console.error(`❌ Tips post oluşturulamadı: ${error.message}`);
    return null;
  }
}

/**
 * Question post oluştur
 */
async function createQuestionPost(
  api: AxiosInstance,
  token: string,
  contextType: ContextType,
  contextId: string,
  category: 'electronics' | 'cosmetics',
  boostOptions: BoostOption[]
): Promise<CreatedPost | null> {
  try {
    if (boostOptions.length === 0) {
      console.warn(`⚠️  Boost option bulunamadı, question post atlanıyor`);
      return null;
    }

    const imagePath = getRandomImage(category);
    const formData = createFormDataWithImage(imagePath);

    const data: any = {
      contextType,
      contextId,
      description: `Question post for ${contextType} ${contextId}`,
      selectedBoostOptionId: boostOptions[0].id,
    };

    let response;
    if (formData) {
      formData.append('contextType', contextType);
      formData.append('contextId', contextId);
      formData.append('description', data.description);
      formData.append('selectedBoostOptionId', data.selectedBoostOptionId);

      response = await api.post('/posts/question', formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          ...formData.getHeaders(),
        },
      });
    } else {
      response = await api.post('/posts/question', data, {
        headers: { Authorization: `Bearer ${token}` },
      });
    }

    return {
      id: response.data.id,
      type: 'QUESTION',
      contextType,
      contextId,
    };
  } catch (error: any) {
    console.error(`❌ Question post oluşturulamadı: ${error.message}`);
    return null;
  }
}

/**
 * Experience post oluştur
 */
async function createExperiencePost(
  api: AxiosInstance,
  token: string,
  contextType: ContextType,
  contextId: string,
  category: 'electronics' | 'cosmetics',
  experienceOptions: ExperienceOptions
): Promise<CreatedPost | null> {
  try {
    if (contextType !== ContextType.PRODUCT) {
      console.warn(`⚠️  Experience post sadece product için oluşturulabilir`);
      return null;
    }

    const imagePath = getRandomImage(category);
    const formData = createFormDataWithImage(imagePath);

    const data: any = {
      contextType,
      contextId,
      content: `Experience post for product ${contextId}`,
      experience: [
        {
          type: 'price_and_shopping',
          content: 'Price and shopping experience',
          rating: 4,
        },
        {
          type: 'product_and_usage',
          content: 'Product and usage experience',
          rating: 5,
        },
      ],
      status: ExperienceStatus.OWN,
      selectedDurationId: experienceOptions.durations[0]?.id || null,
      selectedLocationId: experienceOptions.locations[0]?.id || null,
      selectedPurposeId: experienceOptions.purposes[0]?.id || null,
    };

    let response;
    if (formData) {
      formData.append('contextType', contextType);
      formData.append('contextId', contextId);
      formData.append('content', data.content);
      formData.append('experience', JSON.stringify(data.experience));
      formData.append('status', data.status);
      if (data.selectedDurationId) formData.append('selectedDurationId', data.selectedDurationId);
      if (data.selectedLocationId) formData.append('selectedLocationId', data.selectedLocationId);
      if (data.selectedPurposeId) formData.append('selectedPurposeId', data.selectedPurposeId);

      response = await api.post('/posts/experience', formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          ...formData.getHeaders(),
        },
      });
    } else {
      response = await api.post('/posts/experience', data, {
        headers: { Authorization: `Bearer ${token}` },
      });
    }

    return {
      id: response.data.id,
      type: 'EXPERIENCE',
      contextType,
      contextId,
    };
  } catch (error: any) {
    console.error(`❌ Experience post oluşturulamadı: ${error.message}`);
    return null;
  }
}

/**
 * Update post oluştur
 */
async function createUpdatePost(
  api: AxiosInstance,
  token: string,
  contextType: ContextType,
  contextId: string,
  category: 'electronics' | 'cosmetics'
): Promise<CreatedPost | null> {
  try {
    if (contextType !== ContextType.PRODUCT) {
      console.warn(`⚠️  Update post sadece product için oluşturulabilir`);
      return null;
    }

    const imagePath = getRandomImage(category);
    const formData = createFormDataWithImage(imagePath);

    const data: any = {
      contextType,
      contextId,
      content: `Update post for product ${contextId}`,
    };

    let response;
    if (formData) {
      formData.append('contextType', contextType);
      formData.append('contextId', contextId);
      formData.append('content', data.content);

      response = await api.post('/posts/update', formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          ...formData.getHeaders(),
        },
      });
    } else {
      response = await api.post('/posts/update', data, {
        headers: { Authorization: `Bearer ${token}` },
      });
    }

    return {
      id: response.data.id,
      type: 'UPDATE',
      contextType,
      contextId,
    };
  } catch (error: any) {
    console.error(`❌ Update post oluşturulamadı: ${error.message}`);
    return null;
  }
}

/**
 * Benchmark post oluştur
 */
async function createBenchmarkPost(
  api: AxiosInstance,
  token: string,
  contextType: ContextType,
  contextId: string,
  category: 'electronics' | 'cosmetics',
  products: Array<{ productId: string; productName: string }>
): Promise<CreatedPost | null> {
  try {
    if (contextType !== ContextType.PRODUCT) {
      console.warn(`⚠️  Benchmark post sadece product için oluşturulabilir`);
      return null;
    }

    if (products.length < 2) {
      console.warn(`⚠️  Benchmark post için en az 2 product gerekli`);
      return null;
    }

    const imagePath = getRandomImage(category);
    const formData = createFormDataWithImage(imagePath);

    const data: any = {
      contextType,
      contextId,
      description: `Benchmark post comparing products`,
      products: products.slice(0, 2).map((p) => ({
        productId: p.productId,
        isSelected: true,
      })),
    };

    let response;
    if (formData) {
      formData.append('contextType', contextType);
      formData.append('contextId', contextId);
      formData.append('description', data.description);
      formData.append('products', JSON.stringify(data.products));

      response = await api.post('/posts/benchmark', formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          ...formData.getHeaders(),
        },
      });
    } else {
      response = await api.post('/posts/benchmark', data, {
        headers: { Authorization: `Bearer ${token}` },
      });
    }

    return {
      id: response.data.id,
      type: 'BENCHMARK',
      contextType,
      contextId,
    };
  } catch (error: any) {
    console.error(`❌ Benchmark post oluşturulamadı: ${error.message}`);
    return null;
  }
}

// ==================== FEED TEST HELPERS ====================

/**
 * Product feed testi
 */
async function testProductFeed(
  api: AxiosInstance,
  token: string,
  productId: string,
  expectedCount: number
): Promise<FeedTestResult> {
  try {
    const response = await api.get(`/catalog/products/${productId}/posts`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const actualCount = response.data.items?.length || 0;
    return {
      endpoint: `/catalog/products/${productId}/posts`,
      expectedCount,
      actualCount,
      success: actualCount >= expectedCount,
      items: response.data.items,
    };
  } catch (error: any) {
    return {
      endpoint: `/catalog/products/${productId}/posts`,
      expectedCount,
      actualCount: 0,
      success: false,
      error: error.message,
    };
  }
}

/**
 * Product group feed testi
 */
async function testProductGroupFeed(
  api: AxiosInstance,
  token: string,
  productGroupId: string,
  expectedCount: number
): Promise<FeedTestResult> {
  try {
    const response = await api.get(`/catalog/product-groups/${productGroupId}/posts`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const actualCount = response.data.items?.length || 0;
    return {
      endpoint: `/catalog/product-groups/${productGroupId}/posts`,
      expectedCount,
      actualCount,
      success: actualCount >= expectedCount,
      items: response.data.items,
    };
  } catch (error: any) {
    return {
      endpoint: `/catalog/product-groups/${productGroupId}/posts`,
      expectedCount,
      actualCount: 0,
      success: false,
      error: error.message,
    };
  }
}

/**
 * Sub category feed testi
 */
async function testSubCategoryFeed(
  api: AxiosInstance,
  token: string,
  subCategoryId: string,
  expectedCount: number
): Promise<FeedTestResult> {
  try {
    const response = await api.get(`/catalog/sub-categories/${subCategoryId}/posts`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const actualCount = response.data.items?.length || 0;
    return {
      endpoint: `/catalog/sub-categories/${subCategoryId}/posts`,
      expectedCount,
      actualCount,
      success: actualCount >= expectedCount,
      items: response.data.items,
    };
  } catch (error: any) {
    return {
      endpoint: `/catalog/sub-categories/${subCategoryId}/posts`,
      expectedCount,
      actualCount: 0,
      success: false,
      error: error.message,
    };
  }
}

/**
 * Detaylı feed testleri - Tüm endpoint'leri ve filtreleri test eder
 */
async function detailedFeedTests(
  api: AxiosInstance,
  token: string,
  hierarchy: any,
  summary: TestSummary
): Promise<void> {
  console.log('🔍 DETAYLI FEED TESTLERİ BAŞLIYOR...\n');
  
  const headers = { Authorization: `Bearer ${token}` };
  
  // Her seviye için detaylı testler
  for (const category of [hierarchy.electronics, hierarchy.cosmetics]) {
    const categoryName = category.categoryName;
    console.log(`\n📂 ${categoryName.toUpperCase()} KATEGORİSİ\n${'='.repeat(60)}`);
    
    for (const subCategory of category.subCategories) {
      console.log(`\n📁 Sub Category: ${subCategory.subCategoryName} (${subCategory.subCategoryId})`);
      console.log('-'.repeat(60));
      
      // Sub Category Feed Testleri
      await testSubCategoryFeedDetailed(api, headers, subCategory, summary);
      
      // Product Group Feed Testleri
      for (const productGroup of subCategory.productGroups) {
        console.log(`\n  📦 Product Group: ${productGroup.productGroupName} (${productGroup.productGroupId})`);
        await testProductGroupFeedDetailed(api, headers, productGroup, summary);
        
        // Product Feed Testleri
        for (const product of productGroup.products) {
          console.log(`\n    🏷️  Product: ${product.productName} (${product.productId})`);
          await testProductFeedDetailed(api, headers, product, summary);
        }
      }
    }
  }
}

/**
 * Sub Category feed detaylı testi
 */
async function testSubCategoryFeedDetailed(
  api: AxiosInstance,
  headers: any,
  subCategory: any,
  summary: TestSummary
): Promise<void> {
  const subCategoryId = subCategory.subCategoryId;
  
  // 1. Tüm post'lar (FREE, TIPS, QUESTION olmalı) - limit=50 ile tüm post'ları al
  try {
    const response = await api.get(`/catalog/sub-categories/${subCategoryId}/posts?limit=50`, { headers });
    const items = response.data.items || [];
    const postTypes = items.map((item: any) => item.type || item.data?.type).filter(Boolean);
    
    // Beklenen: Sub category post'ları (3) + Product group post'ları (2 group × 3 = 6) + Product post'ları (4 product × 3 = 12) = 21
    const productGroupCount = subCategory.productGroups?.length || 0;
    const productCount = subCategory.productGroups?.reduce((sum: number, pg: any) => sum + (pg.products?.length || 0), 0) || 0;
    const expectedTotal = 3 + (productGroupCount * 3) + (productCount * 3);
    
    console.log(`  ✅ Tüm Post'lar: ${items.length}/${expectedTotal}`);
    console.log(`     Post Type Dağılımı: ${JSON.stringify(postTypes.reduce((acc: any, type: string) => {
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {}))}`);
    
    // Sadece FREE, TIPS, QUESTION olmalı
    const invalidTypes = postTypes.filter((type: string) => 
      !['post', 'tipsAndTricks', 'question'].includes(type)
    );
    if (invalidTypes.length > 0) {
      console.log(`  ⚠️  UYARI: Beklenmeyen post type'lar bulundu: ${invalidTypes.join(', ')}`);
      console.log(`     Sub category feed'inde sadece FREE, TIPS, QUESTION olmalı!`);
    }
    
    summary.testsRun++;
    if (items.length >= expectedTotal && invalidTypes.length === 0) {
      summary.testsPassed++;
    } else {
      summary.testsFailed++;
    }
  } catch (error: any) {
    console.log(`  ❌ Hata: ${error.message}`);
    summary.testsRun++;
    summary.testsFailed++;
  }
  
  // 2. Tips filtresi - limit=50 ile
  try {
    const response = await api.get(`/catalog/sub-categories/${subCategoryId}/posts?type=tips&limit=50`, { headers });
    const items = response.data.items || [];
    const productGroupCount = subCategory.productGroups?.length || 0;
    const productCount = subCategory.productGroups?.reduce((sum: number, pg: any) => sum + (pg.products?.length || 0), 0) || 0;
    const expectedTips = 1 + productGroupCount + productCount; // 1 sub + N group + N product
    
    const allTips = items.every((item: any) => 
      item.type === 'tipsAndTricks' || item.data?.type === 'TIPS'
    );
    
    console.log(`  ✅ Tips Filtresi: ${items.length}/${expectedTips} ${allTips ? '(hepsi tips)' : '(⚠️ bazıları tips değil!)'}`);
    
    summary.testsRun++;
    if (items.length >= expectedTips && allTips) {
      summary.testsPassed++;
    } else {
      summary.testsFailed++;
      if (!allTips) {
        summary.errors.push(`${subCategory.subCategoryName} tips filtresinde tips olmayan post'lar var`);
      }
    }
  } catch (error: any) {
    console.log(`  ❌ Tips Filtresi Hata: ${error.message}`);
    summary.testsRun++;
    summary.testsFailed++;
  }
  
  // 3. Question filtresi - limit=50 ile
  try {
    const response = await api.get(`/catalog/sub-categories/${subCategoryId}/posts?type=question&limit=50`, { headers });
    const items = response.data.items || [];
    const productGroupCount = subCategory.productGroups?.length || 0;
    const productCount = subCategory.productGroups?.reduce((sum: number, pg: any) => sum + (pg.products?.length || 0), 0) || 0;
    const expectedQuestion = 1 + productGroupCount + productCount;
    
    const allQuestion = items.every((item: any) => 
      item.type === 'question' || item.data?.type === 'QUESTION'
    );
    
    console.log(`  ✅ Question Filtresi: ${items.length}/${expectedQuestion} ${allQuestion ? '(hepsi question)' : '(⚠️ bazıları question değil!)'}`);
    
    summary.testsRun++;
    if (items.length >= expectedQuestion && allQuestion) {
      summary.testsPassed++;
    } else {
      summary.testsFailed++;
    }
  } catch (error: any) {
    console.log(`  ❌ Question Filtresi Hata: ${error.message}`);
    summary.testsRun++;
    summary.testsFailed++;
  }
}

/**
 * Product Group feed detaylı testi
 */
async function testProductGroupFeedDetailed(
  api: AxiosInstance,
  headers: any,
  productGroup: any,
  summary: TestSummary
): Promise<void> {
  const productGroupId = productGroup.productGroupId;
  const productCount = productGroup.products?.length || 0;
  
  // 1. Tüm post'lar (FREE, TIPS, QUESTION olmalı) - limit=50 ile
  try {
    const response = await api.get(`/catalog/product-groups/${productGroupId}/posts?limit=50`, { headers });
    const items = response.data.items || [];
    const postTypes = items.map((item: any) => item.type || item.data?.type).filter(Boolean);
    
    // Beklenen: Product group post'ları (3) + Product post'ları (N product × 3 = 3N)
    const expectedTotal = 3 + (productCount * 3);
    
    console.log(`    ✅ Tüm Post'lar: ${items.length}/${expectedTotal}`);
    console.log(`       Post Type Dağılımı: ${JSON.stringify(postTypes.reduce((acc: any, type: string) => {
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {}))}`);
    
    // Sadece FREE, TIPS, QUESTION olmalı
    const invalidTypes = postTypes.filter((type: string) => 
      !['post', 'tipsAndTricks', 'question'].includes(type)
    );
    if (invalidTypes.length > 0) {
      console.log(`    ⚠️  UYARI: Beklenmeyen post type'lar bulundu: ${invalidTypes.join(', ')}`);
      console.log(`       Product group feed'inde sadece FREE, TIPS, QUESTION olmalı!`);
    }
    
    summary.testsRun++;
    if (items.length >= expectedTotal && invalidTypes.length === 0) {
      summary.testsPassed++;
    } else {
      summary.testsFailed++;
    }
  } catch (error: any) {
    console.log(`    ❌ Hata: ${error.message}`);
    summary.testsRun++;
    summary.testsFailed++;
  }
  
  // 2. Tips filtresi - limit=50 ile
  try {
    const response = await api.get(`/catalog/product-groups/${productGroupId}/posts?type=tips&limit=50`, { headers });
    const items = response.data.items || [];
    const expectedTips = 1 + productCount; // 1 group + N product
    
    const allTips = items.every((item: any) => 
      item.type === 'tipsAndTricks' || item.data?.type === 'TIPS'
    );
    
    console.log(`    ✅ Tips Filtresi: ${items.length}/${expectedTips} ${allTips ? '(hepsi tips)' : '(⚠️ bazıları tips değil!)'}`);
    
    summary.testsRun++;
    if (items.length >= expectedTips && allTips) {
      summary.testsPassed++;
    } else {
      summary.testsFailed++;
    }
  } catch (error: any) {
    console.log(`    ❌ Tips Filtresi Hata: ${error.message}`);
    summary.testsRun++;
    summary.testsFailed++;
  }
}

/**
 * Product feed detaylı testi
 */
async function testProductFeedDetailed(
  api: AxiosInstance,
  headers: any,
  product: any,
  summary: TestSummary
): Promise<void> {
  const productId = product.productId;
  
  // 1. Tüm post'lar (6 tip olmalı: FREE, TIPS, QUESTION, EXPERIENCE, UPDATE, BENCHMARK) - limit=50 ile
  try {
    const response = await api.get(`/catalog/products/${productId}/posts?limit=50`, { headers });
    const items = response.data.items || [];
    // Post type'ları hem item.type hem de item.data.type'dan al
    const postTypes = items.map((item: any) => {
      // Önce item.type'a bak, yoksa item.data.type'a bak
      return item.type || item.data?.type || 'unknown';
    }).filter(Boolean);
    
    // Ayrıca data içindeki type'ları da kontrol et
    const dataTypes = items.map((item: any) => {
      if (item.data) {
        // data.type veya data.postType veya data.contentPostType
        return item.data.type || item.data.postType || item.data.contentPostType;
      }
      return null;
    }).filter(Boolean);
    
    const allTypes = [...new Set([...postTypes, ...dataTypes])];
    
    const expectedTotal = 6; // Her product için 6 tip post
    
    console.log(`      ✅ Tüm Post'lar: ${items.length}/${expectedTotal}`);
    console.log(`         Post Type Dağılımı (item.type): ${JSON.stringify(postTypes.reduce((acc: any, type: string) => {
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {}))}`);
    if (dataTypes.length > 0) {
      console.log(`         Post Type Dağılımı (data.type): ${JSON.stringify(dataTypes.reduce((acc: any, type: string) => {
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      }, {}))}`);
    }
    
    // Tüm 6 tip olmalı (hem item.type hem data.type'da kontrol et)
    const expectedTypes = ['post', 'tipsAndTricks', 'question', 'experience', 'update', 'benchmark'];
    const foundTypes = allTypes.filter((type: string) => expectedTypes.includes(type));
    const missingTypes = expectedTypes.filter((type: string) => !allTypes.includes(type));
    
    if (missingTypes.length > 0) {
      console.log(`      ⚠️  Eksik Post Type'lar: ${missingTypes.join(', ')}`);
      // İlk item'ı örnek olarak göster
      if (items.length > 0) {
        console.log(`      📋 İlk item örneği: ${JSON.stringify({ type: items[0].type, dataType: items[0].data?.type, data: Object.keys(items[0].data || {}) })}`);
      }
    }
    
    summary.testsRun++;
    if (items.length >= expectedTotal && missingTypes.length === 0) {
      summary.testsPassed++;
    } else {
      summary.testsFailed++;
      if (missingTypes.length > 0) {
        summary.errors.push(`${product.productName} için eksik post type'lar: ${missingTypes.join(', ')}`);
      }
    }
  } catch (error: any) {
    console.log(`      ❌ Hata: ${error.message}`);
    summary.testsRun++;
    summary.testsFailed++;
  }
  
  // 2. Her post type için filtre testi
  const typeFilters = [
    { param: 'type=free', expected: 1, typeName: 'FREE' },
    { param: 'type=tips', expected: 1, typeName: 'TIPS' },
    { param: 'type=question', expected: 1, typeName: 'QUESTION' },
    { param: 'type=experience', expected: 1, typeName: 'EXPERIENCE' },
    { param: 'type=update', expected: 1, typeName: 'UPDATE' },
    { param: 'type=benchmark', expected: 1, typeName: 'BENCHMARK' },
  ];
  
  for (const filter of typeFilters) {
    try {
      const response = await api.get(`/catalog/products/${productId}/posts?${filter.param}&limit=50`, { headers });
      const items = response.data.items || [];
      
      console.log(`      ✅ ${filter.typeName} Filtresi: ${items.length}/${filter.expected}`);
      
      summary.testsRun++;
      if (items.length >= filter.expected) {
        summary.testsPassed++;
      } else {
        summary.testsFailed++;
      }
    } catch (error: any) {
      console.log(`      ❌ ${filter.typeName} Filtresi Hata: ${error.message}`);
      summary.testsRun++;
      summary.testsFailed++;
    }
  }
}

// ==================== PRODUCT GROUP CREATION ====================

/**
 * Eksik product group'ları oluşturur
 */
async function ensureProductGroups(api: AxiosInstance, token: string): Promise<void> {
  console.log('🔧 Eksik product grouplar kontrol ediliyor ve oluşturuluyor...\n');

  for (const category of [TEST_HIERARCHY.electronics, TEST_HIERARCHY.cosmetics]) {
    for (const subCategory of category.subCategories) {
      // Mevcut product group'ları kontrol et
      const headers = { Authorization: `Bearer ${token}` };
      let existingProductGroups: any[] = [];
      
      try {
        const response = await api.get(
          `/catalog/sub-categories/${subCategory.subCategoryId}/product-groups`,
          { headers }
        );
        existingProductGroups = response.data || [];
      } catch (error: any) {
        console.warn(`⚠️  Product group listesi alınamadı: ${error.message}`);
      }

      // Eğer product group yoksa veya 2'den azsa, eksikleri oluştur
      const neededCount = 2;
      const currentCount = existingProductGroups.length;
      
      if (currentCount < neededCount) {
        const toCreate = neededCount - currentCount;
        console.log(`  📦 ${subCategory.subCategoryName} için ${toCreate} product group oluşturuluyor...`);

        for (let i = 0; i < toCreate; i++) {
          const productGroupNumber = currentCount + i + 1;
          const productGroupName = `${subCategory.subCategoryName} Group ${productGroupNumber}`;
          
          // MinIO'dan rastgele görsel al
          const imageUrl = await getRandomCatalogImage();
          
          try {
            // Prisma ile direkt DB'ye ekle
            const productGroup = await prisma.productGroup.create({
              data: {
                id: uuidv4(),
                subCategoryId: subCategory.subCategoryId,
                name: productGroupName,
                description: `${productGroupName} - Test için oluşturuldu`,
                imageUrl: imageUrl,
              },
            });

            // TEST_HIERARCHY'yi güncelle
            if (!subCategory.productGroups) {
              subCategory.productGroups = [];
            }
            subCategory.productGroups.push({
              productGroupId: productGroup.id,
              productGroupName: productGroup.name,
              products: [],
            });

            console.log(`    ✅ Product group oluşturuldu: ${productGroupName} (${productGroup.id})`);
          } catch (error: any) {
            console.error(`    ❌ Product group oluşturulamadı: ${error.message}`);
          }
        }
      } else {
        console.log(`  ✅ ${subCategory.subCategoryName} için yeterli product group mevcut (${currentCount})`);
        
        // Mevcut product group'ları TEST_HIERARCHY'ye ekle
        if (!subCategory.productGroups || subCategory.productGroups.length === 0) {
          subCategory.productGroups = existingProductGroups.slice(0, 2).map((pg: any) => ({
            productGroupId: pg.productGroupId,
            productGroupName: pg.name,
            products: [],
          }));
        }
      }
    }
  }
  
  console.log('');
}

// ==================== MOBILE APP SIMULATION ====================

/**
 * Mobil app simülasyonu: Seçilen hiyerarşi için post'ları oluşturur
 * - 1 Sub Category: 3 tip post (FREE, TIPS, QUESTION)
 * - 1 Product Group (seçilen sub category altında): 3 tip post (FREE, TIPS, QUESTION)
 * - 1 Product (seçilen product group altında): 6 tip post (FREE, TIPS, QUESTION, EXPERIENCE, UPDATE, BENCHMARK)
 */
async function simulateMobileAppPosts(
  api: AxiosInstance,
  token: string,
  boostOptions: BoostOption[],
  experienceOptions: ExperienceOptions
): Promise<CreatedPost[]> {
  console.log('\n📱 MOBİL APP SİMÜLASYONU BAŞLATILIYOR...\n');
  console.log('='.repeat(60));
  
  const createdPosts: CreatedPost[] = [];
  
  // 1. Sub Category seç (Electronics > cameras)
  const selectedSubCategory = TEST_HIERARCHY.electronics.subCategories.find(
    (sc) => sc.subCategoryId === '079262b2-a70e-494d-aa69-d2746543caec' // cameras
  );
  
  if (!selectedSubCategory) {
    console.error('❌ Seçilen sub category bulunamadı');
    return createdPosts;
  }
  
  console.log(`\n📍 Seçilen Sub Category: ${selectedSubCategory.subCategoryName} (${selectedSubCategory.subCategoryId})\n`);
  
  // Sub Category için 3 tip post oluştur
  console.log('📝 Sub Category için post\'lar oluşturuluyor...');
  console.log('   └─ FREE post...');
  const subCategoryFreePost = await createFreePost(
    api,
    token,
    ContextType.SUB_CATEGORY,
    selectedSubCategory.subCategoryId,
    'electronics'
  );
  if (subCategoryFreePost) {
    createdPosts.push(subCategoryFreePost);
    console.log(`      ✅ Oluşturuldu: ${subCategoryFreePost.id}`);
  }
  
  console.log('   └─ TIPS post...');
  const subCategoryTipsPost = await createTipsPost(
    api,
    token,
    ContextType.SUB_CATEGORY,
    selectedSubCategory.subCategoryId,
    'electronics',
    TipsAndTricksBenefitCategory.TIME
  );
  if (subCategoryTipsPost) {
    createdPosts.push(subCategoryTipsPost);
    console.log(`      ✅ Oluşturuldu: ${subCategoryTipsPost.id}`);
  }
  
  console.log('   └─ QUESTION post...');
  const subCategoryQuestionPost = await createQuestionPost(
    api,
    token,
    ContextType.SUB_CATEGORY,
    selectedSubCategory.subCategoryId,
    'electronics',
    boostOptions
  );
  if (subCategoryQuestionPost) {
    createdPosts.push(subCategoryQuestionPost);
    console.log(`      ✅ Oluşturuldu: ${subCategoryQuestionPost.id}`);
  }
  
  // 2. Product Group seç (seçilen sub category altındaki ilk product group)
  if (!selectedSubCategory.productGroups || selectedSubCategory.productGroups.length === 0) {
    console.error('❌ Seçilen sub category altında product group bulunamadı');
    return createdPosts;
  }
  
  const selectedProductGroup = selectedSubCategory.productGroups[0];
  console.log(`\n📍 Seçilen Product Group: ${selectedProductGroup.productGroupName} (${selectedProductGroup.productGroupId})\n`);
  
  // Product Group için 3 tip post oluştur
  console.log('📝 Product Group için post\'lar oluşturuluyor...');
  console.log('   └─ FREE post...');
  const productGroupFreePost = await createFreePost(
    api,
    token,
    ContextType.PRODUCT_GROUP,
    selectedProductGroup.productGroupId,
    'electronics'
  );
  if (productGroupFreePost) {
    createdPosts.push(productGroupFreePost);
    console.log(`      ✅ Oluşturuldu: ${productGroupFreePost.id}`);
  }
  
  console.log('   └─ TIPS post...');
  const productGroupTipsPost = await createTipsPost(
    api,
    token,
    ContextType.PRODUCT_GROUP,
    selectedProductGroup.productGroupId,
    'electronics',
    TipsAndTricksBenefitCategory.ENERGY
  );
  if (productGroupTipsPost) {
    createdPosts.push(productGroupTipsPost);
    console.log(`      ✅ Oluşturuldu: ${productGroupTipsPost.id}`);
  }
  
  console.log('   └─ QUESTION post...');
  const productGroupQuestionPost = await createQuestionPost(
    api,
    token,
    ContextType.PRODUCT_GROUP,
    selectedProductGroup.productGroupId,
    'electronics',
    boostOptions
  );
  if (productGroupQuestionPost) {
    createdPosts.push(productGroupQuestionPost);
    console.log(`      ✅ Oluşturuldu: ${productGroupQuestionPost.id}`);
  }
  
  // 3. Product seç veya oluştur (seçilen product group altında)
  let selectedProduct = selectedProductGroup.products?.[0];
  
  // Eğer product yoksa, oluştur
  if (!selectedProduct) {
    console.log(`\n⚠️  Product group altında product bulunamadı, yeni product oluşturuluyor...`);
    
    const productName = `${selectedProductGroup.productGroupName} Test Product`;
    const imageUrl = await getRandomCatalogImage();
    
    try {
      const newProduct = await prisma.product.create({
        data: {
          id: uuidv4(),
          groupId: selectedProductGroup.productGroupId,
          name: productName,
          description: `${productName} - Mobil app simülasyonu için oluşturuldu`,
          imageUrl: imageUrl,
        },
      });
      
      selectedProduct = {
        productId: newProduct.id,
        productName: newProduct.name,
      };
      
      // TEST_HIERARCHY'ye ekle
      if (!selectedProductGroup.products) {
        selectedProductGroup.products = [];
      }
      selectedProductGroup.products.push(selectedProduct);
      
      console.log(`   ✅ Product oluşturuldu: ${productName} (${newProduct.id})`);
    } catch (error: any) {
      console.error(`   ❌ Product oluşturulamadı: ${error.message}`);
      return createdPosts;
    }
  }
  
  console.log(`\n📍 Seçilen Product: ${selectedProduct.productName} (${selectedProduct.productId})\n`);
  
  // Product için 6 tip post oluştur
  console.log('📝 Product için post\'lar oluşturuluyor...');
  
  console.log('   └─ FREE post...');
  const productFreePost = await createFreePost(
    api,
    token,
    ContextType.PRODUCT,
    selectedProduct.productId,
    'electronics'
  );
  if (productFreePost) {
    createdPosts.push(productFreePost);
    console.log(`      ✅ Oluşturuldu: ${productFreePost.id}`);
  }
  
  console.log('   └─ TIPS post...');
  const productTipsPost = await createTipsPost(
    api,
    token,
    ContextType.PRODUCT,
    selectedProduct.productId,
    'electronics',
    TipsAndTricksBenefitCategory.BETTER
  );
  if (productTipsPost) {
    createdPosts.push(productTipsPost);
    console.log(`      ✅ Oluşturuldu: ${productTipsPost.id}`);
  }
  
  console.log('   └─ QUESTION post...');
  const productQuestionPost = await createQuestionPost(
    api,
    token,
    ContextType.PRODUCT,
    selectedProduct.productId,
    'electronics',
    boostOptions
  );
  if (productQuestionPost) {
    createdPosts.push(productQuestionPost);
    console.log(`      ✅ Oluşturuldu: ${productQuestionPost.id}`);
  }
  
  console.log('   └─ EXPERIENCE post...');
  const productExperiencePost = await createExperiencePost(
    api,
    token,
    ContextType.PRODUCT,
    selectedProduct.productId,
    'electronics',
    experienceOptions
  );
  if (productExperiencePost) {
    createdPosts.push(productExperiencePost);
    console.log(`      ✅ Oluşturuldu: ${productExperiencePost.id}`);
  }
  
  console.log('   └─ UPDATE post...');
  const productUpdatePost = await createUpdatePost(
    api,
    token,
    ContextType.PRODUCT,
    selectedProduct.productId,
    'electronics'
  );
  if (productUpdatePost) {
    createdPosts.push(productUpdatePost);
    console.log(`      ✅ Oluşturuldu: ${productUpdatePost.id}`);
  }
  
  console.log('   └─ BENCHMARK post...');
  // Benchmark için en az 2 product gerekli, mevcut product'ları kullan
  const availableProducts = selectedProductGroup.products || [];
  const benchmarkProducts = availableProducts.length >= 2 
    ? availableProducts.slice(0, 2)
    : [selectedProduct, { productId: selectedProduct.productId, productName: `${selectedProduct.productName} (duplicate)` }];
  
  const productBenchmarkPost = await createBenchmarkPost(
    api,
    token,
    ContextType.PRODUCT,
    selectedProduct.productId,
    'electronics',
    benchmarkProducts
  );
  if (productBenchmarkPost) {
    createdPosts.push(productBenchmarkPost);
    console.log(`      ✅ Oluşturuldu: ${productBenchmarkPost.id}`);
  }
  
  console.log('\n' + '='.repeat(60));
  console.log(`\n✅ Mobil app simülasyonu tamamlandı!`);
  console.log(`📊 Toplam oluşturulan post: ${createdPosts.length}`);
  console.log(`   - Sub Category: 3 post`);
  console.log(`   - Product Group: 3 post`);
  console.log(`   - Product: 6 post`);
  console.log('');
  
  return createdPosts;
}

// ==================== MAIN SCENARIO ====================

async function main() {
  console.log('🚀 Hiyerarşik Feed Test Senaryosu Başlatılıyor...\n');

  const api = axios.create({
    baseURL: BASE_URL,
    timeout: 30000,
  });

  const summary: TestSummary = {
    postsCreated: {
      product: 0,
      productGroup: 0,
      subCategory: 0,
      total: 0,
    },
    testsRun: 0,
    testsPassed: 0,
    testsFailed: 0,
    errors: [],
  };

  try {
    // 1. Authentication
    console.log('1️⃣  Authentication...');
    const auth = await authenticate(api);
    console.log(`✅ Logged in as ${auth.userId}\n`);

    // 1.5. Eksik product group'ları oluştur
    await ensureProductGroups(api, auth.token);

    // 2. Catalog data kontrolü
    console.log('2️⃣  Catalog data kontrolü...');
    await getCatalogData(api, auth.token);
    console.log('');

    // 3. Boost ve Experience options alma
    console.log('3️⃣  Boost ve Experience options alma...');
    const boostOptions = await getBoostOptions(api, auth.token);
    const experienceOptions = await getExperienceOptions(api, auth.token);
    console.log(`✅ Boost options: ${boostOptions.length}, Experience options loaded\n`);

    // Test gönderileri için array (tüm post'lar buraya eklenecek)
    const createdPosts: CreatedPost[] = [];
    
    // NOT: Mobil app simülasyonu kaldırıldı - sadece 132 post oluşturulacak
    
    // Duplicate kontrolü için Set'ler
    const createdProductPosts = new Set<string>();
    const createdProductGroupPosts = new Set<string>();
    const createdSubCategoryPosts = new Set<string>();

    // 3.6. TEST_HIERARCHY'yi temizle ve sadece seed script'inden gelen product group'ları ekle
    console.log('3.6️⃣  TEST_HIERARCHY temizleniyor ve seed product group\'lar ekleniyor...\n');
    
    // Seed script'inde tanımlanan product group isimlerini al
    const seedProductGroupNames = [
      'cameras Group 2',
      'drones Group 1',
      'drones Group 2',
      'Bath body Group 2',
      'Facial tools Group 1',
      'Facial tools Group 2',
    ];
    
    // Tüm sub category ID'lerini topla
    const subCategoryIds = [
      TEST_HIERARCHY.electronics.subCategories.map(sc => sc.subCategoryId),
      TEST_HIERARCHY.cosmetics.subCategories.map(sc => sc.subCategoryId),
    ].flat();
    
    // Prisma'dan seed product group'ları al (sadece product'ı olanlar ve ilk bulunan)
    const seedProductGroupsMap = new Map<string, any>();
    
    for (const subCategoryId of subCategoryIds) {
      for (const seedName of seedProductGroupNames) {
        const dbProductGroup = await prisma.productGroup.findFirst({
          where: {
            subCategoryId: subCategoryId,
            name: seedName,
            products: {
              some: {}, // En az 1 product'ı olan
            },
          },
          include: {
            products: {
              take: 2, // İlk 2 product'ı al
            },
          },
          orderBy: {
            createdAt: 'desc', // En yeni olanı al
          },
        });
        
        if (dbProductGroup && !seedProductGroupsMap.has(`${subCategoryId}-${seedName}`)) {
          seedProductGroupsMap.set(`${subCategoryId}-${seedName}`, dbProductGroup);
        }
      }
    }
    
    // TEST_HIERARCHY'deki product group'ları temizle ve seed'den gelenleri ekle
    for (const category of [TEST_HIERARCHY.electronics, TEST_HIERARCHY.cosmetics]) {
      for (const subCategory of category.subCategories) {
        // Mevcut product group'ları temizle (sadece seed'den gelenler kalacak)
        const existingProductGroups = subCategory.productGroups || [];
        subCategory.productGroups = existingProductGroups.filter((pg: any) => {
          // Seed isimlerinden biri değilse kalsın (örn: "cameras" gibi orijinal olanlar)
          return !seedProductGroupNames.includes(pg.productGroupName);
        });
        
        // Seed product group'ları ekle
        for (const [key, dbProductGroup] of seedProductGroupsMap.entries()) {
          if (dbProductGroup.subCategoryId === subCategory.subCategoryId) {
            // Duplicate kontrolü
            const exists = subCategory.productGroups.find(
              (pg: any) => pg.productGroupId === dbProductGroup.id
            );
            
            if (!exists && dbProductGroup.products.length > 0) {
              subCategory.productGroups.push({
                productGroupId: dbProductGroup.id,
                productGroupName: dbProductGroup.name,
                products: dbProductGroup.products.map((p: any) => ({
                  productId: p.id,
                  productName: p.name,
                })),
              });
              console.log(`  ✅ ${dbProductGroup.name} eklendi (${dbProductGroup.products.length} product)\n`);
            }
          }
        }
      }
    }
    console.log('');

    // 4. Test gönderileri oluşturma (SADECE 132 POST - DUPLICATE YOK)
    console.log('4️⃣  Test gönderileri oluşturuluyor (132 post - duplicate yok)...\n');

    // 4.1 Product seviyesi gönderileri (16 product × 6 tip = 96 post)
    console.log('📦 Product seviyesi gönderileri (96 post)...');
    for (const category of [TEST_HIERARCHY.electronics, TEST_HIERARCHY.cosmetics]) {
      const categoryType = category.categoryId === TEST_HIERARCHY.electronics.categoryId ? 'electronics' : 'cosmetics';

      for (const subCategory of category.subCategories) {
        for (const productGroup of subCategory.productGroups) {
          for (const product of productGroup.products) {
            // Duplicate kontrolü
            if (createdProductPosts.has(product.productId)) {
              console.log(`  ⏭️  Product ${product.productName} için post'lar zaten oluşturulmuş, atlanıyor`);
              continue;
            }
            createdProductPosts.add(product.productId);
            
            console.log(`  Creating posts for product: ${product.productName}`);

            // FREE
            const freePost = await createFreePost(api, auth.token, ContextType.PRODUCT, product.productId, categoryType);
            if (freePost) createdPosts.push(freePost);

            // TIPS
            const tipsPost = await createTipsPost(api, auth.token, ContextType.PRODUCT, product.productId, categoryType);
            if (tipsPost) createdPosts.push(tipsPost);

            // QUESTION
            const questionPost = await createQuestionPost(api, auth.token, ContextType.PRODUCT, product.productId, categoryType, boostOptions);
            if (questionPost) createdPosts.push(questionPost);

            // EXPERIENCE
            const experiencePost = await createExperiencePost(api, auth.token, ContextType.PRODUCT, product.productId, categoryType, experienceOptions);
            if (experiencePost) createdPosts.push(experiencePost);

            // UPDATE
            const updatePost = await createUpdatePost(api, auth.token, ContextType.PRODUCT, product.productId, categoryType);
            if (updatePost) createdPosts.push(updatePost);

            // BENCHMARK (aynı product group'tan 2 product ile)
            let benchmarkPost: CreatedPost | null = null;
            if (productGroup.products.length >= 2) {
              benchmarkPost = await createBenchmarkPost(api, auth.token, ContextType.PRODUCT, product.productId, categoryType, productGroup.products);
              if (benchmarkPost) createdPosts.push(benchmarkPost);
            }

            // Bu product için oluşturulan post sayısını say
            const productPostsCount = [freePost, tipsPost, questionPost, experiencePost, updatePost, benchmarkPost].filter((p) => p !== null).length;
            summary.postsCreated.product += productPostsCount;
          }
        }
      }
    }
    console.log(`✅ Product posts created: ${summary.postsCreated.product}\n`);

    // 4.2 Product group seviyesi gönderileri (8 product group × 3 tip = 24 post)
    console.log('📦 Product group seviyesi gönderileri (24 post)...');
    for (const category of [TEST_HIERARCHY.electronics, TEST_HIERARCHY.cosmetics]) {
      const categoryType = category.categoryId === TEST_HIERARCHY.electronics.categoryId ? 'electronics' : 'cosmetics';

      for (const subCategory of category.subCategories) {
        for (const productGroup of subCategory.productGroups) {
          // Duplicate kontrolü
          if (createdProductGroupPosts.has(productGroup.productGroupId)) {
            console.log(`  ⏭️  Product group ${productGroup.productGroupName} için post'lar zaten oluşturulmuş, atlanıyor`);
            continue;
          }
          createdProductGroupPosts.add(productGroup.productGroupId);
          
          console.log(`  Creating posts for product group: ${productGroup.productGroupName}`);

          // FREE
          const freePost = await createFreePost(api, auth.token, ContextType.PRODUCT_GROUP, productGroup.productGroupId, categoryType);
          if (freePost) createdPosts.push(freePost);

          // TIPS
          const tipsPost = await createTipsPost(
            api,
            auth.token,
            ContextType.PRODUCT_GROUP,
            productGroup.productGroupId,
            categoryType,
            TipsAndTricksBenefitCategory.ENERGY
          );
          if (tipsPost) createdPosts.push(tipsPost);

          // QUESTION
          const questionPost = await createQuestionPost(api, auth.token, ContextType.PRODUCT_GROUP, productGroup.productGroupId, categoryType, boostOptions);
          if (questionPost) createdPosts.push(questionPost);

          // Bu product group için oluşturulan post sayısını say
          const productGroupPostsCount = [freePost, tipsPost, questionPost].filter((p) => p !== null).length;
          summary.postsCreated.productGroup += productGroupPostsCount;
        }
      }
    }
    console.log(`✅ Product group posts created: ${summary.postsCreated.productGroup}\n`);

    // 4.3 Sub category seviyesi gönderileri (4 sub category × 3 tip = 12 post)
    console.log('📦 Sub category seviyesi gönderileri (12 post)...');
    for (const category of [TEST_HIERARCHY.electronics, TEST_HIERARCHY.cosmetics]) {
      const categoryType = category.categoryId === TEST_HIERARCHY.electronics.categoryId ? 'electronics' : 'cosmetics';

      for (const subCategory of category.subCategories) {
        // Duplicate kontrolü
        if (createdSubCategoryPosts.has(subCategory.subCategoryId)) {
          console.log(`  ⏭️  Sub category ${subCategory.subCategoryName} için post'lar zaten oluşturulmuş, atlanıyor`);
          continue;
        }
        createdSubCategoryPosts.add(subCategory.subCategoryId);
        
        console.log(`  Creating posts for sub category: ${subCategory.subCategoryName}`);

        // FREE
        const freePost = await createFreePost(api, auth.token, ContextType.SUB_CATEGORY, subCategory.subCategoryId, categoryType);
        if (freePost) createdPosts.push(freePost);

        // TIPS
        const tipsPost = await createTipsPost(
          api,
          auth.token,
          ContextType.SUB_CATEGORY,
          subCategory.subCategoryId,
          categoryType,
          TipsAndTricksBenefitCategory.DURABILITY
        );
        if (tipsPost) createdPosts.push(tipsPost);

        // QUESTION
        const questionPost = await createQuestionPost(api, auth.token, ContextType.SUB_CATEGORY, subCategory.subCategoryId, categoryType, boostOptions);
        if (questionPost) createdPosts.push(questionPost);

        // Bu sub category için oluşturulan post sayısını say
        const subCategoryPostsCount = [freePost, tipsPost, questionPost].filter((p) => p !== null).length;
        summary.postsCreated.subCategory += subCategoryPostsCount;
      }
    }
    console.log(`✅ Sub category posts created: ${summary.postsCreated.subCategory}\n`);

    summary.postsCreated.total = createdPosts.length;
    console.log(`📊 Toplam oluşturulan gönderi: ${summary.postsCreated.total}`);
    console.log(`📊 Beklenen toplam: 132 (12 sub + 24 group + 96 product)\n`);

    // 5. Feed endpointlerini detaylı test etme
    console.log('5️⃣  Feed endpointleri detaylı test ediliyor...\n');
    await detailedFeedTests(api, auth.token, TEST_HIERARCHY, summary);
    console.log('');

    // 5.1 Product feed testleri
    console.log('🔍 Product feed testleri...');
    const testedProductIds = new Set<string>(); // Duplicate test'leri önlemek için
    
    for (const category of [TEST_HIERARCHY.electronics, TEST_HIERARCHY.cosmetics]) {
      for (const subCategory of category.subCategories) {
        for (const productGroup of subCategory.productGroups) {
          for (const product of productGroup.products) {
            // Aynı product'u birden fazla kez test etme
            if (testedProductIds.has(product.productId)) {
              continue;
            }
            testedProductIds.add(product.productId);
            
            const result = await testProductFeed(api, auth.token, product.productId, 6);
            summary.testsRun++;
            if (result.success) {
              summary.testsPassed++;
              console.log(`  ✅ ${product.productName}: ${result.actualCount}/${result.expectedCount} posts`);
            } else {
              summary.testsFailed++;
              console.log(`  ❌ ${product.productName}: ${result.actualCount}/${result.expectedCount} posts - ${result.error || 'Count mismatch'}`);
              if (result.error) summary.errors.push(result.error);
            }
          }
        }
      }
    }
    console.log('');

    // 5.2 Product group feed testleri
    console.log('🔍 Product group feed testleri...');
    const testedProductGroupIds = new Set<string>(); // Duplicate test'leri önlemek için
    const productGroupTestMap = new Map<string, { name: string; products: any[] }>(); // Product group bilgilerini topla
    
    // Önce tüm product group'ları topla (duplicate'leri önlemek için)
    for (const category of [TEST_HIERARCHY.electronics, TEST_HIERARCHY.cosmetics]) {
      for (const subCategory of category.subCategories) {
        for (const productGroup of subCategory.productGroups) {
          if (!productGroupTestMap.has(productGroup.productGroupId)) {
            productGroupTestMap.set(productGroup.productGroupId, {
              name: productGroup.productGroupName,
              products: productGroup.products || [],
            });
          }
        }
      }
    }
    
    // Her product group'u sadece bir kez test et
    for (const [productGroupId, productGroupInfo] of productGroupTestMap.entries()) {
      // Beklenen post sayısını hesapla
      // 1 product group post (3 tip) + N product × 3 tip (FREE, TIPS, QUESTION)
      const expectedCount = 3 + productGroupInfo.products.length * 3;
      
      // Tüm gönderiler
      const result = await testProductGroupFeed(api, auth.token, productGroupId, expectedCount);
      summary.testsRun++;
      if (result.success) {
        summary.testsPassed++;
        console.log(`  ✅ ${productGroupInfo.name}: ${result.actualCount}/${result.expectedCount} posts`);
      } else {
        summary.testsFailed++;
        console.log(`  ❌ ${productGroupInfo.name}: ${result.actualCount}/${result.expectedCount} posts - ${result.error || 'Count mismatch'}`);
        if (result.error) summary.errors.push(result.error);
      }

      // Tips gönderileri (1 product group + N product × 1 = 1 + N)
      const expectedTipsCount = 1 + productGroupInfo.products.length * 1;
      const tipsResult = await api.get(`/catalog/product-groups/${productGroupId}/posts?type=tips`, {
        headers: { Authorization: `Bearer ${auth.token}` },
      });
      const tipsCount = tipsResult.data.items?.length || 0;
      summary.testsRun++;
      if (tipsCount >= expectedTipsCount) {
        summary.testsPassed++;
        console.log(`  ✅ ${productGroupInfo.name} (tips): ${tipsCount}/${expectedTipsCount} posts`);
      } else {
        summary.testsFailed++;
        console.log(`  ❌ ${productGroupInfo.name} (tips): ${tipsCount}/${expectedTipsCount} posts`);
      }
    }
    console.log('');

    // 5.3 Sub category feed testleri
    console.log('🔍 Sub category feed testleri...');
    for (const category of [TEST_HIERARCHY.electronics, TEST_HIERARCHY.cosmetics]) {
      for (const subCategory of category.subCategories) {
        // Tüm gönderiler (3 sub category + 2 product group × 3 + 4 product × 3 = 21)
        const result = await testSubCategoryFeed(api, auth.token, subCategory.subCategoryId, 21);
        summary.testsRun++;
        if (result.success) {
          summary.testsPassed++;
          console.log(`  ✅ ${subCategory.subCategoryName}: ${result.actualCount}/${result.expectedCount} posts`);
        } else {
          summary.testsFailed++;
          console.log(`  ❌ ${subCategory.subCategoryName}: ${result.actualCount}/${result.expectedCount} posts - ${result.error || 'Count mismatch'}`);
          if (result.error) summary.errors.push(result.error);
        }

        // Tips gönderileri (1 sub category + 2 product group × 1 + 4 product × 1 = 7)
        const tipsResult = await api.get(`/catalog/sub-categories/${subCategory.subCategoryId}/posts?type=tips`, {
          headers: { Authorization: `Bearer ${auth.token}` },
        });
        const tipsCount = tipsResult.data.items?.length || 0;
        summary.testsRun++;
        if (tipsCount >= 7) {
          summary.testsPassed++;
          console.log(`  ✅ ${subCategory.subCategoryName} (tips): ${tipsCount}/7 posts`);
        } else {
          summary.testsFailed++;
          console.log(`  ❌ ${subCategory.subCategoryName} (tips): ${tipsCount}/7 posts`);
        }
      }
    }
    console.log('');

    // 6. Özet rapor
    console.log('📊 ÖZET RAPOR');
    console.log('='.repeat(50));
    console.log(`Oluşturulan Gönderiler:`);
    console.log(`  - Product: ${summary.postsCreated.product}`);
    console.log(`  - Product Group: ${summary.postsCreated.productGroup}`);
    console.log(`  - Sub Category: ${summary.postsCreated.subCategory}`);
    console.log(`  - Toplam: ${summary.postsCreated.total}`);
    console.log('');
    console.log(`Test Sonuçları:`);
    console.log(`  - Toplam Test: ${summary.testsRun}`);
    console.log(`  - Başarılı: ${summary.testsPassed}`);
    console.log(`  - Başarısız: ${summary.testsFailed}`);
    console.log(`  - Başarı Oranı: ${((summary.testsPassed / summary.testsRun) * 100).toFixed(2)}%`);
    console.log('');

    if (summary.errors.length > 0) {
      console.log(`Hatalar (${summary.errors.length}):`);
      summary.errors.forEach((error, index) => {
        console.log(`  ${index + 1}. ${error}`);
      });
    }

    console.log('='.repeat(50));
  } catch (error: any) {
    console.error('❌ Test senaryosu başarısız:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Script çalıştırma
if (require.main === module) {
  main()
    .then(() => {
      console.log('\n✅ Test senaryosu tamamlandı');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Test senaryosu hata ile sonlandı:', error);
      process.exit(1);
    });
}

export { main };
