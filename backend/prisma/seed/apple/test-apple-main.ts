import { seedApple } from './index';
import { prisma } from '../types';

async function testAppleMain() {
  console.log('🧪 Testing Apple Main Seed...\n');

  try {
    await seedApple();

    console.log('\n✅ Tüm Apple seed işlemleri başarıyla tamamlandı!\n');
  } catch (error) {
    console.error('❌ Hata:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testAppleMain();
