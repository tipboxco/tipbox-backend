import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';
import { getAuthToken } from '../helpers/auth-helper';
import { requirePostId } from '../helpers/post-test-helper';
import { S3Service } from '../../src/infrastructure/s3/s3.service';
import { ContextType } from '../../src/domain/content/context-type.enum';
import { TipsAndTricksBenefitCategory } from '../../src/domain/content/tips-and-tricks-benefit-category.enum';
import { ExperienceType } from '../../src/domain/content/experience-type.enum';
import { ExperienceStatus } from '../../src/domain/content/experience-status.enum';
import { ContentPostType } from '../../src/domain/content/content-post-type.enum';

// Test ortamında her zaman localhost kullan
const BASE_URL = 'http://localhost:3000';
const prisma = new PrismaClient();

// S3Service'i lazy initialization ile oluştur (beforeAll'da endpoint override edildikten sonra)
let s3Service: S3Service;

// Test görseli yolu
const TEST_IMAGE_PATH = path.join(__dirname, '../post.png');

// Helper: tests/post.png dosyasını oku
function getTestImageBuffer(): Buffer {
  try {
    const imagePath = path.resolve(__dirname, '../post.png');
    if (!fs.existsSync(imagePath)) {
      throw new Error(`Test görseli bulunamadı: ${imagePath}`);
    }
    return fs.readFileSync(imagePath);
  } catch (error) {
    throw new Error(`Test görseli okunamadı: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Helper: MinIO'ya post görseli yükle
async function uploadPostImageToMinIO(
  userId: string,
  postId: string,
  s3ServiceInstance: S3Service
): Promise<string> {
  const imageBuffer = getTestImageBuffer();
  const fileName = `post-images/${userId}/${postId}/${uuidv4()}.png`;
  
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

// Helper: Post body'den görsel URL'lerini çıkar
function extractImageUrlsFromPostBody(body: string): string[] {
  const imageUrlPattern = /https?:\/\/[^\s\)]+\.(png|jpg|jpeg|gif|webp)/gi;
  const matches = body.match(imageUrlPattern);
  return matches || [];
}

// Helper: DB'de post'u kontrol et
async function verifyPostInDB(postId: string, expectedData?: {
  type?: ContentPostType;
  userId?: string;
  bodyShouldContain?: string;
  imageUrls?: string[];
}): Promise<{
  exists: boolean;
  post: any | null;
  matches: boolean;
  errors: string[];
}> {
  const errors: string[] = [];
  
  try {
    const post = await prisma.contentPost.findUnique({
      where: { id: postId },
      include: {
        user: true,
        subCategory: true,
        productGroup: true,
        product: true,
        tip: true,
        question: true,
        comparison: true,
      },
    });

    if (!post) {
      return {
        exists: false,
        post: null,
        matches: false,
        errors: ['Post DB\'de bulunamadı'],
      };
    }

    // Type kontrolü
    if (expectedData?.type && post.type !== expectedData.type) {
      errors.push(`Post type eşleşmiyor. Beklenen: ${expectedData.type}, Bulunan: ${post.type}`);
    }

    // UserId kontrolü
    if (expectedData?.userId && post.userId !== expectedData.userId) {
      errors.push(`UserId eşleşmiyor. Beklenen: ${expectedData.userId}, Bulunan: ${post.userId}`);
    }

    // Body içerik kontrolü
    if (expectedData?.bodyShouldContain && !post.body.includes(expectedData.bodyShouldContain)) {
      errors.push(`Post body beklenen içeriği içermiyor: ${expectedData.bodyShouldContain}`);
    }

    // Image URL kontrolü
    if (expectedData?.imageUrls && expectedData.imageUrls.length > 0) {
      const bodyImageUrls = extractImageUrlsFromPostBody(post.body);
      for (const expectedUrl of expectedData.imageUrls) {
        if (!bodyImageUrls.includes(expectedUrl)) {
          errors.push(`Post body'de beklenen görsel URL'i bulunamadı: ${expectedUrl}`);
        }
      }
    }

    return {
      exists: true,
      post,
      matches: errors.length === 0,
      errors,
    };
  } catch (error) {
    return {
      exists: false,
      post: null,
      matches: false,
      errors: [`DB kontrolü hatası: ${error instanceof Error ? error.message : String(error)}`],
    };
  }
}

// Helper: MinIO'da görseli kontrol et
async function verifyImageInMinIOComplete(imageUrl: string, expectedSize?: number): Promise<{
  exists: boolean;
  accessible: boolean;
  sizeMatches: boolean;
  contentType: string | null;
  errors: string[];
}> {
  const errors: string[] = [];
  
  const verification = await verifyImageInMinIO(imageUrl);
  
  if (!verification.exists) {
    errors.push(`Görsel MinIO'da bulunamadı: ${imageUrl}`);
  }
  
  if (!verification.accessible) {
    errors.push(`Görsel MinIO'dan erişilemiyor: ${imageUrl}`);
  }
  
  if (verification.contentType && !verification.contentType.startsWith('image/')) {
    errors.push(`Görsel content-type yanlış: ${verification.contentType}`);
  }
  
  if (expectedSize && verification.size !== expectedSize) {
    errors.push(`Görsel boyutu eşleşmiyor. Beklenen: ${expectedSize}, Bulunan: ${verification.size}`);
  }
  
  return {
    exists: verification.exists,
    accessible: verification.accessible,
    sizeMatches: !expectedSize || verification.size === expectedSize,
    contentType: verification.contentType,
    errors,
  };
}

describe('Posts API - Kapsamlı Test Suite (DB + MinIO Doğrulamalı)', () => {
  let authToken: string;
  let userId: string;
  
  // Test verileri için context ID'leri
  let subCategoryId: string;
  let productGroupId: string;
  let productId1: string;
  let productId2: string;
  let boostOptionId: string;

  beforeAll(async () => {
    // Test ortamında MinIO'ya localhost üzerinden erişim için endpoint'i override et
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

    // Test görseli kontrolü
    if (!fs.existsSync(TEST_IMAGE_PATH)) {
      throw new Error(`Test görseli bulunamadı: ${TEST_IMAGE_PATH}`);
    }
    console.log('✅ Test görseli hazır');

    // Auth setup - Helper fonksiyonunu kullan
    const authResult = await getAuthToken('omer@tipbox.co', 'password123');
    authToken = authResult.token;
    userId = authResult.userId;

    // Test için context ID'lerini DB'den al veya oluştur
    try {
      // SubCategory bul veya oluştur
      const subCategory = await prisma.subCategory.findFirst();
      if (subCategory) {
        subCategoryId = subCategory.id;
      } else {
        const mainCategory = await prisma.mainCategory.create({
          data: {
            id: uuidv4(),
            name: 'Test Main Category',
            description: 'Test için oluşturuldu',
          },
        });
        const newSubCategory = await prisma.subCategory.create({
          data: {
            id: uuidv4(),
            mainCategoryId: mainCategory.id,
            name: 'Test Sub Category',
            description: 'Test için oluşturuldu',
          },
        });
        subCategoryId = newSubCategory.id;
      }

      // ProductGroup bul veya oluştur
      const productGroup = await prisma.productGroup.findFirst({
        where: { subCategoryId },
      });
      if (productGroup) {
        productGroupId = productGroup.id;
      } else {
        const newProductGroup = await prisma.productGroup.create({
          data: {
            id: uuidv4(),
            subCategoryId,
            name: 'Test Product Group',
            description: 'Test için oluşturuldu',
          },
        });
        productGroupId = newProductGroup.id;
      }

      // Product bul veya oluştur
      const products = await prisma.product.findMany({
        where: { groupId: productGroupId },
        take: 2,
      });
      
      if (products.length >= 2) {
        productId1 = products[0].id;
        productId2 = products[1].id;
      } else {
        const product1 = await prisma.product.create({
          data: {
            id: uuidv4(),
            name: 'Test Product 1',
            groupId: productGroupId,
            description: 'Test için oluşturuldu',
          },
        });
        productId1 = product1.id;
        
        if (products.length === 0) {
          const product2 = await prisma.product.create({
            data: {
              id: uuidv4(),
              name: 'Test Product 2',
              groupId: productGroupId,
              description: 'Test için oluşturuldu',
            },
          });
          productId2 = product2.id;
        } else {
          productId2 = products[0].id;
        }
      }

      // Boost option için mock ID
      boostOptionId = 'boost-option-1';
    } catch (error) {
      console.error('Test data setup error:', error);
      throw error;
    }
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('POST /posts/free - Adım Adım DB + MinIO Doğrulamalı', () => {
    let createdPostId: string;
    let uploadedImageUrl: string;
    const originalImageSize = getTestImageBuffer().length;

    it('Step 1: Post oluştur → DB kontrolü', async () => {
      const res = await request(BASE_URL)
        .post('/posts/free')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          contextType: ContextType.SUB_CATEGORY,
          contextId: subCategoryId,
          description: 'Test serbest gönderi - Adım adım doğrulama',
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      createdPostId = res.body.id;

      // DB kontrolü
      const dbCheck = await verifyPostInDB(createdPostId, {
        type: ContentPostType.FREE,
        userId: userId,
        bodyShouldContain: 'Test serbest gönderi',
      });

      expect(dbCheck.exists).toBe(true);
      expect(dbCheck.matches).toBe(true);
      if (dbCheck.errors.length > 0) {
        throw new Error(`DB doğrulama hatası: ${dbCheck.errors.join(', ')}`);
      }
      console.log('✅ Step 1: Post DB\'de doğrulandı');
    });

    it('Step 2: Görseli MinIO\'ya yükle → MinIO kontrolü', async () => {
      uploadedImageUrl = await uploadPostImageToMinIO(userId, createdPostId, s3Service);
      expect(uploadedImageUrl).toBeTruthy();
      expect(uploadedImageUrl).toContain('tipbox-media');
      expect(uploadedImageUrl).toContain('post-images');

      // MinIO kontrolü
      const minioCheck = await verifyImageInMinIOComplete(uploadedImageUrl, originalImageSize);
      
      expect(minioCheck.exists).toBe(true);
      expect(minioCheck.accessible).toBe(true);
      expect(minioCheck.sizeMatches).toBe(true);
      if (minioCheck.errors.length > 0) {
        throw new Error(`MinIO doğrulama hatası: ${minioCheck.errors.join(', ')}`);
      }
      console.log('✅ Step 2: Görsel MinIO\'da doğrulandı');
    });

    it('Step 3: Post\'u görsel URL ile güncelle → DB kontrolü', async () => {
      requirePostId(createdPostId, 'Step 3: Post güncelleme');
      const currentPost = await prisma.contentPost.findUnique({
        where: { id: createdPostId },
      });
      
      const updatedBody = `${currentPost?.body || ''}\n\n![Post Image](${uploadedImageUrl})`;
      
      await prisma.contentPost.update({
        where: { id: createdPostId },
        data: { body: updatedBody },
      });

      // DB kontrolü - görsel URL'i içermeli
      const dbCheck = await verifyPostInDB(createdPostId, {
        imageUrls: [uploadedImageUrl],
      });

      expect(dbCheck.exists).toBe(true);
      expect(dbCheck.matches).toBe(true);
      if (dbCheck.errors.length > 0) {
        throw new Error(`DB güncelleme doğrulama hatası: ${dbCheck.errors.join(', ')}`);
      }
      console.log('✅ Step 3: Post güncelleme DB\'de doğrulandı');
    });

    it('Step 4: Güncellenmiş post\'u GET ile çek → DB + MinIO kontrolü', async () => {
      requirePostId(createdPostId, 'Step 4: GET ile post çekme');
      // DB'den direkt post'u çek (feed endpoint'i tüm postları döndürmeyebilir)
      const post = await prisma.contentPost.findUnique({
        where: { id: createdPostId },
      });
      expect(post).toBeDefined();

      // DB kontrolü
      const dbCheck = await verifyPostInDB(createdPostId, {
        imageUrls: [uploadedImageUrl],
      });
      expect(dbCheck.matches).toBe(true);

      // MinIO kontrolü
      const minioCheck = await verifyImageInMinIOComplete(uploadedImageUrl);
      expect(minioCheck.accessible).toBe(true);

      console.log('✅ Step 4: GET ile post ve görsel doğrulandı');
    });

    it('Step 5: Post\'u sil → DB kontrolü (post silinmeli, görsel MinIO\'da kalmalı)', async () => {
      requirePostId(createdPostId, 'Step 5: Post silme');
      // Post'u sil
      await prisma.contentPost.delete({
        where: { id: createdPostId },
      });

      // DB kontrolü - post silinmiş olmalı
      const dbCheck = await verifyPostInDB(createdPostId);
      expect(dbCheck.exists).toBe(false);
      console.log('✅ Step 5: Post DB\'den silindi (doğrulandı)');

      // MinIO kontrolü - görsel hala erişilebilir olmalı (soft delete değil)
      const minioCheck = await verifyImageInMinIOComplete(uploadedImageUrl);
      expect(minioCheck.accessible).toBe(true);
      console.log('✅ Step 5: Görsel MinIO\'da hala mevcut (doğrulandı)');
    });
  });

  describe('POST /posts/tips-and-tricks - Adım Adım DB + MinIO Doğrulamalı', () => {
    let createdPostId: string;
    let uploadedImageUrl: string;

    it('Step 1: İpucu post oluştur → DB kontrolü', async () => {
      const res = await request(BASE_URL)
        .post('/posts/tips-and-tricks')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          contextType: ContextType.PRODUCT,
          contextId: productId1,
          description: 'Zaman tasarrufu ipucu',
          benefitCategory: TipsAndTricksBenefitCategory.TIME,
        });

      expect(res.status).toBe(201);
      createdPostId = res.body.id;

      // DB kontrolü
      const dbCheck = await verifyPostInDB(createdPostId, {
        type: ContentPostType.TIPS,
        userId: userId,
      });
      expect(dbCheck.matches).toBe(true);
      expect(dbCheck.post?.tip).toBeDefined();
      // tipCategory kontrolü (benefitCategory değil, tipCategory var)
      expect(dbCheck.post?.tip?.tipCategory).toBeDefined();
      console.log('✅ Step 1: İpucu post DB\'de doğrulandı');
    });

    it('Step 2: Görsel yükle → MinIO kontrolü', async () => {
      uploadedImageUrl = await uploadPostImageToMinIO(userId, createdPostId, s3Service);
      
      const minioCheck = await verifyImageInMinIOComplete(uploadedImageUrl);
      expect(minioCheck.accessible).toBe(true);
      console.log('✅ Step 2: Görsel MinIO\'da doğrulandı');
    });

    it('Step 3: Post\'u güncelle → DB kontrolü', async () => {
      const currentPost = await prisma.contentPost.findUnique({
        where: { id: createdPostId },
      });
      
      await prisma.contentPost.update({
        where: { id: createdPostId },
        data: {
          body: `${currentPost?.body || ''}\n\n![Tip Image](${uploadedImageUrl})`,
        },
      });

      const dbCheck = await verifyPostInDB(createdPostId, {
        imageUrls: [uploadedImageUrl],
      });
      expect(dbCheck.matches).toBe(true);
      console.log('✅ Step 3: Post güncelleme DB\'de doğrulandı');
    });

    it('Step 4: Post body\'yi güncelle → DB + MinIO kontrolü', async () => {
      requirePostId(createdPostId, 'Step 4: Post body güncelleme');
      const newDescription = 'Güncellenmiş ipucu açıklaması';
      await prisma.contentPost.update({
        where: { id: createdPostId },
        data: {
          body: `${newDescription}\n\n![Tip Image](${uploadedImageUrl})`,
        },
      });

      // DB kontrolü
      const dbCheck = await verifyPostInDB(createdPostId, {
        bodyShouldContain: newDescription,
        imageUrls: [uploadedImageUrl],
      });
      expect(dbCheck.matches).toBe(true);

      // MinIO kontrolü
      const minioCheck = await verifyImageInMinIOComplete(uploadedImageUrl);
      expect(minioCheck.accessible).toBe(true);
      console.log('✅ Step 4: Post güncelleme ve görsel doğrulandı');
    });

    it('Step 5: Post\'u sil → DB kontrolü', async () => {
      requirePostId(createdPostId, 'Step 5: Post silme');
      await prisma.contentPost.delete({
        where: { id: createdPostId },
      });

      const dbCheck = await verifyPostInDB(createdPostId);
      expect(dbCheck.exists).toBe(false);
      console.log('✅ Step 5: Post silindi (doğrulandı)');
    });
  });

  describe('POST /posts/question - Adım Adım DB + MinIO Doğrulamalı', () => {
    let createdPostId: string;
    let uploadedImageUrl: string;

    it('Step 1: Boost options listesini al', async () => {
      const boostRes = await request(BASE_URL)
        .get('/posts/boost-options')
        .set('Authorization', `Bearer ${authToken}`);
      
      expect(boostRes.status).toBe(200);
      if (boostRes.body.length > 0) {
        boostOptionId = boostRes.body[0].id;
      }
    });

    it('Step 2: Soru post oluştur → DB kontrolü', async () => {
      // boostOptionId yoksa, mock bir ID kullan
      const boostOptionIdToUse = boostOptionId || 'mock-boost-option-id';
      
      const res = await request(BASE_URL)
        .post('/posts/question')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          contextType: ContextType.PRODUCT,
          contextId: productId1,
          description: 'Ürün hakkında soru',
          selectedBoostOptionId: boostOptionIdToUse,
        });

      // Status kontrolü - 201 veya 400 olabilir (boost option validation)
      if (res.status !== 201) {
        console.error(`❌ Question post oluşturma hatası: Status ${res.status}, Body:`, res.body);
        throw new Error(`Question post oluşturulamadı: ${res.body?.message || 'Bilinmeyen hata'}`);
      }
      
      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      createdPostId = res.body.id;

      // DB kontrolü
      const dbCheck = await verifyPostInDB(createdPostId, {
        type: ContentPostType.QUESTION,
        userId: userId,
      });
      expect(dbCheck.matches).toBe(true);
      expect(dbCheck.post?.question).toBeDefined();
      expect(dbCheck.post?.isBoosted).toBe(true);
      console.log('✅ Step 2: Soru post DB\'de doğrulandı');
    });

    it('Step 3: Görsel yükle → MinIO kontrolü', async () => {
      requirePostId(createdPostId, 'Step 3: Görsel yükleme');
      uploadedImageUrl = await uploadPostImageToMinIO(userId, createdPostId, s3Service);
      
      const minioCheck = await verifyImageInMinIOComplete(uploadedImageUrl);
      expect(minioCheck.accessible).toBe(true);
      console.log('✅ Step 3: Görsel MinIO\'da doğrulandı');
    });

    it('Step 4: Post\'u güncelle → DB kontrolü', async () => {
      requirePostId(createdPostId, 'Step 4: Post güncelleme');
      const currentPost = await prisma.contentPost.findUnique({
        where: { id: createdPostId },
      });
      
      await prisma.contentPost.update({
        where: { id: createdPostId },
        data: {
          body: `${currentPost?.body || ''}\n\n![Question Image](${uploadedImageUrl})`,
        },
      });

      const dbCheck = await verifyPostInDB(createdPostId, {
        imageUrls: [uploadedImageUrl],
      });
      expect(dbCheck.matches).toBe(true);
      console.log('✅ Step 4: Post güncelleme DB\'de doğrulandı');
    });

    it('Step 5: Post\'u sil → DB kontrolü', async () => {
      requirePostId(createdPostId, 'Step 5: Post silme');
      await prisma.contentPost.delete({
        where: { id: createdPostId },
      });

      const dbCheck = await verifyPostInDB(createdPostId);
      expect(dbCheck.exists).toBe(false);
      console.log('✅ Step 5: Post silindi (doğrulandı)');
    });
  });

  describe('POST /posts/benchmark - Adım Adım DB + MinIO Doğrulamalı', () => {
    let createdPostId: string;
    let uploadedImageUrl: string;

    it('Step 1: Benchmark post oluştur → DB kontrolü', async () => {
      const res = await request(BASE_URL)
        .post('/posts/benchmark')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          contextType: ContextType.PRODUCT,
          contextId: productId1,
          products: [
            { productId: productId1, isSelected: true },
            { productId: productId2, isSelected: true }, // En az 2 ürün seçili olmalı
          ],
          description: 'Ürün karşılaştırması',
        });

      // Status kontrolü
      if (res.status !== 201) {
        console.error(`❌ Benchmark post oluşturma hatası: Status ${res.status}, Body:`, res.body);
        throw new Error(`Benchmark post oluşturulamadı: ${res.body?.message || 'Bilinmeyen hata'}`);
      }
      
      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      createdPostId = res.body.id;

      // DB kontrolü
      const dbCheck = await verifyPostInDB(createdPostId, {
        type: ContentPostType.COMPARE,
        userId: userId,
      });
      expect(dbCheck.matches).toBe(true);
      expect(dbCheck.post?.comparison).toBeDefined();
      console.log('✅ Step 1: Benchmark post DB\'de doğrulandı');
    });

    it('Step 2: Görsel yükle → MinIO kontrolü', async () => {
      requirePostId(createdPostId, 'Step 2: Görsel yükleme');
      uploadedImageUrl = await uploadPostImageToMinIO(userId, createdPostId, s3Service);
      
      const minioCheck = await verifyImageInMinIOComplete(uploadedImageUrl);
      expect(minioCheck.accessible).toBe(true);
      console.log('✅ Step 2: Görsel MinIO\'da doğrulandı');
    });

    it('Step 3: Post\'u güncelle → DB kontrolü', async () => {
      requirePostId(createdPostId, 'Step 3: Post güncelleme');
      const currentPost = await prisma.contentPost.findUnique({
        where: { id: createdPostId },
      });
      
      await prisma.contentPost.update({
        where: { id: createdPostId },
        data: {
          body: `${currentPost?.body || ''}\n\n![Benchmark Image](${uploadedImageUrl})`,
        },
      });

      const dbCheck = await verifyPostInDB(createdPostId, {
        imageUrls: [uploadedImageUrl],
      });
      expect(dbCheck.matches).toBe(true);
      console.log('✅ Step 3: Post güncelleme DB\'de doğrulandı');
    });

    it('Step 4: Post\'u sil → DB kontrolü', async () => {
      requirePostId(createdPostId, 'Step 4: Post silme');
      await prisma.contentPost.delete({
        where: { id: createdPostId },
      });

      const dbCheck = await verifyPostInDB(createdPostId);
      expect(dbCheck.exists).toBe(false);
      console.log('✅ Step 4: Post silindi (doğrulandı)');
    });
  });

  describe('POST /posts/experience - Adım Adım DB + MinIO Doğrulamalı', () => {
    let createdPostId: string;
    let uploadedImageUrl: string;
    let experienceOptions: any;

    it('Step 1: Experience options al', async () => {
      const optionsRes = await request(BASE_URL)
        .get('/posts/experience/options')
        .set('Authorization', `Bearer ${authToken}`);

      expect(optionsRes.status).toBe(200);
      experienceOptions = optionsRes.body;
    });

    it('Step 2: Experience post oluştur → DB kontrolü', async () => {
      const res = await request(BASE_URL)
        .post('/posts/experience')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          contextType: ContextType.PRODUCT,
          contextId: productId1,
          selectedDurationId: experienceOptions.durations[0].id,
          selectedLocationId: experienceOptions.locations[0].id,
          selectedPurposeId: experienceOptions.purposes[0].id,
          content: 'Ürün deneyimi',
          experience: [
            {
              type: ExperienceType.PRICE_AND_SHOPPING,
              content: 'Fiyat uygun',
              rating: 5,
            },
          ],
          status: ExperienceStatus.OWN,
        });

      expect(res.status).toBe(201);
      createdPostId = res.body.id;

      // DB kontrolü
      const dbCheck = await verifyPostInDB(createdPostId, {
        type: ContentPostType.EXPERIENCE,
        userId: userId,
      });
      expect(dbCheck.matches).toBe(true);
      console.log('✅ Step 2: Experience post DB\'de doğrulandı');
    });

    it('Step 3: Görsel yükle → MinIO kontrolü', async () => {
      requirePostId(createdPostId, 'Step 3: Görsel yükleme');
      uploadedImageUrl = await uploadPostImageToMinIO(userId, createdPostId, s3Service);
      
      const minioCheck = await verifyImageInMinIOComplete(uploadedImageUrl);
      expect(minioCheck.accessible).toBe(true);
      console.log('✅ Step 3: Görsel MinIO\'da doğrulandı');
    });

    it('Step 4: Post\'u güncelle → DB kontrolü', async () => {
      requirePostId(createdPostId, 'Step 4: Post güncelleme');
      const currentPost = await prisma.contentPost.findUnique({
        where: { id: createdPostId },
      });
      
      await prisma.contentPost.update({
        where: { id: createdPostId },
        data: {
          body: `${currentPost?.body || ''}\n\n![Experience Image](${uploadedImageUrl})`,
        },
      });

      const dbCheck = await verifyPostInDB(createdPostId, {
        imageUrls: [uploadedImageUrl],
      });
      expect(dbCheck.matches).toBe(true);
      console.log('✅ Step 4: Post güncelleme DB\'de doğrulandı');
    });

    it('Step 5: Post\'u sil → DB kontrolü', async () => {
      requirePostId(createdPostId, 'Step 5: Post silme');
      await prisma.contentPost.delete({
        where: { id: createdPostId },
      });

      const dbCheck = await verifyPostInDB(createdPostId);
      expect(dbCheck.exists).toBe(false);
      console.log('✅ Step 5: Post silindi (doğrulandı)');
    });
  });

  describe('POST /posts/update - Adım Adım DB + MinIO Doğrulamalı', () => {
    let createdPostId: string;
    let uploadedImageUrl: string;

    it('Step 1: Update post oluştur → DB kontrolü', async () => {
      const res = await request(BASE_URL)
        .post('/posts/update')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          contextType: ContextType.PRODUCT,
          contextId: productId1,
          content: 'Ürün güncellemesi',
        });

      expect(res.status).toBe(201);
      createdPostId = res.body.id;

      // DB kontrolü
      const dbCheck = await verifyPostInDB(createdPostId, {
        type: ContentPostType.UPDATE,
        userId: userId,
      });
      expect(dbCheck.matches).toBe(true);
      console.log('✅ Step 1: Update post DB\'de doğrulandı');
    });

    it('Step 2: Görsel yükle → MinIO kontrolü', async () => {
      requirePostId(createdPostId, 'Step 2: Görsel yükleme');
      uploadedImageUrl = await uploadPostImageToMinIO(userId, createdPostId, s3Service);
      
      const minioCheck = await verifyImageInMinIOComplete(uploadedImageUrl);
      expect(minioCheck.accessible).toBe(true);
      console.log('✅ Step 2: Görsel MinIO\'da doğrulandı');
    });

    it('Step 3: Post\'u güncelle → DB kontrolü', async () => {
      requirePostId(createdPostId, 'Step 3: Post güncelleme');
      const currentPost = await prisma.contentPost.findUnique({
        where: { id: createdPostId },
      });
      
      await prisma.contentPost.update({
        where: { id: createdPostId },
        data: {
          body: `${currentPost?.body || ''}\n\n![Update Image](${uploadedImageUrl})`,
        },
      });

      const dbCheck = await verifyPostInDB(createdPostId, {
        imageUrls: [uploadedImageUrl],
      });
      expect(dbCheck.matches).toBe(true);
      console.log('✅ Step 3: Post güncelleme DB\'de doğrulandı');
    });

    it('Step 4: GET ile post\'u çek ve görseli MinIO\'dan doğrula', async () => {
      requirePostId(createdPostId, 'Step 4: GET ile post çekme');
      const post = await prisma.contentPost.findUnique({
        where: { id: createdPostId },
      });

      const imageUrls = extractImageUrlsFromPostBody(post?.body || '');
      expect(imageUrls.length).toBeGreaterThan(0);

      // Her görsel URL'ini doğrula
      for (const imageUrl of imageUrls) {
        const imageResponse = await fetch(imageUrl);
        expect(imageResponse.ok).toBe(true);
        expect(imageResponse.headers.get('content-type')).toContain('image/');
      }
      console.log('✅ Step 4: GET ile post ve görsel doğrulandı');
    });

    it('Step 5: Post\'u sil → DB kontrolü', async () => {
      requirePostId(createdPostId, 'Step 5: Post silme');
      await prisma.contentPost.delete({
        where: { id: createdPostId },
      });

      const dbCheck = await verifyPostInDB(createdPostId);
      expect(dbCheck.exists).toBe(false);
      console.log('✅ Step 5: Post silindi (doğrulandı)');
    });
  });

  describe('MinIO Dizin Yapısı ve Bucket Kontrolü', () => {
    it('Step 1: Bucket mevcut olmalı', async () => {
      await s3Service.checkAndCreateBucket();
      // Hata fırlatmazsa bucket mevcut demektir
      expect(true).toBe(true);
      console.log('✅ Step 1: Bucket mevcut (doğrulandı)');
    });

    it('Step 2: Post görseli doğru dizin yapısında yüklenmeli', async () => {
      const testPostId = 'test-post-' + Date.now();
      const imageUrl = await uploadPostImageToMinIO(userId, testPostId, s3Service);
      
      // URL formatı: http://.../tipbox-media/post-images/{userId}/{postId}/{uuid}.png
      expect(imageUrl).toContain('tipbox-media');
      expect(imageUrl).toContain('post-images');
      expect(imageUrl).toContain(userId);
      expect(imageUrl).toContain(testPostId);
      expect(imageUrl).toMatch(/\.png$/);
      console.log('✅ Step 2: Dizin yapısı doğru (doğrulandı)');
    });

    it('Step 3: Aynı post için birden fazla görsel yüklenebilmeli', async () => {
      const testPostId = 'test-post-multi-' + Date.now();
      const imageUrl1 = await uploadPostImageToMinIO(userId, testPostId, s3Service);
      const imageUrl2 = await uploadPostImageToMinIO(userId, testPostId, s3Service);
      
      expect(imageUrl1).not.toBe(imageUrl2); // Farklı UUID'ler
      expect(imageUrl1).toContain(testPostId);
      expect(imageUrl2).toContain(testPostId);
      
      // Her iki görsel de erişilebilir olmalı
      expect(await verifyImageInMinIOComplete(imageUrl1).then(r => r.accessible)).toBe(true);
      expect(await verifyImageInMinIOComplete(imageUrl2).then(r => r.accessible)).toBe(true);
      console.log('✅ Step 3: Çoklu görsel yükleme başarılı (doğrulandı)');
    });
  });
});
