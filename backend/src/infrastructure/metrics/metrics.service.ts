import { Registry, Counter, Histogram, Gauge, collectDefaultMetrics } from 'prom-client';

/**
 * Prometheus Metrics Service
 * 
 * Bu servis, uygulama metriklerini toplamak ve Prometheus formatında sunmak için kullanılır.
 * 
 * Toplanan Metrikler:
 * - HTTP Request Count (Counter)
 * - HTTP Request Duration (Histogram)
 * - HTTP Request Size (Histogram)
 * - Active Connections (Gauge)
 * - Database Query Duration (Histogram)
 * - Redis Operation Duration (Histogram)
 * - Error Count (Counter)
 * - Default Node.js metrikleri (CPU, Memory, Event Loop, vb.)
 */
export class MetricsService {
  private register: Registry;
  private httpRequestCounter: Counter;
  private httpRequestDuration: Histogram;
  private httpRequestSize: Histogram;
  private activeConnections: Gauge;
  private databaseQueryDuration: Histogram;
  private redisOperationDuration: Histogram;
  private errorCounter: Counter;
  private activeUsers: Gauge;

  constructor() {
    // Yeni bir registry oluştur
    this.register = new Registry();

    // Default Node.js metriklerini topla (CPU, Memory, Event Loop, vb.)
    collectDefaultMetrics({ register: this.register });

    // HTTP Request Counter - Toplam istek sayısı
    this.httpRequestCounter = new Counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status_code'],
      registers: [this.register],
    });

    // HTTP Request Duration - İstek süresi (histogram)
    this.httpRequestDuration = new Histogram({
      name: 'http_request_duration_seconds',
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10], // Saniye cinsinden bucket'lar
      registers: [this.register],
    });

    // HTTP Request Size - İstek boyutu
    this.httpRequestSize = new Histogram({
      name: 'http_request_size_bytes',
      help: 'Size of HTTP requests in bytes',
      labelNames: ['method', 'route'],
      buckets: [100, 500, 1000, 5000, 10000, 50000, 100000], // Byte cinsinden bucket'lar
      registers: [this.register],
    });

    // Active Connections - Aktif bağlantı sayısı
    this.activeConnections = new Gauge({
      name: 'http_active_connections',
      help: 'Number of active HTTP connections',
      registers: [this.register],
    });

    // Database Query Duration - Veritabanı sorgu süresi
    this.databaseQueryDuration = new Histogram({
      name: 'database_query_duration_seconds',
      help: 'Duration of database queries in seconds',
      labelNames: ['operation', 'table'],
      buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
      registers: [this.register],
    });

    // Redis Operation Duration - Redis işlem süresi
    this.redisOperationDuration = new Histogram({
      name: 'redis_operation_duration_seconds',
      help: 'Duration of Redis operations in seconds',
      labelNames: ['operation', 'status'],
      buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5],
      registers: [this.register],
    });

    // Error Counter - Hata sayısı
    this.errorCounter = new Counter({
      name: 'errors_total',
      help: 'Total number of errors',
      labelNames: ['type', 'route', 'status_code'],
      registers: [this.register],
    });

    // Active Users - Aktif kullanıcı sayısı
    this.activeUsers = new Gauge({
      name: 'active_users_total',
      help: 'Number of active users',
      registers: [this.register],
    });
  }

  /**
   * HTTP isteği için metrikleri kaydet
   */
  recordHttpRequest(
    method: string,
    route: string,
    statusCode: number,
    duration: number,
    requestSize?: number
  ): void {
    // Normalize route (parametreleri kaldır)
    const normalizedRoute = this.normalizeRoute(route);

    // Request counter'ı artır
    this.httpRequestCounter.inc({
      method: method.toUpperCase(),
      route: normalizedRoute,
      status_code: statusCode.toString(),
    });

    // Request duration'ı kaydet
    this.httpRequestDuration.observe(
      {
        method: method.toUpperCase(),
        route: normalizedRoute,
        status_code: statusCode.toString(),
      },
      duration
    );

    // Request size'ı kaydet (varsa)
    if (requestSize !== undefined) {
      this.httpRequestSize.observe(
        {
          method: method.toUpperCase(),
          route: normalizedRoute,
        },
        requestSize
      );
    }
  }

  /**
   * Aktif bağlantı sayısını güncelle
   */
  setActiveConnections(count: number): void {
    this.activeConnections.set(count);
  }

  /**
   * Veritabanı sorgu süresini kaydet
   */
  recordDatabaseQuery(operation: string, table: string, duration: number): void {
    this.databaseQueryDuration.observe({ operation, table }, duration);
  }

  /**
   * Redis işlem süresini kaydet
   */
  recordRedisOperation(operation: string, status: 'success' | 'error', duration: number): void {
    this.redisOperationDuration.observe({ operation, status }, duration);
  }

  /**
   * Hata sayısını artır
   */
  recordError(type: string, route: string, statusCode: number): void {
    this.errorCounter.inc({
      type,
      route: this.normalizeRoute(route),
      status_code: statusCode.toString(),
    });
  }

  /**
   * Aktif kullanıcı sayısını güncelle
   */
  setActiveUsers(count: number): void {
    this.activeUsers.set(count);
  }

  /**
   * Metrikleri Prometheus formatında döndür
   */
  async getMetrics(): Promise<string> {
    return this.register.metrics();
  }

  /**
   * Route'u normalize et (parametreleri kaldır)
   * Örnek: /users/123 -> /users/:id
   */
  private normalizeRoute(route: string): string {
    if (!route || route === '/') {
      return '/';
    }

    // UUID'leri :id ile değiştir
    let normalized = route.replace(
      /\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
      '/:id'
    );

    // Sayısal ID'leri :id ile değiştir
    normalized = normalized.replace(/\/\d+/g, '/:id');

    // Query string'i kaldır
    normalized = normalized.split('?')[0];

    return normalized || '/';
  }

  /**
   * Registry'yi döndür (test için)
   */
  getRegister(): Registry {
    return this.register;
  }
}

// Singleton instance
let metricsServiceInstance: MetricsService | null = null;

/**
 * Metrics Service singleton instance'ını döndür
 */
export function getMetricsService(): MetricsService {
  if (!metricsServiceInstance) {
    metricsServiceInstance = new MetricsService();
  }
  return metricsServiceInstance;
}

