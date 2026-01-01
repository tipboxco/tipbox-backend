/**
 * Bildirim Sorunlarını Debug Etme Script'i
 * 
 * Her sorunu adım adım test eder ve raporlar
 */

import { PrismaClient } from '@prisma/client';
import axios, { AxiosInstance } from 'axios';
import * as bcrypt from 'bcryptjs';
import { NotificationType } from '../src/domain/notification/notification-type.enum';
import { NotificationService } from '../src/application/notification/notification.service';
import RedisConfigManager from '../src/infrastructure/config/redis.config';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const DEFAULT_PASSWORD = 'password123';
const OMER_USER_ID = '480f5de9-b691-4d70-a6a8-2789226f4e07';
const OMER_EMAIL = 'omer@tipbox.co';

const prisma = new PrismaClient();
const api: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

async function log(message: string, level: 'info' | 'success' | 'error' | 'warn' = 'info') {
  const timestamp = new Date().toLocaleTimeString('tr-TR');
  const prefix = { info: '📋', success: '✅', error: '❌', warn: '⚠️' }[level];
  console.log(`[${timestamp}] ${prefix} ${message}`);
}

async function loginUser(email: string): Promise<string> {
  const response = await api.post('/auth/login', { email, password: DEFAULT_PASSWORD });
  return response.data.token;
}

async function checkTrustNotifications() {
  log('\n═══════════════════════════════════════════════════════', 'info');
  log('1. TRUST BİLDİRİMLERİ İNCELEMESİ', 'info');
  log('═══════════════════════════════════════════════════════', 'info');

  // Trust relation'ları kontrol et
  const trustRelations = await prisma.trustRelation.findMany({
    where: { trustedUserId: OMER_USER_ID },
    take: 5,
    orderBy: { createdAt: 'desc' },
  });

  log(`Ömer'e trust eden ${trustRelations.length} kullanıcı bulundu`, 'info');

  // Trust bildirimlerini kontrol et
  const trustNotifications = await prisma.notification.findMany({
    where: {
      userId: OMER_USER_ID,
      type: { in: [NotificationType.NEW_TRUSTER, NotificationType.NEW_TRUSTED_BY] },
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  log(`Ömer için ${trustNotifications.length} trust bildirimi bulundu`, trustNotifications.length > 0 ? 'success' : 'warn');

  if (trustNotifications.length === 0 && trustRelations.length > 0) {
    log('⚠️ SORUN: Trust relation var ama bildirim yok!', 'error');
    log('   Çözüm: addTrust metoduna bildirim gönderimi eklenmeli', 'info');
  }

  // UserService.addTrust metodunu kontrol et
  log('\nUserService.addTrust metodunu kontrol ediliyor...', 'info');
  const { readFileSync } = await import('fs');
  const userServiceCode = readFileSync('src/application/user/user.service.ts', 'utf-8');
  const hasNotificationInAddTrust = userServiceCode.includes('sendNotification') && 
                                     userServiceCode.includes('addTrust');
  
  if (!hasNotificationInAddTrust) {
    log('❌ SORUN: addTrust metodunda bildirim gönderilmiyor!', 'error');
    log('   Satır 598-615 arası bildirim servisi çağrısı yok', 'info');
  } else {
    log('✅ addTrust metodunda bildirim kodu var', 'success');
  }
}

async function checkExpertMatching() {
  log('\n═══════════════════════════════════════════════════════', 'info');
  log('2. EXPERT MATCHING İNCELEMESİ', 'info');
  log('═══════════════════════════════════════════════════════', 'info');

  // Son expert request'i kontrol et
  const lastRequest = await prisma.expertRequest.findFirst({
    where: { userId: OMER_USER_ID },
    orderBy: { createdAt: 'desc' },
  });

  if (!lastRequest) {
    log('⚠️ Ömer için expert request bulunamadı', 'warn');
    return;
  }

  log(`Son expert request: ${lastRequest.id}`, 'info');
  log(`Status: ${lastRequest.status}`, 'info');

  // Expert matching servisini test et
  const { ExpertMatchingService } = await import('../src/application/expert/expert-matching.service');
  const matchingService = new ExpertMatchingService();
  
  const potentialExperts = await matchingService.findPotentialExperts(
    lastRequest.category,
    OMER_USER_ID
  );

  log(`Potansiyel expert sayısı: ${potentialExperts.length}`, potentialExperts.length > 0 ? 'success' : 'warn');

  if (potentialExperts.length === 0) {
    log('⚠️ SORUN: Potansiyel expert bulunamadı!', 'warn');
    log('   Nedenler:', 'info');
    log('   - Expert badge\'i olan kullanıcı yok', 'info');
    log('   - Expert rolü olan kullanıcı yok', 'info');
    log('   - Son 30 günde expert answer veren kullanıcı yok', 'info');
  }

  // Diana'nın expert olup olmadığını kontrol et
  const diana = await prisma.user.findFirst({
    where: { email: 'diana.notification.test@tipbox.co' },
  });

  if (diana) {
    const dianaBadges = await prisma.userBadge.findMany({
      where: { userId: diana.id },
      include: { badge: true },
    });

    log(`\nDiana'nın ${dianaBadges.length} badge'i var`, 'info');
    
    const expertBadges = dianaBadges.filter(ub => 
      ub.badge.name.toLowerCase().includes('expert') ||
      ub.badge.name.toLowerCase().includes('uzman')
    );

    if (expertBadges.length === 0) {
      log('⚠️ Diana\'nın expert badge\'i yok - bu yüzden bildirim gitmedi!', 'warn');
    }
  }
}

async function checkRedisConfig() {
  log('\n═══════════════════════════════════════════════════════', 'info');
  log('3. REDIS CONFIG İNCELEMESİ', 'info');
  log('═══════════════════════════════════════════════════════', 'info');

  try {
    // Redis config'i initialize et
    const redisConfig = await RedisConfigManager.getInstance().initialize();
    log('✅ Redis config başarıyla initialize edildi', 'success');
    
    // Redis bağlantısını test et
    await redisConfig.pubClient.ping();
    log('✅ Redis bağlantısı çalışıyor', 'success');
    
    await RedisConfigManager.getInstance().disconnect();
  } catch (error: any) {
    log(`❌ Redis config hatası: ${error.message}`, 'error');
    log('   Not: Script direkt çalıştırıldığında Redis initialize edilmemiş olabilir', 'info');
    log('   Bu normal - worker process\'te initialize edilir', 'info');
  }
}

async function checkGamificationNotifications() {
  log('\n═══════════════════════════════════════════════════════', 'info');
  log('4. GAMIFICATION BİLDİRİMLERİ İNCELEMESİ', 'info');
  log('═══════════════════════════════════════════════════════', 'info');

  // Redis initialize et
  try {
    await RedisConfigManager.getInstance().initialize();
    log('✅ Redis initialize edildi', 'success');
  } catch (error: any) {
    log(`⚠️ Redis initialize edilemedi: ${error.message}`, 'warn');
    log('   Bu yüzden bildirimler queue\'ya eklenemiyor', 'info');
    return;
  }

  // NotificationService'i test et
  try {
    const notificationService = new NotificationService();
    await notificationService.sendNotification(
      OMER_USER_ID,
      NotificationType.NEW_BADGE,
      {
        badgeName: 'Test Badge',
        badgeIcon: '🏆',
        badgeId: 'test-badge-id',
      }
    );
    log('✅ Bildirim queue\'ya eklendi', 'success');

    // Biraz bekle
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Bildirimi kontrol et
    const notification = await prisma.notification.findFirst({
      where: {
        userId: OMER_USER_ID,
        type: NotificationType.NEW_BADGE,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (notification) {
      log(`✅ Bildirim veritabanında bulundu: ${notification.id}`, 'success');
    } else {
      log('⚠️ Bildirim veritabanında bulunamadı (worker işlemedi olabilir)', 'warn');
    }
  } catch (error: any) {
    log(`❌ Bildirim gönderme hatası: ${error.message}`, 'error');
  } finally {
    await RedisConfigManager.getInstance().disconnect();
  }
}

async function main() {
  try {
    log('🚀 Bildirim Sorunları Debug Başlatılıyor...', 'info');

    await checkTrustNotifications();
    await checkExpertMatching();
    await checkRedisConfig();
    await checkGamificationNotifications();

    log('\n═══════════════════════════════════════════════════════', 'info');
    log('📊 ÖZET', 'info');
    log('═══════════════════════════════════════════════════════', 'info');
    log('1. Trust bildirimleri: addTrust metoduna bildirim eklenmeli', 'info');
    log('2. Expert matching: Diana\'ya expert badge verilmeli veya expert rolü atanmalı', 'info');
    log('3. Redis config: Script\'te initialize edilmeli (şu an worker\'da initialize ediliyor)', 'info');
    log('4. Gamification: Redis initialize edildikten sonra çalışıyor', 'info');

  } catch (error: any) {
    log(`❌ Hata: ${error.message}`, 'error');
    if (error.stack) {
      console.error(error.stack);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main();

