import { User } from '../../domain/user/user.entity';
import { UserPrismaRepository } from '../../infrastructure/repositories/user-prisma.repository';

export class UserService {
  constructor(private readonly userRepo = new UserPrismaRepository()) {}

  async getUserById(id: number): Promise<User | null> {
    return this.userRepo.findById(id);
  }

  async createUser(email: string, name?: string): Promise<User> {
    return this.userRepo.create(email, name);
  }

  async updateUser(id: number, data: { email?: string; name?: string }): Promise<User | null> {
    return this.userRepo.update(id, data);
  }

  async deleteUser(id: number): Promise<boolean> {
    return this.userRepo.delete(id);
  }

  async listUsers(): Promise<User[]> {
    return this.userRepo.list();
  }
} 