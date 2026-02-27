import { useState, useEffect } from 'react';
import {
  Modal,
  Form,
  Select,
  Button,
  Alert,
  Spin,
  Space,
  message as antdMessage,
} from 'antd';
import {
  fetchUserRoles,
  updateUserRoles,
} from '../../../api/admin-users';
import { FORM_LAYOUT_VERTICAL } from '../../../constants/form-layout';

interface EditUserRolesModalProps {
  open: boolean;
  userId: string;
  onClose: () => void;
  onSuccess: () => void;
}

interface FormValues {
  roles: string[];
}

const AVAILABLE_ROLES = ['admin', 'moderator', 'user', 'premium', 'verified'];

function EditUserRolesModal({ open, userId, onClose, onSuccess }: EditUserRolesModalProps) {
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
        const res = await fetchUserRoles(userId);
        if (!cancelled && res.data) {
          form.setFieldsValue({
            roles: res.data.roles ?? [],
          });
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load user roles');
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
      await updateUserRoles(userId, values.roles);
      antdMessage.success('User roles updated successfully');
      onSuccess();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update user roles');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title="Edit User Roles"
      open={open}
      onCancel={onClose}
      footer={null}
      width={600}
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
            label="User Roles"
            name="roles"
            extra="Select one or more roles for this user"
            rules={[{ required: true, message: 'At least one role is required', type: 'array', min: 1 }]}
          >
            <Select
              mode="multiple"
              placeholder="Select roles"
              options={AVAILABLE_ROLES.map((role) => ({ label: role, value: role }))}
            />
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

export default EditUserRolesModal;
