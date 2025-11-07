import { PrismaClient } from '@prisma/client';
import { generateIdForModel } from '../ids/id.strategy';

// Bu middleware, publicId alanı olan modellerde create sırasında otomatik ID üretir
// Prisma 6.x'te $use kaldırıldı, $extends kullanılıyor
export function createPrismaWithIdMiddleware() {
  return new PrismaClient().$extends({
    query: {
      $allModels: {
        async create({ model, args, query }) {
          // id alanı String/UUID yapılacak modeller için id üret
          if (model && args.data) {
            const data = args.data as Record<string, unknown>;
            const currentId = (data as any).id;
            if (currentId == null) {
              (args.data as any).id = generateIdForModel(model);
            }
          }
          return query(args);
        },
      },
    },
  });
}


