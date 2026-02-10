import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Modal,
  Steps,
  Form,
  Input,
  Upload,
  Button,
  Alert,
  Space,
  message as antdMessage,
} from 'antd';
import { CloudUploadOutlined, InfoCircleOutlined, FileImageOutlined } from '@ant-design/icons';
import { createCollection, uploadMedia } from '../../api/admin-badges-collections';
import { FORM_LAYOUT_VERTICAL } from '../../constants/form-layout';

const { TextArea } = Input;

const INITIAL_FORM = {
  name: '',
  owner: '',
  focusSector: '',
  targetGroup: '',
  shortDescription: '',
  longDescription: '',
  bannerUrl: '',
  unlockCondition: '',
  completionBonus: '',
};

const STEPS = [
  { key: 0, title: 'Basic information', icon: <InfoCircleOutlined /> },
  { key: 1, title: 'Details and image', icon: <FileImageOutlined /> },
];

interface CreateCollectionModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

function CreateCollectionModal({ open, onClose, onSuccess }: CreateCollectionModalProps) {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(INITIAL_FORM);

  useEffect(() => {
    if (!open) {
      setForm(INITIAL_FORM);
      setError(null);
      setStep(0);
    }
  }, [open]);

  const update = useCallback((key: keyof typeof form, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    setError(null);
  }, []);

  const handleBannerUpload = async (file: File) => {
    setUploadingBanner(true);
    setError(null);
    try {
      const res = await uploadMedia(file);
      if (res.data?.url) {
        setForm((f) => ({ ...f, bannerUrl: res.data!.url }));
        antdMessage.success('Cover image uploaded');
      }
    } catch (err) {
      antdMessage.error(err instanceof Error ? err.message : 'Failed to upload image');
    } finally {
      setUploadingBanner(false);
    }
    return false;
  };

  const handleNext = () => {
    if (step === 0 && !form.name.trim()) {
      setError('Collection name is required.');
      return;
    }
    setError(null);
    setStep(1);
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      setError('Collection name is required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await createCollection({
        name: form.name.trim(),
        bannerUrl: form.bannerUrl.trim() || null,
        owner: form.owner.trim() || null,
        focusSector: form.focusSector.trim() || null,
        targetGroup: form.targetGroup.trim() || null,
        shortDescription: form.shortDescription.trim() || null,
        longDescription: form.longDescription.trim() || null,
        unlockCondition: form.unlockCondition.trim() || null,
        completionBonus: form.completionBonus.trim() || null,
      });
      antdMessage.success('Collection created');
      onSuccess();
      if (res.data?.id) {
        navigate(`/gamification/collections/${res.data.id}`);
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create collection');
    } finally {
      setSaving(false);
    }
  };

  const stepItems = STEPS.map((s) => ({ title: s.title, icon: s.icon }));

  return (
    <Modal
      title="New collection"
      open={open}
      onCancel={onClose}
      width={560}
      footer={null}
      destroyOnClose
      styles={{ body: { maxHeight: '70vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' } }}
    >
      <Steps current={step} items={stepItems} size="small" style={{ marginBottom: 20 }} />

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

      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        <Form {...FORM_LAYOUT_VERTICAL} style={{ width: '100%' }}>
          {step === 0 && (
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <Form.Item label="Collection name" required style={{ marginBottom: 8 }}>
              <Input
                value={form.name}
                onChange={(e) => update('name', e.target.value)}
                placeholder="e.g. Summer Season Badges"
              />
            </Form.Item>
            <Form.Item label="Owner (optional)" style={{ marginBottom: 8 }}>
              <Input
                value={form.owner}
                onChange={(e) => update('owner', e.target.value)}
                placeholder="Optional"
              />
            </Form.Item>
            <Form.Item label="Focus sector" style={{ marginBottom: 8 }}>
              <Input
                value={form.focusSector}
                onChange={(e) => update('focusSector', e.target.value)}
                placeholder="e.g. E-commerce, Gaming"
              />
            </Form.Item>
            <Form.Item label="Target group" style={{ marginBottom: 8 }}>
              <Input
                value={form.targetGroup}
                onChange={(e) => update('targetGroup', e.target.value)}
                placeholder="Target audience"
              />
            </Form.Item>
            <Form.Item label="Short description" style={{ marginBottom: 0 }}>
              <TextArea
                value={form.shortDescription}
                onChange={(e) => update('shortDescription', e.target.value)}
                rows={2}
                placeholder="Short description"
              />
              </Form.Item>
            </Space>
          )}

          {step === 1 && (
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <Form.Item label="Long description" style={{ marginBottom: 8 }}>
              <TextArea
                value={form.longDescription}
                onChange={(e) => update('longDescription', e.target.value)}
                rows={2}
                placeholder="Detailed description"
              />
            </Form.Item>
            <Form.Item label="Cover image" style={{ marginBottom: 8 }}>
              <Space direction="vertical" style={{ width: '100%' }} size="small">
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
                {form.bannerUrl && (
                  <div>
                    <img
                      src={form.bannerUrl}
                      alt="Cover"
                      style={{ maxWidth: '100%', maxHeight: 100, borderRadius: 4 }}
                    />
                    <Button size="small" danger onClick={() => update('bannerUrl', '')} style={{ marginTop: 4 }}>
                      Remove
                    </Button>
                  </div>
                )}
                <Input
                  value={form.bannerUrl}
                  onChange={(e) => update('bannerUrl', e.target.value)}
                  placeholder="or cover image URL"
                  size="small"
                />
              </Space>
            </Form.Item>
            <Form.Item label="Unlock condition" style={{ marginBottom: 8 }}>
              <Input
                value={form.unlockCondition}
                onChange={(e) => update('unlockCondition', e.target.value)}
                placeholder="Unlock condition"
              />
            </Form.Item>
            <Form.Item label="Completion reward" style={{ marginBottom: 0 }}>
              <Input
                value={form.completionBonus}
                onChange={(e) => update('completionBonus', e.target.value)}
                placeholder="Reward for completion"
              />
              </Form.Item>
            </Space>
          )}
        </Form>
      </div>

      <div style={{ marginTop: 20, display: 'flex', justifyContent: 'space-between', flexShrink: 0 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Space>
          {step === 1 && (
            <Button onClick={() => setStep(0)}>Back</Button>
          )}
          {step === 0 ? (
            <Button type="primary" onClick={handleNext} disabled={!form.name.trim()}>
              Next
            </Button>
          ) : (
            <Button type="primary" loading={saving} onClick={handleSubmit}>
              {saving ? 'Creating...' : 'Create collection'}
            </Button>
          )}
        </Space>
      </div>
    </Modal>
  );
}

export default CreateCollectionModal;
