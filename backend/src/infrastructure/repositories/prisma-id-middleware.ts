import { PrismaClient } from '@prisma/client';
import { generateIdForModel } from '../ids/id.strategy';
import logger from '../logger/logger';

// Bu middleware, publicId alanı olan modellerde create sırasında otomatik ID üretir
// Prisma 6.x'te $use kaldırıldı, $extends kullanılıyor
export function createPrismaWithIdMiddleware() {
  const baseClient = new PrismaClient({
    // Query loglarını kapat, sadece error'ları göster
    log: ['error'],
  });

  const extendedClient = baseClient.$extends({
    query: {
      $allModels: {
        async create({ model, args, query }) {
          // id alanı String/UUID yapılacak modeller için id üret
          if (model && args.data) {
            const data = args.data as Record<string, unknown>;
            const currentId = data.id;
            if (currentId == null) {
              data.id = generateIdForModel(model);
            }
          }
          return query(args);
        },
      },
    },
  });

  // Prisma Client'ı açıkça bağla (async olarak, arka planda)
  // İlk query'de zaten otomatik bağlanır, ama bu explicit bağlantıyı garanti eder
  baseClient.$connect().catch((error) => {
    logger.error({ message: 'Failed to connect to database', error: error instanceof Error ? error.message : String(error) });
  });

  // $extends() dönüş tipi DynamicClientExtensionThis olduğu için event/eventStats
  // TypeScript tarafından tanınmıyor. Runtime'da extended client tüm modellere sahip;
  // tip olarak PrismaClient kullanıyoruz ki event/eventStats erişilebilir olsun.
  return extendedClient as unknown as PrismaClient;
}


