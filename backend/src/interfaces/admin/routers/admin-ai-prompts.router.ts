import { Router, Request, Response } from 'express';
import { asyncHandler } from '../../../infrastructure/errors/async-handler';
import { validateBody, validateQuery } from '../../../infrastructure/middleware/validation.middleware';
import { getPrisma } from '../../../infrastructure/repositories/prisma.client';
import { NotFoundError, ValidationError } from '../../../infrastructure/errors/custom-errors';
import { CacheService } from '../../../infrastructure/cache/cache.service';
import logger from '../../../infrastructure/logger/logger';
import { z } from 'zod';

const router = Router();
const prisma = getPrisma();
const cache = new CacheService();

const AI_PROMPT_CACHE_PREFIX = 'ai:prompt:';
const AI_PROMPT_CACHE_TTL = 3600; // 1 hour

// ==================== Schemas ====================

const AdminAiPromptsQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(50),
  offset: z.coerce.number().int().nonnegative().default(0),
  isActive: z.coerce.boolean().optional(),
  search: z.string().optional(),
});

const AdminCreateAiPromptSchema = z.object({
  key: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9_-]+$/, 'Key must be lowercase alphanumeric with hyphens or underscores'),
  name: z.string().min(1).max(255),
  description: z.string().max(2000).nullable().optional(),
  promptText: z.string().min(1),
  version: z.string().min(1).max(50).default('v1.0'),
  isActive: z.boolean().default(true),
});

const AdminUpdateAiPromptSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).nullable().optional(),
  promptText: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
  changeNote: z.string().max(500).optional(),
});

// ==================== Stats ====================

router.get(
  '/stats',
  asyncHandler(async (_req: Request, res: Response) => {
    const [total, active] = await Promise.all([
      prisma.aiPromptTemplate.count(),
      prisma.aiPromptTemplate.count({ where: { isActive: true } }),
    ]);

    const versionCount = await prisma.aiPromptVersion.count();

    return res.json({
      success: true,
      data: {
        total,
        active,
        inactive: total - active,
        totalVersions: versionCount,
      },
    });
  }),
);

// ==================== List ====================

router.get(
  '/',
  validateQuery(AdminAiPromptsQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const query = AdminAiPromptsQuerySchema.parse(req.query);

    const where: Record<string, unknown> = {};
    if (query.isActive !== undefined) where.isActive = query.isActive;
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { key: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [templates, total] = await Promise.all([
      prisma.aiPromptTemplate.findMany({
        where,
        take: query.limit,
        skip: query.offset,
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.aiPromptTemplate.count({ where }),
    ]);

    const data = templates.map((t) => ({
      id: t.id,
      key: t.key,
      name: t.name,
      description: t.description,
      version: t.version,
      isActive: t.isActive,
      promptTextPreview: t.promptText.substring(0, 200) + (t.promptText.length > 200 ? '...' : ''),
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
    }));

    return res.json({
      success: true,
      data,
      pagination: { total, limit: query.limit, offset: query.offset },
    });
  }),
);

// ==================== Get Single ====================

router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const template = await prisma.aiPromptTemplate.findUnique({ where: { id } });
    if (!template) {
      throw new NotFoundError('AI prompt template not found');
    }

    // Get version history
    const versions = await prisma.aiPromptVersion.findMany({
      where: { templateKey: template.key },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return res.json({
      success: true,
      data: {
        id: template.id,
        key: template.key,
        name: template.name,
        description: template.description,
        promptText: template.promptText,
        version: template.version,
        isActive: template.isActive,
        createdAt: template.createdAt.toISOString(),
        updatedAt: template.updatedAt.toISOString(),
        createdBy: template.createdBy,
        updatedBy: template.updatedBy,
        versions: versions.map((v) => ({
          id: v.id,
          version: v.version,
          changeNote: v.changeNote,
          promptTextPreview:
            v.promptText.substring(0, 200) + (v.promptText.length > 200 ? '...' : ''),
          createdAt: v.createdAt.toISOString(),
          createdBy: v.createdBy,
        })),
      },
    });
  }),
);

// ==================== Get Version Detail ====================

router.get(
  '/versions/:versionId',
  asyncHandler(async (req: Request, res: Response) => {
    const { versionId } = req.params;

    const version = await prisma.aiPromptVersion.findUnique({ where: { id: versionId } });
    if (!version) {
      throw new NotFoundError('AI prompt version not found');
    }

    return res.json({
      success: true,
      data: {
        id: version.id,
        templateKey: version.templateKey,
        version: version.version,
        promptText: version.promptText,
        changeNote: version.changeNote,
        createdAt: version.createdAt.toISOString(),
        createdBy: version.createdBy,
      },
    });
  }),
);

// ==================== Create ====================

router.post(
  '/',
  validateBody(AdminCreateAiPromptSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const adminId = req.user?.id;
    const body = AdminCreateAiPromptSchema.parse(req.body);

    // Check unique key
    const existing = await prisma.aiPromptTemplate.findUnique({ where: { key: body.key } });
    if (existing) {
      throw new ValidationError(`A prompt template with key "${body.key}" already exists`);
    }

    const template = await prisma.$transaction(async (tx) => {
      const created = await tx.aiPromptTemplate.create({
        data: {
          key: body.key,
          name: body.name,
          description: body.description ?? null,
          promptText: body.promptText,
          version: body.version,
          isActive: body.isActive,
          createdBy: adminId ?? null,
          updatedBy: adminId ?? null,
        },
      });

      // Save initial version
      await tx.aiPromptVersion.create({
        data: {
          templateKey: body.key,
          version: body.version,
          promptText: body.promptText,
          changeNote: 'Initial version',
          createdBy: adminId ?? null,
        },
      });

      return created;
    });

    await prisma.adminLog.create({
      data: {
        adminId: adminId || 'system',
        action: 'AI_PROMPT_CREATE',
        description: `Created AI prompt template: ${body.name} (${body.key})`,
        entityType: 'ai_prompt_template',
        entityId: 0,
      },
    });

    // Invalidate cache
    await cache.del(`${AI_PROMPT_CACHE_PREFIX}${body.key}`);

    logger.info('Admin created AI prompt template', {
      adminId,
      key: body.key,
      version: body.version,
    });

    return res.status(201).json({
      success: true,
      data: {
        id: template.id,
        key: template.key,
        name: template.name,
        description: template.description,
        version: template.version,
        isActive: template.isActive,
        createdAt: template.createdAt.toISOString(),
      },
    });
  }),
);

// ==================== Update ====================

router.patch(
  '/:id',
  validateBody(AdminUpdateAiPromptSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const adminId = req.user?.id;
    const body = AdminUpdateAiPromptSchema.parse(req.body);

    const existing = await prisma.aiPromptTemplate.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundError('AI prompt template not found');
    }

    const promptChanged = body.promptText !== undefined && body.promptText !== existing.promptText;

    // Auto-increment version if prompt text changed
    let newVersion = existing.version;
    if (promptChanged) {
      const versionParts = existing.version.replace('v', '').split('.');
      const major = parseInt(versionParts[0] || '1', 10);
      const minor = parseInt(versionParts[1] || '0', 10);
      newVersion = `v${major}.${minor + 1}`;
    }

    const updated = await prisma.$transaction(async (tx) => {
      const updateData: Record<string, unknown> = {
        updatedBy: adminId ?? null,
      };

      if (body.name !== undefined) updateData.name = body.name;
      if (body.description !== undefined) updateData.description = body.description ?? null;
      if (body.isActive !== undefined) updateData.isActive = body.isActive;

      if (promptChanged) {
        updateData.promptText = body.promptText;
        updateData.version = newVersion;

        // Save version history
        await tx.aiPromptVersion.create({
          data: {
            templateKey: existing.key,
            version: newVersion,
            promptText: body.promptText!,
            changeNote: body.changeNote ?? null,
            createdBy: adminId ?? null,
          },
        });
      }

      return tx.aiPromptTemplate.update({
        where: { id },
        data: updateData,
      });
    });

    await prisma.adminLog.create({
      data: {
        adminId: adminId || 'system',
        action: 'AI_PROMPT_UPDATE',
        description: `Updated AI prompt template: ${existing.name} (${existing.key})${promptChanged ? ` → ${newVersion}` : ''}`,
        entityType: 'ai_prompt_template',
        entityId: 0,
      },
    });

    // Invalidate cache
    await cache.del(`${AI_PROMPT_CACHE_PREFIX}${existing.key}`);

    logger.info('Admin updated AI prompt template', {
      adminId,
      key: existing.key,
      promptChanged,
      newVersion,
    });

    return res.json({
      success: true,
      data: {
        id: updated.id,
        key: updated.key,
        name: updated.name,
        description: updated.description,
        version: updated.version,
        isActive: updated.isActive,
        updatedAt: updated.updatedAt.toISOString(),
      },
    });
  }),
);

// ==================== Restore Version ====================

router.post(
  '/:id/restore-version/:versionId',
  asyncHandler(async (req: Request, res: Response) => {
    const { id, versionId } = req.params;
    const adminId = req.user?.id;

    const template = await prisma.aiPromptTemplate.findUnique({ where: { id } });
    if (!template) {
      throw new NotFoundError('AI prompt template not found');
    }

    const version = await prisma.aiPromptVersion.findUnique({ where: { id: versionId } });
    if (!version) {
      throw new NotFoundError('AI prompt version not found');
    }

    if (version.templateKey !== template.key) {
      throw new ValidationError('Version does not belong to this template');
    }

    // Auto-increment version
    const versionParts = template.version.replace('v', '').split('.');
    const major = parseInt(versionParts[0] || '1', 10);
    const minor = parseInt(versionParts[1] || '0', 10);
    const newVersion = `v${major}.${minor + 1}`;

    await prisma.$transaction(async (tx) => {
      await tx.aiPromptTemplate.update({
        where: { id },
        data: {
          promptText: version.promptText,
          version: newVersion,
          updatedBy: adminId ?? null,
        },
      });

      await tx.aiPromptVersion.create({
        data: {
          templateKey: template.key,
          version: newVersion,
          promptText: version.promptText,
          changeNote: `Restored from ${version.version}`,
          createdBy: adminId ?? null,
        },
      });
    });

    await prisma.adminLog.create({
      data: {
        adminId: adminId || 'system',
        action: 'AI_PROMPT_RESTORE',
        description: `Restored AI prompt ${template.key} to version ${version.version} as ${newVersion}`,
        entityType: 'ai_prompt_template',
        entityId: 0,
      },
    });

    // Invalidate cache
    await cache.del(`${AI_PROMPT_CACHE_PREFIX}${template.key}`);

    logger.info('Admin restored AI prompt version', {
      adminId,
      key: template.key,
      restoredFrom: version.version,
      newVersion,
    });

    return res.json({
      success: true,
      message: `Prompt restored from ${version.version} as ${newVersion}`,
    });
  }),
);

// ==================== Delete ====================

router.delete(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const adminId = req.user?.id;

    const template = await prisma.aiPromptTemplate.findUnique({ where: { id } });
    if (!template) {
      throw new NotFoundError('AI prompt template not found');
    }

    await prisma.$transaction(async (tx) => {
      await tx.aiPromptVersion.deleteMany({ where: { templateKey: template.key } });
      await tx.aiPromptTemplate.delete({ where: { id } });
    });

    await prisma.adminLog.create({
      data: {
        adminId: adminId || 'system',
        action: 'AI_PROMPT_DELETE',
        description: `Deleted AI prompt template: ${template.name} (${template.key})`,
        entityType: 'ai_prompt_template',
        entityId: 0,
      },
    });

    // Invalidate cache
    await cache.del(`${AI_PROMPT_CACHE_PREFIX}${template.key}`);

    logger.info('Admin deleted AI prompt template', { adminId, key: template.key });

    return res.json({ success: true, message: 'AI prompt template deleted successfully' });
  }),
);

export { AI_PROMPT_CACHE_PREFIX, AI_PROMPT_CACHE_TTL };
export default router;
