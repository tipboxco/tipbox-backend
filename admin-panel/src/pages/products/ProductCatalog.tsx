import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Card,
  Table,
  Input,
  Select,
  Space,
  Button,
  Tag,
  Empty,
  Alert,
  Row,
  Modal,
  Form,
  message,
} from 'antd';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import {
  ShoppingOutlined,
  SearchOutlined,
  PlusOutlined,
  DeleteOutlined,
  SwapOutlined,
} from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';
import StatItem, { type StatItemData } from '../../components/StatItem';
import ViewActionButton from '../../components/ViewActionButton';
import {
  fetchProductStats,
  fetchProducts,
  createProduct,
  deleteProduct,
  mergeProducts,
} from '../../api/admin-products';
import type {
  AdminProductStatsResponse,
  AdminProductListItem,
  CreateProductInput,
  MergeProductsInput,
} from '../../api/admin-products';
import { TABLE_COLUMN_WIDTHS, TABLE_SCROLL_CONFIGS } from '../../constants/table-widths';

const PAGE_SIZE = 20;

function ProductCatalog() {
  const [searchParams] = useSearchParams();
  const [stats, setStats] = useState<AdminProductStatsResponse | null>(null);
  const [products, setProducts] = useState<AdminProductListItem[]>([]);
  const [pagination, setPagination] = useState({
    total: 0,
    limit: PAGE_SIZE,
    offset: 0,
  });
  const [loading, setLoading] = useState(true);
  const [loadingList, setLoadingList] = useState(true);
  const [search, setSearch] = useState(searchParams.get('search') ?? '');
  const [categoryId, setCategoryId] = useState(searchParams.get('categoryId') ?? '');
  const [brandId, setBrandId] = useState(searchParams.get('brandId') ?? '');
  const [error, setError] = useState<string | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [mergeModalOpen, setMergeModalOpen] = useState(false);
  const [form] = Form.useForm();
  const [mergeForm] = Form.useForm();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchProductStats();
        if (!cancelled && res.data) setStats(res.data);
      } catch (e) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : 'Failed to load statistics');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadProducts = async () => {
    setLoadingList(true);
    try {
      const res = await fetchProducts({
        limit: PAGE_SIZE,
        offset: pagination.offset,
        search: search || undefined,
        categoryId: categoryId || undefined,
        brandId: brandId || undefined,
      });
      setProducts(res.data ?? []);
      if (res.pagination) setPagination(res.pagination);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load products');
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    loadProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.offset, search, categoryId, brandId]);

  const handleCreate = async (values: CreateProductInput) => {
    try {
      await createProduct(values);
      message.success('Product created successfully');
      setCreateModalOpen(false);
      form.resetFields();
      loadProducts();
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Failed to create product');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    Modal.confirm({
      title: 'Delete Product',
      content: `Are you sure you want to delete "${name}"? This action cannot be undone.`,
      okText: 'Delete',
      okType: 'danger',
      onOk: async () => {
        try {
          await deleteProduct(id);
          message.success('Product deleted successfully');
          loadProducts();
        } catch (e) {
          message.error(e instanceof Error ? e.message : 'Failed to delete product');
        }
      },
    });
  };

  const handleMerge = async (values: MergeProductsInput) => {
    try {
      await mergeProducts(values);
      message.success('Products merged successfully');
      setMergeModalOpen(false);
      mergeForm.resetFields();
      loadProducts();
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Failed to merge products');
    }
  };

  const columns: ColumnsType<AdminProductListItem> = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      width: TABLE_COLUMN_WIDTHS.LONG_TEXT,
      ellipsis: true,
    },
    {
      title: 'Sub Name',
      dataIndex: 'subName',
      key: 'subName',
      width: TABLE_COLUMN_WIDTHS.MEDIUM_TEXT,
      ellipsis: true,
      render: (text) => text ?? '—',
    },
    {
      title: 'Category',
      dataIndex: 'categoryName',
      key: 'categoryName',
      width: TABLE_COLUMN_WIDTHS.MEDIUM_TEXT,
      ellipsis: true,
      render: (text) => text ?? '—',
    },
    {
      title: 'Group',
      dataIndex: 'groupName',
      key: 'groupName',
      width: TABLE_COLUMN_WIDTHS.MEDIUM_TEXT,
      ellipsis: true,
      render: (text) => text ?? '—',
    },
    {
      title: 'Inventory',
      dataIndex: 'inventoryCount',
      key: 'inventoryCount',
      width: TABLE_COLUMN_WIDTHS.SHORT_TEXT,
      align: 'right',
    },
    {
      title: 'Posts',
      dataIndex: 'postCount',
      key: 'postCount',
      width: TABLE_COLUMN_WIDTHS.SHORT_TEXT,
      align: 'right',
    },
    {
      title: 'Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: TABLE_COLUMN_WIDTHS.DATE_SHORT,
      ellipsis: true,
      render: (date) => (date ? new Date(date).toLocaleDateString('en-US') : '—'),
    },
    {
      title: '',
      key: 'action',
      width: TABLE_COLUMN_WIDTHS.ACTION_BUTTON_DOUBLE,
      render: (_, record) => (
        <Space size="small">
          <ViewActionButton to={`/products/${record.id}`} />
          <Button
            size="small"
            type="text"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record.id, record.name)}
          />
        </Space>
      ),
    },
  ];

  const handleTableChange = (pag: TablePaginationConfig) => {
    const newOffset = ((pag.current ?? 1) - 1) * PAGE_SIZE;
    setPagination((prev) => ({ ...prev, offset: newOffset }));
  };

  const currentPage = Math.floor(pagination.offset / pagination.limit) + 1;

  const statsData: StatItemData[] | undefined = stats
    ? [
        {
          label: 'Total Products',
          value: stats.total,
          icon: <ShoppingOutlined />,
        },
        {
          label: 'Added This Month',
          value: stats.addedThisMonth,
          icon: <PlusOutlined />,
        },
        {
          label: 'Categories',
          value: stats.byCategoryCount,
          icon: <ShoppingOutlined />,
        },
      ]
    : undefined;

  return (
    <div>
      <PageHeader
        title="Product Catalog"
        description="Manage product database"
        icon={<ShoppingOutlined />}
        stats={statsData}
        statsLoading={loading}
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
        <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
          <Row justify="space-between" align="middle">
            <Space wrap>
              <Input
                placeholder="Search products..."
                prefix={<SearchOutlined />}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ width: 250 }}
                allowClear
              />
              <Select
                placeholder="Category"
                value={categoryId || undefined}
                onChange={setCategoryId}
                style={{ width: 150 }}
                allowClear
              >
                {/* Categories would be loaded from API */}
              </Select>
              <Select
                placeholder="Brand"
                value={brandId || undefined}
                onChange={setBrandId}
                style={{ width: 150 }}
                allowClear
              >
                {/* Brands would be loaded from API */}
              </Select>
            </Space>
            <Space>
              <Button icon={<SwapOutlined />} onClick={() => setMergeModalOpen(true)}>
                Merge Products
              </Button>
              <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalOpen(true)}>
                Create Product
              </Button>
            </Space>
          </Row>

          <Table
            columns={columns}
            dataSource={products}
            loading={loadingList}
            rowKey="id"
            pagination={{
              current: currentPage,
              pageSize: PAGE_SIZE,
              total: pagination.total,
              showSizeChanger: false,
              showTotal: (total) => `Total ${total} products`,
            }}
            onChange={handleTableChange}
            scroll={TABLE_SCROLL_CONFIGS.DEFAULT}
            locale={{
              emptyText: <Empty description="No products found" />,
            }}
          />
        </Space>
      </Card>

      {/* Create Product Modal */}
      <Modal
        title="Create Product"
        open={createModalOpen}
        onCancel={() => {
          setCreateModalOpen(false);
          form.resetFields();
        }}
        onOk={() => form.submit()}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item
            name="id"
            label="Product ID"
            rules={[{ required: true, message: 'Please enter product ID' }]}
          >
            <Input placeholder="e.g., airpods-pro-2" />
          </Form.Item>
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
          <Form.Item name="imageUrl" label="Image URL">
            <Input placeholder="https://..." />
          </Form.Item>
        </Form>
      </Modal>

      {/* Merge Products Modal */}
      <Modal
        title="Merge Products"
        open={mergeModalOpen}
        onCancel={() => {
          setMergeModalOpen(false);
          mergeForm.resetFields();
        }}
        onOk={() => mergeForm.submit()}
        width={500}
      >
        <Alert
          message="Warning"
          description="This will move all data from source product to target product and delete the source. This action cannot be undone."
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
        />
        <Form form={mergeForm} layout="vertical" onFinish={handleMerge}>
          <Form.Item
            name="sourceProductId"
            label="Source Product ID (will be deleted)"
            rules={[{ required: true, message: 'Please enter source product ID' }]}
          >
            <Input placeholder="Product ID to merge from" />
          </Form.Item>
          <Form.Item
            name="targetProductId"
            label="Target Product ID (will receive data)"
            rules={[{ required: true, message: 'Please enter target product ID' }]}
          >
            <Input placeholder="Product ID to merge into" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default ProductCatalog;
