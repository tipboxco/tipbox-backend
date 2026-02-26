import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  fetchBadgeCategories,
  createBadge,
  fetchCollection,
  fetchActionTypes,
  createCollectionGoal,
} from '../../api/admin-badges-collections';
import type { AdminBadgeCategoryListItem, AdminActionTypeListItem } from '../../types/admin';
import { CreatableFormDrawer } from '../../components/form';
import type { FieldConfig } from '../../components/form';

export type CreateBadgeModalType = 'EVENT' | 'BRAND' | 'COSMETIC' | 'COLLECTION';

interface CreateBadgeModalProps {
  badgeType: CreateBadgeModalType;
  listPath: string;
  collectionId?: string | null;
  onClose: () => void;
  onSuccess: () => void;
}

const isCollectionContext = (type: CreateBadgeModalType, cId?: string | null) =>
  type === 'COLLECTION' && cId;

function CreateBadgeModal({
  badgeType,
  listPath,
  collectionId,
  onClose,
  onSuccess,
}: CreateBadgeModalProps) {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<AdminBadgeCategoryListItem[]>([]);
  const [actionTypes, setActionTypes] = useState<AdminActionTypeListItem[]>([]);
  const [collectionCategoryId, setCollectionCategoryId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const inCollection = !!isCollectionContext(badgeType, collectionId);

  // Load required data when modal opens
  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        // Always load categories and action types
        const [categoriesRes, actionTypesRes] = await Promise.all([
          fetchBadgeCategories(),
          fetchActionTypes(),
        ]);

        if (!cancelled) {
          if (categoriesRes.data) {
            setCategories(categoriesRes.data);
          }
          if (actionTypesRes.data) {
            setActionTypes(actionTypesRes.data);
          }
        }

        // Load collection info if in collection context to get its categoryId
        if (inCollection && collectionId) {
          const collectionRes = await fetchCollection(collectionId);
          if (!cancelled && collectionRes.data?.categoryId) {
            setCollectionCategoryId(collectionRes.data.categoryId);
          }
        }
      } catch (err) {
        console.error('Failed to load data:', err);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [inCollection, collectionId]);

  // Badge fields in logical order:
  // 1. Basic info (name, rarity, category)
  // 2. Visual (image)
  // 3. Description
  // 4. Activation rules (if collection context)
  const badgeFields: FieldConfig[] = [
    // 1. Basic Information
    {
      name: 'name',
      label: 'Badge Name',
      type: 'text',
      required: true,
      maxLength: 500,
      placeholder: 'e.g., First Post Creator',
    },
    {
      name: 'rarity',
      label: 'Rarity',
      type: 'select',
      required: true,
      options: [
        { label: 'Common', value: 'COMMON' },
        { label: 'Rare', value: 'RARE' },
        { label: 'Epic', value: 'EPIC' },
      ],
      placeholder: 'Select rarity level',
    },
    {
      name: 'categoryId',
      label: 'Badge Category',
      type: 'select',
      required: true,
      options: categories.map((c) => ({ label: c.name, value: c.id })),
      placeholder: 'Select category',
    },

    // 2. Visual
    {
      name: 'imageUrl',
      label: 'Badge Image URL',
      type: 'text',
      maxLength: 1000,
      placeholder: 'https://example.com/badge.png',
    },

    // 3. Description
    {
      name: 'description',
      label: 'Description',
      type: 'textarea',
      rows: 2,
      maxLength: 2000,
      placeholder: 'Describe what this badge represents',
    },

    // 4. Activation Rules
    {
      name: 'actionTypeId',
      label: 'Main Action Type',
      type: 'select',
      required: false,
      options: actionTypes.map((a) => ({
        label: `${a.label} (${a.mainAction} / ${a.code})`,
        value: a.id,
      })),
      placeholder: 'Select main action (POST, LIKE, BOOKMARK, etc.)',
    },
    {
      name: 'pointsRequired',
      label: 'Target Value (Points Required)',
      type: 'number',
      required: false,
      placeholder: 'e.g., 10',
      rules: [
        {
          validator: async (_rule, value: unknown) => {
            const numValue = typeof value === 'number' ? value : Number(value);
            if (value != null && (!numValue || numValue < 1)) {
              throw new Error('Target value must be at least 1');
            }
          },
        },
      ],
    },
    {
      name: 'difficulty',
      label: 'Difficulty',
      type: 'select',
      required: false,
      options: [
        { label: 'Easy', value: 'EASY' },
        { label: 'Medium', value: 'MEDIUM' },
        { label: 'Hard', value: 'HARD' },
      ],
      placeholder: 'Select difficulty',
    },
  ];

  const handleSubmit = async (values: Record<string, unknown>) => {
    try {
      // Determine categoryId: use form value (collection categoryId override removed)
      const effectiveCategoryId = values.categoryId as string;

      // Create badge
      const badgeRes = await createBadge({
        name: (values.name as string).trim(),
        description: (values.description as string)?.trim() || null,
        imageUrl: (values.imageUrl as string)?.trim() || null,
        type: badgeType,
        rarity: values.rarity as 'COMMON' | 'RARE' | 'EPIC',
        categoryId: effectiveCategoryId,
        collectionId: badgeType === 'COLLECTION' && collectionId ? collectionId : null,
      });

      // If in collection context AND actionTypeId is provided, create collection goal
      if (inCollection && collectionId && badgeRes.data?.id && values.actionTypeId) {
        await createCollectionGoal(collectionId, {
          actionTypeId: values.actionTypeId as string,
          rewardBadgeId: badgeRes.data.id,
          pointsRequired: Number(values.pointsRequired) || 1,
          title: (values.name as string).trim(),
          difficulty: (values.difficulty as 'EASY' | 'MEDIUM' | 'HARD') || 'MEDIUM',
        });
      }

      onSuccess();

      // Navigate based on context
      if (badgeRes.data?.id && badgeType !== 'COLLECTION') {
        navigate(`${listPath}/${badgeRes.data.id}`);
      } else if (badgeType === 'COLLECTION') {
        navigate(listPath);
      }

      onClose();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to create badge';
      throw new Error(errorMsg);
    }
  };

  return (
    <CreatableFormDrawer
      open={true}
      title={inCollection ? 'Add badge to collection' : `New badge (${badgeType})`}
      fields={badgeFields}
      onSubmit={handleSubmit}
      onClose={onClose}
      loading={loading}
      initialValues={{
        rarity: 'COMMON',
        difficulty: 'MEDIUM',
        pointsRequired: 1,
      }}
      width={600}
    />
  );
}

export default CreateBadgeModal;
