import type { PrismaClient } from '@prisma/client';

const ADMIN_EMAIL = 'admin@tipbox.co';
const ADMIN_USER_ID = '00000000-0000-4000-a000-000000000001';
const ADMIN_DISPLAY_NAME = 'Admin';
const ADMIN_USER_NAME = 'admin';

/**
 * Admin panel girişi için admin@tipbox.co kullanıcısını oluşturur veya günceller.
 * Kullanıcı ADMIN rolüne sahip olur. Varsayılan şifre seed'deki DEFAULT_PASSWORD ile aynı (password123).
 */
export async function ensureAdminUser(
  prisma: PrismaClient,
  passwordHash: string
): Promise<void> {
  let user = await prisma.user.findUnique({
    where: { email: ADMIN_EMAIL },
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        id: ADMIN_USER_ID,
        email: ADMIN_EMAIL,
        passwordHash,
        emailVerified: true,
        status: 'ACTIVE',
      },
    });
  } else {
    // Mevcut kullanıcıyı güncelle (şifre hash güncel olsun)
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        emailVerified: true,
        status: 'ACTIVE',
      },
    });
  }

  await prisma.profile.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      displayName: ADMIN_DISPLAY_NAME,
      userName: ADMIN_USER_NAME,
      postsCount: 0,
      trustCount: 0,
      trusterCount: 0,
    },
    update: {
      displayName: ADMIN_DISPLAY_NAME,
      userName: ADMIN_USER_NAME,
    },
  });

  const existingRole = await prisma.userRole.findFirst({
    where: { userId: user.id, role: 'ADMIN' },
  });
  if (!existingRole) {
    await prisma.userRole.create({
      data: { userId: user.id, role: 'ADMIN' },
    });
  }
}
