import { useState } from 'react';
import {
  Modal,
  Form,
  Input,
  InputNumber,
  Checkbox,
  Button,
  Alert,
  Space,
  message as antdMessage,
} from 'antd';
import { grantUserBadge } from '../../../api/admin-users';
import { FORM_LAYOUT_VERTICAL } from '../../../constants/form-layout';

interface GrantBadgeModalProps {
  open: boolean;
  userId: string;
  onClose: () => void;
  onSuccess: () => void;
}

interface FormValues {
  badgeId: string;
  isVisible: boolean;
  displayOrder?: number;
}

function GrantBadgeModal({ open, userId, onClose, onSuccess }: GrantBadgeModalProps) {
  const [form] = Form.useForm<FormValues>();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (values: FormValues) => {
    setSaving(true);
    setError(null);
    try {
      await grantUserBadge(userId, {
        badgeId: values.badgeId.trim(),
        isVisible: values.isVisible,
        displayOrder: values.displayOrder,
      });
      antdMessage.success('Badge granted to user successfully');
      onSuccess();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to grant badge to user');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title="Grant Badge to User"
      open={open}
      onCancel={onClose}
      footer={null}
      width={600}
      destroyOnHidden
    >
      <Form
        form={form}
        {...FORM_LAYOUT_VERTICAL}
        onFinish={handleSubmit}
        initialValues={{
          isVisible: true,
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
          extra="Enter the UUID of the badge you want to grant to this user"
        >
          <Input placeholder="e.g. 123e4567-e89b-12d3-a456-426614174000" />
        </Form.Item>

        <Form.Item name="isVisible" valuePropName="checked">
          <Checkbox>Make badge visible on user profile</Checkbox>
        </Form.Item>

        <Form.Item
          label="Display Order (Optional)"
          name="displayOrder"
          rules={[{ type: 'number', min: 0, message: 'Display order must be 0 or greater' }]}
          extra="Optional: Controls the order in which badges are displayed on the user's profile"
        >
          <InputNumber min={0} style={{ width: '100%' }} placeholder="e.g. 0" />
        </Form.Item>

        <Form.Item style={{ marginBottom: 0, marginTop: 24 }}>
          <Space>
            <Button type="primary" htmlType="submit" loading={saving}>
              Grant Badge
            </Button>
            <Button onClick={onClose}>Cancel</Button>
          </Space>
        </Form.Item>
      </Form>
    </Modal>
  );
}

export default GrantBadgeModal;
