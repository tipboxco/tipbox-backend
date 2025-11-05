import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = 'omer@tipbox.co';
  const passwordHash = await bcrypt.hash('password123', 10);
  await prisma.user.upsert({
    where: { email },
    update: { emailVerified: true, passwordHash, status: 'ACTIVE' },
    create: { email, passwordHash, emailVerified: true, status: 'ACTIVE' },
  });
  console.log('✅ omer@tipbox.co verified=true ve şifre güncellendi/oluşturuldu.');
}

main().finally(() => prisma.$disconnect());