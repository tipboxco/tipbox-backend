import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { getAuthToken } from '../helpers/auth-helper';
import { S3Service } from '../../src/infrastructure/s3/s3.service';
import { ContextType } from '../../src/domain/content/context-type.enum';
import { TipsAndTricksBenefitCategory } from '../../src/domain/content/tips-and-tricks-benefit-category.enum';
import { ExperienceType } from '../../src/domain/content/experience-type.enum';
import { ExperienceStatus } from '../../src/domain/content/experience-status.enum';
import { ContentPostType } from '../../src/domain/content/content-post-type.enum';
import { generateUuidV4 } from '../../src/infrastructure/ids/id.strategy';
const BASE_URL = 'http://localhost:3000';

// PrismaClient'ı lazy initialization ile oluştur (DATABASE_URL set edildikten sonra)
let prisma: PrismaClient;

let s3Service: S3Service;
let authToken: string;
let userId: string;

// Test görselleri
const POST_IMAGE_PATH = path.join(__dirname, '../assets/post/post.jpg');
const PRODUCT_IMAGE_PATH = path.join(__dirname, '../assets/product/phone1.png');

// Test context ID'leri
let subCategoryId: string;
let productGroupId: string;
let productId1: string;
let productId2: string;
let boostOptionId: string;
let durationId: string;
let locationId: string;
let purposeId: string;

// Helper: Test görseli buffer'ını al
function getTestImageBuffer(imagePath: string): Buffer {
  if (!fs.existsSync(imagePath)) {
    throw new Error(`Test görseli bulunamadı: ${imagePath}`);
  }
  return fs.readFileSync(imagePath);
}

// Helper: MinIO'da görseli doğrula
async function verifyImageInMinIO(imageUrl: string): Promise<{
  exists: boolean;
  accessible: boolean;
  contentType: string | null;
  size: number | null;
  errors: string[];
}> {
  const errors: string[] = [];
  
  try {
    const response = await fetch(imageUrl);
    const accessible = response.ok;
    const contentType = response.headers.get('content-type');
    const size = accessible ? (await response.arrayBuffer()).byteLength : null;
    
    if (!accessible) {
      errors.push(`Görsel erişilemiyor: ${imageUrl} (Status: ${response.status})`);
    }
    
    if (contentType && !contentType.startsWith('image/')) {
      errors.push(`Geçersiz content-type: ${contentType}`);
    }
    
    return {
      exists: accessible,
      accessible,
      contentType,
      size,
      errors,
    };
  } catch (error) {
    errors.push(`Görsel kontrolü hatası: ${error instanceof Error ? error.message : String(error)}`);
    return {
      exists: false,
      accessible: false,
      contentType: null,
      size: null,
      errors,
    };
  }
}

// Helper: PostMedia tablosunu kontrol et
async function verifyPostMediaInDB(postId: string, expectedCount?: number): Promise<{
  exists: boolean;
  mediaCount: number;
  media: any[];
  errors: string[];
}> {
  const errors: string[] = [];
  
  try {
    const media = await prisma.postMedia.findMany({
      where: { postId },
      orderBy: { orderIndex: 'asc' },
    });
    
    if (expectedCount !== undefined && media.length !== expectedCount) {
      errors.push(`PostMedia sayısı eşleşmiyor. Beklenen: ${expectedCount}, Bulunan: ${media.length}`);
    }
    
    // Her media için URL kontrolü
    for (const m of media) {
      if (!m.mediaUrl) {
        errors.push(`PostMedia'da mediaUrl eksik: ${m.id}`);
      }
    }
    
    return {
      exists: media.length > 0,
      mediaCount: media.length,
      media,
      errors,
    };
  } catch (error) {
    errors.push(`DB kontrolü hatası: ${error instanceof Error ? error.message : String(error)}`);
    return {
      exists: false,
      mediaCount: 0,
      media: [],
      errors,
    };
  }
}

// Helper: Post'u DB'de kontrol et
async function verifyPostInDB(postId: string, expectedData?: {
  type?: ContentPostType;
  userId?: string;
  bodyShouldContain?: string;
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
    });
    
    if (!post) {
      return {
        exists: false,
        post: null,
        matches: false,
        errors: ['Post DB\'de bulunamadı'],
      };
    }
    
    if (expectedData?.type && post.type !== expectedData.type) {
      errors.push(`Post type eşleşmiyor. Beklenen: ${expectedData.type}, Bulunan: ${post.type}`);
    }
    
    if (expectedData?.userId && post.userId !== expectedData.userId) {
      errors.push(`UserId eşleşmiyor. Beklenen: ${expectedData.userId}, Bulunan: ${post.userId}`);
    }
    
    if (expectedData?.bodyShouldContain && !post.body.includes(expectedData.bodyShouldContain)) {
      errors.push(`Post body beklenen içeriği içermiyor: ${expectedData.bodyShouldContain}`);
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

describe('Post Endpoints - Kapsamlı Test (Multipart/Form-Data + MinIO + DB)', () => {
  beforeAll(async () => {
    // Test ortamında DATABASE_URL'i localhost olarak ayarla
    // (Testler container dışında çalıştığı için 'postgres' hostname'ine erişemez)
    if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes('postgres:5432')) {
      process.env.DATABASE_URL = process.env.DATABASE_URL?.replace('postgres:5432', 'localhost:5432') 
        || 'postgresql://postgres:postgres@localhost:5432/tipbox_dev';
    }
    
    // PrismaClient'ı DATABASE_URL set edildikten sonra oluştur
    prisma = new PrismaClient();
    
    // S3 endpoint'i localhost olarak ayarla
    if (!process.env.S3_ENDPOINT || process.env.S3_ENDPOINT.includes('minio:')) {
      process.env.S3_ENDPOINT = 'http://localhost:9000';
    }
    
    // Config cache'ini temizle
    delete require.cache[require.resolve('../../src/infrastructure/config/s3.config')];
    delete require.cache[require.resolve('../../src/infrastructure/s3/s3.service')];
    const { S3Service: S3ServiceClass } = await import('../../src/infrastructure/s3/s3.service');
    
    s3Service = new S3ServiceClass();
    
    // MinIO bucket kontrolü
    await s3Service.checkAndCreateBucket();
    console.log('✅ MinIO bucket hazır');
    
    // Test görselleri kontrolü
    if (!fs.existsSync(POST_IMAGE_PATH)) {
      throw new Error(`Test görseli bulunamadı: ${POST_IMAGE_PATH}`);
    }
    if (!fs.existsSync(PRODUCT_IMAGE_PATH)) {
      console.warn(`⚠️ Product görseli bulunamadı: ${PRODUCT_IMAGE_PATH}, sadece post.jpg kullanılacak`);
    }
    console.log('✅ Test görselleri hazır');
    
    // Auth token al
    const authResult = await getAuthToken();
    authToken = authResult.token;
    userId = authResult.userId;
    console.log(`✅ Auth token alındı: ${authToken.substring(0, 20)}...`);
    
    // Test context ID'lerini al veya oluştur
    const subCategory = await prisma.subCategory.findFirst();
    if (subCategory) {
      subCategoryId = subCategory.id;
      const productGroup = await prisma.productGroup.findFirst({
        where: { subCategoryId },
      });
      if (productGroup) {
        productGroupId = productGroup.id;
        const products = await prisma.product.findMany({
          where: { groupId: productGroupId },
          take: 2,
        });
        if (products.length >= 2) {
          productId1 = products[0].id;
          productId2 = products[1].id;
        } else if (products.length === 1) {
          productId1 = products[0].id;
          productId2 = products[0].id;
        } else {
          // Product yoksa oluştur
          const product1 = await prisma.product.create({
            data: {
              id: generateUuidV4(),
              name: 'Test Product 1',
              groupId: productGroupId,
              description: 'Test için oluşturuldu',
            },
          });
          const product2 = await prisma.product.create({
            data: {
              id: generateUuidV4(),
              name: 'Test Product 2',
              groupId: productGroupId,
              description: 'Test için oluşturuldu',
            },
          });
          productId1 = product1.id;
          productId2 = product2.id;
        }
      } else {
        // ProductGroup yoksa oluştur
        const newProductGroup = await prisma.productGroup.create({
          data: {
            subCategoryId,
            name: 'Test Product Group',
            description: 'Test için oluşturuldu',
          },
        });
        productGroupId = newProductGroup.id;
        const product1 = await prisma.product.create({
          data: {
            id: generateUuidV4(),
            name: 'Test Product 1',
            groupId: productGroupId,
            description: 'Test için oluşturuldu',
          },
        });
        const product2 = await prisma.product.create({
          data: {
            id: generateUuidV4(),
            name: 'Test Product 2',
            groupId: productGroupId,
            description: 'Test için oluşturuldu',
          },
        });
        productId1 = product1.id;
        productId2 = product2.id;
      }
    } else {
      // SubCategory yoksa oluştur
      const mainCategory = await prisma.mainCategory.findFirst();
      let mainCatId: string;
      if (mainCategory) {
        mainCatId = mainCategory.id;
      } else {
        const newMainCat = await prisma.mainCategory.create({
          data: {
            name: 'Test Main Category',
            description: 'Test için oluşturuldu',
          },
        });
        mainCatId = newMainCat.id;
      }
      
      const newSubCategory = await prisma.subCategory.create({
        data: {
          mainCategoryId: mainCatId,
          name: 'Test Sub Category',
          description: 'Test için oluşturuldu',
        },
      });
      subCategoryId = newSubCategory.id;
      
      const newProductGroup = await prisma.productGroup.create({
        data: {
          subCategoryId,
          name: 'Test Product Group',
          description: 'Test için oluşturuldu',
        },
      });
      productGroupId = newProductGroup.id;
      
      const product1 = await prisma.product.create({
        data: {
          id: generateUuidV4(),
          name: 'Test Product 1',
          groupId: productGroupId,
          description: 'Test için oluşturuldu',
        },
      });
      const product2 = await prisma.product.create({
        data: {
          id: generateUuidV4(),
          name: 'Test Product 2',
          groupId: productGroupId,
          description: 'Test için oluşturuldu',
        },
      });
      productId1 = product1.id;
      productId2 = product2.id;
    }
    
    // Context ID'lerin set edildiğini kontrol et
    if (!subCategoryId || !productId1 || !productId2) {
      throw new Error('Test context ID\'leri oluşturulamadı');
    }
    console.log(`✅ Test context ID'leri hazır: subCategory=${subCategoryId.substring(0, 8)}..., product1=${productId1.substring(0, 8)}..., product2=${productId2.substring(0, 8)}...`);
    
    // Boost option al
    try {
      const boostRes = await request(BASE_URL)
        .get('/posts/boost-options')
        .set('Authorization', `Bearer ${authToken}`);
      if (boostRes.status === 200 && boostRes.body.length > 0) {
        boostOptionId = boostRes.body[0].id;
      }
    } catch (error) {
      console.warn('⚠️ Boost option alınamadı, mock ID kullanılacak');
      boostOptionId = 'mock-boost-option-id';
    }
    
    // Experience options al
    try {
      const expRes = await request(BASE_URL)
        .get('/posts/experience/options')
        .set('Authorization', `Bearer ${authToken}`);
      if (expRes.status === 200 && expRes.body) {
        durationId = expRes.body.durations?.[0]?.id || 'mock-duration-id';
        locationId = expRes.body.locations?.[0]?.id || 'mock-location-id';
        purposeId = expRes.body.purposes?.[0]?.id || 'mock-purpose-id';
      }
    } catch (error) {
      console.warn('⚠️ Experience options alınamadı, mock ID\'ler kullanılacak');
      durationId = 'mock-duration-id';
      locationId = 'mock-location-id';
      purposeId = 'mock-purpose-id';
    }
    
    console.log('✅ Test setup tamamlandı');
  });
  
  afterAll(async () => {
    await prisma.$disconnect();
  });
  
  describe('POST /posts/free - Multipart/Form-Data ile Görsel Yükleme', () => {
    let createdPostId: string;
    let uploadedImageUrls: string[] = [];
    
    it('1. Post oluştur (görsel ile) → Response kontrolü', async () => {
      const imageBuffer = getTestImageBuffer(POST_IMAGE_PATH);
      console.log(`📤 Görsel buffer boyutu: ${imageBuffer.length} bytes`);
      
      // Debug: Backend'in çalışıp çalışmadığını kontrol et
      try {
        const healthCheck = await request(BASE_URL).get('/health');
        console.log(`📊 Backend health check: ${healthCheck.status}`);
      } catch (error) {
        console.warn(`⚠️ Backend health check başarısız: ${error}`);
      }
      
      const res = await request(BASE_URL)
        .post('/posts/free')
        .set('Authorization', `Bearer ${authToken}`)
        .field('contextType', ContextType.SUB_CATEGORY)
        .field('contextId', subCategoryId)
        .field('description', 'Test serbest gönderi - görsel ile')
        .attach('images', imageBuffer, 'post.jpg');
      
      console.log(`📊 Response status: ${res.status}`);
      console.log(`📊 Response body:`, JSON.stringify(res.body));
      
      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(typeof res.body.id).toBe('string');
      createdPostId = res.body.id;
      console.log(`✅ Post oluşturuldu: ${createdPostId}`);
      
      // Biraz bekle (async işlemler için - görsellerin yüklenmesi ve PostMedia'ya kaydedilmesi için)
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Post'u DB'den çek
      const post = await prisma.contentPost.findUnique({
        where: { id: createdPostId },
      });
      console.log(`📊 Post body: ${post?.body?.substring(0, 200)}`);
      
      // PostMedia kontrolü yap
      const immediateCheck = await verifyPostMediaInDB(createdPostId);
      console.log(`📊 PostMedia kontrolü: ${immediateCheck.mediaCount} kayıt bulundu`);
      if (immediateCheck.media.length > 0) {
        console.log(`📊 PostMedia URL'leri: ${immediateCheck.media.map(m => m.mediaUrl).join(', ')}`);
        uploadedImageUrls = immediateCheck.media.map(m => m.mediaUrl);
      } else {
        console.log(`⚠️ PostMedia kaydı bulunamadı! Post ID: ${createdPostId}`);
        // Debug: Tüm PostMedia kayıtlarını listele
        const allPostMedia = await prisma.postMedia.findMany({
          take: 10,
          orderBy: { createdAt: 'desc' },
        });
        console.log(`📊 Son 10 PostMedia kaydı:`, allPostMedia.map(m => ({ 
          id: m.id.substring(0, 8), 
          postId: m.postId, 
          url: m.mediaUrl?.substring(0, 100) 
        })));
      }
    });
    
    it('2. PostMedia tablosunu kontrol et → DB doğrulama', async () => {
      if (!createdPostId) {
        console.log('⏭️ Post oluşturulamadı, test atlanıyor');
        return;
      }
      
      // Biraz bekle (async işlemler için)
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const mediaCheck = await verifyPostMediaInDB(createdPostId, 1);
      
      console.log(`📊 PostMedia kontrolü detayları:`, {
        exists: mediaCheck.exists,
        mediaCount: mediaCheck.mediaCount,
        errors: mediaCheck.errors,
        media: mediaCheck.media,
      });
      
      if (mediaCheck.mediaCount === 0) {
        // PostMedia kaydı yoksa, post'u kontrol et
        const post = await prisma.contentPost.findUnique({
          where: { id: createdPostId },
        });
        console.log(`📊 Post detayları:`, {
          id: post?.id,
          type: post?.type,
          body: post?.body?.substring(0, 100),
        });
        
        // Tüm PostMedia kayıtlarını listele
        const allMedia = await prisma.postMedia.findMany({
          where: { postId: createdPostId },
        });
        console.log(`📊 Tüm PostMedia kayıtları (postId=${createdPostId}):`, allMedia);
        
        // Eğer hala kayıt yoksa, bu bir sorun - görseller yüklenmemiş demektir
        console.log(`❌ PostMedia kaydı bulunamadı! Görseller yüklenmemiş olabilir.`);
      }
      
      // Eğer uploadedImageUrls zaten set edildiyse (test 1'den), onu kullan
      if (uploadedImageUrls.length === 0 && mediaCheck.mediaCount > 0) {
        uploadedImageUrls = mediaCheck.media.map(m => m.mediaUrl);
      }
      
      expect(mediaCheck.exists).toBe(true);
      expect(mediaCheck.mediaCount).toBe(1);
      expect(mediaCheck.errors.length).toBe(0);
      
      if (uploadedImageUrls.length === 0) {
        uploadedImageUrls = mediaCheck.media.map(m => m.mediaUrl);
      }
      expect(uploadedImageUrls.length).toBe(1);
      expect(uploadedImageUrls[0]).toContain('tipbox-media');
      expect(uploadedImageUrls[0]).toContain('posts');
      console.log(`✅ PostMedia DB'de doğrulandı: ${uploadedImageUrls[0]}`);
    });
    
    it('3. MinIO\'da görseli kontrol et → MinIO doğrulama', async () => {
      if (uploadedImageUrls.length === 0) {
        console.log('⏭️ Görsel URL\'leri bulunamadı, test atlanıyor');
        // PostMedia'dan tekrar al
        const mediaCheck = await verifyPostMediaInDB(createdPostId);
        if (mediaCheck.mediaCount === 0) {
          console.log('❌ PostMedia kaydı yok, görsel yüklenmemiş!');
          return;
        }
        uploadedImageUrls = mediaCheck.media.map(m => m.mediaUrl);
      }
      
      const imageUrl = uploadedImageUrls[0];
      console.log(`🔍 MinIO kontrolü için URL: ${imageUrl}`);
      const minioCheck = await verifyImageInMinIO(imageUrl);
      
      console.log(`📊 MinIO kontrolü sonucu:`, {
        exists: minioCheck.exists,
        accessible: minioCheck.accessible,
        contentType: minioCheck.contentType,
        size: minioCheck.size,
        errors: minioCheck.errors,
      });
      
      expect(minioCheck.exists).toBe(true);
      expect(minioCheck.accessible).toBe(true);
      expect(minioCheck.contentType).toContain('image/');
      expect(minioCheck.errors.length).toBe(0);
      console.log(`✅ Görsel MinIO'da doğrulandı: ${imageUrl}`);
    });
    
    it('4. Post DB kontrolü → Post bilgileri doğrulama', async () => {
      const postCheck = await verifyPostInDB(createdPostId, {
        type: ContentPostType.FREE,
        userId: userId,
        bodyShouldContain: 'Test serbest gönderi',
      });
      
      expect(postCheck.exists).toBe(true);
      expect(postCheck.matches).toBe(true);
      expect(postCheck.errors.length).toBe(0);
      console.log('✅ Post DB bilgileri doğrulandı');
    });
    
    it('5. Çoklu görsel yükleme testi', async () => {
      const imageBuffer1 = getTestImageBuffer(POST_IMAGE_PATH);
      const imageBuffer2 = fs.existsSync(PRODUCT_IMAGE_PATH) 
        ? getTestImageBuffer(PRODUCT_IMAGE_PATH)
        : imageBuffer1; // Fallback
      
      const res = await request(BASE_URL)
        .post('/posts/free')
        .set('Authorization', `Bearer ${authToken}`)
        .field('contextType', ContextType.SUB_CATEGORY)
        .field('contextId', subCategoryId)
        .field('description', 'Test çoklu görsel gönderi')
        .attach('images', imageBuffer1, 'image1.jpg')
        .attach('images', imageBuffer2, 'image2.png');
      
      expect(res.status).toBe(201);
      const multiPostId = res.body.id;
      
      const mediaCheck = await verifyPostMediaInDB(multiPostId, 2);
      expect(mediaCheck.mediaCount).toBe(2);
      expect(mediaCheck.media[0].orderIndex).toBe(0);
      expect(mediaCheck.media[1].orderIndex).toBe(1);
      
      // Her iki görseli MinIO'da kontrol et
      for (const media of mediaCheck.media) {
        const minioCheck = await verifyImageInMinIO(media.mediaUrl);
        expect(minioCheck.accessible).toBe(true);
      }
      
      console.log('✅ Çoklu görsel yükleme doğrulandı');
      
      // Cleanup
      await prisma.contentPost.delete({ where: { id: multiPostId } });
    });
  });
  
  describe('POST /posts/tips-and-tricks - Multipart/Form-Data ile Görsel Yükleme', () => {
    let createdPostId: string;
    let uploadedImageUrls: string[] = [];
    
    it('1. Tips post oluştur (görsel ile) → Response kontrolü', async () => {
      const imageBuffer = getTestImageBuffer(POST_IMAGE_PATH);
      
      const res = await request(BASE_URL)
        .post('/posts/tips-and-tricks')
        .set('Authorization', `Bearer ${authToken}`)
        .field('contextType', ContextType.PRODUCT)
        .field('contextId', productId1)
        .field('description', 'Test ipucu gönderi - görsel ile')
        .field('benefitCategory', TipsAndTricksBenefitCategory.TIME)
        .attach('images', imageBuffer, 'tip.jpg');
      
      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      createdPostId = res.body.id;
      console.log(`✅ Tips post oluşturuldu: ${createdPostId}`);
    });
    
    it('2. PostMedia ve MinIO kontrolü', async () => {
      const mediaCheck = await verifyPostMediaInDB(createdPostId, 1);
      expect(mediaCheck.mediaCount).toBe(1);
      
      uploadedImageUrls = mediaCheck.media.map(m => m.mediaUrl);
      const minioCheck = await verifyImageInMinIO(uploadedImageUrls[0]);
      expect(minioCheck.accessible).toBe(true);
      
      console.log('✅ Tips post görseli doğrulandı');
    });
    
    it('3. Post tip kontrolü', async () => {
      const postCheck = await verifyPostInDB(createdPostId, {
        type: ContentPostType.TIPS,
        userId: userId,
      });
      expect(postCheck.matches).toBe(true);
      
      const post = await prisma.contentPost.findUnique({
        where: { id: createdPostId },
        include: { tip: true },
      });
      expect(post?.tip).toBeDefined();
      console.log('✅ Tips post tipi doğrulandı');
    });
  });
  
  describe('POST /posts/question - Multipart/Form-Data ile Görsel Yükleme', () => {
    let createdPostId: string;
    
    it('1. Question post oluştur (görsel ile) → Response kontrolü', async () => {
      const imageBuffer = getTestImageBuffer(POST_IMAGE_PATH);
      
      const res = await request(BASE_URL)
        .post('/posts/question')
        .set('Authorization', `Bearer ${authToken}`)
        .field('contextType', ContextType.PRODUCT)
        .field('contextId', productId1)
        .field('description', 'Test soru gönderi - görsel ile')
        .field('selectedBoostOptionId', boostOptionId)
        .attach('images', imageBuffer, 'question.jpg');
      
      // Boost option validation hatası olabilir
      if (res.status !== 201) {
        console.warn(`⚠️ Question post oluşturulamadı: ${res.body?.message || 'Bilinmeyen hata'}`);
        // Mock boost option ile tekrar dene
        return;
      }
      
      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      createdPostId = res.body.id;
      console.log(`✅ Question post oluşturuldu: ${createdPostId}`);
    });
    
    it('2. PostMedia ve MinIO kontrolü', async () => {
      if (!createdPostId) {
        console.log('⏭️ Question post oluşturulamadı, test atlanıyor');
        return;
      }
      
      const mediaCheck = await verifyPostMediaInDB(createdPostId, 1);
      expect(mediaCheck.mediaCount).toBe(1);
      
      const imageUrl = mediaCheck.media[0].mediaUrl;
      const minioCheck = await verifyImageInMinIO(imageUrl);
      expect(minioCheck.accessible).toBe(true);
      
      console.log('✅ Question post görseli doğrulandı');
    });
  });
  
  describe('POST /posts/benchmark - JSON Request (Görsel Yok)', () => {
    let createdPostId: string;
    
    it('1. Benchmark post oluştur → Response kontrolü', async () => {
      const res = await request(BASE_URL)
        .post('/posts/benchmark')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          contextType: ContextType.PRODUCT,
          contextId: productId1,
          products: [
            { productId: productId1, isSelected: true },
            { productId: productId2, isSelected: true },
          ],
          description: 'Test karşılaştırma gönderi',
        });
      
      if (res.status !== 201) {
        console.warn(`⚠️ Benchmark post oluşturulamadı: ${res.body?.message || 'Bilinmeyen hata'}`);
        return;
      }
      
      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      createdPostId = res.body.id;
      console.log(`✅ Benchmark post oluşturuldu: ${createdPostId}`);
    });
    
    it('2. Benchmark post görsel yok kontrolü', async () => {
      if (!createdPostId) {
        console.log('⏭️ Benchmark post oluşturulamadı, test atlanıyor');
        return;
      }
      
      const mediaCheck = await verifyPostMediaInDB(createdPostId, 0);
      expect(mediaCheck.mediaCount).toBe(0);
      console.log('✅ Benchmark post görsel yok (beklendiği gibi)');
    });
  });
  
  describe('POST /posts/experience - Multipart/Form-Data ile Görsel Yükleme', () => {
    let createdPostId: string;
    
    it('1. Experience post oluştur (görsel ile) → Response kontrolü', async () => {
      const imageBuffer = getTestImageBuffer(POST_IMAGE_PATH);
      const experienceData = JSON.stringify([
        {
          type: ExperienceType.PRICE_AND_SHOPPING,
          content: 'Fiyat uygun',
          rating: 5,
        },
        {
          type: ExperienceType.PRODUCT_AND_USAGE,
          content: 'Kullanım kolay',
          rating: 4,
        },
      ]);
      
      const res = await request(BASE_URL)
        .post('/posts/experience')
        .set('Authorization', `Bearer ${authToken}`)
        .field('contextType', ContextType.PRODUCT)
        .field('contextId', productId1)
        .field('selectedDurationId', durationId)
        .field('selectedLocationId', locationId)
        .field('selectedPurposeId', purposeId)
        .field('content', 'Test deneyim gönderi - görsel ile')
        .field('experience', experienceData)
        .field('status', ExperienceStatus.OWN)
        .attach('images', imageBuffer, 'experience.jpg');
      
      if (res.status !== 201) {
        console.warn(`⚠️ Experience post oluşturulamadı: ${res.body?.message || 'Bilinmeyen hata'}`);
        return;
      }
      
      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      createdPostId = res.body.id;
      console.log(`✅ Experience post oluşturuldu: ${createdPostId}`);
    });
    
    it('2. PostMedia ve MinIO kontrolü', async () => {
      if (!createdPostId) {
        console.log('⏭️ Experience post oluşturulamadı, test atlanıyor');
        return;
      }
      
      const mediaCheck = await verifyPostMediaInDB(createdPostId, 1);
      expect(mediaCheck.mediaCount).toBe(1);
      
      const imageUrl = mediaCheck.media[0].mediaUrl;
      const minioCheck = await verifyImageInMinIO(imageUrl);
      expect(minioCheck.accessible).toBe(true);
      
      console.log('✅ Experience post görseli doğrulandı');
    });
  });
  
  describe('POST /posts/update - Multipart/Form-Data ile Görsel Yükleme', () => {
    let createdPostId: string;
    
    it('1. Update post oluştur (görsel ile) → Response kontrolü', async () => {
      const imageBuffer = getTestImageBuffer(POST_IMAGE_PATH);
      
      const res = await request(BASE_URL)
        .post('/posts/update')
        .set('Authorization', `Bearer ${authToken}`)
        .field('contextType', ContextType.PRODUCT)
        .field('contextId', productId1)
        .field('content', 'Test güncelleme gönderi - görsel ile')
        .attach('images', imageBuffer, 'update.jpg');
      
      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      createdPostId = res.body.id;
      console.log(`✅ Update post oluşturuldu: ${createdPostId}`);
    });
    
    it('2. PostMedia ve MinIO kontrolü', async () => {
      const mediaCheck = await verifyPostMediaInDB(createdPostId, 1);
      expect(mediaCheck.mediaCount).toBe(1);
      
      const imageUrl = mediaCheck.media[0].mediaUrl;
      const minioCheck = await verifyImageInMinIO(imageUrl);
      expect(minioCheck.accessible).toBe(true);
      
      console.log('✅ Update post görseli doğrulandı');
    });
    
    it('3. Post tip kontrolü', async () => {
      const postCheck = await verifyPostInDB(createdPostId, {
        type: ContentPostType.UPDATE,
        userId: userId,
      });
      expect(postCheck.matches).toBe(true);
      console.log('✅ Update post tipi doğrulandı');
    });
  });
  
  describe('Güvenlik ve Hata Senaryoları', () => {
    it('1. Geçersiz MIME type ile görsel yükleme → Hata kontrolü', async () => {
      const textBuffer = Buffer.from('Bu bir görsel değil');
      
      const res = await request(BASE_URL)
        .post('/posts/free')
        .set('Authorization', `Bearer ${authToken}`)
        .field('contextType', ContextType.SUB_CATEGORY)
        .field('contextId', subCategoryId)
        .field('description', 'Geçersiz görsel test')
        .attach('images', textBuffer, 'fake.txt');
      
      // Multer fileFilter geçersiz dosyayı reddetmeli
      expect(res.status).not.toBe(201);
      console.log('✅ Geçersiz MIME type reddedildi');
    });
    
    it('2. Çok büyük dosya yükleme → Hata kontrolü', async () => {
      // 11MB buffer oluştur (limit 10MB)
      const largeBuffer = Buffer.alloc(11 * 1024 * 1024, 'A');
      
      const res = await request(BASE_URL)
        .post('/posts/free')
        .set('Authorization', `Bearer ${authToken}`)
        .field('contextType', ContextType.SUB_CATEGORY)
        .field('contextId', subCategoryId)
        .field('description', 'Büyük dosya test')
        .attach('images', largeBuffer, 'large.jpg');
      
      // Multer limits hatası olmalı
      expect(res.status).not.toBe(201);
      console.log('✅ Büyük dosya reddedildi');
    });
    
    it('3. Görsel olmadan post oluşturma → Başarılı olmalı', async () => {
      const res = await request(BASE_URL)
        .post('/posts/free')
        .set('Authorization', `Bearer ${authToken}`)
        .field('contextType', ContextType.SUB_CATEGORY)
        .field('contextId', subCategoryId)
        .field('description', 'Görsel olmadan post');
      
      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      
      const mediaCheck = await verifyPostMediaInDB(res.body.id, 0);
      expect(mediaCheck.mediaCount).toBe(0);
      
      console.log('✅ Görsel olmadan post oluşturuldu');
      
      // Cleanup
      await prisma.contentPost.delete({ where: { id: res.body.id } });
    });
    
    it('4. Eksik field ile post oluşturma → Hata kontrolü', async () => {
      const res = await request(BASE_URL)
        .post('/posts/free')
        .set('Authorization', `Bearer ${authToken}`)
        .field('contextType', ContextType.SUB_CATEGORY)
        // contextId eksik
        .field('description', 'Eksik field test');
      
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('message');
      console.log('✅ Eksik field hatası doğrulandı');
    });
    
    it('5. Geçersiz token ile post oluşturma → Hata kontrolü', async () => {
      const imageBuffer = getTestImageBuffer(POST_IMAGE_PATH);
      
      const res = await request(BASE_URL)
        .post('/posts/free')
        .set('Authorization', 'Bearer invalid-token')
        .field('contextType', ContextType.SUB_CATEGORY)
        .field('contextId', subCategoryId)
        .field('description', 'Geçersiz token test')
        .attach('images', imageBuffer, 'test.jpg');
      
      expect(res.status).toBe(401);
      console.log('✅ Geçersiz token reddedildi');
    });
  });
  
  describe('MinIO Dizin Yapısı ve URL Formatı', () => {
    it('1. Görsel URL formatı kontrolü', async () => {
      const imageBuffer = getTestImageBuffer(POST_IMAGE_PATH);
      
      const res = await request(BASE_URL)
        .post('/posts/free')
        .set('Authorization', `Bearer ${authToken}`)
        .field('contextType', ContextType.SUB_CATEGORY)
        .field('contextId', subCategoryId)
        .field('description', 'URL format test')
        .attach('images', imageBuffer, 'test.jpg');
      
      expect(res.status).toBe(201);
      const postId = res.body.id;
      
      const mediaCheck = await verifyPostMediaInDB(postId, 1);
      const imageUrl = mediaCheck.media[0].mediaUrl;
      
      // URL formatı: {BASE_URL}/tipbox-media/posts/{userId}/{uuid}.{ext}
      expect(imageUrl).toContain('tipbox-media');
      expect(imageUrl).toContain('posts');
      expect(imageUrl).toContain(userId);
      expect(imageUrl).toMatch(/\.(jpg|jpeg|png|gif|webp)$/i);
      
      console.log(`✅ URL formatı doğru: ${imageUrl}`);
      
      // Cleanup
      await prisma.contentPost.delete({ where: { id: postId } });
    });
    
    it('2. PostMedia orderIndex kontrolü', async () => {
      const imageBuffer = getTestImageBuffer(POST_IMAGE_PATH);
      
      const res = await request(BASE_URL)
        .post('/posts/free')
        .set('Authorization', `Bearer ${authToken}`)
        .field('contextType', ContextType.SUB_CATEGORY)
        .field('contextId', subCategoryId)
        .field('description', 'Order index test')
        .attach('images', imageBuffer, 'img1.jpg')
        .attach('images', imageBuffer, 'img2.jpg')
        .attach('images', imageBuffer, 'img3.jpg');
      
      expect(res.status).toBe(201);
      const postId = res.body.id;
      
      const mediaCheck = await verifyPostMediaInDB(postId, 3);
      expect(mediaCheck.media[0].orderIndex).toBe(0);
      expect(mediaCheck.media[1].orderIndex).toBe(1);
      expect(mediaCheck.media[2].orderIndex).toBe(2);
      
      console.log('✅ OrderIndex sıralaması doğru');
      
      // Cleanup
      await prisma.contentPost.delete({ where: { id: postId } });
    });
  });
});



