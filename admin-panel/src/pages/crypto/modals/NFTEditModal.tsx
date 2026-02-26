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
  Switch,
  Spin,
  message as antdMessage,
  Card,
  Row,
  Col,
} from 'antd';
import { CloudUploadOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { uploadProductImage } from '../../../api/admin-products';
import type { UpdateNFTInput, AdminNFTDetailResponse } from '../../../api/admin-crypto';
import { FORM_LAYOUT_VERTICAL } from '../../../constants/form-layout';

const { TextArea } = Input;

interface NFTEditModalProps {
  open: boolean;
  nftId: string;
  onClose: () => void;
  onSuccess: () => void;
}

interface FormValues {
  name: string;
  description?: string | null;
  imageUrl: string;
  type: string;
  rarity: string;
  isTransferable: boolean;
  attributes: { traitType: string; value: string }[];
}

function NFTEditModal({ open, nftId, onClose, onSuccess }: NFTEditModalProps) {
  const [form] = Form.useForm<FormValues>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string>('');
  const [nftData, setNftData] = useState<AdminNFTDetailResponse | null>(null);

  // Load NFT data
  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const { fetchNFT } = await import('../../../api/admin-crypto');
        const res = await fetchNFT(nftId);

        if (!cancelled && res.data) {
          const data = res.data;
          setNftData(data);

          // Convert attributes from backend format to form format
          const formattedAttributes = (data.attributes || []).map((attr) => ({
            traitType: attr.traitType,
            value: attr.value,
          }));

          form.setFieldsValue({
            name: data.name,
            description: data.description ?? '',
            imageUrl: data.imageUrl,
            type: data.type,
            rarity: data.rarity,
            isTransferable: data.isTransferable ?? true,
            attributes: formattedAttributes,
          });
          setImageUrl(data.imageUrl);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load NFT data');
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
  }, [open, nftId, form]);

  const handleImageUpload = async (file: File) => {
    setUploadingImage(true);
    setError(null);
    try {
      const res = await uploadProductImage(file);
      if (res.data?.url) {
        setImageUrl(res.data.url);
        form.setFieldValue('imageUrl', res.data.url);
        antdMessage.success('Image uploaded');
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
      if (!values.name || !values.name.trim()) {
        setError('NFT name is required');
        setSaving(false);
        return;
      }
      if (!values.imageUrl || !values.imageUrl.trim()) {
        setError('Image URL is required');
        setSaving(false);
        return;
      }
      if (!values.type) {
        setError('Type is required');
        setSaving(false);
        return;
      }
      if (!values.rarity) {
        setError('Rarity is required');
        setSaving(false);
        return;
      }

      // Prepare payload (UpdateNFTInput doesn't include attributes per type definition)
      const payload: UpdateNFTInput = {
        name: values.name.trim(),
        description: trimString(values.description),
        imageUrl: values.imageUrl.trim(),
        type: values.type,
        rarity: values.rarity,
        isTransferable: values.isTransferable ?? true,
      };

      // Import updateNFT dynamically
      const { updateNFT } = await import('../../../api/admin-crypto');
      await updateNFT(nftId, payload);

      antdMessage.success('NFT updated successfully');
      onSuccess();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update NFT');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title="Edit NFT"
      open={open}
      onCancel={onClose}
      footer={null}
      width={800}
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

          {nftData?.currentOwner && (
            <Alert
              message="Current Owner"
              description={`This NFT is currently owned by ${nftData.currentOwner.username || nftData.currentOwner.email || 'Unknown User'}`}
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />
          )}

          <Form.Item
            label="NFT Name"
            name="name"
            rules={[
              { required: true, message: 'NFT name is required' },
              { min: 1, max: 200, message: 'Name must be between 1 and 200 characters' },
            ]}
          >
            <Input placeholder="e.g., Legendary Dragon Badge" />
          </Form.Item>

          <Form.Item label="Description" name="description">
            <TextArea
              rows={3}
              placeholder="NFT description"
              maxLength={5000}
              showCount
            />
          </Form.Item>

          <Form.Item
            label="Image"
            name="imageUrl"
            rules={[{ required: true, message: 'Image is required' }]}
          >
            <Space direction="vertical" style={{ width: '100%' }} size="small">
              <Upload
                beforeUpload={handleImageUpload}
                showUploadList={false}
                accept="image/jpeg,image/png,image/gif,image/webp"
                disabled={uploadingImage}
              >
                <Button icon={<CloudUploadOutlined />} loading={uploadingImage} size="small">
                  {uploadingImage ? 'Uploading...' : 'Upload Image'}
                </Button>
              </Upload>
              {imageUrl && (
                <div>
                  <img
                    src={imageUrl}
                    alt="NFT"
                    style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 4 }}
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

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="Type"
                name="type"
                rules={[{ required: true, message: 'Type is required' }]}
              >
                <Select placeholder="Select NFT type">
                  <Select.Option value="BADGE">Badge</Select.Option>
                  <Select.Option value="COSMETIC">Cosmetic</Select.Option>
                  <Select.Option value="LOOTBOX">Lootbox</Select.Option>
                </Select>
              </Form.Item>
            </Col>

            <Col span={12}>
              <Form.Item
                label="Rarity"
                name="rarity"
                rules={[{ required: true, message: 'Rarity is required' }]}
              >
                <Select placeholder="Select rarity">
                  <Select.Option value="COMMON">Common</Select.Option>
                  <Select.Option value="UNCOMMON">Uncommon</Select.Option>
                  <Select.Option value="RARE">Rare</Select.Option>
                  <Select.Option value="EPIC">Epic</Select.Option>
                  <Select.Option value="LEGENDARY">Legendary</Select.Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            label="Transferable"
            name="isTransferable"
            valuePropName="checked"
            tooltip="Allow users to transfer this NFT"
          >
            <Switch />
          </Form.Item>

          <Form.Item label="Attributes (Read-Only)">
            <Alert
              message="Note"
              description="Attributes cannot be edited after creation. They are immutable NFT traits."
              type="info"
              showIcon
            />
            {nftData?.attributes && nftData.attributes.length > 0 && (
              <Card size="small" style={{ marginTop: 8 }}>
                {nftData.attributes.map((attr, index) => (
                  <Row key={index} gutter={8} style={{ marginBottom: index < nftData.attributes.length - 1 ? 8 : 0 }}>
                    <Col span={12}>
                      <strong>{attr.traitType}:</strong>
                    </Col>
                    <Col span={12}>
                      {attr.value}
                    </Col>
                  </Row>
                ))}
              </Card>
            )}
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, marginTop: 24 }}>
            <Space>
              <Button type="primary" htmlType="submit" loading={saving}>
                Save Changes
              </Button>
              <Button onClick={onClose}>Cancel</Button>
            </Space>
          </Form.Item>
        </Form>
      )}
    </Modal>
  );
}

export default NFTEditModal;
