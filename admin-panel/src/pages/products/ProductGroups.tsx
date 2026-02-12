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
  message,
  Select,
} from 'antd';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import {
  FolderOpenOutlined,
  SearchOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';
import { type StatItemData } from '../../components/StatItem';
import {
  fetchProductGroupStats,
  fetchProductGroups,
  createProductGroup,
  updateProductGroup,
  deleteProductGroup,
  fetchCategories,
} from '../../api/admin-products';
import type {
  AdminProductGroupStatsResponse,
  AdminProductGroupListItem,
  CreateProductGroupInput,
  UpdateProductGroupInput,
} from '../../api/admin-products';
import { TABLE_COLUMN_WIDTHS, TABLE_SCROLL_CONFIGS } from '../../constants/table-widths';

const PAGE_SIZE = 20;

function ProductGroups() {
  const [stats, setStats] = useState<AdminProductGroupStatsResponse | null>(null);
  const [groups, setGroups] = useState<AdminProductGroupListItem[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [pagination, setPagination] = useState({
    total: 0,
    limit: PAGE_SIZE,
    offset: 0,
  });
  const [loading, setLoading] = useState(true);
  const [loadingList, setLoadingList] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<AdminProductGroupListItem | null>(null);
  const [form] = Form.useForm();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchProductGroupStats();
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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchCategories();
        if (!cancelled && res.data) {
          setCategories(res.data.map(cat => ({ id: cat.id, name: cat.name })));
        }
      } catch (e) {
        // Categories are optional, just log error
        console.error('Failed to load categories:', e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadGroups = async () => {
    setLoadingList(true);
    try {
      const res = await fetchProductGroups({
        limit: PAGE_SIZE,
        offset: pagination.offset,
        search: search || undefined,
      });
      setGroups(res.data ?? []);
      if (res.pagination) setPagination(res.pagination);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load groups');
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    loadGroups();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.offset, search]);

  const handleCreate = async (values: CreateProductGroupInput) => {
    try {
      await createProductGroup({
        ...values,
        subcategoryId: values.subcategoryId || null,
      });
      message.success('Product group created successfully');
      setCreateModalOpen(false);
      form.resetFields();
      loadGroups();
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Failed to create group');
    }
  };

  const handleEdit = async (values: UpdateProductGroupInput) => {
    if (!selectedGroup) return;

    try {
      await updateProductGroup(selectedGroup.id, {
        ...values,
        subcategoryId: values.subcategoryId || null,
      });
      message.success('Product group updated successfully');
      setEditModalOpen(false);
      form.resetFields();
      setSelectedGroup(null);
      loadGroups();
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Failed to update group');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    Modal.confirm({
      title: 'Delete Product Group',
      content: `Are you sure you want to delete "${name}"? This action cannot be undone.`,
      okText: 'Delete',
      okType: 'danger',
      onOk: async () => {
        try {
          await deleteProductGroup(id);
          message.success('Product group deleted successfully');
          loadGroups();
        } catch (e) {
          message.error(e instanceof Error ? e.message : 'Failed to delete group');
        }
      },
    });
  };

  const openEditModal = (group: AdminProductGroupListItem) => {
    setSelectedGroup(group);
    form.setFieldsValue({
      name: group.name,
      subcategoryId: group.subcategoryId || undefined,
    });
    setEditModalOpen(true);
  };

  const columns: ColumnsType<AdminProductGroupListItem> = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      width: TABLE_COLUMN_WIDTHS.LONG_TEXT,
      ellipsis: true,
    },
    {
      title: 'Subcategory',
      dataIndex: 'subcategoryName',
      key: 'subcategoryName',
      width: TABLE_COLUMN_WIDTHS.MEDIUM_TEXT,
      ellipsis: true,
      render: (text) => text ?? '—',
    },
    {
      title: 'Products',
      dataIndex: 'productCount',
      key: 'productCount',
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
          <Button
            size="small"
            type="text"
            icon={<EditOutlined />}
            onClick={() => openEditModal(record)}
          />
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
          label: 'Total Groups',
          value: stats.total,
          icon: <FolderOpenOutlined />,
        },
        {
          label: 'With Products',
          value: stats.withProducts,
          icon: <FolderOpenOutlined />,
        },
        {
          label: 'Most Popular',
          value: stats.mostPopular?.name ?? '—',
          icon: <FolderOpenOutlined />,
        },
      ]
    : undefined;

  return (
    <div>
      <PageHeader
        title="Product Groups"
        description="Organize products into groups"
        icon={<FolderOpenOutlined />}
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
            <Input
              placeholder="Search groups..."
              prefix={<SearchOutlined />}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: 250 }}
              allowClear
            />
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalOpen(true)}>
              Create Group
            </Button>
          </Row>

          <Table
            columns={columns}
            dataSource={groups}
            loading={loadingList}
            rowKey="id"
            pagination={{
              current: currentPage,
              pageSize: PAGE_SIZE,
              total: pagination.total,
              showSizeChanger: false,
              showTotal: (total) => `Total ${total} groups`,
            }}
            onChange={handleTableChange}
            scroll={TABLE_SCROLL_CONFIGS.DEFAULT}
            locale={{
              emptyText: <Empty description="No product groups found" />,
            }}
          />
        </Space>
      </Card>

      {/* Create Group Modal */}
      <Modal
        title="Create Product Group"
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
            name="name"
            label="Group Name"
            rules={[{ required: true, message: 'Please enter group name' }]}
          >
            <Input placeholder="e.g., Apple Laptops" />
          </Form.Item>
          <Form.Item name="subcategoryId" label="Subcategory">
            <Select
              placeholder="Select subcategory (optional)"
              allowClear
              showSearch
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              options={categories.map(cat => ({ label: cat.name, value: cat.id }))}
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* Edit Group Modal */}
      <Modal
        title="Edit Product Group"
        open={editModalOpen}
        onCancel={() => {
          setEditModalOpen(false);
          form.resetFields();
          setSelectedGroup(null);
        }}
        onOk={() => form.submit()}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleEdit}>
          <Form.Item
            name="name"
            label="Group Name"
            rules={[{ required: true, message: 'Please enter group name' }]}
          >
            <Input placeholder="e.g., Apple Laptops" />
          </Form.Item>
          <Form.Item name="subcategoryId" label="Subcategory">
            <Select
              placeholder="Select subcategory (optional)"
              allowClear
              showSearch
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              options={categories.map(cat => ({ label: cat.name, value: cat.id }))}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default ProductGroups;
