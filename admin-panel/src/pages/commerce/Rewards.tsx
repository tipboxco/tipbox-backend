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
} from 'antd';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import {
  DollarOutlined,
  SearchOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';
import { type StatItemData } from '../../components/StatItem';
import ViewActionButton from '../../components/ViewActionButton';
import {
  fetchRewardStats,
  fetchRewards,
  fetchReward,
} from '../../api/admin-commerce';
import type {
  AdminRewardStatsResponse,
  AdminRewardListItem,
  AdminRewardDetailResponse,
} from '../../api/admin-commerce';
import { TABLE_COLUMN_WIDTHS, TABLE_SCROLL_CONFIGS } from '../../constants/table-widths';

const PAGE_SIZE = 20;

type RewardType = 'TIPS' | 'BADGE' | 'ACHIEVEMENT' | 'EVENT' | 'NFT' | 'LOOTBOX';

function Rewards() {
  const [stats, setStats] = useState<AdminRewardStatsResponse | null>(null);
  const [rewards, setRewards] = useState<AdminRewardListItem[]>([]);
  const [pagination, setPagination] = useState({
    total: 0,
    limit: PAGE_SIZE,
    offset: 0,
  });
  const [loading, setLoading] = useState(true);
  const [loadingList, setLoadingList] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<RewardType | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedReward, setSelectedReward] = useState<AdminRewardDetailResponse | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchRewardStats();
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

  const loadRewards = async () => {
    setLoadingList(true);
    try {
      const res = await fetchRewards({
        limit: PAGE_SIZE,
        offset: pagination.offset,
        search: search || undefined,
        type: typeFilter,
      });
      setRewards(res.data ?? []);
      if (res.pagination) setPagination(res.pagination);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load rewards');
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    loadRewards();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.offset, search, typeFilter]);

  const openDetailModal = async (id: string) => {
    setLoadingDetail(true);
    setDetailModalOpen(true);
    try {
      const res = await fetchReward(id);
      setSelectedReward(res.data);
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Failed to load reward details');
    } finally {
      setLoadingDetail(false);
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'TIPS':
        return 'green';
      case 'BADGE':
        return 'blue';
      case 'ACHIEVEMENT':
        return 'purple';
      case 'EVENT':
        return 'orange';
      case 'NFT':
        return 'gold';
      case 'LOOTBOX':
        return 'magenta';
      default:
        return 'default';
    }
  };

  const columns: ColumnsType<AdminRewardListItem> = [
    {
      title: 'User',
      dataIndex: 'username',
      key: 'username',
      width: TABLE_COLUMN_WIDTHS.MEDIUM_TEXT,
      ellipsis: true,
      render: (text, record) => text ?? record.userEmail ?? '—',
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      width: TABLE_COLUMN_WIDTHS.SHORT_TEXT,
      render: (type) => <Tag color={getTypeColor(type)}>{type}</Tag>,
    },
    {
      title: 'Amount',
      dataIndex: 'amount',
      key: 'amount',
      width: TABLE_COLUMN_WIDTHS.SHORT_TEXT,
      align: 'right',
      render: (amount, record) => {
        if (record.type === 'TIPS') {
          return `${amount?.toFixed(2) ?? '0.00'} TIPS`;
        }
        return '—';
      },
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      width: TABLE_COLUMN_WIDTHS.LONG_TEXT,
      ellipsis: true,
      render: (text) => text ?? '—',
    },
    {
      title: 'Status',
      dataIndex: 'claimed',
      key: 'claimed',
      width: TABLE_COLUMN_WIDTHS.SHORT_TEXT,
      align: 'center',
      render: (claimed) =>
        claimed ? <Tag color="green">Claimed</Tag> : <Tag color="orange">Pending</Tag>,
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
      title: 'Claimed',
      dataIndex: 'claimedAt',
      key: 'claimedAt',
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
          <ViewActionButton to={`/users/${record.userId}`} />
          <Button
            size="small"
            type="text"
            icon={<EyeOutlined />}
            onClick={() => openDetailModal(record.id)}
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
          label: 'Total',
          value: stats.total,
          icon: <DollarOutlined />,
        },
        {
          label: 'Claimed',
          value: stats.claimed,
          icon: <DollarOutlined />,
        },
        {
          label: 'Pending',
          value: stats.pending,
          icon: <DollarOutlined />,
        },
        {
          label: 'Total Value',
          value: `${stats.totalValue?.toFixed(2) ?? '0.00'} TIPS`,
          icon: <DollarOutlined />,
        },
      ]
    : undefined;

  return (
    <div>
      <PageHeader
        title="Rewards"
        description="Manage reward claims and distribution"
        icon={<DollarOutlined />}
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
                placeholder="Type"
                value={typeFilter}
                onChange={setTypeFilter}
                style={{ width: 150 }}
                allowClear
              >
                <Select.Option value="TIPS">Tips</Select.Option>
                <Select.Option value="BADGE">Badge</Select.Option>
                <Select.Option value="ACHIEVEMENT">Achievement</Select.Option>
                <Select.Option value="EVENT">Event</Select.Option>
                <Select.Option value="NFT">NFT</Select.Option>
                <Select.Option value="LOOTBOX">Lootbox</Select.Option>
              </Select>
            </Space>
          </Row>

          <Table
            columns={columns}
            dataSource={rewards}
            loading={loadingList}
            rowKey="id"
            pagination={{
              current: currentPage,
              pageSize: PAGE_SIZE,
              total: pagination.total,
              showSizeChanger: false,
              showTotal: (total) => `Total ${total} rewards`,
            }}
            onChange={handleTableChange}
            scroll={TABLE_SCROLL_CONFIGS.DEFAULT}
            locale={{
              emptyText: <Empty description="No rewards found" />,
            }}
          />
        </Space>
      </Card>

      {/* Detail Modal */}
      <Modal
        title="Reward Details"
        open={detailModalOpen}
        onCancel={() => {
          setDetailModalOpen(false);
          setSelectedReward(null);
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
          selectedReward && (
            <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
              <Descriptions bordered column={2} size="small">
                <Descriptions.Item label="User">
                  {selectedReward.username ?? selectedReward.userEmail ?? '—'}
                </Descriptions.Item>
                <Descriptions.Item label="Type">
                  <Tag color={getTypeColor(selectedReward.type)}>{selectedReward.type}</Tag>
                </Descriptions.Item>
                {selectedReward.type === 'TIPS' && selectedReward.amount && (
                  <Descriptions.Item label="Amount" span={2}>
                    {selectedReward.amount.toFixed(2)} TIPS
                  </Descriptions.Item>
                )}
                <Descriptions.Item label="Description" span={2}>
                  {selectedReward.description ?? '—'}
                </Descriptions.Item>
                <Descriptions.Item label="Status">
                  {selectedReward.claimed ? (
                    <Tag color="green">Claimed</Tag>
                  ) : (
                    <Tag color="orange">Pending</Tag>
                  )}
                </Descriptions.Item>
                <Descriptions.Item label="Created">
                  {new Date(selectedReward.createdAt).toLocaleString('en-US')}
                </Descriptions.Item>
                {selectedReward.claimedAt && (
                  <Descriptions.Item label="Claimed" span={2}>
                    {new Date(selectedReward.claimedAt).toLocaleString('en-US')}
                  </Descriptions.Item>
                )}
                {selectedReward.expiresAt && (
                  <Descriptions.Item label="Expires" span={2}>
                    {new Date(selectedReward.expiresAt).toLocaleString('en-US')}
                  </Descriptions.Item>
                )}
                {selectedReward.metadata && Object.keys(selectedReward.metadata).length > 0 && (
                  <Descriptions.Item label="Metadata" span={2}>
                    <pre style={{ margin: 0, fontSize: '12px' }}>
                      {JSON.stringify(selectedReward.metadata, null, 2)}
                    </pre>
                  </Descriptions.Item>
                )}
              </Descriptions>
            </Space>
          )
        )}
      </Modal>
    </div>
  );
}

export default Rewards;
