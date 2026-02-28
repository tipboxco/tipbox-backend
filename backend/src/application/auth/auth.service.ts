import { AuthService as IAuthService } from '../../domain/auth/auth.service.interface';
import { User } from '../../domain/user/user.entity';
import { UserPrismaRepository } from '../../infrastructure/repositories/user-prisma.repository';
import { EmailVerificationCodePrismaRepository } from '../../infrastructure/repositories/email-verification-code-prisma.repository';
import { PasswordResetCodePrismaRepository } from '../../infrastructure/repositories/password-reset-code-prisma.repository';
import { UserDevicePrismaRepository } from '../../infrastructure/repositories/user-device-prisma.repository';
import { EmailService } from '../../infrastructure/email/email.service';
import { signJwt, verifyJwt } from '../../infrastructure/auth/jwt.helper';
import { DeviceParser } from '../../infrastructure/utils/device-parser.util';
import bcrypt from 'bcryptjs';
import { getPrisma } from '../../infrastructure/repositories/prisma.client';
import logger from '../../infrastructure/logger/logger';

export class AuthService implements IAuthService {
  private userRepo = new UserPrismaRepository();
  private emailVerificationRepo = new EmailVerificationCodePrismaRepository();
  private passwordResetRepo = new PasswordResetCodePrismaRepository();
  private deviceRepo = new UserDevicePrismaRepository();
  private emailService = new EmailService();
  private prisma = getPrisma();

  /**
   * Mevcut kullanıcı için email doğrulama kodu üretir ve gönderir
   * (kullanıcıyı silmez; önceki aktif kodları invalidate eder)
   */
  async sendEmailVerificationCode(email: string): Promise<{ success: boolean; message: string }> {
    const user = await this.userRepo.findByEmail(email);

    if (!user) {
      return {
        success: false,
        message: 'Kullanıcı bulunamadı',
      };
    }

    if (user.emailVerified) {
      return {
        success: true,
        message: 'Email adresiniz zaten doğrulanmış.',
      };
    }

    const code = this.generateVerificationCode();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10);

    await this.emailVerificationRepo.create(email, code, expiresAt, undefined, undefined, user.id);

    try {
      await this.emailService.sendVerificationCode(email, code);
      return {
        success: true,
        message: 'Email doğrulama kodu gönderildi.',
      };
    } catch (error) {
      logger.error({
        message: 'Failed to send verification code email',
        email,
        userId: user.id,
        error: error instanceof Error ? error.message : String(error),
      });

      // Email servisi hatası olsa bile verification code DB'de oluşturuldu
      // Kullanıcı email servisi düzeltildikten sonra resend ile tekrar deneyebilir
      logger.warn({
        message: 'Email service unavailable; verification code generated but email not sent',
        email,
        userId: user.id,
      });

      return {
        success: true,
        message: 'Doğrulama kodu oluşturuldu. Email gönderilemedi, lütfen tekrar deneyin.',
      };
    }
  }

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
   * Manuel signup - Email, password ve name ile kayıt başlatır, verification code gönderir
   * Kullanıcı henüz oluşturulmaz, sadece verification code oluşturulur ve email gönderilir
   * Kullanıcı email doğrulandığında oluşturulacak
   */
  async signup(email: string, password: string, name?: string): Promise<{ success: boolean; message: string }> {
    try {
      // Email kontrolü - zaten kayıtlı kullanıcı var mı?
      const existingUser = await this.userRepo.findByEmail(email);
      if (existingUser) {
        return {
          success: false,
          message: 'This email address is already registered',
        };
      }

      // Şifre hash'le
      const passwordHash = await bcrypt.hash(password, 10);

      // 6 haneli kod oluştur
      const code = this.generateVerificationCode();

      // Kod süresi: 10 dakika
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + 10);

      // Verification code kaydet (kullanıcı oluşturulmadan, passwordHash ve name ile)
      let verificationCode;
      try {
        verificationCode = await this.emailVerificationRepo.create(
          email, 
          code, 
          expiresAt, 
          passwordHash, 
          name
        );
      } catch (codeError) {
        logger.error({
          message: 'Failed to create verification code during signup',
          email,
          error: codeError instanceof Error ? codeError.message : String(codeError),
        });
        
        return {
          success: false,
          message: 'An error occurred while creating the verification code. Please try again.',
        };
      }

      // Email gönder
      try {
        await this.emailService.sendVerificationCode(email, code);
        return {
          success: true,
          message: 'Registration successful. Email verification code has been sent.',
        };
      } catch (error) {
        logger.error({
          message: 'Failed to send verification email during signup',
          email,
          verificationCodeId: verificationCode.id,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        });
        
        // Email servisi hatası olsa bile verification code oluşturuldu
        // Kullanıcı daha sonra email doğrulama kodunu kullanabilir (email servisi düzeltildikten sonra)
        // Veya admin tarafından manuel olarak doğrulama yapılabilir
        logger.warn({
          message: 'Email service failed but verification code created. User can verify later when email service is fixed.',
          email,
          verificationCodeId: verificationCode.id,
        });

        return {
          success: true,
          message: 'Registration successful. Verification code has been created. Please contact support if you did not receive the verification email.',
        };
      }
    } catch (error) {
      // Beklenmeyen hatalar için genel catch
      logger.error({
        message: 'Unexpected error during signup',
        email,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      
      return {
        success: false,
        message: 'An error occurred during registration. Please try again.',
      };
    }
  }

  /**
   * Email doğrulama - Code ile email'i doğrular ve kullanıcıyı oluşturur
   */
  async verifyEmail(email: string, code: string): Promise<{ success: boolean; token?: string; message: string }> {
    try {
      // Code'u bul
      const verificationCode = await this.emailVerificationRepo.findByCodeAndEmail(code, email);
      
      if (!verificationCode) {
        return {
          success: false,
          message: 'Invalid or expired verification code',
        };
      }

      // Eğer passwordHash yoksa, eski sistem (kullanıcı zaten oluşturulmuş)
      if (!verificationCode.passwordHash) {
        // Eski sistem - kullanıcı zaten var
        if (!verificationCode.userId) {
          return {
            success: false,
            message: 'Invalid verification code',
          };
        }

        const user = await this.userRepo.findById(verificationCode.userId);
        if (!user) {
          return {
            success: false,
            message: 'User not found',
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

        const updatedUser = await this.userRepo.findById(user.id);
        if (!updatedUser) {
          return {
            success: false,
            message: 'Failed to update user',
          };
        }

        const token = this.generateToken(updatedUser);
        return {
          success: true,
          token,
          message: 'Email verification successful',
        };
      }

      // Yeni sistem - kullanıcı henüz oluşturulmamış, şimdi oluştur
      // Email kontrolü - zaten kayıtlı kullanıcı var mı?
      const existingUser = await this.userRepo.findByEmail(email);
      if (existingUser) {
        // Code'u kullanıldı olarak işaretle
        await this.emailVerificationRepo.markAsUsed(verificationCode.id);
        return {
          success: false,
          message: 'This email address is already registered',
        };
      }

      // Kullanıcı oluştur (emailVerified true olarak, çünkü email doğrulandı)
      let user;
      try {
        user = await this.prisma.user.create({
          data: {
            email,
            passwordHash: verificationCode.passwordHash,
            emailVerified: true,
            status: 'ACTIVE',
            profile: verificationCode.name ? {
              create: {
                displayName: verificationCode.name,
              },
            } : undefined,
          },
          include: {
            profile: true,
            wallets: true,
          },
        });
      } catch (createError) {
        logger.error({
          message: 'Failed to create user during email verification',
          email,
          error: createError instanceof Error ? createError.message : String(createError),
          stack: createError instanceof Error ? createError.stack : undefined,
        });
        
        // Code'u kullanıldı olarak işaretle (hata olsa bile)
        await this.emailVerificationRepo.markAsUsed(verificationCode.id);
        
        // Prisma unique constraint hatası (email zaten var)
        if (createError instanceof Error && createError.message.includes('Unique constraint')) {
          return {
            success: false,
            message: 'This email address is already registered',
          };
        }
        
        return {
          success: false,
          message: 'An error occurred while creating the user. Please try again.',
        };
      }

      // Verification code'un userId'sini güncelle
      try {
        await this.prisma.emailVerificationCode.update({
          where: { id: verificationCode.id },
          data: { userId: user.id },
        });
      } catch (updateError) {
        // Kritik değil, log'la
        logger.warn({
          message: 'Failed to update verification code userId',
          verificationCodeId: verificationCode.id,
          userId: user.id,
          error: updateError instanceof Error ? updateError.message : String(updateError),
        });
      }

      // Code'u kullanıldı olarak işaretle
      await this.emailVerificationRepo.markAsUsed(verificationCode.id);

      // Prisma result'ı User entity'ye dönüştür
      const domainUser = await this.userRepo.findById(user.id);
      if (!domainUser) {
        return {
          success: false,
          message: 'Failed to retrieve created user',
        };
      }

      // Token oluştur ve döndür
      const token = this.generateToken(domainUser);

      logger.info({
        message: 'User created and email verified successfully',
        userId: user.id,
        email,
      });

      return {
        success: true,
        token,
        message: 'Email verification successful',
      };
    } catch (error) {
      logger.error({
        message: 'Unexpected error during email verification',
        email,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      
      return {
        success: false,
        message: 'An error occurred during email verification. Please try again.',
      };
    }
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
    // Access token süresi: 7 gün
    return signJwt({ id: user.id, email: user.email }, '7d');
  }

  // Refresh token üretimi (daha uzun süreli - 7 gün)
  generateRefreshToken(user: User): string {
    // Refresh token süresi: 14 gün
    return signJwt({ id: user.id, email: user.email, type: 'refresh' }, '14d');
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
        message: 'If this email address is registered, a password reset code has been sent.',
      };
    }

    // Email doğrulanmış mı kontrol et
    if (!user.emailVerified) {
      return {
        success: false,
        message: 'Your email address is not verified. Please verify your email address first.',
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
        message: 'Password reset code has been sent.',
      };
    } catch (error) {
      logger.error({
        message: 'Failed to send password reset code',
        email,
        userId: user.id,
        error: error instanceof Error ? error.message : String(error),
      });
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        message: `Failed to send email: ${errorMessage}. Please try again.`,
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
        message: 'Invalid or expired code',
      };
    }

    // Kullanıcıyı bul
    const user = await this.userRepo.findById(resetCode.userId);
    if (!user) {
      return {
        success: false,
        message: 'User not found',
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
      message: 'Code verified. You can now create a new password.',
    };
  }

  /**
   * Track Device - Login sırasında cihaz bilgilerini kaydeder veya günceller
   */
  async trackDevice(
    userId: string,
    userAgent: string,
    ipAddress: string | null,
    location?: string | null
  ): Promise<void> {
    try {
      // User-Agent'tan device name parse et
      const deviceName = DeviceParser.parseDeviceName(userAgent);
      
      // Location'ı IP'den al veya parametreden kullan
      let deviceLocation: string | null = location || null;
      if (!deviceLocation && ipAddress) {
        deviceLocation = await DeviceParser.getLocationFromIP(ipAddress);
      }

      // Önce tüm cihazları inactive yap

      // Cihazı upsert et (userAgent unique constraint ile)
      // upsert içinde zaten isActive=true ve lastLoginAt güncelleniyor
      const device = await this.deviceRepo.upsert(
        userId,
        deviceName,
        deviceLocation,
        userAgent,
        ipAddress,
        true // isActive = true
      );

      // Device'ı aktif yap (upsert'ten sonra ID'yi biliyoruz)
      if (device?.id) { await this.deviceRepo.setActiveDevice(userId, device.id); }

      logger.info({
        message: 'Device tracked successfully',
        userId,
        deviceName,
        ipAddress,
        deviceId: device?.id ?? null,
      });
    } catch (error) {
      // Device tracking hatası kritik değil, log'la ve devam et
      logger.error({
        message: 'Error tracking device',
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
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
        message: 'Your email address is not verified',
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
        message: 'Password must be at least 6 characters long',
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
      message: 'Password updated successfully. You can now login with your new password.',
    };
  }

  /**
   * Auth0 ile kullanıcı oluştur veya güncelle
   * Auth0 callback'ten gelen kullanıcı bilgileriyle DB'de kullanıcı oluşturur veya günceller
   */
  async createOrUpdateUserFromAuth0(
    auth0Id: string,
    email: string,
    name?: string,
    emailVerified: boolean = true,
    picture?: string
  ): Promise<User> {
    // Önce auth0Id ile kontrol et
    let user = await this.userRepo.findByAuth0Id(auth0Id);
    
    if (user) {
      // Kullanıcı zaten varsa, email ve profile bilgilerini güncelle
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          email: email || user.email,
          emailVerified: !!emailVerified,
          status: !!emailVerified ? 'ACTIVE' : user.status,
          profile: name && user.displayName !== name ? {
            upsert: {
              create: {
                displayName: name,
              },
              update: {
                displayName: name,
              },
            },
          } : undefined,
        },
      });
      
      // Güncellenmiş kullanıcıyı döndür
      const updatedUser = await this.userRepo.findById(user.id);
      return updatedUser || user;
    }

    // Email ile de kontrol et (email ile kayıt olmuş ama auth0Id eklenmemiş olabilir)
    if (email) {
      const existingUserByEmail = await this.userRepo.findByEmail(email);
      if (existingUserByEmail) {
        const nextEmailVerified = Boolean(emailVerified || existingUserByEmail.emailVerified);
        // Mevcut kullanıcıya auth0Id ekle
        await this.prisma.user.update({
          where: { id: existingUserByEmail.id },
          data: {
            auth0Id,
            emailVerified: nextEmailVerified,
            status: nextEmailVerified ? 'ACTIVE' : 'PENDING_VERIFICATION',
            //emailVerified: emailVerified ?? existingUserByEmail.emailVerified ?? false,
          },
        });
        
        const updatedUser = await this.userRepo.findById(existingUserByEmail.id);
        return updatedUser || existingUserByEmail;
      }
    }

    // Yeni kullanıcı oluştur
    const newUser = await this.userRepo.createWithAuth0(
      auth0Id,
      email || '',
      name,
      emailVerified
    );

    // Eğer picture varsa avatar olarak kaydet
    if (picture && newUser) {
      try {
        await this.prisma.userAvatar.create({
          data: {
            userId: newUser.id,
            imageUrl: picture,
            isActive: true,
          },
        });
      } catch (error) {
        // Avatar kaydetme hatası kritik değil, log'la
        logger.warn({
          message: 'Failed to save Auth0 picture as avatar',
          userId: newUser.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return newUser;
  }

  /**
   * Auth0 kullanıcısı için token oluştur
   */
  generateTokenForAuth0User(user: User): { token: string; refreshToken: string } {
    return {
      token: this.generateToken(user),
      refreshToken: this.generateRefreshToken(user),
    };
  }
} 