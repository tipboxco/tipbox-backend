import { GeminiService } from '../../infrastructure/ai/gemini.service';
import { CacheService } from '../../infrastructure/cache/cache.service';
import { CACHE_TTL } from '../../infrastructure/cache/cache-ttl';
import logger from '../../infrastructure/logger/logger';
import { getErrorMessage } from '../../infrastructure/errors/error-helper';
import crypto from 'crypto';

export class KeywordMatchingService {
  private readonly geminiService: GeminiService;
  private readonly cache: CacheService;

  constructor() {
    this.geminiService = GeminiService.getInstance();
    this.cache = CacheService.getInstance();
  }

  /**
   * Checks if post content contains ALL given keywords using Gemini AI.
   * Keywords are in English but content can be in any language.
   * Uses AND logic: all keywords must be present as concepts in the content.
   *
   * @param content - Post content (title + body)
   * @param keywords - English keywords to match (AND logic)
   * @returns true if ALL keywords are conceptually present in the content
   */
  async checkKeywordsInContent(content: string, keywords: string[]): Promise<boolean> {
    if (!content || content.trim().length === 0) return false;
    if (!keywords || keywords.length === 0) return false;

    try {
      // Check cache first
      const cacheKey = this.buildCacheKey(content, keywords);
      const cached = await this.cache.get<boolean>(cacheKey);
      if (cached !== null && cached !== undefined) {
        logger.debug('Keyword matching cache hit', { cacheKey });
        return cached;
      }

      const result = await this.matchWithAI(content, keywords);

      // Cache the result (short TTL since content is unique per post)
      await this.cache.set(cacheKey, result, CACHE_TTL.SHORT).catch(() => {
        // Cache failure is non-critical
      });

      return result;
    } catch (error) {
      logger.warn('Keyword matching failed, defaulting to false', {
        error: getErrorMessage(error),
        keywordsCount: keywords.length,
        contentLength: content.length,
      });
      return false;
    }
  }

  /**
   * Uses Gemini AI to check if content mentions all given keyword concepts.
   */
  private async matchWithAI(content: string, keywords: string[]): Promise<boolean> {
    const truncatedContent = content.slice(0, 2000);
    const keywordList = keywords.map((k) => `"${k}"`).join(', ');

    const prompt = `You are a keyword concept matcher. Your task is to determine if a text discusses ALL of the following concepts/topics.

Keywords (in English): ${keywordList}

Text (may be in any language):
"""
${truncatedContent}
"""

Rules:
- A keyword matches if the text discusses the CONCEPT, not just the exact word.
- For example, "battery" matches if the text talks about battery life, charging, power, etc. in ANY language.
- ALL keywords must be present for a match (AND logic).
- Respond with ONLY a JSON object: {"match": true} or {"match": false}
- No explanation needed.`;

    const result = await this.geminiService.generateRawContent(prompt);
    return this.parseAIResponse(result);
  }

  /**
   * Parse AI response and extract match boolean.
   */
  private parseAIResponse(response: string): boolean {
    try {
      // Try to extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*?"match"\s*:\s*(true|false)[\s\S]*?\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as { match: boolean };
        return parsed.match === true;
      }

      // Fallback: check for true/false in response
      const lower = response.toLowerCase().trim();
      if (lower.includes('"match": true') || lower.includes('"match":true')) return true;
      if (lower.includes('"match": false') || lower.includes('"match":false')) return false;

      logger.warn('Could not parse AI keyword match response', { response: response.slice(0, 200) });
      return false;
    } catch (error) {
      logger.warn('Failed to parse AI keyword match response', {
        error: getErrorMessage(error),
        response: response.slice(0, 200),
      });
      return false;
    }
  }

  /**
   * Build cache key from content hash + keywords.
   */
  private buildCacheKey(content: string, keywords: string[]): string {
    const hash = crypto
      .createHash('sha256')
      .update(content.trim().toLowerCase() + '|' + keywords.sort().join(',').toLowerCase())
      .digest('hex')
      .substring(0, 16);
    return `keyword_match:${hash}`;
  }
}
