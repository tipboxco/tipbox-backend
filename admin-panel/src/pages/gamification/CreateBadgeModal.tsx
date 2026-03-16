import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  fetchBadgeCategories,
  createBadge,
  fetchActionTypes,
  createCollectionGoal,
  uploadBadgeImage,
} from '../../api/admin-badges-collections';
import { fetchEvents, addEventBadge } from '../../api/admin-events';
import type {
  AdminBadgeCategoryListItem,
  AdminActionTypeListItem,
  AdminEventListItem,
} from '../../types/admin';
import { CreatableFormDrawer } from '../../components/form';
import type { FieldConfig } from '../../components/form';

export type CreateBadgeModalType = 'EVENT' | 'BRAND' | 'COSMETIC' | 'COLLECTION';

interface CreateBadgeModalProps {
  badgeType: CreateBadgeModalType;
  listPath: string;
  collectionId?: string | null;
  eventId?: string | null;
  onClose: () => void;
  onSuccess: () => void;
}

const isCollectionContext = (type: CreateBadgeModalType, cId?: string | null) =>
  type === 'COLLECTION' && cId;

function CreateBadgeModal({
  badgeType,
  listPath,
  collectionId,
  eventId: preselectedEventId,
  onClose,
  onSuccess,
}: CreateBadgeModalProps) {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<AdminBadgeCategoryListItem[]>([]);
  const [actionTypes, setActionTypes] = useState<AdminActionTypeListItem[]>([]);
  const [events, setEvents] = useState<AdminEventListItem[]>([]);
  const [eventCategoryId, setEventCategoryId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const inCollection = !!isCollectionContext(badgeType, collectionId);
  const isEvent = badgeType === 'EVENT';

  // Load required data when modal opens
  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        // Always load categories and action types
        const promises: Promise<unknown>[] = [
          fetchBadgeCategories(),
          fetchActionTypes(),
        ];

        // Load events for EVENT type (skip if event is preselected)
        if (isEvent && !preselectedEventId) {
          promises.push(fetchEvents({ limit: 100, sort: 'createdAt', order: 'desc' }));
        }

        const results = await Promise.all(promises);
        const categoriesRes = results[0] as Awaited<ReturnType<typeof fetchBadgeCategories>>;
        const actionTypesRes = results[1] as Awaited<ReturnType<typeof fetchActionTypes>>;

        if (!cancelled) {
          if (categoriesRes.data) {
            setCategories(categoriesRes.data);
            // Find "Event" category for auto-selection
            const eventCat = categoriesRes.data.find(
              (c) => c.name.toLowerCase() === 'event',
            );
            if (eventCat) {
              setEventCategoryId(eventCat.id);
            }
          }
          if (actionTypesRes.data) {
            setActionTypes(actionTypesRes.data);
          }

          if (isEvent && !preselectedEventId && results[2]) {
            const eventsRes = results[2] as Awaited<ReturnType<typeof fetchEvents>>;
            if (eventsRes.data) {
              setEvents(eventsRes.data);
            }
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
  }, [inCollection, collectionId, isEvent]);

  // Badge fields in logical order:
  // 1. Basic info (name, rarity, category)
  // 2. Event selector (for EVENT type)
  // 3. Visual (image)
  // 4. Description
  // 5. Activation rules (if collection context)
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
    // Rarity: hidden for EVENT (defaults to COMMON), shown for others
    ...(!isEvent
      ? [
          {
            name: 'rarity',
            label: 'Rarity',
            type: 'select' as const,
            required: true,
            options: [
              { label: 'Common', value: 'COMMON' },
              { label: 'Rare', value: 'RARE' },
              { label: 'Epic', value: 'EPIC' },
            ],
            placeholder: 'Select rarity level',
          },
        ]
      : []),

    // Category: hidden for EVENT (auto-set), shown for others
    ...(isEvent
      ? []
      : [
          {
            name: 'categoryId',
            label: 'Badge Category',
            type: 'select' as const,
            required: true,
            options: categories.map((c) => ({ label: c.name, value: c.id })),
            placeholder: 'Select category',
          },
        ]),

    // Event selector (only for EVENT type, hidden when event is preselected)
    ...(isEvent && !preselectedEventId
      ? [
          {
            name: 'eventId',
            label: 'Select Event',
            type: 'select' as const,
            required: true,
            showSearch: true,
            options: events.map((e) => ({
              label: `${e.title} (${e.status})`,
              value: e.id,
            })),
            placeholder: 'Search and select an event...',
          },
        ]
      : []),

    // 2. Visual
    {
      name: 'imageUrl',
      label: 'Badge Image',
      type: 'upload',
      required: false,
      placeholder: 'Upload badge image (JPG, PNG, GIF, WebP - Max 5MB)',
      uploadConfig: {
        accept: 'image/jpeg,image/jpg,image/png,image/gif,image/webp',
        maxSize: 5 * 1024 * 1024, // 5MB
        onUpload: async (file: File) => {
          try {
            const response = await uploadBadgeImage(file);
            if (!response.data?.url) {
              throw new Error('Upload failed - no URL returned');
            }
            return response.data.url;
          } catch (error) {
            throw new Error(
              error instanceof Error ? error.message : 'Failed to upload image',
            );
          }
        },
      },
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

    // 4. Activation Rules (only for COLLECTION type)
    ...(!isEvent
      ? [
          {
            name: 'actionTypeId',
            label: 'Main Action Type',
            type: 'select' as const,
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
            type: 'number' as const,
            required: false,
            placeholder: 'e.g., 10',
            rules: [
              {
                validator: async (_rule: unknown, value: unknown) => {
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
            type: 'select' as const,
            required: false,
            options: [
              { label: 'Easy', value: 'EASY' },
              { label: 'Medium', value: 'MEDIUM' },
              { label: 'Hard', value: 'HARD' },
            ],
            placeholder: 'Select difficulty',
          },
        ]
      : []),
  ];

  const handleSubmit = async (values: Record<string, unknown>) => {
    try {
      // For EVENT type, use auto-detected Event category; otherwise use form value
      const effectiveCategoryId = isEvent
        ? eventCategoryId ?? (values.categoryId as string)
        : (values.categoryId as string);

      if (!effectiveCategoryId) {
        throw new Error('Badge category not found. Please ensure an "Event" badge category exists.');
      }

      // Create badge
      const badgeRes = await createBadge({
        name: (values.name as string).trim(),
        description: (values.description as string)?.trim() || null,
        imageUrl: (values.imageUrl as string)?.trim() || null,
        type: badgeType,
        rarity: isEvent ? 'COMMON' : (values.rarity as 'COMMON' | 'RARE' | 'EPIC'),
        categoryId: effectiveCategoryId,
        collectionId: badgeType === 'COLLECTION' && collectionId ? collectionId : null,
      });

      // If EVENT type, link badge to the selected or preselected event
      const targetEventId = preselectedEventId ?? (values.eventId as string);
      if (isEvent && badgeRes.data?.id && targetEventId) {
        await addEventBadge(targetEventId, {
          badgeId: badgeRes.data.id,
          rank: 1,
        });
      }

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

      // Navigate based on context (skip navigation if event was preselected - stay on event page)
      if (!preselectedEventId) {
        if (badgeRes.data?.id && badgeType !== 'COLLECTION') {
          navigate(`${listPath}/${badgeRes.data.id}`);
        } else if (badgeType === 'COLLECTION') {
          navigate(listPath);
        }
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
