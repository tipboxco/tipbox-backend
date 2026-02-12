import { useState, useEffect, useRef } from 'react';
import { message as antdMessage, Form } from 'antd';
import type { FormInstance } from 'antd';
import {
  fetchBadgeCategories,
  createBadge,
  fetchActionTypes,
  createCollectionGoal,
  uploadMedia,
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

type MainActionType = 'POST' | 'LIKE' | 'COMMENT' | 'BOOKMARK' | 'JOIN' | 'SYSTEM';

function AddBadgeToCollectionModal({
  open,
  collectionId,
  collectionCategoryId,
  onClose,
  onSuccess,
}: AddBadgeToCollectionModalProps) {
  const [categories, setCategories] = useState<AdminBadgeCategoryListItem[]>([]);
  const [allActionTypes, setAllActionTypes] = useState<AdminActionTypeListItem[]>([]);
  const [filteredCodes, setFilteredCodes] = useState<AdminActionTypeListItem[]>([]);
  const [selectedMainAction, setSelectedMainAction] = useState<MainActionType | null>(null);
  const [loading, setLoading] = useState(true);
  const formRef = useRef<FormInstance>(null);

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

        // Load ALL action types at once
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
            setAllActionTypes(actionTypesRes.data);
          }
        }
      } catch (err) {
        console.error('Failed to load data:', err);
        antdMessage.error('Failed to load form data');
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

  // Get unique main actions from action types
  const mainActions = Array.from(new Set(allActionTypes.map((at) => at.mainAction))).sort();

  // Update filtered codes when mainAction changes
  const handleMainActionChange = (mainAction: MainActionType | null) => {
    setSelectedMainAction(mainAction);
    if (mainAction) {
      const filtered = allActionTypes.filter((at) => at.mainAction === mainAction);
      setFilteredCodes(filtered);
    } else {
      setFilteredCodes([]);
    }

    // Clear dependent fields when mainAction changes
    if (formRef.current) {
      formRef.current.setFieldsValue({
        actionTypeId: undefined,
        bookmarkTarget: undefined,
        likeTarget: undefined,
      });
    }
  };

  const badgeFields: FieldConfig[] = [
    {
      name: 'name',
      label: 'Badge Name',
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
      label: 'Badge Image (Optional)',
      type: 'upload',
      required: false,
      placeholder: 'Upload badge image (JPG, PNG, GIF, WebP - Max 5MB)',
      uploadConfig: {
        accept: 'image/jpeg,image/jpg,image/png,image/gif,image/webp',
        maxSize: 5 * 1024 * 1024, // 5MB
        onUpload: async (file: File) => {
          try {
            const response = await uploadMedia(file);
            if (!response.data?.url) {
              throw new Error('Upload failed - no URL returned');
            }
            return response.data.url;
          } catch (error) {
            throw new Error(
              error instanceof Error ? error.message : 'Failed to upload image'
            );
          }
        },
      },
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
      name: 'mainAction',
      label: 'Main Action Type',
      type: 'select',
      required: true,
      options: mainActions.map((action) => ({
        label: action,
        value: action,
      })),
      placeholder: 'Select main action (POST, LIKE, BOOKMARK, etc.)',
    },
    {
      name: 'actionTypeId',
      label: 'Action Code',
      type: 'select',
      required: true,
      options: filteredCodes.map((a) => ({
        label: `${a.code} - ${a.label}`,
        value: a.id,
      })),
      placeholder: selectedMainAction
        ? `Select ${selectedMainAction} action code`
        : 'First select main action',
      conditional: (values) => !!values.mainAction,
    },
    {
      name: 'bookmarkTarget',
      label: 'Bookmark Target',
      type: 'select',
      required: true,
      options: [
        { label: 'Post', value: 'POST' },
        { label: 'Collection', value: 'COLLECTION' },
      ],
      placeholder: 'Select bookmark target',
      conditional: (values) => values.mainAction === 'BOOKMARK',
    },
    {
      name: 'likeTarget',
      label: 'Like Target',
      type: 'select',
      required: true,
      options: [
        { label: 'All (any like)', value: 'ALL' },
        { label: 'Post', value: 'POST' },
        { label: 'Comment', value: 'COMMENT' },
      ],
      placeholder: 'Select like target',
      conditional: (values) => values.mainAction === 'LIKE',
    },
    {
      name: 'pointsRequired',
      label: 'Target Value (Points Required)',
      type: 'number',
      required: true,
      placeholder: 'e.g. 10 (user must complete 10 actions)',
      rules: [
        {
          validator: async (_rule, value: unknown) => {
            const numValue = typeof value === 'number' ? value : Number(value);
            if (!numValue || numValue < 1) {
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
      required: true,
      options: [
        { label: 'Easy', value: 'EASY' },
        { label: 'Medium', value: 'MEDIUM' },
        { label: 'Hard', value: 'HARD' },
      ],
    },
  ];

  // Helper to safely trim string values
  const trimString = (value: unknown): string | null => {
    if (!value || typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed === '' ? null : trimmed;
  };

  const handleSubmit = async (values: Record<string, unknown>) => {
    try {
      // Validate collectionId
      if (!collectionId) {
        throw new Error('Collection ID is required');
      }

      // Validate required fields
      if (!values.name || typeof values.name !== 'string' || !values.name.trim()) {
        throw new Error('Badge name is required');
      }

      // Use collection's category if available, otherwise use form value
      const effectiveCategoryId = collectionCategoryId ?? trimString(values.categoryId);

      if (!effectiveCategoryId) {
        throw new Error('Badge category is required');
      }

      // Prepare badge data
      const badgeData = {
        name: values.name.trim(),
        description: trimString(values.description),
        imageUrl: trimString(values.imageUrl),
        type: 'COLLECTION' as const,
        rarity: values.rarity as 'COMMON' | 'RARE' | 'EPIC',
        categoryId: effectiveCategoryId,
        collectionId,
      };

      console.log('Creating badge with data:', JSON.stringify(badgeData, null, 2));

      // Create badge
      const badgeRes = await createBadge(badgeData);

      const newBadgeId = badgeRes.data?.id;
      if (!newBadgeId) {
        throw new Error('Failed to create badge - no ID returned');
      }

      // Build requirement description based on action type
      let requirement = `Complete ${values.pointsRequired} ${values.mainAction} actions`;
      if (values.mainAction === 'BOOKMARK' && values.bookmarkTarget) {
        requirement = `Bookmark ${values.pointsRequired} ${values.bookmarkTarget}(s)`;
      } else if (values.mainAction === 'LIKE' && values.likeTarget) {
        requirement = `Like ${values.pointsRequired} ${values.likeTarget === 'ALL' ? 'items' : `${values.likeTarget}(s)`}`;
      }

      // Create collection goal
      await createCollectionGoal(collectionId, {
        actionTypeId: values.actionTypeId as string,
        rewardBadgeId: newBadgeId,
        pointsRequired: Number(values.pointsRequired) || 1,
        title: (values.name as string).trim(),
        requirement,
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
      onClose={() => {
        setSelectedMainAction(null);
        setFilteredCodes([]);
        onClose();
      }}
      loading={loading}
      initialValues={{
        rarity: 'COMMON',
        difficulty: 'MEDIUM',
        pointsRequired: 1,
      }}
      width={600}
      formRef={formRef}
      // Custom field change handler to update filtered codes
      onFieldChange={(field, value) => {
        if (field === 'mainAction') {
          handleMainActionChange(value as MainActionType);
        }
      }}
    />
  );
}

export default AddBadgeToCollectionModal;
