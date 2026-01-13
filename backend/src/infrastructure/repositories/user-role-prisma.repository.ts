import { UserRole } from '../../domain/user/user-role.entity';
import { getPrisma } from './prisma.client';

export class UserRolePrismaRepository {
  private prisma = getPrisma();

  async findById(id: string): Promise<UserRole | null> {
    const role = await this.prisma.userRole.findUnique({ where: { id } });
    return role ? this.toDomain(role) : null;
  }

  async findByUserId(userId: string): Promise<UserRole[]> {
    const roles = await this.prisma.userRole.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });
    return roles.map(role => this.toDomain(role));
  }

  async findByRole(role: string): Promise<UserRole[]> {
    const roles = await this.prisma.userRole.findMany({
      where: { role },
      orderBy: { createdAt: 'desc' }
    });
    return roles.map(userRole => this.toDomain(userRole));
  }

  async findByUserAndRole(userId: string, role: string): Promise<UserRole | null> {
    const userRole = await this.prisma.userRole.findFirst({
      where: {
        userId,
        role
      }
    });
    return userRole ? this.toDomain(userRole) : null;
  }

  async create(userId: string, role: string): Promise<UserRole> {
    const userRole = await this.prisma.userRole.create({
      data: {
        userId,
        role
      }
    });
    return this.toDomain(userRole);
  }

  async delete(id: string): Promise<boolean> {
    try {
      await this.prisma.userRole.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  }

  async deleteByUserAndRole(userId: string, role: string): Promise<boolean> {
    try {
      // Find the record first, then delete by id
      const userRole = await this.prisma.userRole.findFirst({
        where: { userId, role }
      });
      if (userRole) {
        await this.prisma.userRole.delete({ where: { id: userRole.id } });
      }
      return true;
    } catch {
      return false;
    }
  }

  async deleteAllByUserId(userId: string): Promise<boolean> {
    try {
      await this.prisma.userRole.deleteMany({
        where: { userId }
      });
      return true;
    } catch {
      return false;
    }
  }

  async list(): Promise<UserRole[]> {
    const roles = await this.prisma.userRole.findMany();
    return roles.map(role => this.toDomain(role));
  }

  private toDomain(prismaRole: any): UserRole {
    return new UserRole(
      prismaRole.id,
      prismaRole.userId,
      prismaRole.role,
      prismaRole.createdAt,
      prismaRole.updatedAt
    );
  }
}