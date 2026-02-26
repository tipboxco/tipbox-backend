import { useState, useEffect } from 'react';
import {
  Modal,
  Form,
  Input,
  Upload,
  Button,
  Alert,
  Space,
  Tag,
  message as antdMessage,
} from 'antd';
import { CloudUploadOutlined, PlusOutlined } from '@ant-design/icons';
import { createNews, uploadNewsImage } from '../../../api/admin-news';
import type { CreateNewsInput } from '../../../types/admin-news';
import { FORM_LAYOUT_VERTICAL } from '../../../constants/form-layout';

const { TextArea } = Input;

interface NewsCreateModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface FormValues {
  brandId: string;
  title: string;
  content: string;
  bannerImageUrl?: string;
  source: string;
  author?: string;
  tags?: string[];
}

function NewsCreateModal({ open, onClose, onSuccess }: NewsCreateModalProps) {
  const [form] = Form.useForm<FormValues>();
  const [saving, setSaving] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bannerUrl, setBannerUrl] = useState<string>('');
  const [tags, setTags] = useState<string[]>([]);
  const [inputTag, setInputTag] = useState<string>('');

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      form.resetFields();
      form.setFieldsValue({ source: 'Official' });
      setBannerUrl('');
      setTags([]);
      setInputTag('');
      setError(null);
    }
  }, [open, form]);

  const handleBannerUpload = async (file: File) => {
    setUploadingBanner(true);
    setError(null);
    try {
      const res = await uploadNewsImage(file);
      if (res.data?.url) {
        setBannerUrl(res.data.url);
        form.setFieldValue('bannerImageUrl', res.data.url);
        antdMessage.success('Banner uploaded');
      }
    } catch (err) {
      antdMessage.error(err instanceof Error ? err.message : 'Failed to upload banner');
    } finally {
      setUploadingBanner(false);
    }
    return false;
  };

  // Tag management
  const handleAddTag = () => {
    if (inputTag && !tags.includes(inputTag.trim()) && tags.length < 30) {
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
      if (!values.brandId || !values.brandId.trim()) {
        setError('Brand ID is required');
        setSaving(false);
        return;
      }
      if (!values.title || !values.title.trim()) {
        setError('Title is required');
        setSaving(false);
        return;
      }
      if (!values.content || !values.content.trim()) {
        setError('Content is required');
        setSaving(false);
        return;
      }
      if (!values.source || !values.source.trim()) {
        setError('Source is required');
        setSaving(false);
        return;
      }

      // Prepare payload
      const payload: CreateNewsInput = {
        brandId: values.brandId.trim(),
        title: values.title.trim(),
        content: values.content.trim(),
        bannerImageUrl: trimString(values.bannerImageUrl),
        source: values.source.trim(),
        author: trimString(values.author),
        tags: tags.length > 0 ? tags : undefined,
      };

      await createNews(payload);
      antdMessage.success('News article created successfully');
      onSuccess();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create article');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title="Create News Article"
      open={open}
      onCancel={onClose}
      footer={null}
      width={800}
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
          label="Brand ID"
          name="brandId"
          rules={[{ required: true, message: 'Brand ID is required' }]}
          tooltip="UUID of the brand this article belongs to"
        >
          <Input placeholder="e.g., 123e4567-e89b-12d3-a456-426614174000" autoFocus />
        </Form.Item>

        <Form.Item
          label="Article Title"
          name="title"
          rules={[
            { required: true, message: 'Title is required' },
            { min: 1, max: 1000, message: 'Title must be between 1 and 1000 characters' },
          ]}
        >
          <Input placeholder="e.g., Apple Announces New Product Launch" />
        </Form.Item>

        <Form.Item
          label="Content"
          name="content"
          rules={[
            { required: true, message: 'Content is required' },
            { min: 1, max: 50000, message: 'Content must be between 1 and 50,000 characters' },
          ]}
          tooltip="Rich text content (HTML supported)"
        >
          <TextArea
            rows={10}
            placeholder="Article content (supports HTML formatting)"
            maxLength={50000}
            showCount
          />
        </Form.Item>

        <Form.Item label="Banner Image" name="bannerImageUrl">
          <Space direction="vertical" style={{ width: '100%' }} size="small">
            <Upload
              beforeUpload={handleBannerUpload}
              showUploadList={false}
              accept="image/jpeg,image/png,image/gif,image/webp"
              disabled={uploadingBanner}
            >
              <Button icon={<CloudUploadOutlined />} loading={uploadingBanner} size="small">
                {uploadingBanner ? 'Uploading...' : 'Upload Banner'}
              </Button>
            </Upload>
            {bannerUrl && (
              <div>
                <img
                  src={bannerUrl}
                  alt="Banner"
                  style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 4 }}
                />
                <Button
                  size="small"
                  danger
                  onClick={() => {
                    setBannerUrl('');
                    form.setFieldValue('bannerImageUrl', '');
                  }}
                  style={{ marginTop: 4 }}
                >
                  Remove
                </Button>
              </div>
            )}
            <Input
              value={bannerUrl}
              onChange={(e) => {
                setBannerUrl(e.target.value);
                form.setFieldValue('bannerImageUrl', e.target.value);
              }}
              placeholder="or paste image URL"
              size="small"
            />
          </Space>
        </Form.Item>

        <Form.Item
          label="Source"
          name="source"
          rules={[
            { required: true, message: 'Source is required' },
            { min: 1, max: 200, message: 'Source must be between 1 and 200 characters' },
          ]}
          tooltip="Source of the article (e.g., Official, PR, Media)"
        >
          <Input placeholder="e.g., Official, PR Release, Tech Blog" />
        </Form.Item>

        <Form.Item
          label="Author"
          name="author"
          tooltip="Author name (optional)"
        >
          <Input placeholder="e.g., John Doe" />
        </Form.Item>

        <Form.Item
          label={`Tags (${tags.length}/30)`}
          name="tags"
          tooltip="Add keywords/tags for this article"
        >
          <Space direction="vertical" style={{ width: '100%' }}>
            <Space.Compact style={{ width: '100%' }}>
              <Input
                value={inputTag}
                onChange={(e) => setInputTag(e.target.value)}
                onPressEnter={handleAddTag}
                placeholder="Enter tag and press Enter or click Add"
                maxLength={50}
                disabled={tags.length >= 30}
              />
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={handleAddTag}
                disabled={!inputTag.trim() || tags.length >= 30}
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
          description="The article will be immediately visible to users. You can edit or delete it later."
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />

        <Form.Item style={{ marginBottom: 0, marginTop: 24 }}>
          <Space>
            <Button type="primary" htmlType="submit" loading={saving}>
              Create Article
            </Button>
            <Button onClick={onClose}>Cancel</Button>
          </Space>
        </Form.Item>
      </Form>
    </Modal>
  );
}

export default NewsCreateModal;
