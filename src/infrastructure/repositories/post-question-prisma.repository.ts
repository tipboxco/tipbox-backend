import { PostQuestion } from '../../domain/content/post-question.entity';
import { getPrisma } from './prisma.client';
import { QuestionAnswerFormat } from '../../domain/content/question-answer-format.enum';

export class PostQuestionPrismaRepository {
  private prisma = getPrisma();

  async findById(id: string): Promise<PostQuestion | null> {
    const question = await this.prisma.postQuestion.findUnique({ 
      where: { id },
      include: {
        post: true,
        relatedProduct: true
      }
    });
    return question ? this.toDomain(question) : null;
  }

  async findByPostId(postId: string): Promise<PostQuestion | null> {
    const question = await this.prisma.postQuestion.findUnique({
      where: { postId },
      include: {
        post: true,
        relatedProduct: true
      }
    });
    return question ? this.toDomain(question) : null;
  }

  async findByAnswerFormat(format: QuestionAnswerFormat): Promise<PostQuestion[]> {
    const questions = await this.prisma.postQuestion.findMany({
      where: { expectedAnswerFormat: format },
      include: {
        post: true,
        relatedProduct: true
      },
      orderBy: { createdAt: 'desc' }
    });
    return questions.map(question => this.toDomain(question));
  }

  async findByRelatedProduct(productId: string): Promise<PostQuestion[]> {
    const questions = await this.prisma.postQuestion.findMany({
      where: { relatedProductId: productId },
      include: {
        post: true,
        relatedProduct: true
      },
      orderBy: { createdAt: 'desc' }
    });
    return questions.map(question => this.toDomain(question));
  }

  async findWithoutRelatedProduct(): Promise<PostQuestion[]> {
    const questions = await this.prisma.postQuestion.findMany({
      where: { relatedProductId: null },
      include: {
        post: true,
        relatedProduct: true
      },
      orderBy: { createdAt: 'desc' }
    });
    return questions.map(question => this.toDomain(question));
  }

  async create(
    postId: string,
    expectedAnswerFormat: QuestionAnswerFormat,
    relatedProductId?: string
  ): Promise<PostQuestion> {
    const question = await this.prisma.postQuestion.create({
      data: {
        postId,
        expectedAnswerFormat,
        relatedProductId
      },
      include: {
        post: true,
        relatedProduct: true
      }
    });
    return this.toDomain(question);
  }

  async update(id: string, data: { 
    expectedAnswerFormat?: QuestionAnswerFormat;
    relatedProductId?: string;
  }): Promise<PostQuestion | null> {
    const question = await this.prisma.postQuestion.update({
      where: { id },
      data,
      include: {
        post: true,
        relatedProduct: true
      }
    });
    return question ? this.toDomain(question) : null;
  }

  async setRelatedProduct(id: string, productId: string): Promise<PostQuestion | null> {
    return this.update(id, { relatedProductId: productId });
  }

  async removeRelatedProduct(id: string): Promise<PostQuestion | null> {
    return this.update(id, { relatedProductId: undefined });
  }

  async delete(id: string): Promise<boolean> {
    try {
      await this.prisma.postQuestion.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  }

  async deleteByPostId(postId: string): Promise<boolean> {
    try {
      await this.prisma.postQuestion.delete({ where: { postId } });
      return true;
    } catch {
      return false;
    }
  }

  async countByAnswerFormat(format: QuestionAnswerFormat): Promise<number> {
    return await this.prisma.postQuestion.count({
      where: { expectedAnswerFormat: format }
    });
  }

  async countWithRelatedProduct(): Promise<number> {
    return await this.prisma.postQuestion.count({
      where: { relatedProductId: { not: null } }
    });
  }

  async list(): Promise<PostQuestion[]> {
    const questions = await this.prisma.postQuestion.findMany({
      include: {
        post: true,
        relatedProduct: true
      },
      orderBy: { createdAt: 'desc' }
    });
    return questions.map(question => this.toDomain(question));
  }

  private toDomain(prismaQuestion: any): PostQuestion {
    return new PostQuestion(
      prismaQuestion.id,
      prismaQuestion.postId,
      prismaQuestion.expectedAnswerFormat as QuestionAnswerFormat,
      prismaQuestion.relatedProductId,
      prismaQuestion.createdAt,
      prismaQuestion.updatedAt
    );
  }
}