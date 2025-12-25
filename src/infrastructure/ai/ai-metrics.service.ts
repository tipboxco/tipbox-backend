import logger from '../logger/logger';

/**
 * AI Metrics for monitoring and cost analysis
 */
export interface AIMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  cachedRequests: number;
  totalTokensUsed: number;
  totalProcessingTimeMs: number;
  averageProcessingTimeMs: number;
  rateLimitHits: number;
  timeoutErrors: number;
  networkErrors: number;
  validationErrors: number;
}

export class AIMetricsService {
  private static instance: AIMetricsService;
  private metrics: AIMetrics;
  private startTime: number;

  private constructor() {
    this.metrics = this.resetMetrics();
    this.startTime = Date.now();
  }

  public static getInstance(): AIMetricsService {
    if (!AIMetricsService.instance) {
      AIMetricsService.instance = new AIMetricsService();
    }
    return AIMetricsService.instance;
  }

  private resetMetrics(): AIMetrics {
    return {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      cachedRequests: 0,
      totalTokensUsed: 0,
      totalProcessingTimeMs: 0,
      averageProcessingTimeMs: 0,
      rateLimitHits: 0,
      timeoutErrors: 0,
      networkErrors: 0,
      validationErrors: 0,
    };
  }

  /**
   * Record başarılı AI isteği
   */
  public recordSuccess(tokensUsed: number | null, processingTimeMs: number, fromCache: boolean = false): void {
    this.metrics.totalRequests++;
    this.metrics.successfulRequests++;
    
    if (fromCache) {
      this.metrics.cachedRequests++;
    }
    
    if (tokensUsed) {
      this.metrics.totalTokensUsed += tokensUsed;
    }
    
    this.metrics.totalProcessingTimeMs += processingTimeMs;
    this.metrics.averageProcessingTimeMs = 
      this.metrics.totalProcessingTimeMs / this.metrics.successfulRequests;

    this.logMetricsPeriodically();
  }

  /**
   * Record başarısız AI isteği
   */
  public recordFailure(errorType: 'rate-limit' | 'timeout' | 'network' | 'validation' | 'other'): void {
    this.metrics.totalRequests++;
    this.metrics.failedRequests++;

    switch (errorType) {
      case 'rate-limit':
        this.metrics.rateLimitHits++;
        break;
      case 'timeout':
        this.metrics.timeoutErrors++;
        break;
      case 'network':
        this.metrics.networkErrors++;
        break;
      case 'validation':
        this.metrics.validationErrors++;
        break;
    }

    this.logMetricsPeriodically();
  }

  /**
   * Mevcut metrics'i getir
   */
  public getMetrics(): AIMetrics & { uptimeMs: number } {
    return {
      ...this.metrics,
      uptimeMs: Date.now() - this.startTime,
    };
  }

  /**
   * Metrics'i sıfırla
   */
  public reset(): void {
    this.metrics = this.resetMetrics();
    this.startTime = Date.now();
    logger.info('AI metrics reset');
  }

  /**
   * Maliyet analizi (tahmini)
   * Gemini pricing: ~$0.00025 per 1K tokens (input) + $0.0005 per 1K tokens (output)
   * Ortalama olarak $0.000375 per 1K tokens kabul ediyoruz
   */
  public getCostAnalysis(): {
    totalTokens: number;
    estimatedCostUSD: number;
    cachedSavingsPercent: number;
  } {
    const costPerThousandTokens = 0.000375; // USD
    const estimatedCostUSD = (this.metrics.totalTokensUsed / 1000) * costPerThousandTokens;
    
    const cachedSavingsPercent = this.metrics.totalRequests > 0
      ? (this.metrics.cachedRequests / this.metrics.totalRequests) * 100
      : 0;

    return {
      totalTokens: this.metrics.totalTokensUsed,
      estimatedCostUSD: parseFloat(estimatedCostUSD.toFixed(4)),
      cachedSavingsPercent: parseFloat(cachedSavingsPercent.toFixed(2)),
    };
  }

  /**
   * Periyodik olarak metrics'i logla (her 100 istekte bir)
   */
  private logMetricsPeriodically(): void {
    if (this.metrics.totalRequests % 100 === 0) {
      const metrics = this.getMetrics();
      const costAnalysis = this.getCostAnalysis();
      
      logger.info({
        message: 'AI Metrics Periodic Report',
        metrics,
        costAnalysis,
        successRate: `${((metrics.successfulRequests / metrics.totalRequests) * 100).toFixed(2)}%`,
        cacheHitRate: `${((metrics.cachedRequests / metrics.totalRequests) * 100).toFixed(2)}%`,
      });
    }
  }

  /**
   * Detaylı metrics raporu
   */
  public generateReport(): string {
    const metrics = this.getMetrics();
    const costAnalysis = this.getCostAnalysis();
    
    const successRate = metrics.totalRequests > 0
      ? ((metrics.successfulRequests / metrics.totalRequests) * 100).toFixed(2)
      : '0.00';
    
    const cacheHitRate = metrics.totalRequests > 0
      ? ((metrics.cachedRequests / metrics.totalRequests) * 100).toFixed(2)
      : '0.00';

    return `
=== AI Metrics Report ===
Uptime: ${(metrics.uptimeMs / 1000 / 60).toFixed(2)} minutes

Requests:
  - Total: ${metrics.totalRequests}
  - Successful: ${metrics.successfulRequests} (${successRate}%)
  - Failed: ${metrics.failedRequests}
  - Cached: ${metrics.cachedRequests} (${cacheHitRate}% cache hit rate)

Performance:
  - Total Processing Time: ${(metrics.totalProcessingTimeMs / 1000).toFixed(2)}s
  - Average Processing Time: ${metrics.averageProcessingTimeMs.toFixed(0)}ms

Errors:
  - Rate Limit: ${metrics.rateLimitHits}
  - Timeout: ${metrics.timeoutErrors}
  - Network: ${metrics.networkErrors}
  - Validation: ${metrics.validationErrors}

Cost Analysis:
  - Total Tokens: ${costAnalysis.totalTokens}
  - Estimated Cost: $${costAnalysis.estimatedCostUSD}
  - Cache Savings: ${costAnalysis.cachedSavingsPercent}%
========================
    `.trim();
  }
}

export default AIMetricsService;

