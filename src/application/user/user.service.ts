import { User } from '../../domain/user/user.entity';
import { UserPrismaRepository } from '../../infrastructure/repositories/user-prisma.repository';

export class UserService {
  constructor(private readonly userRepo = new UserPrismaRepository()) {}

  async getUserById(id: number): Promise<User | null> {
    return this.userRepo.findById(id);
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

  async deleteUser(id: number): Promise<boolean> {
    return this.userRepo.delete(id);
  }

  async listUsers(): Promise<User[]> {
    return this.userRepo.list();
  }
} 