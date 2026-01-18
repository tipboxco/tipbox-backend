import { MessageReaction } from '../../domain/messaging/message-reaction.entity';
import { getPrisma } from './prisma.client';

export class MessageReactionPrismaRepository {
  private prisma = getPrisma();

  async findById(id: string): Promise<MessageReaction | null> {
    const reaction = await this.prisma.messageReaction.findUnique({
      where: { id },
      include: {
        message: true,
        user: true
      }
    });
    return reaction ? this.toDomain(reaction) : null;
  }

  async findByMessageId(messageId: string): Promise<MessageReaction[]> {
    const reactions = await this.prisma.messageReaction.findMany({
      where: { messageId },
      include: {
        user: true
      },
      orderBy: { createdAt: 'asc' }
    });
    return reactions.map(r => this.toDomain(r));
  }

  async findByMessageIdGrouped(messageId: string): Promise<Array<{ emoji: string; count: number; users: string[] }>> {
    const reactions = await this.prisma.messageReaction.findMany({
      where: { messageId },
      include: {
        user: true
      }
    });

    // Group by emoji
    const grouped = reactions.reduce((acc, reaction) => {
      if (!acc[reaction.emoji]) {
        acc[reaction.emoji] = {
          emoji: reaction.emoji,
          count: 0,
          users: [] as string[]
        };
      }
      acc[reaction.emoji].count++;
      acc[reaction.emoji].users.push(reaction.userId);
      return acc;
    }, {} as Record<string, { emoji: string; count: number; users: string[] }>);

    return Object.values(grouped);
  }

  async findByUserIdAndMessageId(userId: string, messageId: string, emoji: string): Promise<MessageReaction | null> {
    const reaction = await this.prisma.messageReaction.findUnique({
      where: {
        messageId_userId_emoji: {
          messageId,
          userId,
          emoji
        }
      },
      include: {
        message: true,
        user: true
      }
    });
    return reaction ? this.toDomain(reaction) : null;
  }

  async create(data: {
    messageId: string;
    userId: string;
    emoji: string;
  }): Promise<MessageReaction> {
    const reaction = await this.prisma.messageReaction.create({
      data: {
        messageId: data.messageId,
        userId: data.userId,
        emoji: data.emoji,
      },
      include: {
        message: true,
        user: true
      }
    });
    return this.toDomain(reaction);
  }

  async delete(id: string): Promise<boolean> {
    try {
      await this.prisma.messageReaction.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  }

  async deleteByMessageIdAndUserIdAndEmoji(messageId: string, userId: string, emoji: string): Promise<boolean> {
    try {
      await this.prisma.messageReaction.delete({
        where: {
          messageId_userId_emoji: {
            messageId,
            userId,
            emoji
          }
        }
      });
      return true;
    } catch {
      return false;
    }
  }

  private toDomain(prismaReaction: any): MessageReaction {
    return new MessageReaction(
      prismaReaction.id,
      prismaReaction.messageId,
      prismaReaction.userId,
      prismaReaction.emoji,
      prismaReaction.createdAt
    );
  }
}
