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
  message as antdMessage,
  Card,
  Row,
  Col,
} from 'antd';
import { CloudUploadOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { uploadProductImage } from '../../../api/admin-products';
import type { CreateNFTInput } from '../../../api/admin-crypto';
import { FORM_LAYOUT_VERTICAL } from '../../../constants/form-layout';

const { TextArea } = Input;

interface NFTCreateModalProps {
  open: boolean;
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
  currentOwnerId?: string | null;
  attributes: { traitType: string; value: string }[];
}

function NFTCreateModal({ open, onClose, onSuccess }: NFTCreateModalProps) {
  const [form] = Form.useForm<FormValues>();
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string>('');

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      form.resetFields();
      form.setFieldsValue({
        isTransferable: true,
        attributes: [],
      });
      setImageUrl('');
      setError(null);
    }
  }, [open, form]);

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

      // Filter out empty attributes
      const validAttributes = (values.attributes || []).filter(
        (attr) => attr.traitType?.trim() && attr.value?.trim()
      );

      // Prepare payload
      const payload: CreateNFTInput = {
        name: values.name.trim(),
        description: trimString(values.description),
        imageUrl: values.imageUrl.trim(),
        type: values.type,
        rarity: values.rarity,
        isTransferable: values.isTransferable ?? true,
        currentOwnerId: trimString(values.currentOwnerId),
        attributes: validAttributes.length > 0 ? validAttributes : undefined,
      };

      // Import createNFT dynamically to avoid circular dependency
      const { createNFT } = await import('../../../api/admin-crypto');
      await createNFT(payload);

      antdMessage.success('NFT created successfully');
      onSuccess();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create NFT');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title="Create NFT"
      open={open}
      onCancel={onClose}
      footer={null}
      width={800}
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
          label="NFT Name"
          name="name"
          rules={[
            { required: true, message: 'NFT name is required' },
            { min: 1, max: 200, message: 'Name must be between 1 and 200 characters' },
          ]}
        >
          <Input placeholder="e.g., Legendary Dragon Badge" autoFocus />
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

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              label="Transferable"
              name="isTransferable"
              valuePropName="checked"
              tooltip="Allow users to transfer this NFT"
            >
              <Switch />
            </Form.Item>
          </Col>

          <Col span={12}>
            <Form.Item
              label="Initial Owner ID (Optional)"
              name="currentOwnerId"
              tooltip="Leave empty to assign later"
            >
              <Input placeholder="User UUID" />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item label="Attributes (Traits)">
          <Form.List name="attributes">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name, ...restField }) => (
                  <Card
                    key={key}
                    size="small"
                    style={{ marginBottom: 8 }}
                    extra={
                      <Button
                        type="text"
                        danger
                        size="small"
                        icon={<DeleteOutlined />}
                        onClick={() => remove(name)}
                      />
                    }
                  >
                    <Row gutter={8}>
                      <Col span={12}>
                        <Form.Item
                          {...restField}
                          name={[name, 'traitType']}
                          rules={[{ required: true, message: 'Trait type required' }]}
                          style={{ marginBottom: 0 }}
                        >
                          <Input placeholder="Trait type (e.g., Power)" />
                        </Form.Item>
                      </Col>
                      <Col span={12}>
                        <Form.Item
                          {...restField}
                          name={[name, 'value']}
                          rules={[{ required: true, message: 'Value required' }]}
                          style={{ marginBottom: 0 }}
                        >
                          <Input placeholder="Value (e.g., 100)" />
                        </Form.Item>
                      </Col>
                    </Row>
                  </Card>
                ))}
                <Button
                  type="dashed"
                  onClick={() => add()}
                  block
                  icon={<PlusOutlined />}
                  size="small"
                >
                  Add Attribute
                </Button>
              </>
            )}
          </Form.List>
        </Form.Item>

        <Alert
          message="Note"
          description="NFTs can be assigned to users, traded on marketplace, or used as rewards in events and achievements."
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />

        <Form.Item style={{ marginBottom: 0, marginTop: 24 }}>
          <Space>
            <Button type="primary" htmlType="submit" loading={saving}>
              Create NFT
            </Button>
            <Button onClick={onClose}>Cancel</Button>
          </Space>
        </Form.Item>
      </Form>
    </Modal>
  );
}

export default NFTCreateModal;
