import { useState, useEffect } from 'react';
import {
  Modal,
  Form,
  Input,
  Upload,
  Button,
  Alert,
  Spin,
  Space,
  message as antdMessage,
} from 'antd';
import { CloudUploadOutlined } from '@ant-design/icons';
import {
  fetchCollection,
  updateCollection,
  uploadMedia,
} from '../../../api/admin-badges-collections';
import { FORM_LAYOUT_VERTICAL } from '../../../constants/form-layout';

const { TextArea } = Input;

interface EditCollectionModalProps {
  open: boolean;
  collectionId: string;
  onClose: () => void;
  onSuccess: () => void;
}

interface FormValues {
  name: string;
  bannerUrl?: string;
  owner?: string;
  focusSector?: string;
  targetGroup?: string;
  shortDescription?: string;
  longDescription?: string;
  unlockCondition?: string;
  completionBonus?: string;
  categoryId?: string;
}

function EditCollectionModal({ open, collectionId, onClose, onSuccess }: EditCollectionModalProps) {
  const [form] = Form.useForm<FormValues>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bannerUrl, setBannerUrl] = useState<string>('');

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetchCollection(collectionId);
        if (!cancelled && res.data) {
          const data = res.data;
          form.setFieldsValue({
            name: data.name,
            bannerUrl: data.bannerUrl ?? '',
            owner: data.owner ?? '',
            focusSector: data.focusSector ?? '',
            targetGroup: data.targetGroup ?? '',
            shortDescription: data.shortDescription ?? '',
            longDescription: data.longDescription ?? '',
            unlockCondition: data.unlockCondition ?? '',
            completionBonus: data.completionBonus ?? '',
            categoryId: data.categoryId ?? '',
          });
          setBannerUrl(data.bannerUrl ?? '');
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load collection data');
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
  }, [open, collectionId, form]);

  const handleBannerUpload = async (file: File) => {
    setUploadingBanner(true);
    setError(null);
    try {
      const res = await uploadMedia(file);
      if (res.data?.url) {
        setBannerUrl(res.data.url);
        form.setFieldValue('bannerUrl', res.data.url);
        antdMessage.success('Cover image uploaded');
      }
    } catch (err) {
      antdMessage.error(err instanceof Error ? err.message : 'Failed to upload image');
    } finally {
      setUploadingBanner(false);
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
      // Validate required field
      if (!values.name || !values.name.trim()) {
        setError('Collection name is required');
        setSaving(false);
        return;
      }

      await updateCollection(collectionId, {
        name: values.name.trim(),
        bannerUrl: trimString(values.bannerUrl),
        owner: trimString(values.owner),
        focusSector: trimString(values.focusSector),
        targetGroup: trimString(values.targetGroup),
        shortDescription: trimString(values.shortDescription),
        longDescription: trimString(values.longDescription),
        unlockCondition: trimString(values.unlockCondition),
        completionBonus: trimString(values.completionBonus),
        categoryId: trimString(values.categoryId),
      });
      antdMessage.success('Collection updated successfully');
      onSuccess();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update collection');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title="Edit Collection"
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
            label="Collection Name"
            name="name"
            rules={[{ required: true, message: 'Collection name is required' }]}
          >
            <Input placeholder="e.g. Summer Season Badges" />
          </Form.Item>

          <Form.Item label="Cover Image" name="bannerUrl">
            <Space orientation="vertical" style={{ width: '100%' }} size="small">
              <Upload
                beforeUpload={handleBannerUpload}
                showUploadList={false}
                accept="image/jpeg,image/png,image/gif,image/webp"
                disabled={uploadingBanner}
              >
                <Button icon={<CloudUploadOutlined />} loading={uploadingBanner} size="small">
                  {uploadingBanner ? 'Uploading...' : 'Upload image'}
                </Button>
              </Upload>
              {bannerUrl && (
                <div>
                  <img
                    src={bannerUrl}
                    alt="Cover"
                    style={{ maxWidth: '100%', maxHeight: 100, borderRadius: 4 }}
                  />
                  <Button
                    size="small"
                    danger
                    onClick={() => {
                      setBannerUrl('');
                      form.setFieldValue('bannerUrl', '');
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
                  form.setFieldValue('bannerUrl', e.target.value);
                }}
                placeholder="or paste image URL"
                size="small"
              />
            </Space>
          </Form.Item>

          <Form.Item label="Owner" name="owner">
            <Input placeholder="Optional owner name" />
          </Form.Item>

          <Form.Item label="Focus Sector" name="focusSector">
            <Input placeholder="e.g. E-commerce, Gaming" />
          </Form.Item>

          <Form.Item label="Target Group" name="targetGroup">
            <Input placeholder="Target audience" />
          </Form.Item>

          <Form.Item label="Short Description" name="shortDescription">
            <TextArea rows={2} placeholder="Short description" />
          </Form.Item>

          <Form.Item label="Long Description" name="longDescription">
            <TextArea rows={3} placeholder="Detailed description" />
          </Form.Item>

          <Form.Item label="Unlock Condition" name="unlockCondition">
            <Input placeholder="Condition to unlock this collection" />
          </Form.Item>

          <Form.Item label="Completion Bonus" name="completionBonus">
            <Input placeholder="Reward for completing this collection" />
          </Form.Item>

          <Form.Item label="Category ID" name="categoryId">
            <Input placeholder="Optional category UUID" />
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

export default EditCollectionModal;
