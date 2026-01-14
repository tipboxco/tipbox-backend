import { getPrisma } from '../repositories/prisma.client';
import CacheService from '../cache/cache.service';
import logger from '../logger/logger';

const prisma = getPrisma();
const cacheService = CacheService.getInstance();

export interface HealthCheckResult {
  status: 'healthy' | 'unhealthy' | 'degraded';
  responseTime?: number;
  message?: string;
  details?: any;
}

export interface SystemHealth {
  status: 'ok' | 'degraded' | 'error';
  timestamp: string;
  uptime: number;
  version?: string;
  checks: {
    database: HealthCheckResult;
    redis: HealthCheckResult;
    memory: HealthCheckResult;
    cpu?: HealthCheckResult;
  };
}

/**
 * Database health check
 * PostgreSQL bağlantısını test eder
 */
export async function checkDatabaseHealth(): Promise<HealthCheckResult> {
  const startTime = Date.now();
  
  try {
    // Basit bir query ile database bağlantısını test et
    await prisma.$queryRaw`SELECT 1`;
    
    const responseTime = Date.now() - startTime;
    
    // Response time'a göre status belirle
    if (responseTime > 1000) {
      return {
        status: 'degraded',
        responseTime,
        message: 'Database responding slowly',
      };
    }
    
    return {
      status: 'healthy',
      responseTime,
      message: 'Database connection is healthy',
    };
  } catch (error: any) {
    logger.error('Database health check failed', { error: error.message });
    return {
      status: 'unhealthy',
      responseTime: Date.now() - startTime,
      message: error.message || 'Database connection failed',
    };
  }
}

/**
 * Redis health check
 * Redis bağlantısını ve performansını test eder
 */
export async function checkRedisHealth(): Promise<HealthCheckResult> {
  const startTime = Date.now();
  
  try {
    // Cache bağlantısını kontrol et
    if (!cacheService.isCacheConnected()) {
      return {
        status: 'unhealthy',
        message: 'Redis not connected',
      };
    }
    
    // Basit bir set/get ile Redis'i test et
    const testKey = 'health:check:' + Date.now();
    const testValue = { check: true, timestamp: Date.now() };
    
    await cacheService.set(testKey, testValue, 10); // 10 saniye TTL
    const retrieved = await cacheService.get(testKey);
    
    // Cleanup
    await cacheService.del(testKey);
    
    const responseTime = Date.now() - startTime;
    
    // Response time'a göre status belirle
    if (responseTime > 500) {
      return {
        status: 'degraded',
        responseTime,
        message: 'Redis responding slowly',
      };
    }
    
    if (!retrieved) {
      return {
        status: 'degraded',
        responseTime,
        message: 'Redis get/set test failed',
      };
    }
    
    return {
      status: 'healthy',
      responseTime,
      message: 'Redis connection is healthy',
    };
  } catch (error: any) {
    logger.error('Redis health check failed', { error: error.message });
    return {
      status: 'unhealthy',
      responseTime: Date.now() - startTime,
      message: error.message || 'Redis connection failed',
    };
  }
}

/**
 * Memory health check
 * Process memory kullanımını kontrol eder
 */
export function checkMemoryHealth(): HealthCheckResult {
  const memoryUsage = process.memoryUsage();
  
  // MB cinsinden
  const heapUsedMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
  const heapTotalMB = Math.round(memoryUsage.heapTotal / 1024 / 1024);
  const rssMB = Math.round(memoryUsage.rss / 1024 / 1024);
  
  // Heap usage yüzdesi
  const heapUsagePercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;
  
  const details = {
    heapUsedMB,
    heapTotalMB,
    rssMB,
    heapUsagePercent: Math.round(heapUsagePercent),
  };
  
  // Memory kullanımı %98'ın üzerinde ise unhealthy
  if (heapUsagePercent > 98) {
    return {
      status: 'unhealthy',
      message: 'Memory usage critically high',
      details,
    };
  }
  
  // Memory kullanımı %90'ın üzerinde ise degraded
  if (heapUsagePercent > 90) {
    return {
      status: 'degraded',
      message: 'Memory usage high',
      details,
    };
  }
  
  return {
    status: 'healthy',
    message: 'Memory usage normal',
    details,
  };
}

/**
 * CPU health check
 * Process CPU kullanımını kontrol eder
 */
export function checkCPUHealth(): HealthCheckResult {
  const cpuUsage = process.cpuUsage();
  
  // Microseconds cinsinden
  const userCPU = cpuUsage.user;
  const systemCPU = cpuUsage.system;
  const totalCPU = userCPU + systemCPU;
  
  const details = {
    userCPUMs: Math.round(userCPU / 1000),
    systemCPUMs: Math.round(systemCPU / 1000),
    totalCPUMs: Math.round(totalCPU / 1000),
  };
  
  return {
    status: 'healthy',
    message: 'CPU usage tracked',
    details,
  };
}

/**
 * Comprehensive system health check
 * Tüm sistemleri kontrol eder ve genel durumu döner
 */
export async function checkSystemHealth(): Promise<SystemHealth> {
  const [database, redis, memory] = await Promise.all([
    checkDatabaseHealth(),
    checkRedisHealth(),
    Promise.resolve(checkMemoryHealth()),
  ]);
  
  // CPU check opsiyonel
  const cpu = checkCPUHealth();
  
  // Genel sistem durumunu belirle
  let overallStatus: 'ok' | 'degraded' | 'error' = 'ok';
  
  const checks = [database, redis, memory];
  
  // Herhangi bir servis unhealthy ise sistem error
  if (checks.some(check => check.status === 'unhealthy')) {
    overallStatus = 'error';
  }
  // Herhangi bir servis degraded ise sistem degraded
  else if (checks.some(check => check.status === 'degraded')) {
    overallStatus = 'degraded';
  }
  
  return {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version,
    checks: {
      database,
      redis,
      memory,
      cpu,
    },
  };
}

/**
 * Readiness check - Servisin request'leri kabul etmeye hazır olup olmadığını kontrol eder
 * Kubernetes readiness probe için kullanılır
 */
export async function checkReadiness(): Promise<boolean> {
  try {
    // Database ve Redis bağlantılarını kontrol et
    const [dbHealth, redisHealth] = await Promise.all([
      checkDatabaseHealth(),
      checkRedisHealth(),
    ]);
    
    // Database mutlaka healthy olmalı
    // Redis degraded olabilir (cache için)
    return dbHealth.status === 'healthy';
  } catch (error) {
    logger.error('Readiness check failed', { error });
    return false;
  }
}

/**
 * Liveness check - Servisin çalışıyor olup olmadığını kontrol eder
 * Kubernetes liveness probe için kullanılır
 */
export function checkLiveness(): boolean {
  // Basit alive check - process çalışıyorsa true
  // Eğer process hang olursa veya deadlock olursa bu endpoint timeout verecek
  return true;
}

