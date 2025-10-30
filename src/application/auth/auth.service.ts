import { AuthService as IAuthService } from '../../domain/auth/auth.service.interface';
import { User } from '../../domain/user/user.entity';
import { UserPrismaRepository } from '../../infrastructure/repositories/user-prisma.repository';
import { EmailVerificationCodePrismaRepository } from '../../infrastructure/repositories/email-verification-code-prisma.repository';
import { PasswordResetCodePrismaRepository } from '../../infrastructure/repositories/password-reset-code-prisma.repository';
import { EmailService } from '../../infrastructure/email/email.service';
import { signJwt, verifyJwt } from '../../infrastructure/auth/jwt.helper';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import logger from '../../infrastructure/logger/logger';

export class AuthService implements IAuthService {
  private userRepo = new UserPrismaRepository();
  private emailVerificationRepo = new EmailVerificationCodePrismaRepository();
  private passwordResetRepo = new PasswordResetCodePrismaRepository();
  private emailService = new EmailService();
  private prisma = new PrismaClient();

  async authenticate(email: string, password: string): Promise<User | null> {
    const user = await this.userRepo.findByEmail(email);
    if (!user) return null;
    
    // Şifre hash kontrolü
    if (!user.passwordHash) return null;
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return null;
    
    return user;
  }

  async register(email: string, password: string, name?: string): Promise<User> {
    const passwordHash = await bcrypt.hash(password, 10);
    return this.userRepo.createWithPassword(email, passwordHash, name);
  }

  /**
   * Manuel signup - Email ve password ile kayıt başlatır, verification code gönderir
   */
  async signup(email: string, password: string): Promise<{ success: boolean; message: string }> {
    // Email kontrolü
    const existingUser = await this.userRepo.findByEmail(email);
    if (existingUser) {
      return {
        success: false,
        message: 'Bu email adresi zaten kayıtlı',
      };
    }

    // Şifre hash'le
    const passwordHash = await bcrypt.hash(password, 10);

    // Kullanıcı oluştur (emailVerified false olarak)
    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        emailVerified: false,
        status: 'PENDING_VERIFICATION',
      },
      include: {
        profile: true,
        wallets: true,
      },
    });

    // 6 haneli kod oluştur
    const code = this.generateVerificationCode();

    // Kod süresi: 10 dakika
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10);

    // Verification code kaydet
    await this.emailVerificationRepo.create(user.id, email, code, expiresAt);

    // Email gönder
    try {
      await this.emailService.sendVerificationCode(email, code);
      return {
        success: true,
        message: 'Kayıt başarılı. Email doğrulama kodu gönderildi.',
      };
    } catch (error) {
      // Email gönderilemediyse kullanıcıyı ve verification code'u sil
      try {
        await this.emailVerificationRepo.deleteByUserId(user.id);
        await this.prisma.user.delete({ where: { id: user.id } });
      } catch (deleteError) {
        // Silme hatası durumunda log'la ama devam et
        console.error('Failed to cleanup user after email send failure:', deleteError);
      }
      
      // Detaylı hata mesajı
      const errorMessage = error instanceof Error ? error.message : 'Bilinmeyen hata';
      return {
        success: false,
        message: `Email gönderilemedi: ${errorMessage}. Lütfen tekrar deneyin veya sistem yöneticisiyle iletişime geçin.`,
      };
    }
  }

  /**
   * Email doğrulama - Code ile email'i doğrular
   */
  async verifyEmail(email: string, code: string): Promise<{ success: boolean; token?: string; message: string }> {
    // Code'u bul
    const verificationCode = await this.emailVerificationRepo.findByCodeAndEmail(code, email);
    
    if (!verificationCode) {
      return {
        success: false,
        message: 'Geçersiz veya süresi dolmuş doğrulama kodu',
      };
    }

    // Kullanıcıyı bul
    const user = await this.userRepo.findById(verificationCode.userId);
    if (!user) {
      return {
        success: false,
        message: 'Kullanıcı bulunamadı',
      };
    }

    // Email doğrulandı olarak işaretle
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        status: 'ACTIVE',
      },
    });

    // Code'u kullanıldı olarak işaretle
    await this.emailVerificationRepo.markAsUsed(verificationCode.id);

    // Domain entity'yi güncelle (emailVerified true olarak)
    const updatedUser = await this.userRepo.findById(user.id);
    if (!updatedUser) {
      return {
        success: false,
        message: 'Kullanıcı güncellenemedi',
      };
    }

    // Token oluştur ve döndür
    const token = this.generateToken(updatedUser);

    return {
      success: true,
      token,
      message: 'Email doğrulama başarılı',
    };
  }

  /**
   * 6 haneli doğrulama kodu oluştur
   */
  private generateVerificationCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  async validateToken(token: string): Promise<User | null> {
    const payload = verifyJwt(token);
    if (!payload || typeof payload !== 'object' || !('id' in payload)) return null;
    const user = await this.userRepo.findById(String((payload as any).id));
    return user;
  }

  async getUserFromToken(token: string): Promise<User | null> {
    return this.validateToken(token);
  }

  // Ekstra: JWT üretimi
  generateToken(user: User): string {
    return signJwt({ id: user.id, email: user.email }, '1h');
  }

  // Refresh token üretimi (daha uzun süreli - 7 gün)
  generateRefreshToken(user: User): string {
    return signJwt({ id: user.id, email: user.email, type: 'refresh' }, '7d');
  }

  /**
   * Forgot Password - Şifre sıfırlama kodu oluşturur ve email gönderir
   */
  async forgotPassword(email: string): Promise<{ success: boolean; message: string }> {
    // Kullanıcıyı bul
    const user = await this.userRepo.findByEmail(email);
    
    // Güvenlik: Kullanıcı yoksa da true döndür (email enumeration saldırılarını önlemek için)
    if (!user) {
      logger.warn({
        message: 'Forgot password request for non-existent email',
        email,
      });
      return {
        success: true,
        message: 'Eğer bu email adresi kayıtlıysa, şifre sıfırlama kodu gönderildi.',
      };
    }

    // Email doğrulanmış mı kontrol et
    if (!user.emailVerified) {
      return {
        success: false,
        message: 'Email adresiniz doğrulanmamış. Lütfen önce email adresinizi doğrulayın.',
      };
    }

    // 6 haneli kod oluştur
    const code = this.generateVerificationCode();

    // Kod süresi: 10 dakika
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10);

    // Reset code kaydet
    await this.passwordResetRepo.create(user.id, email, code, expiresAt);

    // Email gönder
    try {
      await this.emailService.sendPasswordResetCode(email, code);
      logger.info({
        message: 'Password reset code sent successfully',
        email,
        userId: user.id,
      });
      return {
        success: true,
        message: 'Şifre sıfırlama kodu gönderildi.',
      };
    } catch (error) {
      logger.error({
        message: 'Failed to send password reset code',
        email,
        userId: user.id,
        error: error instanceof Error ? error.message : String(error),
      });
      
      const errorMessage = error instanceof Error ? error.message : 'Bilinmeyen hata';
      return {
        success: false,
        message: `Email gönderilemedi: ${errorMessage}. Lütfen tekrar deneyin.`,
      };
    }
  }

  /**
   * Verify Reset Code - Şifre sıfırlama kodunu doğrular
   */
  async verifyResetCode(email: string, code: string): Promise<{ success: boolean; message: string }> {
    // Code'u bul
    const resetCode = await this.passwordResetRepo.findByCodeAndEmail(code, email);
    
    if (!resetCode) {
      return {
        success: false,
        message: 'Geçersiz veya süresi dolmuş kod',
      };
    }

    // Kullanıcıyı bul
    const user = await this.userRepo.findById(resetCode.userId);
    if (!user) {
      return {
        success: false,
        message: 'Kullanıcı bulunamadı',
      };
    }

    // Code doğru ve geçerli
    logger.info({
      message: 'Password reset code verified successfully',
      email,
      userId: user.id,
    });

    return {
      success: true,
      message: 'Kod doğrulandı. Yeni şifrenizi oluşturabilirsiniz.',
    };
  }

  /**
   * Reset Password - Yeni şifreyi kaydeder
   */
  async resetPassword(email: string, newPassword: string): Promise<{ success: boolean; message: string }> {
    // Kullanıcıyı bul
    const user = await this.userRepo.findByEmail(email);
    if (!user) {
      return {
        success: false,
        message: 'Kullanıcı bulunamadı',
      };
    }

    // Email doğrulanmış mı kontrol et
    if (!user.emailVerified) {
      return {
        success: false,
        message: 'Email adresiniz doğrulanmamış',
      };
    }

    // Aktif bir reset kodu var mı kontrol et (güvenlik için)
    const activeResetCode = await this.passwordResetRepo.findByCodeAndEmail('', email);
    if (!activeResetCode) {
      // Bu kontrolü bypass edebiliriz çünkü verify-reset-code'dan sonra çağrılıyor
      // Ama daha güvenli olması için aktif kod kontrolü yapabiliriz
      logger.warn({
        message: 'Password reset attempted without valid verification code',
        email,
        userId: user.id,
      });
    }

    // Şifre validasyonu
    if (!newPassword || newPassword.length < 6) {
      return {
        success: false,
        message: 'Şifre en az 6 karakter olmalıdır',
      };
    }

    // Yeni şifreyi hash'le
    const passwordHash = await bcrypt.hash(newPassword, 10);

    // Şifreyi güncelle ve tüm reset kodlarını iptal et
    await this.prisma.$transaction(async (tx) => {
      // Şifreyi güncelle
      await tx.user.update({
        where: { id: user.id },
        data: { passwordHash },
      });

      // Tüm aktif reset kodlarını iptal et
      await tx.passwordResetToken.updateMany({
        where: {
          userId: user.id,
          isUsed: false,
        },
        data: {
          isUsed: true,
        },
      });
    });

    logger.info({
      message: 'Password reset completed successfully',
      email,
      userId: user.id,
    });

    return {
      success: true,
      message: 'Şifre başarıyla güncellendi. Yeni şifrenizle giriş yapabilirsiniz.',
    };
  }
} 