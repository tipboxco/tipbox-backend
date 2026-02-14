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
  Spin,
  Tag,
  message as antdMessage,
} from 'antd';
import { CloudUploadOutlined } from '@ant-design/icons';
import {
  fetchProductGroup,
  updateProductGroup,
  fetchCategories,
  uploadProductImage,
} from '../../../api/admin-products';
import type {
  UpdateProductGroupInput,
  AdminCategoryListItem,
} from '../../../api/admin-products';
import { FORM_LAYOUT_VERTICAL } from '../../../constants/form-layout';

const { TextArea } = Input;

interface ProductGroupEditModalProps {
  open: boolean;
  groupId: string;
  onClose: () => void;
  onSuccess: () => void;
}

interface FormValues {
  name: string;
  description?: string;
  subCategoryId: string;
  imageUrl?: string;
}

// Helper to flatten categories and get subcategories with parent context
const getSubcategoriesWithParent = (
  categories: AdminCategoryListItem[]
): { id: string; name: string; parentName: string | null }[] => {
  const result: { id: string; name: string; parentName: string | null }[] = [];

  const traverse = (cats: AdminCategoryListItem[], parentName: string | null = null) => {
    cats.forEach((cat) => {
      result.push({
        id: cat.id,
        name: cat.name,
        parentName,
      });

      if (cat.children && cat.children.length > 0) {
        traverse(cat.children, cat.name);
      }
    });
  };

  traverse(categories);
  return result;
};

function ProductGroupEditModal({ open, groupId, onClose, onSuccess }: ProductGroupEditModalProps) {
  const [form] = Form.useForm<FormValues>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string>('');
  const [categories, setCategories] = useState<AdminCategoryListItem[]>([]);
  const [productCount, setProductCount] = useState<number>(0);

  // Load group data and categories
  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [groupRes, categoriesRes] = await Promise.all([
          fetchProductGroup(groupId),
          fetchCategories(),
        ]);

        if (!cancelled) {
          if (groupRes.data) {
            const data = groupRes.data;
            form.setFieldsValue({
              name: data.name,
              description: data.description ?? '',
              subCategoryId: data.subCategoryId,
              imageUrl: data.imageUrl ?? '',
            });
            setImageUrl(data.imageUrl ?? '');
            setProductCount(data.productCount ?? 0);
          }

          if (categoriesRes.data) {
            setCategories(categoriesRes.data);
          }
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load group data');
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
  }, [open, groupId, form]);

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
        setError('Group name is required');
        setSaving(false);
        return;
      }
      if (!values.subCategoryId || !values.subCategoryId.trim()) {
        setError('Subcategory is required');
        setSaving(false);
        return;
      }

      // Prepare payload
      const payload: UpdateProductGroupInput = {
        name: values.name.trim(),
        description: trimString(values.description),
        subCategoryId: values.subCategoryId.trim(),
        imageUrl: trimString(values.imageUrl),
      };

      await updateProductGroup(groupId, payload);
      antdMessage.success('Product group updated successfully');
      onSuccess();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update product group');
    } finally {
      setSaving(false);
    }
  };

  const subcategoriesWithParent = getSubcategoriesWithParent(categories);

  return (
    <Modal
      title="Edit Product Group"
      open={open}
      onCancel={onClose}
      footer={null}
      width={700}
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

          {productCount > 0 && (
            <Alert
              message="Group has products"
              description={`This group currently contains ${productCount} product${productCount > 1 ? 's' : ''}. Changes will affect all associated products.`}
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />
          )}

          <Form.Item
            label="Group Name"
            name="name"
            rules={[
              { required: true, message: 'Group name is required' },
              { min: 1, max: 200, message: 'Name must be between 1 and 200 characters' },
            ]}
          >
            <Input placeholder="e.g., Apple MacBooks" />
          </Form.Item>

          <Form.Item label="Description" name="description">
            <TextArea
              rows={3}
              placeholder="Product group description"
              maxLength={5000}
              showCount
            />
          </Form.Item>

          <Form.Item
            label="Subcategory"
            name="subCategoryId"
            rules={[{ required: true, message: 'Subcategory is required' }]}
            tooltip="Select the subcategory this group belongs to"
          >
            <Select
              showSearch
              placeholder="Select subcategory"
              optionFilterProp="children"
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              options={subcategoriesWithParent.map((subcat) => ({
                label: subcat.name,
                value: subcat.id,
                title: subcat.parentName
                  ? `${subcat.parentName} → ${subcat.name}`
                  : subcat.name,
              }))}
              optionRender={(option) => {
                const subcat = subcategoriesWithParent.find((s) => s.id === option.value);
                return (
                  <div>
                    {subcat?.parentName && (
                      <Tag color="blue" style={{ marginRight: 4 }}>
                        {subcat.parentName}
                      </Tag>
                    )}
                    {subcat?.name}
                  </div>
                );
              }}
            />
          </Form.Item>

          <Form.Item label="Group Image" name="imageUrl">
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
                    alt="Group"
                    style={{ maxWidth: '100%', maxHeight: 150, borderRadius: 4 }}
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

export default ProductGroupEditModal;
