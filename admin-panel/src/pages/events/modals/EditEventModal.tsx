import { useState, useEffect } from 'react';
import {
  Modal,
  Form,
  Input,
  Select,
  Button,
  Alert,
  Spin,
  Space,
  message as antdMessage,
} from 'antd';
import {
  fetchEvent,
  updateEvent,
} from '../../../api/admin-events';
import { FORM_LAYOUT_VERTICAL } from '../../../constants/form-layout';

const { TextArea } = Input;

interface EditEventModalProps {
  open: boolean;
  eventId: string;
  onClose: () => void;
  onSuccess: () => void;
}

interface FormValues {
  title: string;
  description?: string;
  startDate: string;
  endDate: string;
  status: string;
  feedType: string;
  imageUrl?: string;
}

function EditEventModal({ open, eventId, onClose, onSuccess }: EditEventModalProps) {
  const [form] = Form.useForm<FormValues>();
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
        const res = await fetchEvent(eventId);
        if (!cancelled && res.data) {
          const data = res.data;
          form.setFieldsValue({
            title: data.title,
            description: data.description ?? '',
            startDate: data.startDate.slice(0, 16), // Format for datetime-local input
            endDate: data.endDate.slice(0, 16),
            status: data.status,
            feedType: data.feedType,
            imageUrl: data.imageUrl ?? '',
          });
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load event data');
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
  }, [open, eventId, form]);

  const handleSubmit = async (values: FormValues) => {
    setSaving(true);
    setError(null);
    try {
      await updateEvent(eventId, {
        title: values.title.trim(),
        description: values.description?.trim() || null,
        startDate: new Date(values.startDate).toISOString(),
        endDate: new Date(values.endDate).toISOString(),
        status: values.status,
        feedType: values.feedType,
        imageUrl: values.imageUrl?.trim() || null,
      });
      antdMessage.success('Event updated successfully');
      onSuccess();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update event');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title="Edit Event"
      open={open}
      onCancel={onClose}
      footer={null}
      width={600}
      destroyOnClose
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
            label="Title"
            name="title"
            rules={[{ required: true, message: 'Event title is required' }]}
          >
            <Input placeholder="Event title" />
          </Form.Item>

          <Form.Item label="Description" name="description">
            <TextArea rows={4} placeholder="Event description (optional)" />
          </Form.Item>

          <Form.Item
            label="Start Date"
            name="startDate"
            rules={[{ required: true, message: 'Start date is required' }]}
          >
            <Input type="datetime-local" />
          </Form.Item>

          <Form.Item
            label="End Date"
            name="endDate"
            rules={[{ required: true, message: 'End date is required' }]}
          >
            <Input type="datetime-local" />
          </Form.Item>

          <Form.Item
            label="Status"
            name="status"
            rules={[{ required: true, message: 'Status is required' }]}
          >
            <Select>
              <Select.Option value="DRAFT">DRAFT</Select.Option>
              <Select.Option value="PUBLISHED">PUBLISHED</Select.Option>
              <Select.Option value="ENDED">ENDED</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            label="Feed Type"
            name="feedType"
            rules={[{ required: true, message: 'Feed type is required' }]}
          >
            <Select>
              <Select.Option value="GENERAL">GENERAL</Select.Option>
              <Select.Option value="BRAND">BRAND</Select.Option>
              <Select.Option value="PRODUCT">PRODUCT</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item label="Image URL" name="imageUrl">
            <Input type="url" placeholder="https://..." />
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

export default EditEventModal;
