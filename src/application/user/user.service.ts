import { User } from '../../domain/user/user.entity';
import { UserPrismaRepository } from '../../infrastructure/repositories/user-prisma.repository';
import { S3Service } from '../../infrastructure/s3/s3.service';
import { CacheService } from '../../infrastructure/cache/cache.service';

export class UserService {
  private readonly s3Service: S3Service;
  private readonly cacheService: CacheService;

  constructor(private readonly userRepo = new UserPrismaRepository()) {
    this.s3Service = new S3Service();
    this.cacheService = CacheService.getInstance();
  }

  async getUserById(id: number): Promise<User | null> {
    return this.userRepo.findById(id);
  }

  /**
   * Kullanıcı profilini cache'ten veya veritabanından alır (Cache-Aside Pattern)
   * @param userId - Kullanıcı ID'si
   * @returns Kullanıcı profili
   */
  async getUserProfile(userId: number): Promise<User | null> {
    const cacheKey = `user:${userId}:profile`;
    
    try {
      // Önce cache'ten kontrol et
      const cachedUser = await this.cacheService.get<User>(cacheKey);
      if (cachedUser) {
        return cachedUser;
      }

      // Cache miss - veritabanından çek
      const user = await this.userRepo.findById(userId);
      if (user) {
        // Cache'e kaydet (1 saat TTL)
        await this.cacheService.set(cacheKey, user, 3600);
      }
      
      return user;
    } catch (error) {
      // Cache hatası durumunda doğrudan veritabanından çek
      return this.userRepo.findById(userId);
    }
  }

  async getUserByEmail(email: string): Promise<User | null> {
    return this.userRepo.findByEmail(email);
  }

  async createUser(email: string, displayName?: string): Promise<User> {
    return this.userRepo.create(email, displayName);
  }

  async createUserWithPassword(email: string, passwordHash: string, displayName?: string): Promise<User> {
    return this.userRepo.createWithPassword(email, passwordHash, displayName);
  }

  async updateUser(id: number, data: { email?: string; passwordHash?: string; status?: string }): Promise<User | null> {
    return this.userRepo.update(id, data);
  }

  /**
   * Kullanıcı profilini günceller ve cache'i temizler
   * @param userId - Kullanıcı ID'si
   * @param data - Güncellenecek veri
   * @returns Güncellenmiş kullanıcı profili
   */
  async updateUserProfile(userId: number, data: { email?: string; passwordHash?: string; status?: string }): Promise<User | null> {
    try {
      // Veritabanını güncelle
      const updatedUser = await this.userRepo.update(userId, data);
      
      if (updatedUser) {
        // Cache'i temizle (cache invalidation)
        const cacheKey = `user:${userId}:profile`;
        await this.cacheService.del(cacheKey);
      }
      
      return updatedUser;
    } catch (error) {
      throw error;
    }
  }

  async deleteUser(id: number): Promise<boolean> {
    return this.userRepo.delete(id);
  }

  async listUsers(): Promise<User[]> {
    return this.userRepo.list();
  }

  /**
   * Kullanıcı profil fotoğrafı yükleme için pre-signed URL oluşturur
   * @param userId - Kullanıcı ID'si
   * @param fileName - Yüklenecek dosya adı
   * @param fileType - Dosya tipi (MIME type)
   * @returns Pre-signed URL ve dosya bilgileri
   */
  async updateUserProfilePicture(userId: number, fileName: string, fileType: string): Promise<{
    uploadUrl: string;
    fileUrl: string;
  }> {
    // Dosya adını kullanıcı ID'si ile prefix'leyerek benzersiz hale getir
    const uniqueFileName = `profile-pictures/${userId}/${fileName}`;
    
    // Pre-signed URL oluştur
    const uploadUrl = await this.s3Service.generatePresignedUploadUrl(uniqueFileName, fileType);
    
    // Dosya yüklendikten sonra erişilecek nihai URL
    // Format: ${S3_ENDPOINT}/${S3_BUCKET_NAME}/${fileName}
    const fileUrl = this.s3Service.getFileUrl(uniqueFileName);
    
    return {
      uploadUrl,
      fileUrl,
    };
  }
} 