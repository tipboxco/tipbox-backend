import { getPrisma } from './prisma.client';
import { MainAction } from '../../domain/gamification/main-action.enum';

export class ActionTypeRepository {
  private prisma = getPrisma();

  async findById(id: string) {
    return await this.prisma.actionType.findUnique({
      where: { id },
    });
  }

  async findByMainActionAndCode(mainAction: MainAction, code: string) {
    return await this.prisma.actionType.findFirst({
      where: {
        mainAction,
        code,
      },
    });
  }

  async findByMainAction(mainAction: MainAction) {
    return await this.prisma.actionType.findMany({
      where: { mainAction },
      orderBy: { code: 'asc' },
    });
  }

  async findAll() {
    return await this.prisma.actionType.findMany({
      orderBy: [{ mainAction: 'asc' }, { code: 'asc' }],
    });
  }
}
