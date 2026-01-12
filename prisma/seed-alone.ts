import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcryptjs'
const prisma = new PrismaClient()

async function main() {
  // User verileri değişken olarak tanımlanıyor (şifreler hashleniyor)
  const users = [
    {
      name: 'Omer',
      email: 'omer@tipbox.co',
      password: "password123"
    },
    {
      name: 'Market Test',
      email: 'markettest@tipbox.co',
      password: "password123"
    },
    {
      name: 'Trust User 0',
      email: 'trust-user-0@tipbox.co',
      password: "password123"
    },
    {
      name: 'Trust User 1',
      email: 'trust-user-1@tipbox.co',
      password: "password123"
    },
    {
      name: 'Trust User 2',
      email: 'trust-user-2@tipbox.co',
      password: "password123"
    },
    {
      name: 'Trust User 3',
      email: 'trust-user-3@tipbox.co',
      password: "password123"
    },
    {
      name: 'Trust User 4',
      email: 'trust-user-4@tipbox.co',
      password: "password123"
    }
  ];

  const passwordHash = await bcrypt.hash("password123", 10)
  // User tablomuza verileri insert ediyoruz
  await prisma.user.deleteMany({});
  for (const user of users) {
    await prisma.user.create({
      data: {
        email: user.email,
        emailVerified: true,
          status: 'ACTIVE',
        passwordHash: passwordHash,
        
      }
    })
  }

  console.log('Sadece User tablosuna hashlenmiş şifre ile veri basımı tamamlandı.')
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

