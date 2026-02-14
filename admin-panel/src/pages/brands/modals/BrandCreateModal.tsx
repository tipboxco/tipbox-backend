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
  Slider,
  Switch,
  Tag,
  message as antdMessage,
  Row,
  Col,
} from 'antd';
import { CloudUploadOutlined, PlusOutlined } from '@ant-design/icons';
import {
  createBrand,
  uploadBrandLogo,
  uploadBrandBanner,
  fetchBrandCategories,
  type CreateBrandInput,
  type AdminBrandCategoryListItem,
} from '../../../api/admin-brands';
import { FORM_LAYOUT_VERTICAL } from '../../../constants/form-layout';

const { TextArea } = Input;

interface BrandCreateModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface FormValues {
  id: string;
  name: string;
  description?: string;
  logoUrl?: string;
  imageUrl?: string;
  bannerUrl?: string;
  category?: string;
  categoryId?: string;
  externalId?: string;
  rank: number;
  isPopular: boolean;
  tags?: string[];
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

function BrandCreateModal({ open, onClose, onSuccess }: BrandCreateModalProps) {
  const [form] = Form.useForm<FormValues>();
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string>('');
  const [bannerUrl, setBannerUrl] = useState<string>('');
  const [imageUrl, setImageUrl] = useState<string>('');
  const [tags, setTags] = useState<string[]>([]);
  const [inputTag, setInputTag] = useState<string>('');
  const [categories, setCategories] = useState<AdminBrandCategoryListItem[]>([]);

  // Load categories
  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    (async () => {
      try {
        const res = await fetchBrandCategories();
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
      form.setFieldsValue({ rank: 0, isPopular: false });
      setLogoUrl('');
      setBannerUrl('');
      setImageUrl('');
      setTags([]);
      setInputTag('');
      setError(null);
    }
  }, [open, form]);

  const handleLogoUpload = async (file: File) => {
    setUploadingLogo(true);
    setError(null);
    try {
      const res = await uploadBrandLogo(file);
      if (res.data?.url) {
        setLogoUrl(res.data.url);
        form.setFieldValue('logoUrl', res.data.url);
        antdMessage.success('Logo uploaded');
      }
    } catch (err) {
      antdMessage.error(err instanceof Error ? err.message : 'Failed to upload logo');
    } finally {
      setUploadingLogo(false);
    }
    return false;
  };

  const handleBannerUpload = async (file: File) => {
    setUploadingBanner(true);
    setError(null);
    try {
      const res = await uploadBrandBanner(file);
      if (res.data?.url) {
        setBannerUrl(res.data.url);
        form.setFieldValue('bannerUrl', res.data.url);
        antdMessage.success('Banner uploaded');
      }
    } catch (err) {
      antdMessage.error(err instanceof Error ? err.message : 'Failed to upload banner');
    } finally {
      setUploadingBanner(false);
    }
    return false;
  };

  const handleImageUpload = async (file: File) => {
    setUploadingImage(true);
    setError(null);
    try {
      const res = await uploadBrandLogo(file); // Reuse logo endpoint for general image
      if (res.data?.url) {
        setImageUrl(res.data.url);
        form.setFieldValue('imageUrl', res.data.url);
        antdMessage.success('Image uploaded');
      }
    } catch (err) {
      antdMessage.error(err instanceof Error ? err.message : 'Failed to upload image');
    } finally {
      setUploadingImage(false);
    }
    return false;
  };

  // Tag management
  const handleAddTag = () => {
    if (inputTag && !tags.includes(inputTag.trim()) && tags.length < 20) {
      const newTags = [...tags, inputTag.trim()];
      setTags(newTags);
      form.setFieldValue('tags', newTags);
      setInputTag('');
    }
  };

  const handleRemoveTag = (removedTag: string) => {
    const newTags = tags.filter((tag) => tag !== removedTag);
    setTags(newTags);
    form.setFieldValue('tags', newTags);
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
        setError('Brand ID is required');
        setSaving(false);
        return;
      }
      if (!values.name || !values.name.trim()) {
        setError('Brand name is required');
        setSaving(false);
        return;
      }

      // Prepare payload with proper null handling for Prisma
      const payload: CreateBrandInput = {
        id: values.id.trim(),
        name: values.name.trim(),
        description: trimString(values.description),
        logoUrl: trimString(values.logoUrl),
        imageUrl: trimString(values.imageUrl),
        bannerUrl: trimString(values.bannerUrl),
        category: trimString(values.category),
        categoryId: trimString(values.categoryId),
        externalId: trimString(values.externalId),
        rank: values.rank ?? 0,
        isPopular: values.isPopular ?? false,
        tags: tags.length > 0 ? tags : undefined,
      };

      await createBrand(payload);
      antdMessage.success('Brand created successfully');
      onSuccess();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create brand');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title="Create Brand"
      open={open}
      onCancel={onClose}
      footer={null}
      width={800}
      destroyOnClose
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

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              label="Brand Name"
              name="name"
              rules={[
                { required: true, message: 'Brand name is required' },
                { min: 1, max: 200, message: 'Name must be between 1 and 200 characters' },
              ]}
            >
              <Input
                placeholder="e.g., Apple"
                onChange={handleNameChange}
                autoFocus
              />
            </Form.Item>
          </Col>

          <Col span={12}>
            <Form.Item
              label="Brand ID"
              name="id"
              tooltip="Auto-generated from name. Use lowercase with hyphens."
              rules={[
                { required: true, message: 'Brand ID is required' },
                {
                  pattern: /^[a-z0-9-]+$/,
                  message: 'ID must be lowercase letters, numbers, and hyphens only',
                },
              ]}
            >
              <Input placeholder="e.g., apple" />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item label="Description" name="description">
          <TextArea
            rows={3}
            placeholder="Brand description"
            maxLength={5000}
            showCount
          />
        </Form.Item>

        <Row gutter={16}>
          <Col span={8}>
            <Form.Item label="Logo" name="logoUrl">
              <Space direction="vertical" style={{ width: '100%' }} size="small">
                <Upload
                  beforeUpload={handleLogoUpload}
                  showUploadList={false}
                  accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml"
                  disabled={uploadingLogo}
                >
                  <Button icon={<CloudUploadOutlined />} loading={uploadingLogo} size="small" block>
                    {uploadingLogo ? 'Uploading...' : 'Upload Logo'}
                  </Button>
                </Upload>
                {logoUrl && (
                  <div>
                    <img
                      src={logoUrl}
                      alt="Logo"
                      style={{ maxWidth: '100%', maxHeight: 80, borderRadius: 4 }}
                    />
                    <Button
                      size="small"
                      danger
                      onClick={() => {
                        setLogoUrl('');
                        form.setFieldValue('logoUrl', '');
                      }}
                      style={{ marginTop: 4 }}
                      block
                    >
                      Remove
                    </Button>
                  </div>
                )}
                <Input
                  value={logoUrl}
                  onChange={(e) => {
                    setLogoUrl(e.target.value);
                    form.setFieldValue('logoUrl', e.target.value);
                  }}
                  placeholder="or paste URL"
                  size="small"
                />
              </Space>
            </Form.Item>
          </Col>

          <Col span={8}>
            <Form.Item label="General Image" name="imageUrl">
              <Space direction="vertical" style={{ width: '100%' }} size="small">
                <Upload
                  beforeUpload={handleImageUpload}
                  showUploadList={false}
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  disabled={uploadingImage}
                >
                  <Button icon={<CloudUploadOutlined />} loading={uploadingImage} size="small" block>
                    {uploadingImage ? 'Uploading...' : 'Upload Image'}
                  </Button>
                </Upload>
                {imageUrl && (
                  <div>
                    <img
                      src={imageUrl}
                      alt="Brand"
                      style={{ maxWidth: '100%', maxHeight: 80, borderRadius: 4 }}
                    />
                    <Button
                      size="small"
                      danger
                      onClick={() => {
                        setImageUrl('');
                        form.setFieldValue('imageUrl', '');
                      }}
                      style={{ marginTop: 4 }}
                      block
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
                  placeholder="or paste URL"
                  size="small"
                />
              </Space>
            </Form.Item>
          </Col>

          <Col span={8}>
            <Form.Item label="Banner" name="bannerUrl">
              <Space direction="vertical" style={{ width: '100%' }} size="small">
                <Upload
                  beforeUpload={handleBannerUpload}
                  showUploadList={false}
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  disabled={uploadingBanner}
                >
                  <Button icon={<CloudUploadOutlined />} loading={uploadingBanner} size="small" block>
                    {uploadingBanner ? 'Uploading...' : 'Upload Banner'}
                  </Button>
                </Upload>
                {bannerUrl && (
                  <div>
                    <img
                      src={bannerUrl}
                      alt="Banner"
                      style={{ maxWidth: '100%', maxHeight: 80, borderRadius: 4 }}
                    />
                    <Button
                      size="small"
                      danger
                      onClick={() => {
                        setBannerUrl('');
                        form.setFieldValue('bannerUrl', '');
                      }}
                      style={{ marginTop: 4 }}
                      block
                    >
                      Remove
                    </Button>
                  </div>
                )}
                <Input
                  value={bannerUrl}
                  onChange={(e) => {
                    setBannerUrl(e.target.value);
                    form.setFieldValue('bannerUrl', e.target.value);
                  }}
                  placeholder="or paste URL"
                  size="small"
                />
              </Space>
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              label="Brand Category"
              name="categoryId"
              tooltip="Select from existing categories"
            >
              <Select
                placeholder="Select category (optional)"
                allowClear
                showSearch
                filterOption={(input, option) =>
                  (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                }
                options={categories.map((cat) => ({ label: cat.name, value: cat.id }))}
              />
            </Form.Item>
          </Col>

          <Col span={12}>
            <Form.Item
              label="Custom Category"
              name="category"
              tooltip="Or enter a custom category name"
            >
              <Input placeholder="e.g., Technology" />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item
          label="External ID"
          name="externalId"
          tooltip="ID from external system (optional)"
        >
          <Input placeholder="External system identifier" />
        </Form.Item>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              label={`Display Rank: ${form.getFieldValue('rank') ?? 0}`}
              name="rank"
              tooltip="Higher rank = higher priority in listings"
            >
              <Slider min={0} max={1000} />
            </Form.Item>
          </Col>

          <Col span={12}>
            <Form.Item
              label="Featured Brand"
              name="isPopular"
              valuePropName="checked"
              tooltip="Mark as popular/featured brand"
            >
              <Switch />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item
          label={`Tags (${tags.length}/20)`}
          name="tags"
          tooltip="Add keywords/tags for this brand"
        >
          <Space direction="vertical" style={{ width: '100%' }}>
            <Space.Compact style={{ width: '100%' }}>
              <Input
                value={inputTag}
                onChange={(e) => setInputTag(e.target.value)}
                onPressEnter={handleAddTag}
                placeholder="Enter tag and press Enter or click Add"
                maxLength={50}
                disabled={tags.length >= 20}
              />
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={handleAddTag}
                disabled={!inputTag.trim() || tags.length >= 20}
              >
                Add
              </Button>
            </Space.Compact>
            <div>
              {tags.map((tag) => (
                <Tag
                  key={tag}
                  closable
                  onClose={() => handleRemoveTag(tag)}
                  style={{ marginBottom: 4 }}
                >
                  {tag}
                </Tag>
              ))}
            </div>
          </Space>
        </Form.Item>

        <Alert
          message="Note"
          description="After creating the brand, you can manage additional settings from the brand detail page."
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />

        <Form.Item style={{ marginBottom: 0, marginTop: 24 }}>
          <Space>
            <Button type="primary" htmlType="submit" loading={saving}>
              Create Brand
            </Button>
            <Button onClick={onClose}>Cancel</Button>
          </Space>
        </Form.Item>
      </Form>
    </Modal>
  );
}

export default BrandCreateModal;
