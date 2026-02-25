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
  message as antdMessage,
} from 'antd';
import { CloudUploadOutlined } from '@ant-design/icons';
import {
  createProduct,
  uploadProductImage,
  type CreateProductInput,
} from '../../../api/admin-products';
import { FORM_LAYOUT_VERTICAL } from '../../../constants/form-layout';

const { TextArea } = Input;

interface ProductCreateModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface FormValues {
  id: string;
  name: string;
  description?: string;
  subName?: string;
  groupId?: string;
  categoryId?: string;
  brandId?: string;
  imageUrl?: string;
  thumbnail?: string;
  metadata?: string; // JSON string
}

// Helper function to slugify string
const slugify = (text: string): string => {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/[\s_-]+/g, '-') // Replace spaces, underscores with single hyphen
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
};

function ProductCreateModal({ open, onClose, onSuccess }: ProductCreateModalProps) {
  const [form] = Form.useForm<FormValues>();
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string>('');

  // Auto-generate ID from name
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    if (name) {
      const generatedId = slugify(name);
      form.setFieldValue('id', generatedId);
    }
  };

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      form.resetFields();
      setImageUrl('');
      setError(null);
    }
  }, [open, form]);

  const handleImageUpload = async (file: File) => {
    setUploadingImage(true);
    setError(null);
    try {
      const res = await uploadProductImage(file);
      if (res.data?.url) {
        setImageUrl(res.data.url);
        form.setFieldValue('imageUrl', res.data.url);
        antdMessage.success('Product image uploaded');
      }
    } catch (err) {
      antdMessage.error(err instanceof Error ? err.message : 'Failed to upload image');
    } finally {
      setUploadingImage(false);
    }
    return false; // Prevent default upload behavior
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
        setError('Product ID is required');
        setSaving(false);
        return;
      }
      if (!values.name || !values.name.trim()) {
        setError('Product name is required');
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

      // Prepare payload with proper null handling for Prisma
      const payload: CreateProductInput = {
        id: values.id.trim(),
        name: values.name.trim(),
        description: trimString(values.description),
        subName: trimString(values.subName),
        groupId: trimString(values.groupId),
        categoryId: trimString(values.categoryId),
        brandId: trimString(values.brandId),
        imageUrl: trimString(values.imageUrl),
        thumbnail: trimString(values.thumbnail),
        metadata,
      };

      await createProduct(payload);
      antdMessage.success('Product created successfully');
      onSuccess();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create product');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title="Create Product"
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

        <Form.Item
          label="Product Name"
          name="name"
          rules={[
            { required: true, message: 'Product name is required' },
            { min: 1, max: 500, message: 'Name must be between 1 and 500 characters' },
          ]}
        >
          <Input
            placeholder="e.g., iPhone 15 Pro"
            onChange={handleNameChange}
            autoFocus
          />
        </Form.Item>

        <Form.Item
          label="Product ID"
          name="id"
          tooltip="Auto-generated from name. Use lowercase with hyphens."
          rules={[
            { required: true, message: 'Product ID is required' },
            {
              pattern: /^[a-z0-9-]+$/,
              message: 'ID must be lowercase letters, numbers, and hyphens only',
            },
          ]}
        >
          <Input placeholder="e.g., iphone-15-pro" />
        </Form.Item>

        <Form.Item label="Sub Name" name="subName">
          <Input placeholder="Optional subtitle or variant (e.g., 2nd Generation)" />
        </Form.Item>

        <Form.Item label="Description" name="description">
          <TextArea
            rows={3}
            placeholder="Product description"
            maxLength={10000}
            showCount
          />
        </Form.Item>

        <Form.Item label="Product Image" name="imageUrl">
          <Space direction="vertical" style={{ width: '100%' }} size="small">
            <Upload
              beforeUpload={handleImageUpload}
              showUploadList={false}
              accept="image/jpeg,image/png,image/gif,image/webp"
              disabled={uploadingImage}
            >
              <Button icon={<CloudUploadOutlined />} loading={uploadingImage} size="small">
                {uploadingImage ? 'Uploading...' : 'Upload image'}
              </Button>
            </Upload>
            {imageUrl && (
              <div>
                <img
                  src={imageUrl}
                  alt="Product"
                  style={{ maxWidth: '100%', maxHeight: 150, borderRadius: 4 }}
                />
                <Button
                  size="small"
                  danger
                  onClick={() => {
                    setImageUrl('');
                    form.setFieldValue('imageUrl', '');
                  }}
                  style={{ marginTop: 4 }}
                >
                  Remove
                </Button>
              </div>
            )}
            <Input
              value={imageUrl}
              onChange={(e) => {
                setImageUrl(e.target.value);
                form.setFieldValue('imageUrl', e.target.value);
              }}
              placeholder="or paste image URL"
              size="small"
            />
          </Space>
        </Form.Item>

        <Form.Item label="Thumbnail URL" name="thumbnail">
          <Input placeholder="Optional thumbnail URL (auto-generated from image if empty)" />
        </Form.Item>

        <Form.Item
          label="Brand ID"
          name="brandId"
          tooltip="UUID of the brand. Leave empty if no brand."
        >
          <Input placeholder="e.g., 123e4567-e89b-12d3-a456-426614174000" />
        </Form.Item>

        <Form.Item
          label="Category ID"
          name="categoryId"
          tooltip="UUID of the category. Leave empty if no category."
        >
          <Input placeholder="e.g., 123e4567-e89b-12d3-a456-426614174000" />
        </Form.Item>

        <Form.Item
          label="Product Group ID"
          name="groupId"
          tooltip="UUID of the product group. Leave empty if no group."
        >
          <Input placeholder="e.g., 123e4567-e89b-12d3-a456-426614174000" />
        </Form.Item>

        <Form.Item
          label="Metadata (JSON)"
          name="metadata"
          tooltip="Optional JSON object for additional product data"
        >
          <TextArea
            rows={3}
            placeholder='{"key": "value", "specs": { "color": "black" }}'
            style={{ fontFamily: 'monospace', fontSize: 12 }}
          />
        </Form.Item>

        <Alert
          message="Note"
          description="After creating the product, you can view and edit it from the products list. Brand, Category, and Group can be selected from dropdowns in the detail page."
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />

        <Form.Item style={{ marginBottom: 0, marginTop: 24 }}>
          <Space>
            <Button type="primary" htmlType="submit" loading={saving}>
              Create Product
            </Button>
            <Button onClick={onClose}>Cancel</Button>
          </Space>
        </Form.Item>
      </Form>
    </Modal>
  );
}

export default ProductCreateModal;
