import { useState, useEffect, useCallback } from 'react';
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
  Tag,
  Spin,
  message,
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
  fetchBrandCategoryBrands,
} from '../../api/admin-brands';
import type {
  AdminBrandCategoryListItem,
  AdminBrandCategoryBrandItem,
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

  // Expanded row state
  const [expandedRowKeys, setExpandedRowKeys] = useState<string[]>([]);
  const [categoryBrands, setCategoryBrands] = useState<Record<string, AdminBrandCategoryBrandItem[]>>({});
  const [categoryBrandsLoading, setCategoryBrandsLoading] = useState<Record<string, boolean>>({});

  const loadCategories = async () => {
    setLoading(true);
    setError(null);
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

  const loadCategoryBrands = useCallback(async (categoryId: string) => {
    setCategoryBrandsLoading((prev) => ({ ...prev, [categoryId]: true }));
    try {
      const res = await fetchBrandCategoryBrands(categoryId);
      setCategoryBrands((prev) => ({ ...prev, [categoryId]: res.data ?? [] }));
    } catch {
      message.error('Failed to load brands for this category');
    } finally {
      setCategoryBrandsLoading((prev) => ({ ...prev, [categoryId]: false }));
    }
  }, []);

  const handleExpand = (expanded: boolean, record: AdminBrandCategoryListItem) => {
    if (expanded) {
      setExpandedRowKeys((prev) => [...prev, record.id]);
      if (!categoryBrands[record.id]) {
        loadCategoryBrands(record.id);
      }
    } else {
      setExpandedRowKeys((prev) => prev.filter((key) => key !== record.id));
    }
  };

  const handleCreate = async (values: CreateBrandCategoryInput) => {
    try {
      await createBrandCategory({
        name: values.name.trim(),
        imageUrl: values.imageUrl?.trim() || null,
        categoryId: values.categoryId?.trim() || null,
      });
      message.success('Brand category created successfully');
      setCreateModalOpen(false);
      createForm.resetFields();
      loadCategories();
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Failed to create brand category');
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
      message.success('Brand category updated successfully');
      setEditModalOpen(false);
      editForm.resetFields();
      setSelectedCategory(null);
      loadCategories();
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Failed to update brand category');
    }
  };

  const handleDelete = (record: AdminBrandCategoryListItem) => {
    Modal.confirm({
      title: 'Delete Brand Category',
      content:
        record.brandCount > 0
          ? `"${record.name}" has ${record.brandCount} brand(s) associated. Brands must be reassigned before deletion. Are you sure you want to proceed?`
          : `Are you sure you want to delete "${record.name}"?`,
      okText: 'Delete',
      okType: 'danger',
      onOk: async () => {
        try {
          await deleteBrandCategory(record.id);
          message.success('Brand category deleted successfully');
          loadCategories();
        } catch (e) {
          message.error(e instanceof Error ? e.message : 'Failed to delete brand category');
        }
      },
    });
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

  const brandColumns: ColumnsType<AdminBrandCategoryBrandItem> = [
    {
      title: 'Logo',
      dataIndex: 'logoUrl',
      key: 'logoUrl',
      width: TABLE_COLUMN_WIDTHS.IMAGE_SMALL,
      render: (url: string | null) =>
        url ? (
          <Avatar src={url} shape="square" size={32} />
        ) : (
          <Avatar icon={<PictureOutlined />} shape="square" size={32} />
        ),
    },
    {
      title: 'Brand Name',
      dataIndex: 'name',
      key: 'name',
      width: TABLE_COLUMN_WIDTHS.LONG_TEXT_FLEXIBLE,
      ellipsis: true,
    },
    {
      title: 'Popular',
      dataIndex: 'isPopular',
      key: 'isPopular',
      width: TABLE_COLUMN_WIDTHS.SHORT_TEXT,
      render: (isPopular: boolean | null) => (
        <Tag color={isPopular ? 'green' : 'default'}>
          {isPopular ? 'Popular' : 'Regular'}
        </Tag>
      ),
    },
    {
      title: 'Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: TABLE_COLUMN_WIDTHS.DATE_SHORT,
      ellipsis: true,
      render: (date: string) => (date ? new Date(date).toLocaleDateString('en-US') : '—'),
    },
  ];

  const expandedRowRender = (record: AdminBrandCategoryListItem) => {
    const brands = categoryBrands[record.id];
    const isLoading = categoryBrandsLoading[record.id];

    if (isLoading) {
      return (
        <div style={{ padding: 24, textAlign: 'center' }}>
          <Spin size="small" />
        </div>
      );
    }

    if (!brands || brands.length === 0) {
      return (
        <div style={{ padding: 16 }}>
          <Empty description="No brands in this category" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        </div>
      );
    }

    return (
      <Table
        columns={brandColumns}
        dataSource={brands}
        rowKey="id"
        pagination={false}
        size="small"
        scroll={TABLE_SCROLL_CONFIGS.AUTO}
      />
    );
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
      render: (url: string | null) =>
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
          <Button
            size="small"
            type="text"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record)}
            title="Delete category"
          />
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
          title="Error"
          description={error}
          type="error"
          closable
          onClose={() => setError(null)}
          style={{ marginBottom: 16 }}
        />
      )}

      <Card variant="outlined">
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
            expandable={{
              expandedRowKeys,
              onExpand: handleExpand,
              expandedRowRender,
              rowExpandable: (record) => record.brandCount > 0,
            }}
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
