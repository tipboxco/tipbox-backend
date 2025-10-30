import { Prisma, PrismaClient } from '@prisma/client';
import { generateIdForModel } from '../ids/id.strategy';

// Bu middleware, publicId alanı olan modellerde create sırasında otomatik ID üretir
export function registerIdMiddleware(prisma: PrismaClient) {
  prisma.$use(async (params, next) => {
    if (params.action === 'create') {
      const model = params.model as string | undefined;
      const data = (params.args?.data || {}) as Record<string, unknown>;

      // id alanı String/UUID yapılacak modeller için id üret
      if (model) {
        const currentId = (data as any).id;
        if (currentId == null) {
          (params.args.data as any).id = generateIdForModel(model);
        }
      }
    }
    return next(params);
  });
}


