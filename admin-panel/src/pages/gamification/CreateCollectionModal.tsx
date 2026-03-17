import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { message as antdMessage } from 'antd';
import { InfoCircleOutlined, FileImageOutlined } from '@ant-design/icons';
import {
  createCollection,
  uploadMedia,
  uploadHighlightsImage,
  fetchCollectionCategories,
  type AdminCollectionCategoryMain,
} from '../../api/admin-badges-collections';
import { CreatableFormDrawer } from '../../components/form';
import type { FieldConfig, StepConfig } from '../../components/form';

interface CreateCollectionModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

function CreateCollectionModal({ open, onClose, onSuccess }: CreateCollectionModalProps) {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<AdminCollectionCategoryMain[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(false);

  // Load categories when modal opens
  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    (async () => {
      setLoadingCategories(true);
      try {
        const res = await fetchCollectionCategories();
        if (!cancelled && res.data) {
          setCategories(res.data);
        }
      } catch (err) {
        console.error('Failed to load categories:', err);
      } finally {
        if (!cancelled) {
          setLoadingCategories(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open]);

  // Convert nested categories to nested options format
  const categoryOptions = [
    // Add "Custom" option first (will be converted to null in handleSubmit)
    {
      label: 'Custom',
      value: '__CUSTOM__', // Special value to indicate no category
      children: [],
    },
    // Then add real categories from API
    ...categories.map((main) => ({
      label: main.name,
      value: main.id,
      children: main.children.map((sub) => ({
        label: sub.name,
        value: sub.id,
      })),
    })),
  ];

  const collectionFields: FieldConfig[] = [
    {
      name: 'name',
      label: 'Collection name',
      type: 'text',
      required: true,
      maxLength: 500,
      placeholder: 'e.g. Summer Season Badges',
    },
    {
      name: 'owner',
      label: 'Owner',
      type: 'text',
      maxLength: 200,
      placeholder: 'Optional',
    },
    {
      name: 'focusSector',
      label: 'Focus sector',
      type: 'text',
      maxLength: 200,
      placeholder: 'e.g. E-commerce, Gaming',
    },
    {
      name: 'targetGroup',
      label: 'Target group',
      type: 'text',
      maxLength: 200,
      placeholder: 'Target audience',
    },
    {
      name: 'shortDescription',
      label: 'Short description',
      type: 'textarea',
      rows: 2,
      maxLength: 2000,
      placeholder: 'Short description',
    },
    {
      name: 'categoryId',
      label: 'Category',
      type: 'nested-select',
      nestedOptions: categoryOptions,
      placeholder: 'Select category (optional)',
    },
    {
      name: 'longDescription',
      label: 'Long description',
      type: 'textarea',
      rows: 3,
      maxLength: 5000,
      placeholder: 'Detailed description',
    },
    {
      name: 'bannerUrl',
      label: 'Cover image',
      type: 'upload',
      uploadConfig: {
        accept: 'image/jpeg,image/png,image/gif,image/webp',
        maxSize: 5 * 1024 * 1024, // 5MB
        onUpload: async (file: File) => {
          const res = await uploadMedia(file);
          if (!res.data?.url) {
            throw new Error('Upload failed - no URL returned');
          }
          return res.data.url;
        },
      },
    },
    {
      name: 'highlightsImage',
      label: 'Highlights image',
      type: 'upload',
      uploadConfig: {
        accept: 'image/jpeg,image/png,image/gif,image/webp',
        maxSize: 5 * 1024 * 1024, // 5MB
        onUpload: async (file: File) => {
          const res = await uploadHighlightsImage(file);
          if (!res.data?.url) {
            throw new Error('Upload failed - no URL returned');
          }
          return res.data.url;
        },
      },
    },
    {
      name: 'unlockCondition',
      label: 'Unlock condition',
      type: 'text',
      maxLength: 200,
      placeholder: 'Unlock condition',
    },
    {
      name: 'completionBonus',
      label: 'Completion reward',
      type: 'text',
      maxLength: 200,
      placeholder: 'Reward for completion',
    },
  ];

  const steps: StepConfig[] = [
    {
      title: 'Basic information',
      icon: <InfoCircleOutlined />,
      fields: ['name', 'owner', 'focusSector', 'targetGroup', 'shortDescription', 'categoryId'],
    },
    {
      title: 'Details and image',
      icon: <FileImageOutlined />,
      fields: ['longDescription', 'bannerUrl', 'highlightsImage', 'unlockCondition', 'completionBonus'],
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
      // Validate required fields
      if (!values.name || typeof values.name !== 'string' || !values.name.trim()) {
        throw new Error('Collection name is required');
      }

      // Convert __CUSTOM__ to null (no category)
      let categoryId = trimString(values.categoryId);
      if (categoryId === '__CUSTOM__') {
        categoryId = null;
      }

      const res = await createCollection({
        name: values.name.trim(),
        owner: trimString(values.owner),
        focusSector: trimString(values.focusSector),
        targetGroup: trimString(values.targetGroup),
        shortDescription: trimString(values.shortDescription),
        longDescription: trimString(values.longDescription),
        bannerUrl: trimString(values.bannerUrl),
        highlightsImage: trimString(values.highlightsImage),
        unlockCondition: trimString(values.unlockCondition),
        completionBonus: trimString(values.completionBonus),
        categoryId: categoryId,
      });

      antdMessage.success('Collection created successfully');
      onSuccess();

      // Navigate to collection detail page
      if (res.data?.id) {
        navigate(`/gamification/collections/${res.data.id}`);
      }

      onClose();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to create collection';
      antdMessage.error(errorMsg);
      throw err; // Re-throw to show error in drawer
    }
  };

  return (
    <CreatableFormDrawer
      open={open}
      title="New collection"
      fields={collectionFields}
      steps={steps}
      onSubmit={handleSubmit}
      onClose={onClose}
      loading={loadingCategories}
      width={560}
    />
  );
}

export default CreateCollectionModal;
