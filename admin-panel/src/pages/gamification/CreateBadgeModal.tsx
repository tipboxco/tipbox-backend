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
        // Always load categories
        const categoriesRes = await fetchBadgeCategories();
        if (!cancelled && categoriesRes.data) {
          setCategories(categoriesRes.data);
        }

        // Load collection info if in collection context to get its categoryId
        if (inCollection && collectionId) {
          const collectionRes = await fetchCollection(collectionId);
          if (!cancelled && collectionRes.data?.categoryId) {
            setCollectionCategoryId(collectionRes.data.categoryId);
          }
        }

        // Load action types if in collection context
        if (inCollection) {
          const actionTypesRes = await fetchActionTypes();
          if (!cancelled && actionTypesRes.data) {
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
  }, [inCollection, collectionId]);

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
      placeholder: 'Optional description',
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
      label: 'Category',
      type: 'select',
      required: true,
      options: categories.map((c) => ({ label: c.name, value: c.id })),
      placeholder: 'Select category',
      // Only show if NOT in collection context
      conditional: () => !inCollection,
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
      // Only show if IN collection context
      conditional: () => inCollection,
    },
    {
      name: 'pointsRequired',
      label: 'Target Count',
      type: 'number',
      required: true,
      placeholder: 'Enter target count',
      rules: [
        {
          validator: async (_rule, value: unknown) => {
            const numValue = typeof value === 'number' ? value : Number(value);
            if (inCollection && (!numValue || numValue < 1)) {
              throw new Error('Target count must be at least 1');
            }
          },
        },
      ],
      // Only show if IN collection context
      conditional: () => inCollection,
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
      placeholder: 'Select difficulty',
      // Only show if IN collection context
      conditional: () => inCollection,
    },
  ];

  const handleSubmit = async (values: Record<string, unknown>) => {
    try {
      // Determine categoryId: use collection's category if in collection context, otherwise use form value
      const effectiveCategoryId = inCollection && collectionCategoryId
        ? collectionCategoryId
        : (values.categoryId as string);

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

      // If in collection context, create collection goal
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
