/**
 * Test threadId update
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function test() {
  const requestId = 'afda3de0-bad0-4d79-889e-f1f56b11a580';
  const threadId = 'b87042e5-d4cc-462c-8288-7259d7729d9c';
  
  console.log('Testing Prisma update with threadId...');
  
  try {
    const result = await prisma.dMRequest.update({
      where: { id: requestId },
      data: {
        threadId: threadId,
        updatedAt: new Date(),
      },
    });
    
    console.log('✅ Update successful:', result.threadId);
    
    // Check DB
    const check = await prisma.dMRequest.findUnique({
      where: { id: requestId },
      select: { id: true, threadId: true, status: true },
    });
    
    console.log('✅ DB check:', check);
  } catch (error) {
    console.error('❌ Update error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

test();



