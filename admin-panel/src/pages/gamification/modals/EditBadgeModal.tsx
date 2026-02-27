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
  fetchBadge,
  updateBadge,
  fetchBadgeCategories,
} from '../../../api/admin-badges-collections';
import type { AdminBadgeCategoryListItem } from '../../../types/admin';
import { FORM_LAYOUT_VERTICAL } from '../../../constants/form-layout';

interface EditBadgeModalProps {
  open: boolean;
  badgeId: string;
  onClose: () => void;
  onSuccess: () => void;
}

interface FormValues {
  name: string;
  description?: string;
  imageUrl?: string;
  type: string;
  rarity: 'COMMON' | 'RARE' | 'EPIC';
  categoryId: string;
  collectionId?: string;
}

function EditBadgeModal({ open, badgeId, onClose, onSuccess }: EditBadgeModalProps) {
  const [form] = Form.useForm<FormValues>();
  const [categories, setCategories] = useState<AdminBadgeCategoryListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        // Fetch badge data and categories in parallel
        const [badgeRes, categoriesRes] = await Promise.all([
          fetchBadge(badgeId),
          fetchBadgeCategories(),
        ]);

        if (!cancelled) {
          if (badgeRes.data) {
            form.setFieldsValue({
              name: badgeRes.data.name,
              description: badgeRes.data.description ?? '',
              imageUrl: badgeRes.data.imageUrl ?? '',
              type: badgeRes.data.type,
              rarity: badgeRes.data.rarity as 'COMMON' | 'RARE' | 'EPIC',
              categoryId: badgeRes.data.categoryId,
              collectionId: badgeRes.data.collectionId ?? '',
            });
          }
          if (categoriesRes.data) {
            setCategories(categoriesRes.data);
          }
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load badge data');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, badgeId, form]);

  const handleSubmit = async (values: FormValues) => {
    setSaving(true);
    setError(null);
    try {
      await updateBadge(badgeId, {
        name: values.name.trim(),
        description: values.description?.trim() || null,
        imageUrl: values.imageUrl?.trim() || null,
        type: values.type,
        rarity: values.rarity,
        categoryId: values.categoryId,
        collectionId: values.collectionId?.trim() || null,
      });
      antdMessage.success('Badge updated successfully');
      onSuccess();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update badge');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title="Edit Badge"
      open={open}
      onCancel={onClose}
      footer={null}
      width={600}
      destroyOnHidden
    >
      {loading ? (
        <div style={{ textAlign: 'center', padding: 48 }}>
          <Spin size="large" />
        </div>
      ) : (
        <Form form={form} {...FORM_LAYOUT_VERTICAL} onFinish={handleSubmit}>
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

          {/* 1. Basic Information */}
          <Form.Item
            label="Badge Name"
            name="name"
            rules={[{ required: true, message: 'Badge name is required' }]}
          >
            <Input placeholder="e.g., First Post Creator" />
          </Form.Item>

          <Form.Item
            label="Type"
            name="type"
            rules={[{ required: true, message: 'Badge type is required' }]}
          >
            <Select placeholder="Select badge type">
              <Select.Option value="COLLECTION">Collection Badge</Select.Option>
              <Select.Option value="EVENT">Event Badge</Select.Option>
              <Select.Option value="COSMETIC">Cosmetic Badge</Select.Option>
              <Select.Option value="BRAND">Brand Badge</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            label="Rarity"
            name="rarity"
            rules={[{ required: true, message: 'Rarity is required' }]}
          >
            <Select placeholder="Select rarity level">
              <Select.Option value="COMMON">Common</Select.Option>
              <Select.Option value="RARE">Rare</Select.Option>
              <Select.Option value="EPIC">Epic</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            label="Category"
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

          {/* 2. Visual */}
          <Form.Item label="Badge Image URL" name="imageUrl">
            <Input type="url" placeholder="https://example.com/badge.png" />
          </Form.Item>

          {/* 3. Description */}
          <Form.Item label="Description" name="description">
            <Input.TextArea rows={3} placeholder="Describe what this badge represents" />
          </Form.Item>

          {/* 4. Associations */}
          <Form.Item label="Collection ID" name="collectionId">
            <Input placeholder="Optional: Link to a specific collection" />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, marginTop: 24 }}>
            <Space>
              <Button type="primary" htmlType="submit" loading={saving}>
                Save
              </Button>
              <Button onClick={onClose}>Cancel</Button>
            </Space>
          </Form.Item>
        </Form>
      )}
    </Modal>
  );
}

export default EditBadgeModal;
