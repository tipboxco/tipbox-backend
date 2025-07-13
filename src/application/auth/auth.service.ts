import { AuthService as IAuthService } from '../../domain/auth/auth.service.interface';
import { User } from '../../domain/user/user.entity';
import { UserPrismaRepository } from '../../infrastructure/repositories/user-prisma.repository';
import { signJwt, verifyJwt } from '../../infrastructure/auth/jwt.helper';
import bcrypt from 'bcryptjs';

export class AuthService implements IAuthService {
  private userRepo = new UserPrismaRepository();

  async authenticate(email: string, password: string): Promise<User | null> {
    const user = await this.userRepo.findByEmail(email);
    if (!user) return null;
    // Şifre hash kontrolü
    // if (!user.passwordHash) return null; // passwordHash alanı eklenmeli
    // const valid = await bcrypt.compare(password, user.passwordHash);
    // if (!valid) return null;
    // Şimdilik password kontrolü yok, ileride eklenecek
    return user;
  }

  async register(email: string, password: string, name?: string): Promise<User> {
    // const passwordHash = await bcrypt.hash(password, 10);
    // return this.userRepo.createWithPassword(email, passwordHash, name);
    // Şimdilik password hash yok, ileride eklenecek
    return this.userRepo.create(email, name);
  }

  async validateToken(token: string): Promise<User | null> {
    const payload = verifyJwt(token);
    if (!payload || typeof payload !== 'object' || !('id' in payload)) return null;
    const user = await this.userRepo.findById(Number(payload.id));
    return user;
  }

  async getUserFromToken(token: string): Promise<User | null> {
    return this.validateToken(token);
  }

  // Ekstra: JWT üretimi
  generateToken(user: User): string {
    return signJwt({ id: user.id, email: user.email });
  }
} 