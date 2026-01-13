import { getPrisma } from './prisma.client';

// Geçici olarak userDevice modeli eksik olduğu için minimal implementation
export class UserDevicePrismaRepository {
  private prisma = getPrisma();

  async create(data: any): Promise<any> {
    // TODO: userDevice modeli schema'ya eklendiğinde implement edilecek
    return null;
  }

  async findByUserId(userId: string): Promise<any[]> {
    // TODO: userDevice modeli schema'ya eklendiğinde implement edilecek
    return [];
  }

  async findByDeviceId(deviceId: string): Promise<any | null> {
    // TODO: userDevice modeli schema'ya eklendiğinde implement edilecek
    return null;
  }

  async findById(deviceId: string): Promise<any | null> {
    // TODO: userDevice modeli schema'ya eklendiğinde implement edilecek
    return null;
  }

  async update(deviceId: string, data: any): Promise<any | null> {
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

  async findByUserIdAndDeviceId(userId: string, deviceId: string): Promise<any | null> {
    // TODO: userDevice modeli schema'ya eklendiğinde implement edilecek
    return null;
  }

  async setActiveDevice(userId: string, deviceId: string): Promise<void> {
    // TODO: userDevice modeli schema'ya eklendiğinde implement edilecek
  }

  async upsert(userId: string, deviceName: string | null, deviceLocation: string | null, userAgent: string | null, ipAddress: string | null, isActive: boolean): Promise<any> {
    // TODO: userDevice modeli schema'ya eklendiğinde implement edilecek
    return null;
  }
}
