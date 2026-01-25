import { getPrisma } from '../src/infrastructure/repositories/prisma.client';
import logger from '../src/infrastructure/logger/logger';
import * as jwt from 'jsonwebtoken';
import * as https from 'https';
import * as http from 'http';

const GEORGIA_ID = '480f5de9-b691-4d70-a6a8-2789226f4e07';

async function testNotificationEndpoint() {
  const prisma = getPrisma();

  try {
    // Georgia kullanıcısını bul
    const georgia = await prisma.user.findUnique({
      where: { id: GEORGIA_ID },
    });

    if (!georgia) {
      throw new Error('Georgia user not found');
    }

    // JWT token oluştur
    const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
    const token = jwt.sign(
      { id: georgia.id, email: georgia.email },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    logger.info(`Token oluşturuldu: ${token.substring(0, 20)}...`);

    // Notification endpoint'ine istek at
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/notifications?limit=10',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    };

    return new Promise<void>((resolve, reject) => {
      const req = http.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            
            // NEW_BADGE bildirimlerini filtrele
            const badgeNotifications = response.data?.filter((n: any) => n.type === 'NEW_BADGE') || [];
            
            console.log('\n📬 NEW_BADGE Bildirimleri:\n');
            badgeNotifications.forEach((notif: any, index: number) => {
              console.log(`Bildirim ${index + 1}:`);
              console.log(`  Type: ${notif.type}`);
              console.log(`  Title: ${notif.title}`);
              console.log(`  Message: ${notif.message}`);
              console.log(`  Data:`, JSON.stringify(notif.data, null, 2));
              console.log(`  userId: ${notif.userId}`);
              console.log(`  username: ${notif.username}`);
              console.log(`  avatar: ${notif.avatar}`);
              console.log(`  postId: ${notif.postId}`);
              console.log(`  commentId: ${notif.commentId}`);
              console.log('---\n');
            });

            // Gereksiz alanları kontrol et
            const hasUnnecessaryFields = badgeNotifications.some((n: any) => 
              n.userId !== undefined || 
              n.username !== undefined || 
              n.avatar !== undefined || 
              n.postId !== undefined || 
              n.commentId !== undefined ||
              n.data?.avatar !== undefined ||
              n.data?.userId !== undefined ||
              n.data?.username !== undefined ||
              n.data?.postId !== undefined ||
              n.data?.commentId !== undefined ||
              n.data?.badgeIcon !== undefined
            );

            if (hasUnnecessaryFields) {
              console.log('❌ NEW_BADGE bildirimlerinde gereksiz alanlar var!');
            } else {
              console.log('✅ NEW_BADGE bildirimleri temiz!');
            }

            resolve();
          } catch (error) {
            console.error('Response parse error:', error);
            console.error('Response data:', data);
            reject(error);
          }
        });
      });

      req.on('error', (error) => {
        console.error('Request error:', error);
        reject(error);
      });

      req.end();
    });
  } catch (error) {
    logger.error('❌ Test sırasında hata oluştu:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  testNotificationEndpoint()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export { testNotificationEndpoint };
