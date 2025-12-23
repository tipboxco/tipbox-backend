import logger from '../logger/logger';

/**
 * Cache Metrics Tracker
 * Cache hit/miss rate ve performance metriklerini takip eder
 */
class CacheMetrics {
  private hits: number = 0;
  private misses: number = 0;
  private totalResponseTime: number = 0;
  private operationCount: number = 0;

  /**
   * Cache hit kaydeder
   */
  recordHit(responseTimeMs?: number): void {
    this.hits++;
    if (responseTimeMs) {
      this.totalResponseTime += responseTimeMs;
      this.operationCount++;
    }
  }

  /**
   * Cache miss kaydeder
   */
  recordMiss(responseTimeMs?: number): void {
    this.misses++;
    if (responseTimeMs) {
      this.totalResponseTime += responseTimeMs;
      this.operationCount++;
    }
  }

  /**
   * Cache hit rate'i hesaplar (%)
   */
  getHitRate(): number {
    const total = this.hits + this.misses;
    return total > 0 ? (this.hits / total) * 100 : 0;
  }

  /**
   * Ortalama response time'ı hesaplar (ms)
   */
  getAverageResponseTime(): number {
    return this.operationCount > 0 ? this.totalResponseTime / this.operationCount : 0;
  }

  /**
   * Tüm metrikleri döndürür
   */
  getMetrics() {
    return {
      hits: this.hits,
      misses: this.misses,
      total: this.hits + this.misses,
      hitRate: this.getHitRate().toFixed(2) + '%',
      averageResponseTime: this.getAverageResponseTime().toFixed(2) + 'ms',
    };
  }

  /**
   * Metrikleri sıfırlar
   */
  reset(): void {
    this.hits = 0;
    this.misses = 0;
    this.totalResponseTime = 0;
    this.operationCount = 0;
  }

  /**
   * Metrikleri log'a yazar
   */
  logMetrics(): void {
    const metrics = this.getMetrics();
    logger.info({
      message: 'Cache metrics',
      ...metrics,
    });
  }
}

// Singleton instance
export const cacheMetrics = new CacheMetrics();

// Her 5 dakikada bir metrikleri logla
if (process.env.NODE_ENV !== 'test') {
  setInterval(() => {
    cacheMetrics.logMetrics();
  }, 5 * 60 * 1000); // 5 dakika
}

