import { signJwt } from '../src/infrastructure/auth/jwt.helper';
import { getPrisma } from '../src/infrastructure/repositories/prisma.client';

const prisma = getPrisma();

const TEST_USER_ID = '44444444-4444-4444-a444-444444444444';

async function generateTestToken() {
  console.log('Generating test token...');
  
  // Get user
  const user = await prisma.user.findUnique({
    where: { id: TEST_USER_ID }
  });

  if (!user) {
    console.error('User not found!');
    process.exit(1);
  }

  console.log(`User found: ${user.email}`);
  console.log(`Email verified: ${user.emailVerified}`);

  // Update email_verified if needed
  if (!user.emailVerified) {
    console.log('Updating email_verified to true...');
    await prisma.user.update({
      where: { id: TEST_USER_ID },
      data: { emailVerified: true }
    });
    console.log('Email verified!');
  }

  // Generate token
  const token = signJwt({
    id: user.id,
    email: user.email
  }, '30d'); // 30 days expiry for testing

  console.log('\n=================================');
  console.log('TEST USER TOKEN');
  console.log('=================================');
  console.log(`User ID: ${user.id}`);
  console.log(`Email: ${user.email}`);
  console.log(`\nToken:`);
  console.log(token);
  console.log('\n=================================');
  console.log('Usage:');
  console.log('curl -H "Authorization: Bearer <TOKEN>" http://localhost:3000/wallets/balance');
  console.log('=================================\n');

  process.exit(0);
}

generateTestToken().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});

