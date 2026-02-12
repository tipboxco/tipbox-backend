import { useState, useEffect } from 'react';
import {
  Modal,
  Form,
  Input,
  Button,
  Alert,
  Spin,
  Space,
  message as antdMessage,
  Image,
} from 'antd';
import {
  fetchUserAvatar,
  createUserAvatar,
  updateUserAvatar,
} from '../../../api/admin-users';
import { FORM_LAYOUT_VERTICAL } from '../../../constants/form-layout';

interface EditUserAvatarModalProps {
  open: boolean;
  userId: string;
  onClose: () => void;
  onSuccess: () => void;
}

interface FormValues {
  imageUrl: string;
}

function EditUserAvatarModal({ open, userId, onClose, onSuccess }: EditUserAvatarModalProps) {
  const [form] = Form.useForm<FormValues>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [existingAvatarId, setExistingAvatarId] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetchUserAvatar(userId);
        if (!cancelled && res.data) {
          const data = res.data;
          setExistingAvatarId(data.id ?? null);
          const imageUrl = data.imageUrl ?? '';
          form.setFieldsValue({
            imageUrl,
          });
          setPreviewUrl(imageUrl);
        }
      } catch (e) {
        if (!cancelled) {
          // Avatar might not exist yet, that's OK
          console.log('No existing avatar found, will create new one');
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
    if (!values.imageUrl.trim()) {
      setError('Image URL is required');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      if (existingAvatarId) {
        // Update existing avatar
        await updateUserAvatar(userId, {
          imageUrl: values.imageUrl.trim(),
          isActive: true,
        });
      } else {
        // Create new avatar
        await createUserAvatar(userId, {
          imageUrl: values.imageUrl.trim(),
        });
      }
      antdMessage.success('User avatar updated successfully');
      onSuccess();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update user avatar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title="Edit User Avatar"
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
            label="Avatar Image URL"
            name="imageUrl"
            rules={[
              { required: true, message: 'Image URL is required' },
              { type: 'url', message: 'Please enter a valid URL' },
            ]}
          >
            <Input
              placeholder="https://example.com/avatar.jpg"
              onChange={(e) => setPreviewUrl(e.target.value)}
            />
          </Form.Item>

          {previewUrl && (
            <Form.Item label="Preview">
              <Image
                src={previewUrl}
                alt="Avatar preview"
                style={{ maxWidth: 200, maxHeight: 200, borderRadius: 8 }}
                fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
              />
            </Form.Item>
          )}

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

export default EditUserAvatarModal;
