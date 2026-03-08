import { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Input,
  Space,
  Button,
  Empty,
  Alert,
  Row,
  Modal,
  Form,
  Avatar,
  Popconfirm,
  message as antdMessage,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  ShopOutlined,
  SearchOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  PictureOutlined,
} from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';
import {
  fetchBrandCategories,
  createBrandCategory,
  updateBrandCategory,
  deleteBrandCategory,
} from '../../api/admin-brands';
import type {
  AdminBrandCategoryListItem,
  CreateBrandCategoryInput,
  UpdateBrandCategoryInput,
} from '../../api/admin-brands';
import { TABLE_COLUMN_WIDTHS, TABLE_SCROLL_CONFIGS } from '../../constants/table-widths';

function BrandCategories() {
  const [categories, setCategories] = useState<AdminBrandCategoryListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<AdminBrandCategoryListItem | null>(null);
  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();

  const loadCategories = async () => {
    setLoading(true);
    try {
      const res = await fetchBrandCategories({ search: search || undefined });
      setCategories(res.data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load brand categories');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const handleCreate = async (values: CreateBrandCategoryInput) => {
    try {
      await createBrandCategory({
        name: values.name.trim(),
        imageUrl: values.imageUrl?.trim() || null,
        categoryId: values.categoryId?.trim() || null,
      });
      antdMessage.success('Brand category created successfully');
      setCreateModalOpen(false);
      createForm.resetFields();
      loadCategories();
    } catch (e) {
      antdMessage.error(e instanceof Error ? e.message : 'Failed to create brand category');
    }
  };

  const handleEdit = async (values: UpdateBrandCategoryInput) => {
    if (!selectedCategory) return;

    try {
      await updateBrandCategory(selectedCategory.id, {
        name: values.name?.trim(),
        imageUrl: values.imageUrl?.trim() || null,
        categoryId: values.categoryId?.trim() || null,
      });
      antdMessage.success('Brand category updated successfully');
      setEditModalOpen(false);
      editForm.resetFields();
      setSelectedCategory(null);
      loadCategories();
    } catch (e) {
      antdMessage.error(e instanceof Error ? e.message : 'Failed to update brand category');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteBrandCategory(id);
      antdMessage.success('Brand category deleted successfully');
      loadCategories();
    } catch (e) {
      antdMessage.error(e instanceof Error ? e.message : 'Failed to delete brand category');
    }
  };

  const openEditModal = (category: AdminBrandCategoryListItem) => {
    setSelectedCategory(category);
    editForm.setFieldsValue({
      name: category.name,
      imageUrl: category.imageUrl || undefined,
      categoryId: category.categoryId || undefined,
    });
    setEditModalOpen(true);
  };

  const columns: ColumnsType<AdminBrandCategoryListItem> = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      width: TABLE_COLUMN_WIDTHS.LONG_TEXT_FLEXIBLE,
      ellipsis: true,
    },
    {
      title: 'Image',
      dataIndex: 'imageUrl',
      key: 'imageUrl',
      width: TABLE_COLUMN_WIDTHS.IMAGE_SMALL,
      render: (url: string | null, record) =>
        url ? (
          <Avatar src={url} shape="square" size={40} />
        ) : (
          <Avatar icon={<PictureOutlined />} shape="square" size={40} />
        ),
    },
    {
      title: 'Category',
      dataIndex: 'categoryName',
      key: 'categoryName',
      width: TABLE_COLUMN_WIDTHS.MEDIUM_TEXT,
      ellipsis: true,
      render: (text: string | null) => text ?? '—',
    },
    {
      title: 'Brand Count',
      dataIndex: 'brandCount',
      key: 'brandCount',
      width: TABLE_COLUMN_WIDTHS.NUMBER_SMALL,
      align: 'right',
      sorter: (a, b) => a.brandCount - b.brandCount,
    },
    {
      title: 'Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: TABLE_COLUMN_WIDTHS.DATE_SHORT,
      ellipsis: true,
      render: (date: string) => (date ? new Date(date).toLocaleDateString('en-US') : '—'),
    },
    {
      title: '',
      key: 'action',
      width: TABLE_COLUMN_WIDTHS.ACTION_BUTTONS,
      render: (_, record) => (
        <Space size="small">
          <Button
            size="small"
            type="text"
            icon={<EditOutlined />}
            onClick={() => openEditModal(record)}
            title="Edit category"
          />
          <Popconfirm
            title="Delete Brand Category"
            description={
              record.brandCount > 0
                ? `This category has ${record.brandCount} brand(s) associated. Are you sure you want to delete it?`
                : 'Are you sure you want to delete this category?'
            }
            onConfirm={() => handleDelete(record.id)}
            okText="Delete"
            okType="danger"
          >
            <Button
              size="small"
              type="text"
              danger
              icon={<DeleteOutlined />}
              title="Delete category"
            />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Brand Categories"
        description="Manage brand categories"
        icon={<ShopOutlined />}
      />

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

      <Card>
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Row justify="space-between" align="middle">
            <Input
              placeholder="Search brand categories..."
              prefix={<SearchOutlined />}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: 280 }}
              allowClear
            />
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setCreateModalOpen(true)}
            >
              Create Category
            </Button>
          </Row>

          <Table
            columns={columns}
            dataSource={categories}
            loading={loading}
            rowKey="id"
            pagination={false}
            scroll={TABLE_SCROLL_CONFIGS.AUTO}
            locale={{
              emptyText: <Empty description="No brand categories found" />,
            }}
          />
        </Space>
      </Card>

      {/* Create Brand Category Modal */}
      <Modal
        title="Create Brand Category"
        open={createModalOpen}
        onCancel={() => {
          setCreateModalOpen(false);
          createForm.resetFields();
        }}
        onOk={() => createForm.submit()}
        okText="Create"
      >
        <Form form={createForm} layout="vertical" onFinish={handleCreate}>
          <Form.Item
            name="name"
            label="Name"
            rules={[{ required: true, message: 'Please enter category name' }]}
          >
            <Input placeholder="e.g., Electronics" />
          </Form.Item>
          <Form.Item label="Image URL">
            <Space direction="vertical" size="small" style={{ width: '100%' }}>
              <Form.Item name="imageUrl" noStyle>
                <Input placeholder="https://..." />
              </Form.Item>
              <Form.Item noStyle dependencies={['imageUrl']}>
                {() => {
                  const url = createForm.getFieldValue('imageUrl');
                  return url ? (
                    <img src={url} alt="Preview" style={{ maxWidth: '100%', maxHeight: 80, borderRadius: 4, objectFit: 'cover' }} />
                  ) : null;
                }}
              </Form.Item>
            </Space>
          </Form.Item>
          <Form.Item name="categoryId" label="Category ID">
            <Input placeholder="Optional parent category ID" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Edit Brand Category Modal */}
      <Modal
        title="Edit Brand Category"
        open={editModalOpen}
        onCancel={() => {
          setEditModalOpen(false);
          editForm.resetFields();
          setSelectedCategory(null);
        }}
        onOk={() => editForm.submit()}
        okText="Save"
      >
        <Form form={editForm} layout="vertical" onFinish={handleEdit}>
          <Form.Item
            name="name"
            label="Name"
            rules={[{ required: true, message: 'Please enter category name' }]}
          >
            <Input placeholder="e.g., Electronics" />
          </Form.Item>
          <Form.Item label="Image URL">
            <Space direction="vertical" size="small" style={{ width: '100%' }}>
              <Form.Item name="imageUrl" noStyle>
                <Input placeholder="https://..." />
              </Form.Item>
              <Form.Item noStyle dependencies={['imageUrl']}>
                {() => {
                  const url = editForm.getFieldValue('imageUrl');
                  return url ? (
                    <img src={url} alt="Preview" style={{ maxWidth: '100%', maxHeight: 80, borderRadius: 4, objectFit: 'cover' }} />
                  ) : null;
                }}
              </Form.Item>
            </Space>
          </Form.Item>
          <Form.Item name="categoryId" label="Category ID">
            <Input placeholder="Optional parent category ID" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default BrandCategories;
