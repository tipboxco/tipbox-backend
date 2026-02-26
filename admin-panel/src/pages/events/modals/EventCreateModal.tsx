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
  DatePicker,
  message as antdMessage,
  Tag,
} from 'antd';
import type { Dayjs } from 'dayjs';
import { CloudUploadOutlined } from '@ant-design/icons';
import { createEvent, uploadEventImage } from '../../../api/admin-events';
import { FORM_LAYOUT_VERTICAL } from '../../../constants/form-layout';

const { TextArea } = Input;
const { RangePicker } = DatePicker;

interface EventCreateModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface FormValues {
  title: string;
  description?: string;
  dateRange: [Dayjs, Dayjs];
  status: 'DRAFT' | 'PUBLISHED' | 'CLOSED';
  feedType: 'PICKS' | 'ROASTS';
  productId?: string;
  brandId?: string;
  mainCategoryId?: string;
  subCategoryId?: string;
  imageUrl?: string;
}

function EventCreateModal({ open, onClose, onSuccess }: EventCreateModalProps) {
  const [form] = Form.useForm<FormValues>();
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string>('');

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      form.resetFields();
      form.setFieldsValue({ status: 'DRAFT', feedType: 'PICKS' });
      setImageUrl('');
      setError(null);
    }
  }, [open, form]);

  const handleImageUpload = async (file: File) => {
    setUploadingImage(true);
    setError(null);
    try {
      const res = await uploadEventImage(file);
      if (res.data?.url) {
        setImageUrl(res.data.url);
        form.setFieldValue('imageUrl', res.data.url);
        antdMessage.success('Event image uploaded');
      }
    } catch (err) {
      antdMessage.error(err instanceof Error ? err.message : 'Failed to upload image');
    } finally {
      setUploadingImage(false);
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
      if (!values.title || !values.title.trim()) {
        setError('Event title is required');
        setSaving(false);
        return;
      }

      if (!values.dateRange || values.dateRange.length !== 2) {
        setError('Start and end dates are required');
        setSaving(false);
        return;
      }

      const [startDate, endDate] = values.dateRange;

      // Validate date range
      if (startDate.isAfter(endDate)) {
        setError('Start date must be before end date');
        setSaving(false);
        return;
      }

      // Prepare payload with proper null handling for Prisma
      await createEvent({
        title: values.title.trim(),
        description: trimString(values.description),
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        status: values.status || 'DRAFT',
        feedType: values.feedType || 'PICKS',
        productId: trimString(values.productId),
        brandId: trimString(values.brandId),
        mainCategoryId: trimString(values.mainCategoryId),
        subCategoryId: trimString(values.subCategoryId),
        imageUrl: trimString(values.imageUrl),
      });

      antdMessage.success('Event created successfully');
      onSuccess();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create event');
    } finally {
      setSaving(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'DRAFT':
        return 'gold';
      case 'PUBLISHED':
        return 'green';
      case 'CLOSED':
        return 'red';
      default:
        return 'default';
    }
  };

  return (
    <Modal
      title="Create Event"
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
          label="Event Title"
          name="title"
          rules={[
            { required: true, message: 'Event title is required' },
            { min: 1, max: 500, message: 'Title must be between 1 and 500 characters' },
          ]}
        >
          <Input
            placeholder="e.g., Summer Product Picks 2026"
            autoFocus
          />
        </Form.Item>

        <Form.Item label="Description" name="description">
          <TextArea
            rows={4}
            placeholder="Event description (supports basic formatting)"
            maxLength={10000}
            showCount
          />
        </Form.Item>

        <Form.Item
          label="Event Duration"
          name="dateRange"
          rules={[
            { required: true, message: 'Start and end dates are required' },
          ]}
        >
          <RangePicker
            showTime={{
              format: 'HH:mm',
            }}
            format="YYYY-MM-DD HH:mm"
            style={{ width: '100%' }}
            placeholder={['Start Date & Time', 'End Date & Time']}
          />
        </Form.Item>

        <Form.Item
          label="Event Status"
          name="status"
          tooltip="Draft: Not visible to users, Published: Live event, Closed: Event ended"
        >
          <Select
            options={[
              { label: <Tag color={getStatusColor('DRAFT')}>Draft</Tag>, value: 'DRAFT' },
              { label: <Tag color={getStatusColor('PUBLISHED')}>Published</Tag>, value: 'PUBLISHED' },
              { label: <Tag color={getStatusColor('CLOSED')}>Closed</Tag>, value: 'CLOSED' },
            ]}
          />
        </Form.Item>

        <Form.Item
          label="Feed Type"
          name="feedType"
          tooltip="Type of posts allowed in this event"
        >
          <Select
            options={[
              { label: 'Picks (Recommendations)', value: 'PICKS' },
              { label: 'Roasts (Criticisms)', value: 'ROASTS' },
            ]}
          />
        </Form.Item>

        <Form.Item label="Event Banner" name="imageUrl">
          <Space direction="vertical" style={{ width: '100%' }} size="small">
            <Upload
              beforeUpload={handleImageUpload}
              showUploadList={false}
              accept="image/jpeg,image/png,image/gif,image/webp"
              disabled={uploadingImage}
            >
              <Button icon={<CloudUploadOutlined />} loading={uploadingImage} size="small">
                {uploadingImage ? 'Uploading...' : 'Upload Banner'}
              </Button>
            </Upload>
            {imageUrl && (
              <div>
                <img
                  src={imageUrl}
                  alt="Event Banner"
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

        <Alert
          message="Optional Associations"
          description="Link this event to specific products, brands, or categories. Leave empty if not applicable."
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />

        <Form.Item
          label="Product ID"
          name="productId"
          tooltip="Associate with a specific product (UUID)"
        >
          <Input placeholder="e.g., iphone-15-pro" />
        </Form.Item>

        <Form.Item
          label="Brand ID"
          name="brandId"
          tooltip="Associate with a specific brand (UUID)"
        >
          <Input placeholder="e.g., 123e4567-e89b-12d3-a456-426614174000" />
        </Form.Item>

        <Form.Item
          label="Main Category ID"
          name="mainCategoryId"
          tooltip="Main category UUID (optional)"
        >
          <Input placeholder="e.g., 123e4567-e89b-12d3-a456-426614174000" />
        </Form.Item>

        <Form.Item
          label="Sub Category ID"
          name="subCategoryId"
          tooltip="Sub category UUID (optional, requires main category)"
        >
          <Input placeholder="e.g., 123e4567-e89b-12d3-a456-426614174000" />
        </Form.Item>

        <Alert
          message="Note"
          description="Events will be visible to users based on the status. You can manage event rewards and participants after creation."
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />

        <Form.Item style={{ marginBottom: 0, marginTop: 24 }}>
          <Space>
            <Button type="primary" htmlType="submit" loading={saving}>
              Create Event
            </Button>
            <Button onClick={onClose}>Cancel</Button>
          </Space>
        </Form.Item>
      </Form>
    </Modal>
  );
}

export default EventCreateModal;
