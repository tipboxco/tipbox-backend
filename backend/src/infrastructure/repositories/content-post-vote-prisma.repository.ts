import type { ContentPostVote as PrismaContentPostVoteModel } from '@prisma/client';
import { ContentPostVote } from '../../domain/interaction/content-post-vote.entity';
import { VoteType } from '../../domain/interaction/vote-type.enum';
import { getPrisma } from './prisma.client';

export class ContentPostVotePrismaRepository {
  private prisma = getPrisma();

  async findByUserAndPost(userId: string, postId: string): Promise<ContentPostVote | null> {
    const vote = await this.prisma.contentPostVote.findUnique({
      where: {
        userId_postId: {
          userId,
          postId,
        },
      },
    });
    return vote ? this.toDomain(vote) : null;
  }

  async create(data: {
    userId: string;
    postId: string;
    voteType: VoteType;
  }): Promise<ContentPostVote> {
    const vote = await this.prisma.contentPostVote.create({
      data: {
        userId: data.userId,
        postId: data.postId,
        voteType: data.voteType,
      },
    });
    return this.toDomain(vote);
  }

  async delete(id: string): Promise<boolean> {
    try {
      await this.prisma.contentPostVote.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  }

  private toDomain(prismaVote: PrismaContentPostVoteModel): ContentPostVote {
    return new ContentPostVote(
      prismaVote.id,
      prismaVote.userId,
      prismaVote.postId,
      prismaVote.voteType as VoteType,
      prismaVote.createdAt,
      prismaVote.updatedAt,
    );
  }
}
