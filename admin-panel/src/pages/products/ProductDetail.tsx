import { useState, useEffect, type ChangeEvent } from 'react';
import { useParams } from 'react-router-dom';
import {
  Card,
  Descriptions,
  Image,
  Space,
  Empty,
  Alert,
  Button,
  Modal,
  Form,
  Input,
  Upload,
  message,
  Table,
  Tag,
  Spin,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  ShoppingOutlined,
  EditOutlined,
  UserOutlined,
  FileTextOutlined,
  CloudUploadOutlined,
} from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';
import { type StatItemData } from '../../components/StatItem';
import {
  fetchProduct,
  updateProduct,
  deleteProduct,
  uploadProductImage,
} from '../../api/admin-products';
import type {
  AdminProductDetailResponse,
  UpdateProductInput,
} from '../../api/admin-products';
import { TABLE_COLUMN_WIDTHS } from '../../constants/table-widths';
import { useNavigate } from 'react-router-dom';

function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [product, setProduct] = useState<AdminProductDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [form] = Form.useForm();
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imagePreview, setImagePreview] = useState('');
  const [uploadingThumbnail, setUploadingThumbnail] = useState(false);
  const [thumbnailPreview, setThumbnailPreview] = useState('');

  const loadProduct = async () => {
    if (!id) return;

    setLoading(true);
    try {
      const res = await fetchProduct(id);
      setProduct(res.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load product');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProduct();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleEdit = async (values: UpdateProductInput) => {
    if (!id) return;

    try {
      await updateProduct(id, values);
      message.success('Product updated successfully');
      setEditModalOpen(false);
      form.resetFields();
      setImagePreview('');
      setThumbnailPreview('');
      loadProduct();
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Failed to update product');
    }
  };

  const handleDelete = async () => {
    if (!id || !product) return;

    Modal.confirm({
      title: 'Delete Product',
      content: `Are you sure you want to delete "${product.name}"? This action cannot be undone.`,
      okText: 'Delete',
      okType: 'danger',
      onOk: async () => {
        try {
          await deleteProduct(id);
          message.success('Product deleted successfully');
          navigate('/products');
        } catch (e) {
          message.error(e instanceof Error ? e.message : 'Failed to delete product');
        }
      },
    });
  };

  const handleImageUpload = async (file: File) => {
    setUploadingImage(true);
    try {
      const res = await uploadProductImage(file);
      const url = res.data?.url ?? '';
      setImagePreview(url);
      form.setFieldValue('imageUrl', url);
      message.success('Image uploaded successfully');
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Failed to upload image');
    } finally {
      setUploadingImage(false);
    }
    return false;
  };

  const handleThumbnailUpload = async (file: File) => {
    setUploadingThumbnail(true);
    try {
      const res = await uploadProductImage(file);
      const url = res.data?.url ?? '';
      setThumbnailPreview(url);
      form.setFieldValue('thumbnail', url);
      message.success('Thumbnail uploaded successfully');
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Failed to upload thumbnail');
    } finally {
      setUploadingThumbnail(false);
    }
    return false;
  };

  const openEditModal = () => {
    if (!product) return;
    form.setFieldsValue({
      name: product.name,
      subName: product.subName ?? undefined,
      description: product.description ?? undefined,
      categoryId: product.categoryId ?? undefined,
      groupId: product.groupId ?? undefined,
      brandId: product.brandId ?? undefined,
      imageUrl: product.imageUrl ?? undefined,
      thumbnail: product.thumbnail ?? undefined,
    });
    setImagePreview(product.imageUrl ?? '');
    setThumbnailPreview(product.thumbnail ?? '');
    setEditModalOpen(true);
  };

  const inventoryColumns: ColumnsType<AdminProductDetailResponse['recentInventories'][0]> = [
    {
      title: 'User',
      dataIndex: 'username',
      key: 'username',
      width: TABLE_COLUMN_WIDTHS.MEDIUM_TEXT,
      ellipsis: true,
      render: (text, record) => text ?? record.userId,
    },
    {
      title: 'Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: TABLE_COLUMN_WIDTHS.DATE_SHORT,
      render: (date) => new Date(date).toLocaleDateString('en-US'),
    },
  ];

  const postColumns: ColumnsType<AdminProductDetailResponse['recentPosts'][0]> = [
    {
      title: 'Post ID',
      dataIndex: 'id',
      key: 'id',
      width: TABLE_COLUMN_WIDTHS.MEDIUM_TEXT,
      ellipsis: true,
    },
    {
      title: 'User',
      dataIndex: 'username',
      key: 'username',
      width: TABLE_COLUMN_WIDTHS.MEDIUM_TEXT,
      ellipsis: true,
      render: (text, record) => text ?? record.userId,
    },
    {
      title: 'Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: TABLE_COLUMN_WIDTHS.DATE_SHORT,
      render: (date) => new Date(date).toLocaleDateString('en-US'),
    },
  ];

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (error || !product) {
    return (
      <div>
        <PageHeader
          title="Product Details"
          icon={<ShoppingOutlined />}
          backTo="/products"
        />
        <Alert
          message="Error"
          description={error ?? 'Product not found'}
          type="error"
          showIcon
        />
      </div>
    );
  }

  const statsData: StatItemData[] = [
    {
      label: 'Inventory Count',
      value: product.inventoryCount,
      icon: <UserOutlined />,
    },
    {
      label: 'Post Count',
      value: product.postCount,
      icon: <FileTextOutlined />,
    },
  ];

  return (
    <div>
      <PageHeader
        title={product.name}
        description="Product details and statistics"
        icon={<ShoppingOutlined />}
        backTo="/products"
        stats={statsData}
        actions={
          <Space>
            <Button icon={<EditOutlined />} onClick={openEditModal}>
              Edit
            </Button>
            <Button danger onClick={handleDelete}>
              Delete
            </Button>
          </Space>
        }
      />

      <Space orientation="vertical" size="large" style={{ width: '100%' }}>
        {/* Product Information */}
        <Card title="Product Information">
          <Descriptions column={{ xs: 1, sm: 2, md: 2, lg: 2 }} bordered>
            <Descriptions.Item label="Product ID" span={2}>
              {product.id}
            </Descriptions.Item>
            <Descriptions.Item label="Name" span={2}>
              {product.name}
            </Descriptions.Item>
            {product.subName && (
              <Descriptions.Item label="Sub Name" span={2}>
                {product.subName}
              </Descriptions.Item>
            )}
            {product.description && (
              <Descriptions.Item label="Description" span={2}>
                {product.description}
              </Descriptions.Item>
            )}
            <Descriptions.Item label="Category">
              {product.categoryName ? (
                <Tag color="blue">{product.categoryName}</Tag>
              ) : (
                '—'
              )}
            </Descriptions.Item>
            <Descriptions.Item label="Group">
              {product.groupName ? <Tag color="green">{product.groupName}</Tag> : '—'}
            </Descriptions.Item>
            <Descriptions.Item label="Brand ID">
              {product.brandId ?? '—'}
            </Descriptions.Item>
            <Descriptions.Item label="Created At">
              {new Date(product.createdAt).toLocaleString('en-US')}
            </Descriptions.Item>
            <Descriptions.Item label="Updated At" span={2}>
              {new Date(product.updatedAt).toLocaleString('en-US')}
            </Descriptions.Item>
          </Descriptions>

          {(product.imageUrl || product.thumbnail) && (
            <div style={{ marginTop: 16 }}>
              <Space orientation="horizontal" size="middle">
                {product.imageUrl && (
                  <div>
                    <div style={{ marginBottom: 8, fontWeight: 500 }}>Image</div>
                    <Image
                      src={product.imageUrl}
                      alt={product.name}
                      width={200}
                      placeholder
                    />
                  </div>
                )}
                {product.thumbnail && (
                  <div>
                    <div style={{ marginBottom: 8, fontWeight: 500 }}>Thumbnail</div>
                    <Image
                      src={product.thumbnail}
                      alt={`${product.name} thumbnail`}
                      width={100}
                      placeholder
                    />
                  </div>
                )}
              </Space>
            </div>
          )}
        </Card>

        {/* Recent Inventories */}
        <Card title={`Recent Inventories (${product.inventoryCount} total)`}>
          {product.recentInventories.length > 0 ? (
            <Table
              columns={inventoryColumns}
              dataSource={product.recentInventories}
              rowKey="userId"
              pagination={false}
              size="small"
            />
          ) : (
            <Empty description="No inventories found" />
          )}
        </Card>

        {/* Recent Posts */}
        <Card title={`Recent Posts (${product.postCount} total)`}>
          {product.recentPosts.length > 0 ? (
            <Table
              columns={postColumns}
              dataSource={product.recentPosts}
              rowKey="id"
              pagination={false}
              size="small"
            />
          ) : (
            <Empty description="No posts found" />
          )}
        </Card>
      </Space>

      {/* Edit Product Modal */}
      <Modal
        title="Edit Product"
        open={editModalOpen}
        onCancel={() => {
          setEditModalOpen(false);
          form.resetFields();
          setImagePreview('');
          setThumbnailPreview('');
        }}
        onOk={() => form.submit()}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleEdit}>
          <Form.Item
            name="name"
            label="Product Name"
            rules={[{ required: true, message: 'Please enter product name' }]}
          >
            <Input placeholder="e.g., AirPods Pro (2nd generation)" />
          </Form.Item>
          <Form.Item name="subName" label="Sub Name">
            <Input placeholder="Optional sub name" />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={3} placeholder="Product description" />
          </Form.Item>
          <Form.Item name="categoryId" label="Category ID">
            <Input placeholder="Optional category ID" />
          </Form.Item>
          <Form.Item name="groupId" label="Group ID">
            <Input placeholder="Optional group ID" />
          </Form.Item>
          <Form.Item name="brandId" label="Brand ID">
            <Input placeholder="Optional brand ID" />
          </Form.Item>
          <Form.Item name="imageUrl" label="Product Image">
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
              {imagePreview && (
                <div>
                  <img
                    src={imagePreview}
                    alt="Product"
                    style={{ maxWidth: '100%', maxHeight: 150, borderRadius: 4 }}
                  />
                  <Button
                    size="small"
                    danger
                    onClick={() => {
                      setImagePreview('');
                      form.setFieldValue('imageUrl', '');
                    }}
                    style={{ marginTop: 4 }}
                  >
                    Remove
                  </Button>
                </div>
              )}
              <Input
                value={imagePreview}
                onChange={(e: ChangeEvent<HTMLInputElement>) => {
                  setImagePreview(e.target.value);
                  form.setFieldValue('imageUrl', e.target.value);
                }}
                placeholder="or paste image URL"
                size="small"
              />
            </Space>
          </Form.Item>
          <Form.Item name="thumbnail" label="Thumbnail">
            <Space direction="vertical" style={{ width: '100%' }} size="small">
              <Upload
                beforeUpload={handleThumbnailUpload}
                showUploadList={false}
                accept="image/jpeg,image/png,image/gif,image/webp"
                disabled={uploadingThumbnail}
              >
                <Button icon={<CloudUploadOutlined />} loading={uploadingThumbnail} size="small">
                  {uploadingThumbnail ? 'Uploading...' : 'Upload Thumbnail'}
                </Button>
              </Upload>
              {thumbnailPreview && (
                <div>
                  <img
                    src={thumbnailPreview}
                    alt="Thumbnail"
                    style={{ maxWidth: '100%', maxHeight: 150, borderRadius: 4 }}
                  />
                  <Button
                    size="small"
                    danger
                    onClick={() => {
                      setThumbnailPreview('');
                      form.setFieldValue('thumbnail', '');
                    }}
                    style={{ marginTop: 4 }}
                  >
                    Remove
                  </Button>
                </div>
              )}
              <Input
                value={thumbnailPreview}
                onChange={(e: ChangeEvent<HTMLInputElement>) => {
                  setThumbnailPreview(e.target.value);
                  form.setFieldValue('thumbnail', e.target.value);
                }}
                placeholder="or paste thumbnail URL"
                size="small"
              />
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default ProductDetail;
