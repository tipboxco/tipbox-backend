/**
 * Seed Pipeline Logger — E2E test tarzı staged logging for seed/clear scripts.
 *
 * AI Pipeline Logger'ın seed script versiyonu:
 *   - Winston logger yerine console.log kullanır (seed scriptleri altyapı dışında çalışır)
 *   - Aynı stage/skip/complete/fail API'si
 *
 * Kullanım:
 *   const pipeline = new SeedPipelineLogger('clear-and-seed', 6);
 *   await pipeline.runStage('MinIO cleanup', () => clearAllMedia());
 *   pipeline.complete();
 *
 * Çıktı:
 *   [Seed] clear-and-seed started (6 stages)
 *     [1/6] MinIO cleanup                 ✓ (234ms)
 *     [2/6] DB cleanup                    ✓ (1203ms)
 *     ...
 *   [Seed] clear-and-seed completed (12345ms)
 */

export class SeedPipelineLogger {
  private readonly name: string;
  private readonly totalStages: number;
  private currentStage = 0;
  private readonly startTime: number;

  constructor(name: string, totalStages: number) {
    this.name = name;
    this.totalStages = totalStages;
    this.startTime = Date.now();
    console.log(`\n[Seed] ${name} started (${totalStages} stages)`);
  }

  /** Pipeline başlangıcından itibaren geçen süre (ms). */
  get elapsed(): number {
    return Date.now() - this.startTime;
  }

  /**
   * Bir stage'i çalıştırır, timing + ✓/✗ loglar.
   */
  async runStage<T>(stageName: string, fn: () => Promise<T> | T, detail?: string): Promise<T> {
    this.currentStage++;
    const label = `[${this.currentStage}/${this.totalStages}]`;
    const stageStart = Date.now();

    try {
      const result = await fn();
      const ms = Date.now() - stageStart;
      const detailStr = detail ? ` ${detail}` : '';
      console.log(`  ${label} ${stageName} ✓${detailStr} (${ms}ms)`);
      return result;
    } catch (error) {
      const ms = Date.now() - stageStart;
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`  ${label} ${stageName} ✗ (${ms}ms) | ${errorMsg}`);
      throw error;
    }
  }

  /**
   * Opsiyonel stage — hata fırlatılırsa loglar ama devam eder.
   */
  async runStageOptional<T>(
    stageName: string,
    fn: () => Promise<T> | T,
    fallback: T,
  ): Promise<T> {
    this.currentStage++;
    const label = `[${this.currentStage}/${this.totalStages}]`;
    const stageStart = Date.now();

    try {
      const result = await fn();
      const ms = Date.now() - stageStart;
      console.log(`  ${label} ${stageName} ✓ (${ms}ms)`);
      return result;
    } catch (error) {
      const ms = Date.now() - stageStart;
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.warn(`  ${label} ${stageName} ⚠ non-critical (${ms}ms) | ${errorMsg}`);
      return fallback;
    }
  }

  /**
   * Stage'i atla — "— skipped" loglar.
   */
  skipStage(stageName: string): void {
    this.currentStage++;
    const label = `[${this.currentStage}/${this.totalStages}]`;
    console.log(`  ${label} ${stageName} — skipped`);
  }

  /**
   * Pipeline başarıyla tamamlandı.
   */
  complete(summary?: string): void {
    const totalMs = this.elapsed;
    const summaryStr = summary ? ` | ${summary}` : '';
    console.log(`[Seed] ${this.name} completed (${totalMs}ms)${summaryStr}\n`);
  }

  /**
   * Pipeline hata ile sonlandı.
   */
  fail(error: string): void {
    const totalMs = this.elapsed;
    console.error(
      `[Seed] ${this.name} FAILED at stage ${this.currentStage}/${this.totalStages} (${totalMs}ms) | ${error}\n`,
    );
  }
}
