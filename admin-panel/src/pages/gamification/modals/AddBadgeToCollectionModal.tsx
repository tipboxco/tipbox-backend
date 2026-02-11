import { useState, useEffect } from 'react';
import { message as antdMessage } from 'antd';
import {
  fetchBadgeCategories,
  createBadge,
  fetchActionTypes,
  createCollectionGoal,
} from '../../../api/admin-badges-collections';
import type { AdminBadgeCategoryListItem, AdminActionTypeListItem } from '../../../types/admin';
import { CreatableFormDrawer } from '../../../components/form';
import type { FieldConfig } from '../../../components/form';

interface AddBadgeToCollectionModalProps {
  open: boolean;
  collectionId: string;
  collectionCategoryId: string | null;
  onClose: () => void;
  onSuccess: () => void;
}

function AddBadgeToCollectionModal({
  open,
  collectionId,
  collectionCategoryId,
  onClose,
  onSuccess,
}: AddBadgeToCollectionModalProps) {
  const [categories, setCategories] = useState<AdminBadgeCategoryListItem[]>([]);
  const [actionTypes, setActionTypes] = useState<AdminActionTypeListItem[]>([]);
  const [loading, setLoading] = useState(true);

  const needsCategoryField = collectionCategoryId === null;

  // Load required data when modal opens
  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        // Load categories only if collection doesn't have one
        const categoriesPromise = needsCategoryField
          ? fetchBadgeCategories()
          : Promise.resolve({ data: [] as AdminBadgeCategoryListItem[] });

        // Always load action types
        const actionTypesPromise = fetchActionTypes();

        const [categoriesRes, actionTypesRes] = await Promise.all([
          categoriesPromise,
          actionTypesPromise,
        ]);

        if (!cancelled) {
          if (categoriesRes.data) {
            setCategories(categoriesRes.data);
          }
          if (actionTypesRes.data) {
            setActionTypes(actionTypesRes.data);
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
  }, [open, needsCategoryField]);

  const badgeFields: FieldConfig[] = [
    {
      name: 'name',
      label: 'Badge name',
      type: 'text',
      required: true,
      maxLength: 500,
      placeholder: 'Enter badge name',
    },
    {
      name: 'description',
      label: 'Description',
      type: 'textarea',
      rows: 2,
      maxLength: 2000,
      placeholder: 'Optional badge description',
    },
    {
      name: 'imageUrl',
      label: 'Image URL',
      type: 'text',
      maxLength: 1000,
      placeholder: 'https://...',
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
    },
    {
      name: 'categoryId',
      label: 'Badge Category',
      type: 'select',
      required: true,
      options: categories.map((c) => ({ label: c.name, value: c.id })),
      placeholder: 'Select category',
      // Only show if collection doesn't have a category
      conditional: () => needsCategoryField,
    },
    {
      name: 'actionTypeId',
      label: 'Activation Type',
      type: 'select',
      required: true,
      options: actionTypes.map((a) => ({
        label: `${a.label} (${a.mainAction} / ${a.code})`,
        value: a.id,
      })),
      placeholder: 'Select activation type',
    },
    {
      name: 'pointsRequired',
      label: 'Target Count (Points Required)',
      type: 'number',
      required: true,
      placeholder: 'e.g. 10',
      rules: [
        {
          validator: async (_rule, value: unknown) => {
            const numValue = typeof value === 'number' ? value : Number(value);
            if (!numValue || numValue < 1) {
              throw new Error('Target count must be at least 1');
            }
          },
        },
      ],
    },
    {
      name: 'difficulty',
      label: 'Difficulty',
      type: 'select',
      required: true,
      options: [
        { label: 'Easy', value: 'EASY' },
        { label: 'Medium', value: 'MEDIUM' },
        { label: 'Hard', value: 'HARD' },
      ],
    },
  ];

  const handleSubmit = async (values: Record<string, unknown>) => {
    try {
      // Use collection's category if available, otherwise use form value
      const effectiveCategoryId = collectionCategoryId ?? (values.categoryId as string);

      // Create badge
      const badgeRes = await createBadge({
        name: (values.name as string).trim(),
        description: (values.description as string)?.trim() || null,
        imageUrl: (values.imageUrl as string)?.trim() || null,
        type: 'COLLECTION',
        rarity: values.rarity as 'COMMON' | 'RARE' | 'EPIC',
        categoryId: effectiveCategoryId,
        collectionId,
      });

      const newBadgeId = badgeRes.data?.id;
      if (!newBadgeId) {
        throw new Error('Failed to create badge - no ID returned');
      }

      // Create collection goal
      await createCollectionGoal(collectionId, {
        actionTypeId: values.actionTypeId as string,
        rewardBadgeId: newBadgeId,
        pointsRequired: Number(values.pointsRequired) || 1,
        title: (values.name as string).trim(),
        difficulty: (values.difficulty as 'EASY' | 'MEDIUM' | 'HARD') || 'MEDIUM',
      });

      antdMessage.success('Badge added to collection successfully');
      onSuccess();
      onClose();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to add badge to collection';
      antdMessage.error(errorMsg);
      throw err; // Re-throw to show error in drawer
    }
  };

  return (
    <CreatableFormDrawer
      open={open}
      title="Add Badge to Collection"
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

export default AddBadgeToCollectionModal;
