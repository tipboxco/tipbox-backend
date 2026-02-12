import { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Input,
  Space,
  Button,
  Tag,
  Empty,
  Alert,
  Row,
  Modal,
  Select,
  Descriptions,
  message,
  List,
} from 'antd';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import {
  GiftOutlined,
  SearchOutlined,
  EyeOutlined,
  UnlockOutlined,
} from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';
import { type StatItemData } from '../../components/StatItem';
import ViewActionButton from '../../components/ViewActionButton';
import {
  fetchLootboxStats,
  fetchLootboxes,
  fetchLootbox,
  openLootbox,
} from '../../api/admin-crypto';
import type {
  AdminLootboxStatsResponse,
  AdminLootboxListItem,
  AdminLootboxDetailResponse,
} from '../../api/admin-crypto';
import { TABLE_COLUMN_WIDTHS, TABLE_SCROLL_CONFIGS } from '../../constants/table-widths';

const PAGE_SIZE = 20;

type LootboxStatus = 'LOCKED' | 'OPENABLE' | 'CLAIMED';

function Lootboxes() {
  const [stats, setStats] = useState<AdminLootboxStatsResponse | null>(null);
  const [lootboxes, setLootboxes] = useState<AdminLootboxListItem[]>([]);
  const [pagination, setPagination] = useState({
    total: 0,
    limit: PAGE_SIZE,
    offset: 0,
  });
  const [loading, setLoading] = useState(true);
  const [loadingList, setLoadingList] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<LootboxStatus | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedLootbox, setSelectedLootbox] = useState<AdminLootboxDetailResponse | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchLootboxStats();
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

  const loadLootboxes = async () => {
    setLoadingList(true);
    try {
      const res = await fetchLootboxes({
        limit: PAGE_SIZE,
        offset: pagination.offset,
        search: search || undefined,
        status: statusFilter,
      });
      setLootboxes(res.data ?? []);
      if (res.pagination) setPagination(res.pagination);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load lootboxes');
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    loadLootboxes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.offset, search, statusFilter]);

  const openDetailModal = async (id: string) => {
    setLoadingDetail(true);
    setDetailModalOpen(true);
    try {
      const res = await fetchLootbox(id);
      setSelectedLootbox(res.data);
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Failed to load lootbox details');
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleForceOpen = async (id: string, username: string) => {
    Modal.confirm({
      title: 'Force Open Lootbox',
      content: `Are you sure you want to force open ${username}'s lootbox? This will reveal the contents.`,
      okText: 'Open',
      okType: 'primary',
      onOk: async () => {
        try {
          await openLootbox(id);
          message.success('Lootbox opened successfully');
          loadLootboxes();
        } catch (e) {
          message.error(e instanceof Error ? e.message : 'Failed to open lootbox');
        }
      },
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'LOCKED':
        return 'red';
      case 'OPENABLE':
        return 'orange';
      case 'CLAIMED':
        return 'green';
      default:
        return 'default';
    }
  };

  const columns: ColumnsType<AdminLootboxListItem> = [
    {
      title: 'User',
      dataIndex: 'username',
      key: 'username',
      width: TABLE_COLUMN_WIDTHS.MEDIUM_TEXT,
      ellipsis: true,
      render: (text, record) => text ?? record.userEmail ?? '—',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: TABLE_COLUMN_WIDTHS.SHORT_TEXT,
      align: 'center',
      render: (status) => <Tag color={getStatusColor(status)}>{status}</Tag>,
    },
    {
      title: 'Acquired',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: TABLE_COLUMN_WIDTHS.DATE_SHORT,
      ellipsis: true,
      render: (date) => (date ? new Date(date).toLocaleDateString('en-US') : '—'),
    },
    {
      title: 'Opened',
      dataIndex: 'openedAt',
      key: 'openedAt',
      width: TABLE_COLUMN_WIDTHS.DATE_SHORT,
      ellipsis: true,
      render: (date) => (date ? new Date(date).toLocaleDateString('en-US') : '—'),
    },
    {
      title: '',
      key: 'action',
      width: TABLE_COLUMN_WIDTHS.ACTION_BUTTON_TRIPLE,
      render: (_, record) => (
        <Space size="small">
          <ViewActionButton to={`/users/${record.userId}`} />
          <Button
            size="small"
            type="text"
            icon={<EyeOutlined />}
            onClick={() => openDetailModal(record.id)}
          />
          {record.status === 'OPENABLE' && (
            <Button
              size="small"
              type="text"
              icon={<UnlockOutlined />}
              onClick={() => handleForceOpen(record.id, record.username ?? record.userEmail ?? 'this user')}
            />
          )}
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
          label: 'Total Lootboxes',
          value: stats.total,
          icon: <GiftOutlined />,
        },
        {
          label: 'Opened',
          value: stats.opened,
          icon: <GiftOutlined />,
        },
        {
          label: 'Unopened',
          value: stats.unopened,
          icon: <GiftOutlined />,
        },
        {
          label: 'Claimed',
          value: stats.claimed,
          icon: <GiftOutlined />,
        },
      ]
    : undefined;

  return (
    <div>
      <PageHeader
        title="Lootboxes"
        description="Manage lootbox system"
        icon={<GiftOutlined />}
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

      <Card>
        <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
          <Row justify="space-between" align="middle">
            <Space wrap>
              <Input
                placeholder="Search users..."
                prefix={<SearchOutlined />}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ width: 250 }}
                allowClear
              />
              <Select
                placeholder="Status"
                value={statusFilter}
                onChange={setStatusFilter}
                style={{ width: 150 }}
                allowClear
              >
                <Select.Option value="LOCKED">Locked</Select.Option>
                <Select.Option value="OPENABLE">Openable</Select.Option>
                <Select.Option value="CLAIMED">Claimed</Select.Option>
              </Select>
            </Space>
          </Row>

          <Table
            columns={columns}
            dataSource={lootboxes}
            loading={loadingList}
            rowKey="id"
            pagination={{
              current: currentPage,
              pageSize: PAGE_SIZE,
              total: pagination.total,
              showSizeChanger: false,
              showTotal: (total) => `Total ${total} lootboxes`,
            }}
            onChange={handleTableChange}
            scroll={TABLE_SCROLL_CONFIGS.DEFAULT}
            locale={{
              emptyText: <Empty description="No lootboxes found" />,
            }}
          />
        </Space>
      </Card>

      {/* Detail Modal */}
      <Modal
        title="Lootbox Details"
        open={detailModalOpen}
        onCancel={() => {
          setDetailModalOpen(false);
          setSelectedLootbox(null);
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
          selectedLootbox && (
            <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
              <Descriptions bordered column={2} size="small">
                <Descriptions.Item label="User">
                  {selectedLootbox.username ?? selectedLootbox.userEmail ?? '—'}
                </Descriptions.Item>
                <Descriptions.Item label="Status">
                  <Tag color={getStatusColor(selectedLootbox.status)}>{selectedLootbox.status}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Acquired">
                  {new Date(selectedLootbox.createdAt).toLocaleString('en-US')}
                </Descriptions.Item>
                {selectedLootbox.openedAt && (
                  <Descriptions.Item label="Opened">
                    {new Date(selectedLootbox.openedAt).toLocaleString('en-US')}
                  </Descriptions.Item>
                )}
              </Descriptions>

              {selectedLootbox.contents && selectedLootbox.contents.length > 0 && (
                <Card title="Contents" size="small">
                  <List
                    dataSource={selectedLootbox.contents}
                    renderItem={(item) => (
                      <List.Item>
                        <List.Item.Meta
                          title={item.itemName ?? 'Unknown Item'}
                          description={
                            <Space orientation="vertical" size="small">
                              <div>Type: {item.itemType}</div>
                              {item.quantity && <div>Quantity: {item.quantity}</div>}
                            </Space>
                          }
                        />
                      </List.Item>
                    )}
                  />
                </Card>
              )}

              {selectedLootbox.status === 'LOCKED' && (
                <Alert
                  message="Locked"
                  description="This lootbox is still locked and cannot be opened yet."
                  type="warning"
                  showIcon
                />
              )}
            </Space>
          )
        )}
      </Modal>
    </div>
  );
}

export default Lootboxes;
