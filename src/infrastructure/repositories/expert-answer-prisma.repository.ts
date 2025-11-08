import { PrismaClient } from '@prisma/client';
import { ExpertAnswer } from '../../domain/expert/expert-answer.entity';

export class ExpertAnswerPrismaRepository {
  private prisma = new PrismaClient();

  async findById(id: string): Promise<ExpertAnswer | null> {
    const answer = await this.prisma.expertAnswer.findUnique({
      where: { id },
      include: {
        expertUser: true,
        request: true,
      },
    });
    return answer ? this.toDomain(answer) : null;
  }

  async findByRequestId(requestId: string): Promise<ExpertAnswer[]> {
    const answers = await this.prisma.expertAnswer.findMany({
      where: { requestId },
      include: {
        expertUser: {
          include: {
            profile: true,
            titles: true,
            avatars: {
              where: { isActive: true },
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return answers.map((answer: any) => this.toDomain(answer));
  }

  async create(
    requestId: string,
    expertUserId: string,
    content: string
  ): Promise<ExpertAnswer> {
    const answer = await this.prisma.expertAnswer.create({
      data: {
        requestId,
        expertUserId,
        content,
      },
      include: {
        expertUser: {
          include: {
            profile: true,
            titles: true,
            avatars: {
              where: { isActive: true },
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        },
      },
    });
    return this.toDomain(answer);
  }

  async update(id: string, content: string): Promise<ExpertAnswer | null> {
    const answer = await this.prisma.expertAnswer.update({
      where: { id },
      data: { content },
      include: {
        expertUser: {
          include: {
            profile: true,
            titles: true,
            avatars: {
              where: { isActive: true },
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        },
      },
    });
    return answer ? this.toDomain(answer) : null;
  }

  async delete(id: string): Promise<boolean> {
    try {
      await this.prisma.expertAnswer.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  }

  private toDomain(prismaAnswer: any): ExpertAnswer {
    return new ExpertAnswer(
      prismaAnswer.id,
      prismaAnswer.requestId,
      prismaAnswer.expertUserId,
      prismaAnswer.content,
      prismaAnswer.createdAt,
      prismaAnswer.updatedAt
    );
  }
}

