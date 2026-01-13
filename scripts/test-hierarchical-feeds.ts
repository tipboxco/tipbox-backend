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

    // 3.5. Mobil app simülasyonu (endpoint testi)
    const mobileAppPosts = await simulateMobileAppPosts(api, auth.token, boostOptions, experienceOptions);
    console.log(`📱 Mobil app simülasyonu: ${mobileAppPosts.length} post oluşturuldu\n`);

    // 4. Test gönderileri oluşturma
    console.log('4️⃣  Test gönderileri oluşturuluyor...\n');

    const createdPosts: CreatedPost[] = [];

    // 4.1 Product seviyesi gönderileri
    console.log('📦 Product seviyesi gönderileri...');
    for (const category of [TEST_HIERARCHY.electronics, TEST_HIERARCHY.cosmetics]) {
      const categoryType = category.categoryId === TEST_HIERARCHY.electronics.categoryId ? 'electronics' : 'cosmetics';

      for (const subCategory of category.subCategories) {
        for (const productGroup of subCategory.productGroups) {
          for (const product of productGroup.products) {
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

    // 4.2 Product group seviyesi gönderileri
    console.log('📦 Product group seviyesi gönderileri...');
    for (const category of [TEST_HIERARCHY.electronics, TEST_HIERARCHY.cosmetics]) {
      const categoryType = category.categoryId === TEST_HIERARCHY.electronics.categoryId ? 'electronics' : 'cosmetics';

      for (const subCategory of category.subCategories) {
        for (const productGroup of subCategory.productGroups) {
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

    // 4.3 Sub category seviyesi gönderileri
    console.log('📦 Sub category seviyesi gönderileri...');
    for (const category of [TEST_HIERARCHY.electronics, TEST_HIERARCHY.cosmetics]) {
      const categoryType = category.categoryId === TEST_HIERARCHY.electronics.categoryId ? 'electronics' : 'cosmetics';

      for (const subCategory of category.subCategories) {
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
    console.log(`📊 Toplam oluşturulan gönderi: ${summary.postsCreated.total}\n`);

    // 5. Feed endpointlerini test etme
    console.log('5️⃣  Feed endpointleri test ediliyor...\n');

    // 5.1 Product feed testleri
    console.log('🔍 Product feed testleri...');
    for (const category of [TEST_HIERARCHY.electronics, TEST_HIERARCHY.cosmetics]) {
      for (const subCategory of category.subCategories) {
        for (const productGroup of subCategory.productGroups) {
          for (const product of productGroup.products) {
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
    for (const category of [TEST_HIERARCHY.electronics, TEST_HIERARCHY.cosmetics]) {
      for (const subCategory of category.subCategories) {
        for (const productGroup of subCategory.productGroups) {
          // Tüm gönderiler (3 product group + 2 product × 3 tip = 9)
          const result = await testProductGroupFeed(api, auth.token, productGroup.productGroupId, 9);
          summary.testsRun++;
          if (result.success) {
            summary.testsPassed++;
            console.log(`  ✅ ${productGroup.productGroupName}: ${result.actualCount}/${result.expectedCount} posts`);
          } else {
            summary.testsFailed++;
            console.log(`  ❌ ${productGroup.productGroupName}: ${result.actualCount}/${result.expectedCount} posts - ${result.error || 'Count mismatch'}`);
            if (result.error) summary.errors.push(result.error);
          }

          // Tips gönderileri (1 product group + 2 product × 1 = 3)
          const tipsResult = await api.get(`/catalog/product-groups/${productGroup.productGroupId}/posts?type=tips`, {
            headers: { Authorization: `Bearer ${auth.token}` },
          });
          const tipsCount = tipsResult.data.items?.length || 0;
          summary.testsRun++;
          if (tipsCount >= 3) {
            summary.testsPassed++;
            console.log(`  ✅ ${productGroup.productGroupName} (tips): ${tipsCount}/3 posts`);
          } else {
            summary.testsFailed++;
            console.log(`  ❌ ${productGroup.productGroupName} (tips): ${tipsCount}/3 posts`);
          }
        }
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
