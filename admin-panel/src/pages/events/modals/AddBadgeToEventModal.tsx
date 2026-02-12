import { useState } from 'react';
import {
  Modal,
  Form,
  Input,
  InputNumber,
  Button,
  Alert,
  Space,
  message as antdMessage,
} from 'antd';
import { addEventBadge } from '../../../api/admin-events';
import { FORM_LAYOUT_VERTICAL } from '../../../constants/form-layout';

interface AddBadgeToEventModalProps {
  open: boolean;
  eventId: string;
  onClose: () => void;
  onSuccess: () => void;
}

interface FormValues {
  badgeId: string;
  rank: number;
  displayOrder?: number;
}

function AddBadgeToEventModal({ open, eventId, onClose, onSuccess }: AddBadgeToEventModalProps) {
  const [form] = Form.useForm<FormValues>();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (values: FormValues) => {
    setSaving(true);
    setError(null);
    try {
      await addEventBadge(eventId, {
        badgeId: values.badgeId.trim(),
        rank: values.rank,
        displayOrder: values.displayOrder ?? null,
      });
      antdMessage.success('Badge added to event successfully');
      onSuccess();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add badge to event');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title="Add Badge to Event"
      open={open}
      onCancel={onClose}
      footer={null}
      width={600}
      destroyOnClose
    >
      <Form
        form={form}
        {...FORM_LAYOUT_VERTICAL}
        onFinish={handleSubmit}
        initialValues={{
          rank: 1,
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
          label="Badge ID"
          name="badgeId"
          rules={[
            { required: true, message: 'Badge ID is required' },
            {
              pattern: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
              message: 'Badge ID must be a valid UUID',
            },
          ]}
          extra="Enter the UUID of the badge you want to add to this event"
        >
          <Input placeholder="e.g. 123e4567-e89b-12d3-a456-426614174000" />
        </Form.Item>

        <Form.Item
          label="Rank"
          name="rank"
          rules={[
            { required: true, message: 'Rank is required' },
            { type: 'number', min: 1, message: 'Rank must be at least 1' },
          ]}
          extra="The rank determines the badge tier or importance"
        >
          <InputNumber min={1} style={{ width: '100%' }} placeholder="e.g. 1" />
        </Form.Item>

        <Form.Item
          label="Display Order (Optional)"
          name="displayOrder"
          rules={[{ type: 'number', min: 0, message: 'Display order must be 0 or greater' }]}
          extra="Optional: Controls the order in which badges are displayed"
        >
          <InputNumber min={0} style={{ width: '100%' }} placeholder="e.g. 0" />
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
    </Modal>
  );
}

export default AddBadgeToEventModal;
