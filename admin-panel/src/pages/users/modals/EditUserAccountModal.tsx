import { useState, useEffect } from 'react';
import {
  Modal,
  Form,
  Input,
  Select,
  Checkbox,
  Button,
  Alert,
  Spin,
  Space,
  message as antdMessage,
} from 'antd';
import {
  fetchUser,
  updateUser,
} from '../../../api/admin-users';
import { FORM_LAYOUT_VERTICAL } from '../../../constants/form-layout';

interface EditUserAccountModalProps {
  open: boolean;
  userId: string;
  onClose: () => void;
  onSuccess: () => void;
}

interface FormValues {
  email: string;
  status: string;
  emailVerified: boolean;
}

function EditUserAccountModal({ open, userId, onClose, onSuccess }: EditUserAccountModalProps) {
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
        const res = await fetchUser(userId);
        if (!cancelled && res.data) {
          const data = res.data;
          form.setFieldsValue({
            email: data.email,
            status: data.status ?? 'ACTIVE',
            emailVerified: data.emailVerified ?? false,
          });
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load user data');
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
  }, [open, userId, form]);

  const handleSubmit = async (values: FormValues) => {
    setSaving(true);
    setError(null);
    try {
      await updateUser(userId, {
        email: values.email.trim(),
        status: values.status || null,
        emailVerified: values.emailVerified,
      });
      antdMessage.success('User account updated successfully');
      onSuccess();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update user account');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title="Edit User Account"
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
            label="Email"
            name="email"
            rules={[
              { required: true, message: 'Email is required' },
              { type: 'email', message: 'Please enter a valid email' },
            ]}
          >
            <Input placeholder="user@example.com" />
          </Form.Item>

          <Form.Item
            label="Status"
            name="status"
            rules={[{ required: true, message: 'Status is required' }]}
          >
            <Select>
              <Select.Option value="ACTIVE">ACTIVE</Select.Option>
              <Select.Option value="SUSPENDED">SUSPENDED</Select.Option>
              <Select.Option value="BANNED">BANNED</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item name="emailVerified" valuePropName="checked">
            <Checkbox>Email Verified</Checkbox>
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

export default EditUserAccountModal;
