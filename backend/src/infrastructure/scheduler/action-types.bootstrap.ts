import { getPrisma } from '../repositories/prisma.client';
import logger from '../logger/logger';

/**
 * Ensures all default action types exist in the database.
 * Runs on server startup (non-blocking, idempotent).
 * New action types are inserted only if they don't already exist.
 */
export async function ensureDefaultActionTypes(): Promise<void> {
  const prisma = getPrisma();

  const defaults = [
    // POST actions
    { mainAction: 'POST', code: 'EXPERIENCE', label: 'Experience Post' },
    { mainAction: 'POST', code: 'TIPS', label: 'Tips Post' },
    { mainAction: 'POST', code: 'REVIEW', label: 'Review Post' },
    { mainAction: 'POST', code: 'GENERAL', label: 'General Post' },
    { mainAction: 'POST', code: 'FREE', label: 'Free Post' },
    { mainAction: 'POST', code: 'QUESTION', label: 'Question Post' },
    { mainAction: 'POST', code: 'COMPARE', label: 'Compare Post' },
    { mainAction: 'POST', code: 'UPDATE', label: 'Update Post' },
    { mainAction: 'POST', code: 'BENCHMARK', label: 'Benchmark Post' },
    // LIKE actions
    { mainAction: 'LIKE', code: 'ALL', label: 'Like Action' },
    // COMMENT actions
    { mainAction: 'COMMENT', code: 'ALL', label: 'Comment Action' },
    // BOOKMARK actions
    { mainAction: 'BOOKMARK', code: 'ALL', label: 'Bookmark Action' },
    // JOIN actions
    { mainAction: 'JOIN', code: 'ALL', label: 'Join Action' },
    { mainAction: 'JOIN', code: 'EVENT', label: 'Join Event' },
    { mainAction: 'JOIN', code: 'BRAND', label: 'Join Brand' },
    // SYSTEM actions
    { mainAction: 'SYSTEM', code: 'PROFILE_COMPLETE', label: 'Complete Profile' },
    { mainAction: 'SYSTEM', code: 'BIO_ADD', label: 'Add Bio' },
    { mainAction: 'SYSTEM', code: 'INVENTORY_ADD', label: 'Add Inventory Item' },
    { mainAction: 'SYSTEM', code: 'INVENTORY_OWN', label: 'Add Owned Product to Inventory' },
    { mainAction: 'SYSTEM', code: 'INVENTORY_TRIED', label: 'Add Tried Product to Inventory' },
    { mainAction: 'SYSTEM', code: 'PROFILE_PHOTO', label: 'Add Profile Photo' },
    { mainAction: 'SYSTEM', code: 'TRUST', label: 'Trust User' },
    { mainAction: 'SYSTEM', code: 'UPVOTE', label: 'Upvote Event Post' },
  ];

  try {
    const existing = await prisma.actionType.findMany({
      select: { mainAction: true, code: true },
    });

    const existingSet = new Set(existing.map((e) => `${e.mainAction}:${e.code}`));

    const missing = defaults.filter((d) => !existingSet.has(`${d.mainAction}:${d.code}`));

    if (missing.length === 0) {
      return;
    }

    await prisma.actionType.createMany({
      data: missing,
      skipDuplicates: true,
    });

    logger.info(`Bootstrap: ${missing.length} missing action types created`, {
      created: missing.map((m) => `${m.mainAction}:${m.code}`),
    });
  } catch (err) {
    logger.warn('Bootstrap: Failed to ensure default action types', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
