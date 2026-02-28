import { getPrisma } from './prisma.client';
import { UserDevice } from '../../domain/user/user-device.entity';

export interface CreateUserDeviceData {
  userId: string;
  name: string;
  location?: string | null;
  userAgent: string;
  ipAddress?: string | null;
  isActive?: boolean;
}

export interface UpdateUserDeviceData {
  name?: string;
  location?: string | null;
  userAgent?: string;
  ipAddress?: string | null;
  isActive?: boolean;
}

// Geçici olarak userDevice modeli eksik olduğu için minimal implementation
export class UserDevicePrismaRepository {
  private prisma = getPrisma();

  async create(data: CreateUserDeviceData): Promise<UserDevice | null> {
    // TODO: userDevice modeli schema'ya eklendiğinde implement edilecek
    return null;
  }

  async findByUserId(userId: string): Promise<UserDevice[]> {
    // TODO: userDevice modeli schema'ya eklendiğinde implement edilecek
    return [];
  }

  async findByDeviceId(deviceId: string): Promise<UserDevice | null> {
    // TODO: userDevice modeli schema'ya eklendiğinde implement edilecek
    return null;
  }

  async findById(deviceId: string): Promise<UserDevice | null> {
    // TODO: userDevice modeli schema'ya eklendiğinde implement edilecek
    return null;
  }

  async update(deviceId: string, data: UpdateUserDeviceData): Promise<UserDevice | null> {
    // TODO: userDevice modeli schema'ya eklendiğinde implement edilecek
    return null;
  }

  async delete(deviceId: string): Promise<void> {
    // TODO: userDevice modeli schema'ya eklendiğinde implement edilecek
  }

  async deleteByUserId(userId: string): Promise<number> {
    // TODO: userDevice modeli schema'ya eklendiğinde implement edilecek
    return 0;
  }

  async findByUserIdAndDeviceId(userId: string, deviceId: string): Promise<UserDevice | null> {
    // TODO: userDevice modeli schema'ya eklendiğinde implement edilecek
    return null;
  }

  async setActiveDevice(userId: string, deviceId: string): Promise<void> {
    // TODO: userDevice modeli schema'ya eklendiğinde implement edilecek
  }

  async upsert(userId: string, deviceName: string | null, deviceLocation: string | null, userAgent: string | null, ipAddress: string | null, isActive: boolean): Promise<UserDevice | null> {
    // TODO: userDevice modeli schema'ya eklendiğinde implement edilecek
    return null;
  }
}
