import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const prisma = getPrisma();

async function deleteJuliaHavkaThread() {
  console.log('🔍 Julia-Havka thread\'i aranıyor...\n');

  // Julia user ID: 99999999-9999-4999-9999-999999999999 (ozan@tipbox.co)
  const JULIA_USER_ID = '99999999-9999-4999-9999-999999999999';

  // Find Julia user
  const juliaUser = await prisma.user.findUnique({
    where: { id: JULIA_USER_ID },
    select: { id: true, email: true },
  });

  if (!juliaUser) {
    console.log('❌ Julia kullanıcısı bulunamadı');
    return;
  }

  console.log(`✓ Julia bulundu: ${juliaUser.email} (${juliaUser.id})\n`);

  // Find all threads where Julia is a participant
  const threads = await prisma.dMThread.findMany({
    where: {
      OR: [
        { userOneId: JULIA_USER_ID },
        { userTwoId: JULIA_USER_ID },
      ],
    },
    include: {
      userOne: {
        select: { id: true, email: true },
      },
      userTwo: {
        select: { id: true, email: true },
      },
      messages: {
        select: { id: true },
        take: 1,
      },
    },
  });

  console.log(`📋 ${threads.length} thread bulundu:\n`);

  threads.forEach((thread, index) => {
    const otherUser = thread.userOneId === JULIA_USER_ID ? thread.userTwo : thread.userOne;
    console.log(`  ${index + 1}. Thread ID: ${thread.id}`);
    console.log(`     User One: ${thread.userOne.email} (${thread.userOne.id})`);
    console.log(`     User Two: ${thread.userTwo.email} (${thread.userTwo.id})`);
    console.log(`     Mesaj sayısı: ${thread.messages.length}`);
    console.log(`     Support Thread: ${thread.isSupportThread ? 'Evet' : 'Hayır'}\n`);
  });

  // Find thread with Havka (search by email or name)
  let havkaThread = null;
  for (const thread of threads) {
    const otherUser = thread.userOneId === JULIA_USER_ID ? thread.userTwo : thread.userOne;
    // Havka'yı email veya name'de ara
    if (
      otherUser.email?.toLowerCase().includes('havka') ||
      otherUser.email?.toLowerCase().includes('ozan')
    ) {
      havkaThread = thread;
      break;
    }
  }

  if (!havkaThread) {
    console.log('ℹ️  Julia-Havka thread\'i bulunamadı (zaten silinmiş olabilir)');
    return;
  }

  console.log(`\n🗑️  Julia-Havka thread\'i siliniyor...`);
  console.log(`   Thread ID: ${havkaThread.id}`);
  console.log(`   Mesaj sayısı: ${await prisma.dMMessage.count({ where: { threadId: havkaThread.id } })}`);

  // Delete thread (cascade will delete messages)
  await prisma.dMThread.delete({
    where: { id: havkaThread.id },
  });

  console.log('✅ Thread başarıyla silindi\n');
}

async function main() {
  try {
    await deleteJuliaHavkaThread();
  } catch (error: any) {
    console.error('❌ Hata:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
