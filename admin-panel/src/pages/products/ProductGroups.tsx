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
  message,
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
import ProductGroupCreateModal from './modals/ProductGroupCreateModal';
import ProductGroupEditModal from './modals/ProductGroupEditModal';
import {
  fetchProductGroupStats,
  fetchProductGroups,
  deleteProductGroup,
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
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

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

  const handleCreateSuccess = () => {
    loadGroups();
  };

  const handleEditSuccess = () => {
    setEditModalOpen(false);
    setSelectedGroupId(null);
    loadGroups();
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

  const openEditModal = (groupId: string) => {
    setSelectedGroupId(groupId);
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
            onClick={() => openEditModal(record.id)}
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
      <ProductGroupCreateModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onSuccess={handleCreateSuccess}
      />

      {/* Edit Group Modal */}
      {selectedGroupId && (
        <ProductGroupEditModal
          open={editModalOpen}
          groupId={selectedGroupId}
          onClose={() => {
            setEditModalOpen(false);
            setSelectedGroupId(null);
          }}
          onSuccess={handleEditSuccess}
        />
      )}
    </div>
  );
}

export default ProductGroups;
