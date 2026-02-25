import { useState, useEffect } from 'react';
import {
  Modal,
  Form,
  Input,
  Upload,
  Button,
  Alert,
  Space,
  Select,
  Switch,
  InputNumber,
  message as antdMessage,
  TreeSelect,
} from 'antd';
import { CloudUploadOutlined } from '@ant-design/icons';
import {
  createCategory,
  fetchCategories,
  uploadProductImage,
} from '../../../api/admin-products';
import type {
  CreateCategoryInput,
  AdminCategoryListItem,
} from '../../../api/admin-products';
import { FORM_LAYOUT_VERTICAL } from '../../../constants/form-layout';

const { TextArea } = Input;

interface CategoryCreateModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface FormValues {
  id: string;
  name: string;
  description?: string;
  parentId?: string;
  thumbnail?: string;
  handle?: string;
  rank?: number;
  isActive: boolean;
  metadata?: string; // JSON string
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

// Build tree data for TreeSelect
const buildTreeData = (
  categories: AdminCategoryListItem[],
  excludeId?: string
): { title: string; value: string; children?: unknown[] }[] => {
  return categories
    .filter((cat) => cat.id !== excludeId) // Exclude self
    .map((cat) => ({
      title: cat.name,
      value: cat.id,
      children: cat.children && cat.children.length > 0
        ? buildTreeData(cat.children, excludeId)
        : undefined,
    }));
};

function CategoryCreateModal({ open, onClose, onSuccess }: CategoryCreateModalProps) {
  const [form] = Form.useForm<FormValues>();
  const [saving, setSaving] = useState(false);
  const [uploadingThumbnail, setUploadingThumbnail] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [thumbnailUrl, setThumbnailUrl] = useState<string>('');
  const [categories, setCategories] = useState<AdminCategoryListItem[]>([]);

  // Load categories for parent selector
  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    (async () => {
      try {
        const res = await fetchCategories();
        if (!cancelled && res.data) {
          setCategories(res.data);
        }
      } catch (e) {
        console.error('Failed to load categories:', e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open]);

  // Auto-generate handle from name
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    if (name) {
      const generatedHandle = slugify(name);
      form.setFieldValue('handle', generatedHandle);
    }
  };

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      form.resetFields();
      form.setFieldsValue({
        id: crypto.randomUUID(),
        rank: 0,
        isActive: true
      });
      setThumbnailUrl('');
      setError(null);
    }
  }, [open, form]);

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
      if (!values.id || !values.id.trim()) {
        setError('Category ID is required');
        setSaving(false);
        return;
      }
      if (!values.name || !values.name.trim()) {
        setError('Category name is required');
        setSaving(false);
        return;
      }

      // Parse metadata if provided
      let metadata: Record<string, unknown> | undefined;
      if (values.metadata) {
        try {
          metadata = JSON.parse(values.metadata);
        } catch (e) {
          setError('Invalid JSON in metadata field');
          setSaving(false);
          return;
        }
      }

      // Prepare payload
      const payload: CreateCategoryInput = {
        id: values.id.trim(),
        name: values.name.trim(),
        description: trimString(values.description),
        parentId: trimString(values.parentId),
        thumbnail: trimString(values.thumbnail),
        handle: trimString(values.handle),
        rank: values.rank ?? 0,
        isActive: values.isActive ?? true,
        metadata,
      };

      await createCategory(payload);
      antdMessage.success('Category created successfully');
      onSuccess();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create category');
    } finally {
      setSaving(false);
    }
  };

  const treeData = buildTreeData(categories);

  return (
    <Modal
      title="Create Category"
      open={open}
      onCancel={onClose}
      footer={null}
      width={700}
      destroyOnHidden
    >
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

        <Form.Item name="id" hidden>
          <Input />
        </Form.Item>

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
            autoFocus
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
          tooltip="Select a parent category to create a subcategory"
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

        <Alert
          message="Note"
          description="The category will be created with the specified hierarchy. You can reorder categories later."
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />

        <Form.Item style={{ marginBottom: 0, marginTop: 24 }}>
          <Space>
            <Button type="primary" htmlType="submit" loading={saving}>
              Create Category
            </Button>
            <Button onClick={onClose}>Cancel</Button>
          </Space>
        </Form.Item>
      </Form>
    </Modal>
  );
}

export default CategoryCreateModal;
