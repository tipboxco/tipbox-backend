import { Router, Request, Response } from 'express';
import multer, { FileFilterCallback } from 'multer';
import { UserService } from '../../application/user/user.service';
import { CreateUserRequest, UserResponse } from './user.dto';
import { asyncHandler } from '../../infrastructure/errors/async-handler';
import { S3Service } from '../../infrastructure/s3/s3.service';
import { v4 as uuidv4 } from 'uuid';
import logger from '../../infrastructure/logger/logger';

const router = Router();
const userService = new UserService();
const s3Service = new S3Service();

// Multer configuration - memory storage (dosya buffer'da tutulacak)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
    // Sadece resim dosyalarına izin ver
    const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    
    if (file.mimetype && allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Sadece resim dosyaları yüklenebilir (JPG, PNG, GIF, WebP)'));
    }
  },
});

/**
 * @openapi
 * /users:
 *   post:
 *     summary: Yeni kullanıcı oluştur
 *     description: Email ve display name ile yeni kullanıcı oluşturur (admin işlemi)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - displayName
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: yeni.kullanici@tipbox.com
 *                 description: Kullanıcının email adresi (benzersiz olmalı)
 *               displayName:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 50
 *                 example: Yeni Kullanıcı
 *                 description: Kullanıcının görünen adı
 *               bio:
 *                 type: string
 *                 maxLength: 500
 *                 example: Merhaba! Ben yeni bir kullanıcıyım ve Tipbox'ı keşfediyorum.
 *                 description: Kullanıcının kısa biyografisi (opsiyonel)
 *     responses:
 *       201:
 *         description: Kullanıcı başarıyla oluşturuldu
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                   example: "a2y7c1m4xk9q0v3b5n8d6p1r0s"
 *                   description: Oluşturulan kullanıcının benzersiz ID'si
 *                 email:
 *                   type: string
 *                   format: email
 *                   example: yeni.kullanici@tipbox.com
 *                   description: Kullanıcının email adresi
 *                 name:
 *                   type: string
 *                   example: Yeni Kullanıcı
 *                   description: Kullanıcının tam adı
 *                 status:
 *                   type: string
 *                   example: ACTIVE
 *                   description: Kullanıcının hesap durumu
 *                 auth0Id:
 *                   type: string
 *                   nullable: true
 *                   example: null
 *                   description: Auth0 kullanıcı ID'si
 *                 walletAddress:
 *                   type: string
 *                   nullable: true
 *                   example: null
 *                   description: Kullanıcının cüzdan adresi
 *                 kycStatus:
 *                   type: string
 *                   example: PENDING
 *                   description: KYC doğrulama durumu
 *                 createdAt:
 *                   type: string
 *                   format: date-time
 *                   example: "2024-01-15T14:30:00.000Z"
 *                   description: Hesap oluşturulma tarihi
 *                 updatedAt:
 *                   type: string
 *                   format: date-time
 *                   example: "2024-01-15T14:30:00.000Z"
 *                   description: Son güncelleme tarihi
 *       400:
 *         description: Geçersiz istek formatı
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Email ve displayName alanları zorunludur
 *       409:
 *         description: Email zaten kayıtlı
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Bu email adresi zaten kayıtlı
 *       401:
 *         description: Yetkisiz erişim
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Geçersiz token
 *       500:
 *         description: Sunucu hatası
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Kullanıcı oluşturulurken bir hata oluştu
 */
router.post('/', asyncHandler(async (req: Request, res: Response) => {
  const { email, displayName, bio } = req.body as CreateUserRequest;
  const user = await userService.createUser(email, displayName);
  const response: UserResponse = {
    id: user.id,
    email: user.email ?? '',
    name: user.name ?? '',
    status: user.status || 'ACTIVE',
    auth0Id: user.auth0Id || null,
    walletAddress: user.walletAddress || null,
    kycStatus: user.kycStatus || '',
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString()
  };
  res.status(201).json(response);
}));

/**
 * @openapi
 * /users/setup-profile:
 *   post:
 *     summary: Kullanıcı profilini tamamlar (Set Up Profile)
 *     description: Email doğrulaması sonrası kullanıcı profilini tamamlar. FullName, UserName, Avatar ve ilgi alanlarını kaydeder.
 *     operationId: setupUserProfile
 *     tags:
 *       - Users
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - FullName
 *               - UserName
 *               - selectCategories
 *             properties:
 *               FullName:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 100
 *                 example: Ömer Faruk
 *                 description: Kullanıcının tam adı
 *               UserName:
 *                 type: string
 *                 minLength: 3
 *                 maxLength: 30
 *                 pattern: '^[a-zA-Z0-9_]+$'
 *                 example: omerfaruk
 *                 description: Kullanıcının benzersiz kullanıcı adı
 *               Avatar:
 *                 type: string
 *                 format: binary
 *                 description: Profil fotoğrafı (opsiyonel, max 5MB)
 *               selectCategories:
 *                 type: string
 *                 example: '{"userId":"1","selectedCategories":[{"categoryId":"1","subCategoryIds":["1","2"]}]}'
 *                 description: JSON string formatında ilgi alanları
 *     responses:
 *       200:
 *         description: Profil başarıyla tamamlandı
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Profil başarıyla tamamlandı
 *                 user:
 *                   $ref: '#/components/schemas/UserResponse'
 *       400:
 *         description: Geçersiz istek formatı veya eksik alanlar
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: FullName, UserName ve selectCategories alanları zorunludur
 *       401:
 *         description: Yetkisiz erişim veya email doğrulanmamış
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Email doğrulanmamış
 *       409:
 *         description: Kullanıcı adı zaten kullanılıyor
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Bu kullanıcı adı zaten kullanılıyor
 *       500:
 *         description: Sunucu hatası
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Profil tamamlanırken bir hata oluştu
 */
router.post('/setup-profile', upload.single('Avatar'), asyncHandler(async (req: Request & { file?: Express.Multer.File }, res: Response) => {
  const userPayload = (req as any).user;
  const userId = userPayload?.id || userPayload?.userId || userPayload?.sub;
  
  if (!userId) {
    return res.status(401).json({
      success: false,
      message: 'Yetkisiz erişim',
    });
  }

  // ID artık string (UUID/ULID)
  const userIdStr = String(userId);

  const { FullName, UserName, selectCategories } = req.body;

  // Validasyon
  if (!FullName || !UserName || !selectCategories) {
    return res.status(400).json({
      success: false,
      message: 'FullName, UserName ve selectCategories alanları zorunludur',
    });
  }

  // selectCategories JSON parse
  let categoriesData;
  try {
    categoriesData = typeof selectCategories === 'string' 
      ? JSON.parse(selectCategories) 
      : selectCategories;
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: 'selectCategories geçerli bir JSON formatında olmalıdır',
    });
  }

  // Avatar yükleme
  let avatarUrl: string | undefined;
  if (req.file) {
    try {
      // File extension'ı güvenli şekilde al (dosya adından veya MIME type'dan)
      let fileExtension = 'jpg'; // Default extension
      
      // Önce dosya adından extension al
      if (req.file.originalname && req.file.originalname.includes('.')) {
        const parts = req.file.originalname.split('.');
        if (parts.length > 1) {
          fileExtension = parts[parts.length - 1].toLowerCase();
        }
      }
      
      // MIME type'dan extension mapping (güvenlik için)
      const mimeToExtension: Record<string, string> = {
        'image/jpeg': 'jpg',
        'image/jpg': 'jpg',
        'image/png': 'png',
        'image/gif': 'gif',
        'image/webp': 'webp',
        'image/svg+xml': 'svg',
      };
      
      // MIME type varsa onu kullan (daha güvenilir)
      if (req.file.mimetype && mimeToExtension[req.file.mimetype]) {
        fileExtension = mimeToExtension[req.file.mimetype];
      }
      
      // Extension'ı validate et (sadece izin verilen formatlar)
      const allowedExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
      if (!allowedExtensions.includes(fileExtension)) {
        return res.status(400).json({
          success: false,
          message: 'Desteklenmeyen dosya formatı. Sadece JPG, PNG, GIF ve WebP formatları desteklenmektedir.',
        });
      }
      
      // Dosya adını oluştur
      const fileName = `profile-pictures/${userIdStr}/${uuidv4()}.${fileExtension}`;
      
      // Avatar'ı yükle
      avatarUrl = await s3Service.uploadFile(fileName, req.file.buffer, req.file.mimetype);
      
      logger.info({
        message: 'Avatar başarıyla yüklendi',
        userId: userIdStr,
        fileName,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Bilinmeyen hata';
      logger.error({
        message: 'Avatar yükleme hatası',
        error: errorMessage,
        userId: userIdStr,
        fileName: req.file.originalname,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
      });
      
      return res.status(500).json({
        success: false,
        message: `Avatar yüklenirken bir hata oluştu: ${errorMessage}`,
      });
    }
  }

  // Profil setup
  try {
    const user = await userService.setupProfile(userIdStr, {
      fullName: FullName,
      userName: UserName,
      avatarUrl,
      selectedCategories: categoriesData.selectedCategories || [],
    });

    const response: UserResponse = {
      id: user.id,
      email: user.email ?? '',
      name: user.name ?? '',
      status: user.status || 'ACTIVE',
      auth0Id: user.auth0Id || null,
      walletAddress: user.walletAddress || null,
      kycStatus: user.kycStatus || '',
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };

    res.status(200).json({
      success: true,
      message: 'Profil başarıyla tamamlandı',
      user: response,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Bilinmeyen hata';
    
    if (errorMessage.includes('zaten kullanılıyor')) {
      return res.status(409).json({
        success: false,
        message: errorMessage,
      });
    }
    
    if (errorMessage.includes('Email doğrulanmamış')) {
      return res.status(401).json({
        success: false,
        message: errorMessage,
      });
    }

    res.status(500).json({
      success: false,
      message: `Profil tamamlanırken bir hata oluştu: ${errorMessage}`,
    });
  }
}));

/**
 * @openapi
 * /users/{id}:
 *   get:
 *     summary: Kullanıcıyı ID ile getir
 *     description: Belirtilen ID'ye sahip kullanıcının detaylı bilgilerini döner
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: Kullanıcının benzersiz ID'si
 *         example: 1
 *     responses:
 *       200:
 *         description: Kullanıcı başarıyla bulundu
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: integer
 *                   example: 1
 *                   description: Kullanıcının benzersiz ID'si
 *                 email:
 *                   type: string
 *                   format: email
 *                   example: omer@tipbox.co
 *                   description: Kullanıcının email adresi
 *                 name:
 *                   type: string
 *                   example: Ömer Faruk
 *                   description: Kullanıcının tam adı
 *                 status:
 *                   type: string
 *                   example: ACTIVE
 *                   description: Kullanıcının hesap durumu
 *                 auth0Id:
 *                   type: string
 *                   nullable: true
 *                   example: auth0|60f7b3b3b3b3b3b3b3b3b3b3
 *                   description: Auth0 kullanıcı ID'si
 *                 walletAddress:
 *                   type: string
 *                   nullable: true
 *                   example: 0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6
 *                   description: Kullanıcının cüzdan adresi
 *                 kycStatus:
 *                   type: string
 *                   example: VERIFIED
 *                   description: KYC doğrulama durumu
 *                 createdAt:
 *                   type: string
 *                   format: date-time
 *                   example: "2024-01-15T10:30:00.000Z"
 *                   description: Hesap oluşturulma tarihi
 *                 updatedAt:
 *                   type: string
 *                   format: date-time
 *                   example: "2024-01-15T10:30:00.000Z"
 *                   description: Son güncelleme tarihi
 *       404:
 *         description: Kullanıcı bulunamadı
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Kullanıcı bulunamadı
 *       401:
 *         description: Yetkisiz erişim
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Geçersiz token
 *       500:
 *         description: Sunucu hatası
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Kullanıcı bilgileri alınırken bir hata oluştu
 */
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id;
  const user = await userService.getUserById(id);
  if (!user) return res.status(404).json({ message: 'User not found' });
  const response: UserResponse = {
    id: user.id,
    email: user.email ?? '',
    name: user.name ?? '',
    status: user.status || 'ACTIVE',
    auth0Id: user.auth0Id || null,
    walletAddress: user.walletAddress || null,
    kycStatus: user.kycStatus || '',
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString()
  };
  res.json(response);
}));

/**
 * @openapi
 * /users:
 *   get:
 *     summary: Tüm kullanıcıları listele
 *     responses:
 *       200:
 *         description: Kullanıcı listesi
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/UserResponse'
 */
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const users = await userService.listUsers();
  res.json(users.map(user => ({
    id: user.id,
    email: user.email ?? '',
    name: user.name ?? '',
    status: user.status || 'ACTIVE',
    auth0Id: user.auth0Id || null,
    walletAddress: user.walletAddress || null,
    kycStatus: user.kycStatus || '',
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString()
  })));
}));

/**
 * @openapi
 * /users/{id}/profile-card:
 *   get:
 *     summary: Kullanıcının profil kartını getir
 *     description: Profil kartı için isim, avatar, banner, açıklama, unvanlar, istatistikler ve rozetleri döner
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Kullanıcı ID (UUID/ULID)
 *         example: "b6d8c1f2-4a9b-4d1c-9e2a-123456789abc"
 *     responses:
 *       200:
 *         description: Profil kartı
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                   example: "b6d8c1f2-4a9b-4d1c-9e2a-123456789abc"
 *                 name:
 *                   type: string
 *                   example: "Ömer Faruk"
 *                 avatarUrl:
 *                   type: string
 *                   nullable: true
 *                   example: "https://cdn.tipbox.co/profile-pictures/omer.jpg"
 *                 bannerUrl:
 *                   type: string
 *                   nullable: true
 *                   example: "https://cdn.tipbox.co/profile-banners/omer-banner.jpg"
 *                 description:
 *                   type: string
 *                   nullable: true
 *                   example: "Teknoloji meraklısı. Donanım ve yazılım üzerine yazıyorum."
 *                 titles:
 *                   type: array
 *                   items:
 *                     type: string
 *                   example: ["Technology Enthusiast", "Digital Surfer", "Hardware Expert"]
 *                 stats:
 *                   type: object
 *                   properties:
 *                     posts:
 *                       type: integer
 *                       example: 42
 *                     trust:
 *                       type: integer
 *                       example: 15
 *                     truster:
 *                       type: integer
 *                       example: 28
 *                 badges:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       imageUrl:
 *                         type: string
 *                         nullable: true
 *                         example: "https://cdn.tipbox.co/badges/rare-builder.png"
 *                       title:
 *                         type: string
 *                         example: "Rare Builder"
 *       404:
 *         description: Kullanıcı bulunamadı
 */
router.get('/:id/profile-card', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const card = await userService.getUserProfileCard(id);
  if (!card) {
    return res.status(404).json({ message: 'Kullanıcı bulunamadı' });
  }
  res.json(card);
}));

/**
 * @openapi
 * /users/{id}/trusts:
 *   get:
 *     summary: Kullanıcının trust ettiği kullanıcıları listele
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: Kullanıcı ID
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: İsim veya kullanıcı adına göre arama (case-insensitive)
 *     responses:
 *       200:
 *         description: Trust listesi
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id: { type: string, example: "b6d8c1f2-4a9b-4d1c-9e2a-123456789abc" }
 *                   userName: { type: string, nullable: true, example: "omerfaruk" }
 *                   name: { type: string, nullable: true, example: "Ömer Faruk" }
 *                   titles:
 *                     type: array
 *                     items: { type: string }
 *                     example: ["Technology Enthusiast","Digital Surfer","Hardware Expert"]
 *                   avatar: { type: string, nullable: true, example: "https://cdn.tipbox.co/avatars/omer.jpg" }
 */
router.get('/:id/trusts', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const q = (req.query.q as string) || undefined;
  const list = await userService.listTrustedUsers(id, q);
  res.json(list);
}));

/**
 * @openapi
 * /users/{id}/trusters:
 *   get:
 *     summary: Kullanıcıyı trust eden kullanıcıları listele
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: Kullanıcı ID
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: İsim veya kullanıcı adına göre arama (case-insensitive)
 *     responses:
 *       200:
 *         description: Truster listesi
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id: { type: string, example: "7a2d..." }
 *                   userName: { type: string, nullable: true, example: "techguy" }
 *                   name: { type: string, nullable: true, example: "Ali Veli" }
 *                   titles:
 *                     type: array
 *                     items: { type: string }
 *                     example: ["Hardware Expert"]
 *                   avatar: { type: string, nullable: true }
 *                   isTrusted: { type: boolean, example: true }
 */
router.get('/:id/trusters', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const q = (req.query.q as string) || undefined;
  const list = await userService.listTrusters(id, q);
  res.json(list);
}));

/**
 * @openapi
 * /users/{id}/trust/{targetUserId}:
 *   post:
 *     summary: Bir kullanıcıyı trust et
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: targetUserId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       204: { description: Başarılı }
 */
router.post('/:id/trust/:targetUserId', asyncHandler(async (req: Request, res: Response) => {
  const { id, targetUserId } = req.params;
  await userService.addTrust(id, targetUserId);
  res.status(204).send();
}));

/**
 * @openapi
 * /users/{id}/trusts/{targetUserId}:
 *   delete:
 *     summary: Trust listesinden kaldır
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: targetUserId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       204: { description: Başarılı }
 *       404: { description: Kayıt bulunamadı }
 */
router.delete('/:id/trusts/:targetUserId', asyncHandler(async (req: Request, res: Response) => {
  const { id, targetUserId } = req.params;
  const ok = await userService.removeTrust(id, targetUserId);
  if (!ok) return res.status(404).json({ message: 'Kayıt bulunamadı' });
  res.status(204).send();
}));

/**
 * @openapi
 * /users/{id}:
 *   put:
 *     summary: Kullanıcıyı güncelle
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: Kullanıcı ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *               name:
 *                 type: string
 *     responses:
 *       200:
 *         description: Güncellenen kullanıcı
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserResponse'
 *       404:
 *         description: Kullanıcı bulunamadı
 */
router.put('/:id', asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id;
  const { email, status } = req.body;
  const user = await userService.updateUser(id, { email, status });
  if (!user) return res.status(404).json({ message: 'User not found' });
  res.json({
    id: user.id,
    email: user.email ?? '',
    name: user.name ?? '',
    status: user.status || 'ACTIVE',
    auth0Id: user.auth0Id || null,
    walletAddress: user.walletAddress || null,
    kycStatus: user.kycStatus || '',
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString()
  });
}));

/**
 * @openapi
 * /users/{id}:
 *   delete:
 *     summary: Kullanıcıyı sil
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: Kullanıcı ID
 *     responses:
 *       204:
 *         description: Başarıyla silindi
 *       404:
 *         description: Kullanıcı bulunamadı
 */
router.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id;
  const ok = await userService.deleteUser(id);
  if (!ok) return res.status(404).json({ message: 'User not found' });
  res.status(204).send();
}));

export default router; 