import { useState, useEffect } from 'react';
import {
  Modal,
  Form,
  Input,
  Upload,
  Button,
  Alert,
  Space,
  Switch,
  InputNumber,
  Spin,
  TreeSelect,
  message as antdMessage,
} from 'antd';
import { CloudUploadOutlined } from '@ant-design/icons';
import {
  fetchCategory,
  updateCategory,
  fetchCategories,
  uploadProductImage,
} from '../../../api/admin-products';
import type {
  UpdateCategoryInput,
  AdminCategoryListItem,
} from '../../../api/admin-products';
import { FORM_LAYOUT_VERTICAL } from '../../../constants/form-layout';

const { TextArea } = Input;

interface CategoryEditModalProps {
  open: boolean;
  categoryId: string;
  onClose: () => void;
  onSuccess: () => void;
}

interface FormValues {
  name: string;
  description?: string;
  parentId?: string;
  thumbnail?: string;
  handle?: string;
  rank?: number;
  isActive: boolean;
  metadata?: string;
}

// Helper function to slugify string
const slugify = (text: string): string => {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

// Build tree data for TreeSelect, excluding current category and its descendants
const buildTreeData = (
  categories: AdminCategoryListItem[],
  excludeId: string,
  excludedDescendants: Set<string>
): { title: string; value: string; children?: unknown[]; disabled?: boolean }[] => {
  return categories
    .map((cat) => {
      const isExcluded = cat.id === excludeId || excludedDescendants.has(cat.id);
      return {
        title: cat.name,
        value: cat.id,
        disabled: isExcluded,
        children: cat.children && cat.children.length > 0
          ? buildTreeData(cat.children, excludeId, excludedDescendants)
          : undefined,
      };
    });
};

// Get all descendant IDs of a category
const getDescendantIds = (category: AdminCategoryListItem): Set<string> => {
  const descendants = new Set<string>();
  const traverse = (cat: AdminCategoryListItem) => {
    if (cat.children && cat.children.length > 0) {
      cat.children.forEach((child) => {
        descendants.add(child.id);
        traverse(child);
      });
    }
  };
  traverse(category);
  return descendants;
};

function CategoryEditModal({ open, categoryId, onClose, onSuccess }: CategoryEditModalProps) {
  const [form] = Form.useForm<FormValues>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingThumbnail, setUploadingThumbnail] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [thumbnailUrl, setThumbnailUrl] = useState<string>('');
  const [categories, setCategories] = useState<AdminCategoryListItem[]>([]);
  const [currentCategory, setCurrentCategory] = useState<AdminCategoryListItem | null>(null);

  // Load category data and all categories for parent selector
  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [categoryRes, categoriesRes] = await Promise.all([
          fetchCategory(categoryId),
          fetchCategories(),
        ]);

        if (!cancelled) {
          if (categoryRes.data) {
            const data = categoryRes.data;
            setCurrentCategory(data);
            form.setFieldsValue({
              name: data.name,
              description: data.description ?? '',
              parentId: data.parentId ?? undefined,
              thumbnail: data.thumbnail ?? '',
              handle: data.handle ?? '',
              rank: data.rank ?? 0,
              isActive: data.isActive ?? true,
              metadata: data.metadata ? JSON.stringify(data.metadata, null, 2) : '',
            });
            setThumbnailUrl(data.thumbnail ?? '');
          }

          if (categoriesRes.data) {
            setCategories(categoriesRes.data);
          }
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load category data');
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
  }, [open, categoryId, form]);

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    if (name) {
      const generatedHandle = slugify(name);
      form.setFieldValue('handle', generatedHandle);
    }
  };

  const handleThumbnailUpload = async (file: File) => {
    setUploadingThumbnail(true);
    setError(null);
    try {
      const res = await uploadProductImage(file);
      if (res.data?.url) {
        setThumbnailUrl(res.data.url);
        form.setFieldValue('thumbnail', res.data.url);
        antdMessage.success('Thumbnail uploaded');
      }
    } catch (err) {
      antdMessage.error(err instanceof Error ? err.message : 'Failed to upload thumbnail');
    } finally {
      setUploadingThumbnail(false);
    }
    return false;
  };

  // Helper to safely trim string values
  const trimString = (value: string | undefined | null): string | null => {
    if (!value) return null;
    const trimmed = value.trim();
    return trimmed === '' ? null : trimmed;
  };

  const handleSubmit = async (values: FormValues) => {
    setSaving(true);
    setError(null);
    try {
      // Validate required fields
      if (!values.name || !values.name.trim()) {
        setError('Category name is required');
        setSaving(false);
        return;
      }

      // Parse metadata if provided
      let metadata: Record<string, unknown> | undefined;
      if (values.metadata && values.metadata.trim()) {
        try {
          metadata = JSON.parse(values.metadata);
        } catch (e) {
          setError('Invalid JSON in metadata field');
          setSaving(false);
          return;
        }
      }

      // Prepare payload
      const payload: UpdateCategoryInput = {
        name: values.name.trim(),
        description: trimString(values.description),
        parentId: trimString(values.parentId),
        thumbnail: trimString(values.thumbnail),
        handle: trimString(values.handle),
        rank: values.rank ?? 0,
        isActive: values.isActive ?? true,
        metadata,
      };

      await updateCategory(categoryId, payload);
      antdMessage.success('Category updated successfully');
      onSuccess();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update category');
    } finally {
      setSaving(false);
    }
  };

  // Get descendants to prevent circular references
  const excludedDescendants = currentCategory ? getDescendantIds(currentCategory) : new Set<string>();
  const treeData = buildTreeData(categories, categoryId, excludedDescendants);

  return (
    <Modal
      title="Edit Category"
      open={open}
      onCancel={onClose}
      footer={null}
      width={700}
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

          <Form.Item
            label="Category Name"
            name="name"
            rules={[
              { required: true, message: 'Category name is required' },
              { min: 1, max: 200, message: 'Name must be between 1 and 200 characters' },
            ]}
          >
            <Input
              placeholder="e.g., Smartphones & Tablets"
              onChange={handleNameChange}
            />
          </Form.Item>

          <Form.Item
            label="URL Handle (Slug)"
            name="handle"
            tooltip="Auto-generated from name. Used for URLs."
            rules={[
              {
                pattern: /^[a-z0-9-]*$/,
                message: 'Handle must be lowercase letters, numbers, and hyphens only',
              },
            ]}
          >
            <Input placeholder="e.g., smartphones-tablets" />
          </Form.Item>

          <Form.Item label="Description" name="description">
            <TextArea
              rows={3}
              placeholder="Category description"
              maxLength={5000}
              showCount
            />
          </Form.Item>

          <Form.Item
            label="Parent Category"
            name="parentId"
            tooltip="Cannot select this category or its descendants to prevent circular references"
          >
            <TreeSelect
              showSearch
              style={{ width: '100%' }}
              dropdownStyle={{ maxHeight: 400, overflow: 'auto' }}
              placeholder="Select parent category (optional)"
              allowClear
              treeDefaultExpandAll
              treeData={treeData}
            />
          </Form.Item>

          <Form.Item label="Thumbnail" name="thumbnail">
            <Space direction="vertical" style={{ width: '100%' }} size="small">
              <Upload
                beforeUpload={handleThumbnailUpload}
                showUploadList={false}
                accept="image/jpeg,image/png,image/gif,image/webp"
                disabled={uploadingThumbnail}
              >
                <Button icon={<CloudUploadOutlined />} loading={uploadingThumbnail} size="small">
                  {uploadingThumbnail ? 'Uploading...' : 'Upload Thumbnail'}
                </Button>
              </Upload>
              {thumbnailUrl && (
                <div>
                  <img
                    src={thumbnailUrl}
                    alt="Thumbnail"
                    style={{ maxWidth: '100%', maxHeight: 100, borderRadius: 4 }}
                  />
                  <Button
                    size="small"
                    danger
                    onClick={() => {
                      setThumbnailUrl('');
                      form.setFieldValue('thumbnail', '');
                    }}
                    style={{ marginTop: 4 }}
                  >
                    Remove
                  </Button>
                </div>
              )}
              <Input
                value={thumbnailUrl}
                onChange={(e) => {
                  setThumbnailUrl(e.target.value);
                  form.setFieldValue('thumbnail', e.target.value);
                }}
                placeholder="or paste image URL"
                size="small"
              />
            </Space>
          </Form.Item>

          <Form.Item
            label="Display Order"
            name="rank"
            tooltip="Lower numbers appear first"
          >
            <InputNumber min={0} max={9999} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            label="Active"
            name="isActive"
            valuePropName="checked"
            tooltip="Inactive categories are hidden from users"
          >
            <Switch />
          </Form.Item>

          <Form.Item
            label="Metadata (JSON)"
            name="metadata"
            tooltip="Optional JSON object for additional category data"
          >
            <TextArea
              rows={3}
              placeholder='{"key": "value"}'
              style={{ fontFamily: 'monospace', fontSize: 12 }}
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, marginTop: 24 }}>
            <Space>
              <Button type="primary" htmlType="submit" loading={saving}>
                Save Changes
              </Button>
              <Button onClick={onClose}>Cancel</Button>
            </Space>
          </Form.Item>
        </Form>
      )}
    </Modal>
  );
}

export default CategoryEditModal;
