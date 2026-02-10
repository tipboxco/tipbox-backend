import { useState, useEffect } from 'react';
import {
  Modal,
  Form,
  Input,
  Select,
  InputNumber,
  Button,
  Alert,
  Spin,
  Space,
  message as antdMessage,
} from 'antd';
import {
  fetchBadgeCategories,
  createBadge,
  fetchActionTypes,
  createCollectionGoal,
} from '../../../api/admin-badges-collections';
import type { AdminBadgeCategoryListItem, AdminActionTypeListItem } from '../../../types/admin';
import { FORM_LAYOUT_VERTICAL } from '../../../constants/form-layout';

interface AddBadgeToCollectionModalProps {
  open: boolean;
  collectionId: string;
  collectionCategoryId: string | null;
  onClose: () => void;
  onSuccess: () => void;
}

interface FormValues {
  name: string;
  description?: string;
  imageUrl?: string;
  rarity: 'COMMON' | 'RARE' | 'EPIC';
  categoryId: string;
  actionTypeId: string;
  pointsRequired: number;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
}

function AddBadgeToCollectionModal({
  open,
  collectionId,
  collectionCategoryId,
  onClose,
  onSuccess,
}: AddBadgeToCollectionModalProps) {
  const [form] = Form.useForm<FormValues>();
  const [categories, setCategories] = useState<AdminBadgeCategoryListItem[]>([]);
  const [actionTypes, setActionTypes] = useState<AdminActionTypeListItem[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    (async () => {
      setLoadingData(true);
      setError(null);
      try {
        const [categoriesRes, actionTypesRes] = await Promise.all([
          collectionCategoryId === null ? fetchBadgeCategories() : Promise.resolve({ data: [] }),
          fetchActionTypes(),
        ]);

        if (!cancelled) {
          if (categoriesRes.data && categoriesRes.data.length > 0) {
            setCategories(categoriesRes.data);
            form.setFieldValue('categoryId', categoriesRes.data[0].id);
          } else if (collectionCategoryId) {
            form.setFieldValue('categoryId', collectionCategoryId);
          }

          if (actionTypesRes.data && actionTypesRes.data.length > 0) {
            setActionTypes(actionTypesRes.data);
            form.setFieldValue('actionTypeId', actionTypesRes.data[0].id);
          }
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load form data');
        }
      } finally {
        if (!cancelled) {
          setLoadingData(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, collectionCategoryId, form]);

  const handleSubmit = async (values: FormValues) => {
    setSaving(true);
    setError(null);
    try {
      const effectiveCategoryId = collectionCategoryId ?? values.categoryId;

      // Create badge
      const badgeRes = await createBadge({
        name: values.name.trim(),
        description: values.description?.trim() || null,
        imageUrl: values.imageUrl?.trim() || null,
        type: 'COLLECTION',
        rarity: values.rarity,
        categoryId: effectiveCategoryId,
        collectionId,
      });

      const newBadgeId = badgeRes.data?.id;
      if (!newBadgeId) {
        throw new Error('Failed to create badge');
      }

      // Create collection goal
      await createCollectionGoal(collectionId, {
        actionTypeId: values.actionTypeId,
        rewardBadgeId: newBadgeId,
        pointsRequired: values.pointsRequired,
        title: values.name.trim(),
        difficulty: values.difficulty,
      });

      antdMessage.success('Badge added to collection successfully');
      onSuccess();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add badge to collection');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title="Add Badge to Collection"
      open={open}
      onCancel={onClose}
      footer={null}
      width={600}
      destroyOnClose
    >
      {loadingData ? (
        <div style={{ textAlign: 'center', padding: 48 }}>
          <Spin size="large" />
        </div>
      ) : (
        <Form
          form={form}
          {...FORM_LAYOUT_VERTICAL}
          onFinish={handleSubmit}
          initialValues={{
            rarity: 'COMMON',
            difficulty: 'MEDIUM',
            pointsRequired: 1,
          }}
        >
          {error && (
            <Alert
              message="Error"
              description={error}
              type="error"
              closable
              onClose={() => setError(null)}
              style={{ marginBottom: 16 }}
            />
          )}

          <Form.Item
            label="Badge Name"
            name="name"
            rules={[{ required: true, message: 'Badge name is required' }]}
          >
            <Input placeholder="Badge name" />
          </Form.Item>

          <Form.Item label="Description" name="description">
            <Input.TextArea rows={2} placeholder="Optional badge description" />
          </Form.Item>

          <Form.Item label="Image URL" name="imageUrl">
            <Input type="url" placeholder="https://..." />
          </Form.Item>

          <Form.Item
            label="Rarity"
            name="rarity"
            rules={[{ required: true, message: 'Rarity is required' }]}
          >
            <Select>
              <Select.Option value="COMMON">COMMON</Select.Option>
              <Select.Option value="RARE">RARE</Select.Option>
              <Select.Option value="EPIC">EPIC</Select.Option>
            </Select>
          </Form.Item>

          {collectionCategoryId === null && (
            <Form.Item
              label="Badge Category"
              name="categoryId"
              rules={[{ required: true, message: 'Category is required' }]}
            >
              <Select placeholder="Select category">
                {categories.map((c) => (
                  <Select.Option key={c.id} value={c.id}>
                    {c.name}
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>
          )}

          <Form.Item
            label="Activation Type"
            name="actionTypeId"
            rules={[{ required: true, message: 'Activation type is required' }]}
          >
            <Select placeholder="Select activation type">
              {actionTypes.map((a) => (
                <Select.Option key={a.id} value={a.id}>
                  {a.label} ({a.mainAction} / {a.code})
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            label="Target Count (Points Required)"
            name="pointsRequired"
            rules={[
              { required: true, message: 'Target count is required' },
              { type: 'number', min: 1, message: 'Must be at least 1' },
            ]}
          >
            <InputNumber min={1} style={{ width: '100%' }} placeholder="e.g. 10" />
          </Form.Item>

          <Form.Item
            label="Difficulty"
            name="difficulty"
            rules={[{ required: true, message: 'Difficulty is required' }]}
          >
            <Select>
              <Select.Option value="EASY">Easy</Select.Option>
              <Select.Option value="MEDIUM">Medium</Select.Option>
              <Select.Option value="HARD">Hard</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, marginTop: 24 }}>
            <Space>
              <Button type="primary" htmlType="submit" loading={saving}>
                Add Badge
              </Button>
              <Button onClick={onClose}>Cancel</Button>
            </Space>
          </Form.Item>
        </Form>
      )}
    </Modal>
  );
}

export default AddBadgeToCollectionModal;
