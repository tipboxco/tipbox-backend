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
  Select,
  Tag,
  Timeline,
  Image,
} from 'antd';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import {
  UnorderedListOutlined,
  SearchOutlined,
  EyeOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';
import { type StatItemData } from '../../components/StatItem';
import ViewActionButton from '../../components/ViewActionButton';
import {
  fetchInventoryStats,
  fetchInventories,
  fetchInventory,
} from '../../api/admin-products';
import type {
  AdminInventoryStatsResponse,
  AdminInventoryListItem,
  AdminInventoryDetailResponse,
} from '../../api/admin-products';
import { TABLE_COLUMN_WIDTHS, TABLE_SCROLL_CONFIGS } from '../../constants/table-widths';

const PAGE_SIZE = 20;

function UserInventories() {
  const [stats, setStats] = useState<AdminInventoryStatsResponse | null>(null);
  const [inventories, setInventories] = useState<AdminInventoryListItem[]>([]);
  const [pagination, setPagination] = useState({
    total: 0,
    limit: PAGE_SIZE,
    offset: 0,
  });
  const [loading, setLoading] = useState(true);
  const [loadingList, setLoadingList] = useState(true);
  const [search, setSearch] = useState('');
  const [experienceType, setExperienceType] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedInventory, setSelectedInventory] = useState<AdminInventoryDetailResponse | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchInventoryStats();
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

  const loadInventories = async () => {
    setLoadingList(true);
    try {
      const res = await fetchInventories({
        limit: PAGE_SIZE,
        offset: pagination.offset,
        search: search || undefined,
        experienceType: experienceType,
      });
      setInventories(res.data ?? []);
      if (res.pagination) setPagination(res.pagination);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load inventories');
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    loadInventories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.offset, search, experienceType]);

  const openDetailModal = async (id: string) => {
    setLoadingDetail(true);
    setDetailModalOpen(true);
    try {
      const res = await fetchInventory(id);
      setSelectedInventory(res.data);
    } catch (e) {
      Alert.error({
        title: 'Error',
        content: e instanceof Error ? e.message : 'Failed to load inventory details',
      });
    } finally {
      setLoadingDetail(false);
    }
  };

  const getExperienceTypeTag = (type: string | null) => {
    if (!type) return '—';
    switch (type.toUpperCase()) {
      case 'OWNED':
        return <Tag color="green">Owned</Tag>;
      case 'TESTED':
        return <Tag color="blue">Tested</Tag>;
      case 'RENTED':
        return <Tag color="orange">Rented</Tag>;
      case 'BORROWED':
        return <Tag color="purple">Borrowed</Tag>;
      default:
        return <Tag>{type}</Tag>;
    }
  };

  const columns: ColumnsType<AdminInventoryListItem> = [
    {
      title: 'User',
      dataIndex: 'username',
      key: 'username',
      width: TABLE_COLUMN_WIDTHS.MEDIUM_TEXT,
      ellipsis: true,
      render: (text, record) => text ?? record.userEmail ?? '—',
    },
    {
      title: 'Product',
      dataIndex: 'productName',
      key: 'productName',
      width: TABLE_COLUMN_WIDTHS.LONG_TEXT,
      ellipsis: true,
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
      title: 'Experience',
      dataIndex: 'experienceType',
      key: 'experienceType',
      width: TABLE_COLUMN_WIDTHS.SHORT_TEXT,
      render: (type) => getExperienceTypeTag(type),
    },
    {
      title: 'Duration',
      dataIndex: 'duration',
      key: 'duration',
      width: TABLE_COLUMN_WIDTHS.SHORT_TEXT,
      render: (duration) => duration ?? '—',
    },
    {
      title: 'Location',
      dataIndex: 'location',
      key: 'location',
      width: TABLE_COLUMN_WIDTHS.MEDIUM_TEXT,
      ellipsis: true,
      render: (text) => text ?? '—',
    },
    {
      title: 'Active',
      dataIndex: 'isActive',
      key: 'isActive',
      width: TABLE_COLUMN_WIDTHS.SHORT_TEXT,
      align: 'center',
      render: (isActive) => (isActive ? <Tag color="green">Yes</Tag> : <Tag>No</Tag>),
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
            icon={<EyeOutlined />}
            onClick={() => openDetailModal(record.id)}
          />
          <ViewActionButton to={`/users/${record.userId}`} />
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
          label: 'Total Inventories',
          value: stats.total,
          icon: <UnorderedListOutlined />,
        },
        {
          label: 'Unique Users',
          value: stats.uniqueUsers,
          icon: <UnorderedListOutlined />,
        },
        {
          label: 'Unique Products',
          value: stats.uniqueProducts,
          icon: <UnorderedListOutlined />,
        },
        {
          label: 'Avg Duration',
          value: stats.avgDuration ?? '—',
          icon: <ClockCircleOutlined />,
        },
      ]
    : undefined;

  return (
    <div>
      <PageHeader
        title="User Inventories"
        description="View user product ownership"
        icon={<UnorderedListOutlined />}
        statsData={statsData}
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

      <Card bordered={false}>
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Row justify="space-between" align="middle">
            <Space wrap>
              <Input
                placeholder="Search user or product..."
                prefix={<SearchOutlined />}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ width: 250 }}
                allowClear
              />
              <Select
                placeholder="Experience Type"
                value={experienceType}
                onChange={setExperienceType}
                style={{ width: 150 }}
                allowClear
              >
                <Select.Option value="OWNED">Owned</Select.Option>
                <Select.Option value="TESTED">Tested</Select.Option>
                <Select.Option value="RENTED">Rented</Select.Option>
                <Select.Option value="BORROWED">Borrowed</Select.Option>
              </Select>
            </Space>
          </Row>

          <Table
            columns={columns}
            dataSource={inventories}
            loading={loadingList}
            rowKey="id"
            pagination={{
              current: currentPage,
              pageSize: PAGE_SIZE,
              total: pagination.total,
              showSizeChanger: false,
              showTotal: (total) => `Total ${total} inventories`,
            }}
            onChange={handleTableChange}
            scroll={TABLE_SCROLL_CONFIGS.DEFAULT}
            locale={{
              emptyText: <Empty description="No user inventories found" />,
            }}
          />
        </Space>
      </Card>

      {/* Detail Modal */}
      <Modal
        title="Inventory Details"
        open={detailModalOpen}
        onCancel={() => {
          setDetailModalOpen(false);
          setSelectedInventory(null);
        }}
        footer={[
          <Button key="close" onClick={() => setDetailModalOpen(false)}>
            Close
          </Button>,
        ]}
        width={800}
      >
        {loadingDetail ? (
          <div style={{ textAlign: 'center', padding: '20px' }}>Loading...</div>
        ) : (
          selectedInventory && (
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <div>
                <strong>User:</strong>{' '}
                {selectedInventory.username ?? selectedInventory.userEmail ?? '—'}
              </div>
              <div>
                <strong>Product:</strong> {selectedInventory.productName}
              </div>
              {selectedInventory.categoryName && (
                <div>
                  <strong>Category:</strong> {selectedInventory.categoryName}
                </div>
              )}
              <div>
                <strong>Experience Type:</strong>{' '}
                {getExperienceTypeTag(selectedInventory.experienceType)}
              </div>
              {selectedInventory.duration && (
                <div>
                  <strong>Duration:</strong> {selectedInventory.duration}
                </div>
              )}
              {selectedInventory.location && (
                <div>
                  <strong>Location:</strong> {selectedInventory.location}
                </div>
              )}
              {selectedInventory.purpose && (
                <div>
                  <strong>Purpose:</strong> {selectedInventory.purpose}
                </div>
              )}
              <div>
                <strong>Active:</strong>{' '}
                {selectedInventory.isActive ? <Tag color="green">Yes</Tag> : <Tag>No</Tag>}
              </div>
              {selectedInventory.isLegacy && (
                <div>
                  <Tag color="orange">Legacy Inventory</Tag>
                </div>
              )}
              <div>
                <strong>Created:</strong>{' '}
                {new Date(selectedInventory.createdAt).toLocaleString('en-US')}
              </div>
              <div>
                <strong>Updated:</strong>{' '}
                {new Date(selectedInventory.updatedAt).toLocaleString('en-US')}
              </div>

              {selectedInventory.media && selectedInventory.media.length > 0 && (
                <>
                  <div>
                    <strong>Media:</strong>
                  </div>
                  <Image.PreviewGroup>
                    <Space wrap>
                      {selectedInventory.media.map((media) => (
                        <Image
                          key={media.id}
                          width={100}
                          height={100}
                          src={media.url}
                          alt="Inventory media"
                          style={{ objectFit: 'cover' }}
                        />
                      ))}
                    </Space>
                  </Image.PreviewGroup>
                </>
              )}

              {selectedInventory.history && selectedInventory.history.length > 0 && (
                <>
                  <div>
                    <strong>History:</strong>
                  </div>
                  <Timeline
                    items={selectedInventory.history.map((entry) => ({
                      children: (
                        <div>
                          <div>
                            <strong>{entry.action}</strong>
                          </div>
                          {entry.details && <div>{entry.details}</div>}
                          <div style={{ fontSize: '12px', color: '#888' }}>
                            {new Date(entry.timestamp).toLocaleString('en-US')}
                          </div>
                        </div>
                      ),
                    }))}
                  />
                </>
              )}
            </Space>
          )
        )}
      </Modal>
    </div>
  );
}

export default UserInventories;
