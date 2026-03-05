/**
 * AI Pipeline Logger — E2E test tarzı staged logging utility.
 *
 * Kullanım:
 *   const pipeline = new AIPipelineLogger({
 *     pipelineName: 'GeminiService',
 *     operationName: 'splitExperience',
 *     totalStages: 6,
 *     metadata: { productName: 'iPhone 15' },
 *   });
 *
 *   const result = await pipeline.runStage('Validating input', () => validate(req));
 *   pipeline.complete({ tokens: 1250 });
 *
 * Log çıktısı:
 *   [AI Pipeline] splitExperience started | product: iPhone 15
 *     [1/6] Validating input              ✓ (2ms)
 *     ...
 *   [AI Pipeline] splitExperience completed (4552ms) | tokens: 1250
 */

import logger from '../logger/logger';

type MetadataValue = string | number | boolean | null | undefined;
type MetadataRecord = Record<string, MetadataValue>;

export interface PipelineConfig {
  /** Pipeline sahibi (örn. GeminiService, PostService) */
  pipelineName: string;
  /** Operasyon adı (örn. splitExperience, createInventoryItem) */
  operationName: string;
  /** Toplam stage sayısı */
  totalStages: number;
  /** Ek metadata (logda gösterilir) */
  metadata?: MetadataRecord;
}

export class AIPipelineLogger {
  private readonly config: PipelineConfig;
  private currentStage = 0;
  private readonly startTime: number;

  constructor(config: PipelineConfig) {
    this.config = config;
    this.startTime = Date.now();

    const metaStr = this.formatMeta(config.metadata);
    logger.info(`[AI Pipeline] ${config.operationName} started${metaStr}`, {
      pipeline: config.pipelineName,
      operation: config.operationName,
      totalStages: config.totalStages,
      ...config.metadata,
    });
  }

  /** Pipeline başlangıcından itibaren geçen süre (ms). */
  get elapsed(): number {
    return Date.now() - this.startTime;
  }

  /**
   * Bir stage'i çalıştırır, timing + ✓/✗ loglar.
   * Hata fırlatılırsa ✗ loglanır ve error re-throw edilir.
   */
  async runStage<T>(
    stageName: string,
    fn: () => Promise<T> | T,
    detail?: string,
  ): Promise<T> {
    this.currentStage++;
    const label = `[${this.currentStage}/${this.config.totalStages}]`;
    const stageStart = Date.now();

    try {
      const result = await fn();
      const ms = Date.now() - stageStart;
      const detailStr = detail ? ` ${detail}` : '';

      logger.info(`  ${label} ${stageName} ✓${detailStr} (${ms}ms)`, {
        pipeline: this.config.pipelineName,
        operation: this.config.operationName,
        stage: this.currentStage,
        stageName,
        durationMs: ms,
      });

      return result;
    } catch (error) {
      const ms = Date.now() - stageStart;
      const errorMsg = error instanceof Error ? error.message : String(error);

      logger.error(`  ${label} ${stageName} ✗ (${ms}ms) | ${errorMsg}`, {
        pipeline: this.config.pipelineName,
        operation: this.config.operationName,
        stage: this.currentStage,
        stageName,
        durationMs: ms,
        error: errorMsg,
      });

      throw error;
    }
  }

  /**
   * Opsiyonel stage — hata fırlatılırsa loglar ama devam eder (fallback döner).
   */
  async runStageOptional<T>(
    stageName: string,
    fn: () => Promise<T> | T,
    fallback: T,
  ): Promise<T> {
    this.currentStage++;
    const label = `[${this.currentStage}/${this.config.totalStages}]`;
    const stageStart = Date.now();

    try {
      const result = await fn();
      const ms = Date.now() - stageStart;

      logger.info(`  ${label} ${stageName} ✓ (${ms}ms)`, {
        pipeline: this.config.pipelineName,
        operation: this.config.operationName,
        stage: this.currentStage,
        stageName,
        durationMs: ms,
      });

      return result;
    } catch (error) {
      const ms = Date.now() - stageStart;
      const errorMsg = error instanceof Error ? error.message : String(error);

      logger.warn(`  ${label} ${stageName} ✗ non-critical (${ms}ms) | ${errorMsg}`, {
        pipeline: this.config.pipelineName,
        operation: this.config.operationName,
        stage: this.currentStage,
        stageName,
        durationMs: ms,
        error: errorMsg,
        nonCritical: true,
      });

      return fallback;
    }
  }

  /**
   * Opsiyonel stage'i atla — "— skipped" loglar ve sayacı artırır.
   */
  skipStage(stageName: string): void {
    this.currentStage++;
    const label = `[${this.currentStage}/${this.config.totalStages}]`;

    logger.info(`  ${label} ${stageName} — skipped`, {
      pipeline: this.config.pipelineName,
      operation: this.config.operationName,
      stage: this.currentStage,
      stageName,
      skipped: true,
    });
  }

  /**
   * Pipeline başarıyla tamamlandı.
   */
  complete(extras?: MetadataRecord): void {
    const totalMs = this.elapsed;
    const metaStr = this.formatMeta(extras);

    logger.info(
      `[AI Pipeline] ${this.config.operationName} completed (${totalMs}ms)${metaStr}`,
      {
        pipeline: this.config.pipelineName,
        operation: this.config.operationName,
        totalDurationMs: totalMs,
        stagesCompleted: this.currentStage,
        ...extras,
      },
    );
  }

  /**
   * Pipeline hata ile sonlandı.
   */
  fail(error: string, extras?: MetadataRecord): void {
    const totalMs = this.elapsed;

    logger.error(
      `[AI Pipeline] ${this.config.operationName} FAILED at stage ${this.currentStage}/${this.config.totalStages} (${totalMs}ms) | ${error}`,
      {
        pipeline: this.config.pipelineName,
        operation: this.config.operationName,
        totalDurationMs: totalMs,
        failedAtStage: this.currentStage,
        error,
        ...extras,
      },
    );
  }

  /** Metadata'yı " | key: value" formatına çevirir. */
  private formatMeta(meta?: MetadataRecord): string {
    if (!meta) return '';
    const parts = Object.entries(meta)
      .filter(([, v]) => v !== undefined && v !== null)
      .map(([k, v]) => `${k}: ${v}`);
    return parts.length > 0 ? ` | ${parts.join(', ')}` : '';
  }
}
