import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';
import { getAuthToken } from '../helpers/auth-helper';
import { S3Service } from '../../src/infrastructure/s3/s3.service';

// Test ortamında her zaman localhost kullan
const BASE_URL = 'http://localhost:3000';
const prisma = new PrismaClient();

// S3Service'i lazy initialization ile oluştur (beforeAll'da endpoint override edildikten sonra)
let s3Service: S3Service;

// Test görselleri dizini
const CATALOG_IMAGES_DIR = path.join(__dirname, '../assets/catalog');

// Catalog görsel isimlerine göre test verileri
const CATALOG_TEST_DATA = [
  { imageName: 'cameras.png', name: 'Cameras', description: 'Digital cameras and photography equipment' },
  { imageName: 'phones.png', name: 'Phones', description: 'Smartphones and mobile devices' },
  { imageName: 'computers-tablets.png', name: 'Computers & Tablets', description: 'Laptops, desktops, and tablets' },
  { imageName: 'headphones.png', name: 'Headphones', description: 'Audio headphones and earbuds' },
  { imageName: 'TV.png', name: 'TV', description: 'Televisions and displays' },
  { imageName: 'games.png', name: 'Games', description: 'Gaming consoles and accessories' },
  { imageName: 'drone.png', name: 'Drone', description: 'Drones and aerial devices' },
  { imageName: 'printers.png', name: 'Printers', description: 'Printers and printing equipment' },
  { imageName: 'air conditioner.png', name: 'Air Conditioner', description: 'Air conditioning units' },
  { imageName: 'home appliances.png', name: 'Home Appliances', description: 'Home and kitchen appliances' },
  { imageName: 'smart home devices.png', name: 'Smart Home Devices', description: 'Smart home automation devices' },
  { imageName: 'kucukev.png', name: 'Küçük Ev', description: 'Small home and compact living solutions' },
];

// Test verileri için ID'ler
let testCategoryIds: string[] = [];
let testSubCategoryIds: string[] = [];
let testProductGroupIds: string[] = [];
let testProductIds: string[] = [];
let testImageUrls: Map<string, string> = new Map(); // entityId -> imageUrl

// Helper: Catalog görselini oku
function getCatalogImageBuffer(imageName: string): Buffer {
  try {
    const imagePath = path.resolve(CATALOG_IMAGES_DIR, imageName);
    if (!fs.existsSync(imagePath)) {
      throw new Error(`Catalog görseli bulunamadı: ${imagePath}`);
    }
    return fs.readFileSync(imagePath);
  } catch (error) {
    throw new Error(`Catalog görseli okunamadı (${imageName}): ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Helper: MinIO'ya catalog görseli yükle
async function uploadCatalogImageToMinIO(
  entityType: 'category' | 'sub-category' | 'product-group' | 'product',
  entityId: string,
  imageName: string,
  s3ServiceInstance: S3Service
): Promise<string> {
  const imageBuffer = getCatalogImageBuffer(imageName);
  const fileName = `catalog-images/${entityType}/${entityId}/${imageName}`;
  
  const imageUrl = await s3ServiceInstance.uploadFile(
    fileName,
    imageBuffer,
    'image/png'
  );
  
  return imageUrl;
}

// Helper: MinIO'dan görseli doğrula
async function verifyImageInMinIO(imageUrl: string): Promise<{
  exists: boolean;
  accessible: boolean;
  contentType: string | null;
  size: number | null;
}> {
  try {
    const response = await fetch(imageUrl);
    const accessible = response.ok;
    const contentType = response.headers.get('content-type');
    const size = accessible ? (await response.arrayBuffer()).byteLength : null;
    
    return {
      exists: accessible,
      accessible,
      contentType,
      size,
    };
  } catch (error) {
    return {
      exists: false,
      accessible: false,
      contentType: null,
      size: null,
    };
  }
}

// Helper: DB'de category'yi kontrol et
async function verifyCategoryInDB(categoryId: string, expectedData?: {
  name?: string;
  imageUrl?: string;
}): Promise<{
  exists: boolean;
  category: any | null;
}> {
  try {
    const category = await prisma.mainCategory.findUnique({
      where: { id: categoryId },
    });

    if (!category) {
      return { exists: false, category: null };
    }

    if (expectedData) {
      if (expectedData.name && category.name !== expectedData.name) {
        throw new Error(`Category name mismatch: expected ${expectedData.name}, got ${category.name}`);
      }
      if (expectedData.imageUrl && category.imageUrl !== expectedData.imageUrl) {
        throw new Error(`Category imageUrl mismatch: expected ${expectedData.imageUrl}, got ${category.imageUrl}`);
      }
    }

    return { exists: true, category };
  } catch (error) {
    throw new Error(`Category verification failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Helper: DB'de sub-category'yi kontrol et
async function verifySubCategoryInDB(subCategoryId: string, expectedData?: {
  name?: string;
  imageUrl?: string;
  categoryId?: string;
}): Promise<{
  exists: boolean;
  subCategory: any | null;
}> {
  try {
    const subCategory = await prisma.subCategory.findUnique({
      where: { id: subCategoryId },
    });

    if (!subCategory) {
      return { exists: false, subCategory: null };
    }

    if (expectedData) {
      if (expectedData.name && subCategory.name !== expectedData.name) {
        throw new Error(`SubCategory name mismatch: expected ${expectedData.name}, got ${subCategory.name}`);
      }
      if (expectedData.imageUrl && subCategory.imageUrl !== expectedData.imageUrl) {
        throw new Error(`SubCategory imageUrl mismatch: expected ${expectedData.imageUrl}, got ${subCategory.imageUrl}`);
      }
      if (expectedData.categoryId && subCategory.mainCategoryId !== expectedData.categoryId) {
        throw new Error(`SubCategory categoryId mismatch: expected ${expectedData.categoryId}, got ${subCategory.mainCategoryId}`);
      }
    }

    return { exists: true, subCategory };
  } catch (error) {
    throw new Error(`SubCategory verification failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Helper: DB'de product group'u kontrol et
async function verifyProductGroupInDB(productGroupId: string, expectedData?: {
  name?: string;
  imageUrl?: string;
  subCategoryId?: string;
}): Promise<{
  exists: boolean;
  productGroup: any | null;
}> {
  try {
    const productGroup = await prisma.productGroup.findUnique({
      where: { id: productGroupId },
    });

    if (!productGroup) {
      return { exists: false, productGroup: null };
    }

    if (expectedData) {
      if (expectedData.name && productGroup.name !== expectedData.name) {
        throw new Error(`ProductGroup name mismatch: expected ${expectedData.name}, got ${productGroup.name}`);
      }
      if (expectedData.imageUrl && productGroup.imageUrl !== expectedData.imageUrl) {
        throw new Error(`ProductGroup imageUrl mismatch: expected ${expectedData.imageUrl}, got ${productGroup.imageUrl}`);
      }
      if (expectedData.subCategoryId && productGroup.subCategoryId !== expectedData.subCategoryId) {
        throw new Error(`ProductGroup subCategoryId mismatch: expected ${expectedData.subCategoryId}, got ${productGroup.subCategoryId}`);
      }
    }

    return { exists: true, productGroup };
  } catch (error) {
    throw new Error(`ProductGroup verification failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Helper: DB'de product'u kontrol et
async function verifyProductInDB(productId: string, expectedData?: {
  name?: string;
  imageUrl?: string;
  productGroupId?: string;
}): Promise<{
  exists: boolean;
  product: any | null;
}> {
  try {
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      return { exists: false, product: null };
    }

    if (expectedData) {
      if (expectedData.name && product.name !== expectedData.name) {
        throw new Error(`Product name mismatch: expected ${expectedData.name}, got ${product.name}`);
      }
      if (expectedData.imageUrl && product.imageUrl !== expectedData.imageUrl) {
        throw new Error(`Product imageUrl mismatch: expected ${expectedData.imageUrl}, got ${product.imageUrl}`);
      }
      if (expectedData.productGroupId && product.groupId !== expectedData.productGroupId) {
        throw new Error(`Product productGroupId mismatch: expected ${expectedData.productGroupId}, got ${product.groupId}`);
      }
    }

    return { exists: true, product };
  } catch (error) {
    throw new Error(`Product verification failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

describe('Catalog Endpoints', () => {
  let authToken: string;
  let userId: string;

  beforeAll(async () => {
    // Test ortamında S3 endpoint'i localhost olarak ayarla
    // (Test ortamı Docker container dışında çalıştığı için 'minio' hostname'ine erişemez)
    if (!process.env.S3_ENDPOINT || process.env.S3_ENDPOINT.includes('minio:')) {
      process.env.S3_ENDPOINT = 'http://localhost:9000';
    }

    // Config modül cache'ini temizle ve S3Service'i yeniden import et
    // Bu sayede yeni S3_ENDPOINT değeri kullanılır
    delete require.cache[require.resolve('../../src/infrastructure/config/s3.config')];
    delete require.cache[require.resolve('../../src/infrastructure/s3/s3.service')];
    const { S3Service: S3ServiceClass } = await import('../../src/infrastructure/s3/s3.service');
    
    // S3Service'i environment variable set edildikten sonra oluştur
    s3Service = new S3ServiceClass();

    // MinIO bucket kontrolü
    try {
      await s3Service.checkAndCreateBucket();
      console.log('✅ MinIO bucket hazır');
    } catch (error) {
      console.error('⚠️ MinIO bucket hazırlanırken hata:', error);
      throw error;
    }

    // Test görsellerinin mevcut olduğunu kontrol et
    for (const item of CATALOG_TEST_DATA) {
      const imagePath = path.resolve(CATALOG_IMAGES_DIR, item.imageName);
      if (!fs.existsSync(imagePath)) {
        throw new Error(`Test görseli bulunamadı: ${imagePath}`);
      }
    }

    // Auth token al
    const authResult = await getAuthToken();
    authToken = authResult.token;
    userId = authResult.userId;

    // Token'ın geçerli olduğunu kontrol et
    if (!authToken) {
      throw new Error('Auth token alınamadı');
    }
    console.log(`✅ Auth token alındı: ${authToken.substring(0, 20)}...`);

    console.log('✅ Test setup tamamlandı');
  });

  afterAll(async () => {
    // Test verilerini temizle
    try {
      // Products
      if (testProductIds.length > 0) {
        await prisma.product.deleteMany({
          where: { id: { in: testProductIds } },
        });
      }
      // Product Groups
      if (testProductGroupIds.length > 0) {
        await prisma.productGroup.deleteMany({
          where: { id: { in: testProductGroupIds } },
        });
      }
      // Sub Categories
      if (testSubCategoryIds.length > 0) {
        await prisma.subCategory.deleteMany({
          where: { id: { in: testSubCategoryIds } },
        });
      }
      // Main Categories
      if (testCategoryIds.length > 0) {
        await prisma.mainCategory.deleteMany({
          where: { id: { in: testCategoryIds } },
        });
      }
    } catch (error) {
      console.error('Test verileri temizlenirken hata:', error);
    } finally {
      await prisma.$disconnect();
    }
  });

  describe('GET /catalog/categories', () => {
    it('Step 1: Kategorileri listele ve DB kontrolü yap', async () => {
      // Önce test kategorileri oluştur
      const createdCategories = [];
      for (const item of CATALOG_TEST_DATA.slice(0, 3)) { // İlk 3 kategoriyi oluştur
        const categoryId = uuidv4();
        testCategoryIds.push(categoryId);

        // Görseli MinIO'ya yükle
        const imageUrl = await uploadCatalogImageToMinIO('category', categoryId, item.imageName, s3Service);
        testImageUrls.set(categoryId, imageUrl);

        // DB'ye kategori ekle
        const category = await prisma.mainCategory.create({
          data: {
            id: categoryId,
            name: item.name,
            description: item.description,
            imageUrl: imageUrl,
          },
        });

        createdCategories.push(category);
      }

      // API'den kategorileri getir
      const response = await request(BASE_URL)
        .get('/catalog/categories')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
      expect(response.body.length).toBeGreaterThanOrEqual(3);

      // Oluşturduğumuz kategorilerin response'da olduğunu kontrol et
      const responseCategoryIds = response.body.map((c: any) => c.categoryId);
      for (const category of createdCategories) {
        expect(responseCategoryIds).toContain(category.id);
        
        const responseCategory = response.body.find((c: any) => c.categoryId === category.id);
        expect(responseCategory).toBeDefined();
        expect(responseCategory.name).toBe(category.name);
        expect(responseCategory.image).toBe(category.imageUrl);
      }

      // DB kontrolü: Her kategori için
      for (const category of createdCategories) {
        const dbCheck = await verifyCategoryInDB(category.id, {
          name: category.name,
          imageUrl: category.imageUrl,
        });
        expect(dbCheck.exists).toBe(true);
        expect(dbCheck.category).toBeDefined();

        // MinIO kontrolü: Görsel erişilebilir olmalı
        const imageCheck = await verifyImageInMinIO(category.imageUrl!);
        expect(imageCheck.accessible).toBe(true);
        expect(imageCheck.contentType).toContain('image');
        expect(imageCheck.size).toBeGreaterThan(0);
      }

      console.log('✅ Kategoriler başarıyla listelendi ve doğrulandı');
    });
  });

  describe('GET /catalog/categories/:categoryId/sub-categories', () => {
    let testCategoryId: string;

    beforeAll(async () => {
      // Test için bir kategori oluştur
      testCategoryId = uuidv4();
      testCategoryIds.push(testCategoryId);

      const categoryData = CATALOG_TEST_DATA[0]; // cameras.png
      const imageUrl = await uploadCatalogImageToMinIO('category', testCategoryId, categoryData.imageName, s3Service);
      testImageUrls.set(testCategoryId, imageUrl);

      await prisma.mainCategory.create({
        data: {
          id: testCategoryId,
          name: categoryData.name,
          description: categoryData.description,
          imageUrl: imageUrl,
        },
      });
    });

    it('Step 1: Sub-kategorileri oluştur, listele ve DB kontrolü yap', async () => {
      // Test sub-kategorileri oluştur
      const subCategoryData = [
        { name: 'DSLR Cameras', description: 'Digital SLR cameras', imageName: 'cameras.png' },
        { name: 'Mirrorless Cameras', description: 'Mirrorless camera systems', imageName: 'cameras.png' },
        { name: 'Action Cameras', description: 'Action and sports cameras', imageName: 'cameras.png' },
      ];

      for (const item of subCategoryData) {
        const subCategoryId = uuidv4();
        testSubCategoryIds.push(subCategoryId);

        // Görseli MinIO'ya yükle
        const imageUrl = await uploadCatalogImageToMinIO('sub-category', subCategoryId, item.imageName, s3Service);
        testImageUrls.set(subCategoryId, imageUrl);

        // DB'ye sub-category ekle
        await prisma.subCategory.create({
          data: {
            id: subCategoryId,
            mainCategoryId: testCategoryId,
            name: item.name,
            description: item.description,
            imageUrl: imageUrl,
          },
        });
      }

      // API'den sub-kategorileri getir
      const response = await request(BASE_URL)
        .get(`/catalog/categories/${testCategoryId}/sub-categories`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
      expect(response.body.length).toBeGreaterThanOrEqual(3);

      // Oluşturduğumuz sub-kategorilerin response'da olduğunu kontrol et
      const responseSubCategoryIds = response.body.map((sc: any) => sc.subCategoryId);
      for (const subCategoryId of testSubCategoryIds) {
        expect(responseSubCategoryIds).toContain(subCategoryId);
        
        const responseSubCategory = response.body.find((sc: any) => sc.subCategoryId === subCategoryId);
        expect(responseSubCategory).toBeDefined();
        expect(responseSubCategory.categoryId).toBe(testCategoryId);
      }

      // DB kontrolü: Her sub-category için
      for (const subCategoryId of testSubCategoryIds) {
        const dbCheck = await verifySubCategoryInDB(subCategoryId, {
          categoryId: testCategoryId,
        });
        expect(dbCheck.exists).toBe(true);
        expect(dbCheck.subCategory).toBeDefined();

        // MinIO kontrolü: Görsel erişilebilir olmalı
        const imageUrl = testImageUrls.get(subCategoryId);
        if (imageUrl) {
          const imageCheck = await verifyImageInMinIO(imageUrl);
          expect(imageCheck.accessible).toBe(true);
          expect(imageCheck.contentType).toContain('image');
          expect(imageCheck.size).toBeGreaterThan(0);
        }
      }

      console.log('✅ Sub-kategoriler başarıyla listelendi ve doğrulandı');
    });
  });

  describe('GET /catalog/sub-categories/:subCategoryId/product-groups', () => {
    let testCategoryId: string;
    let testSubCategoryId: string;
    let testProductGroupIds: string[] = [];

    beforeAll(async () => {
      // Test için kategori ve sub-category oluştur
      testCategoryId = uuidv4();
      testCategoryIds.push(testCategoryId);

      const categoryData = CATALOG_TEST_DATA[1]; // phones.png
      const categoryImageUrl = await uploadCatalogImageToMinIO('category', testCategoryId, categoryData.imageName, s3Service);
      testImageUrls.set(testCategoryId, categoryImageUrl);

      await prisma.mainCategory.create({
        data: {
          id: testCategoryId,
          name: categoryData.name,
          description: categoryData.description,
          imageUrl: categoryImageUrl,
        },
      });

      testSubCategoryId = uuidv4();
      testSubCategoryIds.push(testSubCategoryId);

      const subCategoryImageUrl = await uploadCatalogImageToMinIO('sub-category', testSubCategoryId, categoryData.imageName, s3Service);
      testImageUrls.set(testSubCategoryId, subCategoryImageUrl);

      await prisma.subCategory.create({
        data: {
          id: testSubCategoryId,
          mainCategoryId: testCategoryId,
          name: 'Smartphones',
          description: 'Mobile smartphones',
          imageUrl: subCategoryImageUrl,
        },
      });
    });

    it('Step 1: Product group\'ları oluştur, listele ve DB kontrolü yap', async () => {
      // Test product group'ları oluştur
      const productGroupData = [
        { name: 'iPhone', description: 'Apple iPhone models', imageName: 'phones.png' },
        { name: 'Samsung Galaxy', description: 'Samsung Galaxy series', imageName: 'phones.png' },
        { name: 'Google Pixel', description: 'Google Pixel phones', imageName: 'phones.png' },
      ];

      for (const item of productGroupData) {
        const productGroupId = uuidv4();
        testProductGroupIds.push(productGroupId);

        // Görseli MinIO'ya yükle
        const imageUrl = await uploadCatalogImageToMinIO('product-group', productGroupId, item.imageName, s3Service);
        testImageUrls.set(productGroupId, imageUrl);

        // DB'ye product group ekle
        await prisma.productGroup.create({
          data: {
            id: productGroupId,
            subCategoryId: testSubCategoryId,
            name: item.name,
            description: item.description,
            imageUrl: imageUrl,
          },
        });
      }

      // API'den product group'ları getir
      const response = await request(BASE_URL)
        .get(`/catalog/sub-categories/${testSubCategoryId}/product-groups`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
      expect(response.body.length).toBeGreaterThanOrEqual(3);

      // Oluşturduğumuz product group'ların response'da olduğunu kontrol et
      const responseProductGroupIds = response.body.map((pg: any) => pg.productGroupId);
      for (const productGroupId of testProductGroupIds) {
        expect(responseProductGroupIds).toContain(productGroupId);
        
        const responseProductGroup = response.body.find((pg: any) => pg.productGroupId === productGroupId);
        expect(responseProductGroup).toBeDefined();
        expect(responseProductGroup.subCategoryId).toBe(testSubCategoryId);
      }

      // DB kontrolü: Her product group için
      for (const productGroupId of testProductGroupIds) {
        const dbCheck = await verifyProductGroupInDB(productGroupId, {
          subCategoryId: testSubCategoryId,
        });
        expect(dbCheck.exists).toBe(true);
        expect(dbCheck.productGroup).toBeDefined();

        // MinIO kontrolü: Görsel erişilebilir olmalı
        const imageUrl = testImageUrls.get(productGroupId);
        if (imageUrl) {
          const imageCheck = await verifyImageInMinIO(imageUrl);
          expect(imageCheck.accessible).toBe(true);
          expect(imageCheck.contentType).toContain('image');
          expect(imageCheck.size).toBeGreaterThan(0);
        }
      }

      console.log('✅ Product group\'lar başarıyla listelendi ve doğrulandı');
    });
  });

  describe('GET /catalog/product-groups/:productGroupId/products', () => {
    let testCategoryId: string;
    let testSubCategoryId: string;
    let testProductGroupId: string;
    let testProductIds: string[] = [];

    beforeAll(async () => {
      // Test için kategori, sub-category ve product group oluştur
      testCategoryId = uuidv4();
      testCategoryIds.push(testCategoryId);

      const categoryData = CATALOG_TEST_DATA[2]; // computers-tablets.png
      const categoryImageUrl = await uploadCatalogImageToMinIO('category', testCategoryId, categoryData.imageName, s3Service);
      testImageUrls.set(testCategoryId, categoryImageUrl);

      await prisma.mainCategory.create({
        data: {
          id: testCategoryId,
          name: categoryData.name,
          description: categoryData.description,
          imageUrl: categoryImageUrl,
        },
      });

      testSubCategoryId = uuidv4();
      testSubCategoryIds.push(testSubCategoryId);

      const subCategoryImageUrl = await uploadCatalogImageToMinIO('sub-category', testSubCategoryId, categoryData.imageName, s3Service);
      testImageUrls.set(testSubCategoryId, subCategoryImageUrl);

      await prisma.subCategory.create({
        data: {
          id: testSubCategoryId,
          mainCategoryId: testCategoryId,
          name: 'Laptops',
          description: 'Laptop computers',
          imageUrl: subCategoryImageUrl,
        },
      });

      testProductGroupId = uuidv4();
      testProductGroupIds.push(testProductGroupId);

      const productGroupImageUrl = await uploadCatalogImageToMinIO('product-group', testProductGroupId, categoryData.imageName, s3Service);
      testImageUrls.set(testProductGroupId, productGroupImageUrl);

      await prisma.productGroup.create({
        data: {
          id: testProductGroupId,
          subCategoryId: testSubCategoryId,
          name: 'MacBook',
          description: 'Apple MacBook series',
          imageUrl: productGroupImageUrl,
        },
      });
    });

    it('Step 1: Product\'ları oluştur, listele ve DB kontrolü yap', async () => {
      // Test product'ları oluştur
      const productData = [
        { name: 'MacBook Pro 16"', brand: 'Apple', description: '16-inch MacBook Pro', imageName: 'computers-tablets.png' },
        { name: 'MacBook Air M2', brand: 'Apple', description: 'MacBook Air with M2 chip', imageName: 'computers-tablets.png' },
        { name: 'MacBook Pro 14"', brand: 'Apple', description: '14-inch MacBook Pro', imageName: 'computers-tablets.png' },
      ];

      for (const item of productData) {
        const productId = uuidv4();
        testProductIds.push(productId);

        // Görseli MinIO'ya yükle
        const imageUrl = await uploadCatalogImageToMinIO('product', productId, item.imageName, s3Service);
        testImageUrls.set(productId, imageUrl);

        // DB'ye product ekle
        await prisma.product.create({
          data: {
            id: productId,
            groupId: testProductGroupId,
            name: item.name,
            brand: item.brand,
            description: item.description,
            imageUrl: imageUrl,
          },
        });
      }

      // API'den product'ları getir
      const response = await request(BASE_URL)
        .get(`/catalog/product-groups/${testProductGroupId}/products`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
      expect(response.body.length).toBeGreaterThanOrEqual(3);

      // Oluşturduğumuz product'ların response'da olduğunu kontrol et
      const responseProductIds = response.body.map((p: any) => p.productId);
      for (const productId of testProductIds) {
        expect(responseProductIds).toContain(productId);
        
        const responseProduct = response.body.find((p: any) => p.productId === productId);
        expect(responseProduct).toBeDefined();
        expect(responseProduct.productGroupId).toBe(testProductGroupId);
      }

      // DB kontrolü: Her product için
      for (const productId of testProductIds) {
        const dbCheck = await verifyProductInDB(productId, {
          productGroupId: testProductGroupId,
        });
        expect(dbCheck.exists).toBe(true);
        expect(dbCheck.product).toBeDefined();

        // MinIO kontrolü: Görsel erişilebilir olmalı
        const imageUrl = testImageUrls.get(productId);
        if (imageUrl) {
          const imageCheck = await verifyImageInMinIO(imageUrl);
          expect(imageCheck.accessible).toBe(true);
          expect(imageCheck.contentType).toContain('image');
          expect(imageCheck.size).toBeGreaterThan(0);
        }
      }

      console.log('✅ Product\'lar başarıyla listelendi ve doğrulandı');
    });
  });

  describe('Auth Kontrolü', () => {
    it('Step 1: Auth token olmadan erişim reddedilmeli', async () => {
      const response = await request(BASE_URL)
        .get('/catalog/categories')
        .expect(401);

      expect(response.body.message).toBeDefined();
      console.log('✅ Auth kontrolü başarılı: Token olmadan erişim reddedildi');
    });

    it('Step 2: Geçersiz token ile erişim reddedilmeli', async () => {
      const response = await request(BASE_URL)
        .get('/catalog/categories')
        .set('Authorization', 'Bearer invalid-token-12345')
        .expect(401);

      expect(response.body.message).toBeDefined();
      console.log('✅ Auth kontrolü başarılı: Geçersiz token ile erişim reddedildi');
    });
  });

  describe('MinIO Dizin Yapısı ve Bucket Kontrolü', () => {
    it('Step 1: Bucket mevcut olmalı', async () => {
      // S3Service bucket kontrolü yapıyor, hata fırlatmamalı
      await expect(s3Service.checkAndCreateBucket()).resolves.not.toThrow();
      console.log('✅ Bucket mevcut ve hazır');
    });

    it('Step 2: Catalog görseli doğru dizin yapısında yüklenmeli', async () => {
      const testEntityId = uuidv4();
      const imageName = 'cameras.png';
      
      const imageUrl = await uploadCatalogImageToMinIO('category', testEntityId, imageName, s3Service);
      
      // URL'de dizin yapısını kontrol et
      expect(imageUrl).toContain('catalog-images');
      expect(imageUrl).toContain('category');
      expect(imageUrl).toContain(testEntityId);
      expect(imageUrl).toContain(imageName);

      // Görsel erişilebilir olmalı
      const imageCheck = await verifyImageInMinIO(imageUrl);
      expect(imageCheck.accessible).toBe(true);
      expect(imageCheck.contentType).toContain('image');
      expect(imageCheck.size).toBeGreaterThan(0);

      console.log('✅ Catalog görseli doğru dizin yapısında yüklendi ve erişilebilir');
    });

    it('Step 3: Farklı entity type\'lar için görseller yüklenebilmeli', async () => {
      const testIds = {
        category: uuidv4(),
        'sub-category': uuidv4(),
        'product-group': uuidv4(),
        product: uuidv4(),
      };

      const imageName = 'phones.png';

      for (const [entityType, entityId] of Object.entries(testIds)) {
        const imageUrl = await uploadCatalogImageToMinIO(
          entityType as 'category' | 'sub-category' | 'product-group' | 'product',
          entityId,
          imageName,
          s3Service
        );

        // URL'de doğru entity type'ı kontrol et
        expect(imageUrl).toContain(`catalog-images/${entityType}`);
        expect(imageUrl).toContain(entityId);

        // Görsel erişilebilir olmalı
        const imageCheck = await verifyImageInMinIO(imageUrl);
        expect(imageCheck.accessible).toBe(true);
        expect(imageCheck.contentType).toContain('image');
        expect(imageCheck.size).toBeGreaterThan(0);
      }

      console.log('✅ Tüm entity type\'lar için görseller başarıyla yüklendi');
    });
  });
});

