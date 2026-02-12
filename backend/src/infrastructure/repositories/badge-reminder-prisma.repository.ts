import { getPrisma } from './prisma.client';

export interface BadgeReminderRecord {
  id: string;
  userId: string;
  badgeId: string;
  remindAt: Date;
  createdAt: Date;
}

export class BadgeReminderPrismaRepository {
  private readonly prisma = getPrisma();

  async create(userId: string, badgeId: string, remindAt: Date): Promise<BadgeReminderRecord> {
    const record = await this.prisma.badgeReminder.create({
      data: {
        userId,
        badgeId,
        remindAt,
      },
    });
    return {
      id: record.id,
      userId: record.userId,
      badgeId: record.badgeId,
      remindAt: record.remindAt,
      createdAt: record.createdAt,
    };
  }

  async upsert(userId: string, badgeId: string, remindAt: Date): Promise<BadgeReminderRecord> {
    const existing = await this.prisma.badgeReminder.findFirst({
      where: { userId, badgeId },
    });
    if (existing) {
      const updated = await this.prisma.badgeReminder.update({
        where: { id: existing.id },
        data: { remindAt },
      });
      return {
        id: updated.id,
        userId: updated.userId,
        badgeId: updated.badgeId,
        remindAt: updated.remindAt,
        createdAt: updated.createdAt,
      };
    }
    return this.create(userId, badgeId, remindAt);
  }

  async findDue(now: Date, limit: number = 100): Promise<BadgeReminderRecord[]> {
    const records = await this.prisma.badgeReminder.findMany({
      where: { remindAt: { lte: now } },
      orderBy: { remindAt: 'asc' },
      take: limit,
    });
    return records.map((r) => ({
      id: r.id,
      userId: r.userId,
      badgeId: r.badgeId,
      remindAt: r.remindAt,
      createdAt: r.createdAt,
    }));
  }

  async delete(id: string): Promise<boolean> {
    try {
      await this.prisma.badgeReminder.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  }

  async deleteByUserAndBadge(userId: string, badgeId: string): Promise<number> {
    const result = await this.prisma.badgeReminder.deleteMany({
      where: { userId, badgeId },
    });
    return result.count;
  }
}
