import { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Space,
  Button,
  Tag,
  Empty,
  Alert,
  Row,
  Modal,
  Select,
  DatePicker,
  message,
} from 'antd';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import {
  GiftOutlined,
  CheckOutlined,
  CloseOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';
import { type StatItemData } from '../../components/StatItem';
import {
  fetchRewardClaimStats,
  fetchRewardClaims,
  approveRewardClaim,
  rejectRewardClaim,
  extendRewardClaim,
} from '../../api/admin-reward-claims';
import type {
  RewardClaimStatsResponse,
  RewardClaimListItem,
} from '../../api/admin-reward-claims';
import { TABLE_COLUMN_WIDTHS, TABLE_SCROLL_CONFIGS } from '../../constants/table-widths';
import type { Dayjs } from 'dayjs';

const PAGE_SIZE = 20;

type ClaimStatus = 'PENDING' | 'CLAIMED' | 'EXPIRED' | 'REJECTED';

const STATUS_COLORS: Record<ClaimStatus, string> = {
  PENDING: 'orange',
  CLAIMED: 'green',
  EXPIRED: 'default',
  REJECTED: 'red',
};

function RewardClaims() {
  const [stats, setStats] = useState<RewardClaimStatsResponse | null>(null);
  const [claims, setClaims] = useState<RewardClaimListItem[]>([]);
  const [pagination, setPagination] = useState({
    total: 0,
    limit: PAGE_SIZE,
    offset: 0,
  });
  const [loading, setLoading] = useState(true);
  const [loadingList, setLoadingList] = useState(true);
  const [statusFilter, setStatusFilter] = useState<ClaimStatus | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [extendModalOpen, setExtendModalOpen] = useState(false);
  const [extendingClaimId, setExtendingClaimId] = useState<string | null>(null);
  const [extendDate, setExtendDate] = useState<Dayjs | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchRewardClaimStats();
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
    setLoadingList(true);
    (async () => {
      try {
        const res = await fetchRewardClaims({
          limit: PAGE_SIZE,
          offset: pagination.offset,
          status: statusFilter,
        });
        if (!cancelled) {
          setClaims(res.data ?? []);
          if (res.pagination) setPagination((p) => ({ ...p, ...res.pagination }));
        }
      } catch (e) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : 'Failed to load reward claims');
      } finally {
        if (!cancelled) setLoadingList(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pagination.offset, statusFilter]);

  const loadData = async () => {
    setLoadingList(true);
    try {
      const res = await fetchRewardClaims({
        limit: PAGE_SIZE,
        offset: pagination.offset,
        status: statusFilter,
      });
      setClaims(res.data ?? []);
      if (res.pagination) setPagination((p) => ({ ...p, ...res.pagination }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load reward claims');
    } finally {
      setLoadingList(false);
    }
  };

  const reloadStats = async () => {
    try {
      const res = await fetchRewardClaimStats();
      if (res.data) setStats(res.data);
    } catch {
      // Stats reload failure is non-critical
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await approveRewardClaim(id);
      message.success('Reward claim approved successfully');
      loadData();
      reloadStats();
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Failed to approve reward claim');
    }
  };

  const handleReject = async (id: string) => {
    try {
      await rejectRewardClaim(id);
      message.success('Reward claim rejected');
      loadData();
      reloadStats();
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Failed to reject reward claim');
    }
  };

  const openExtendModal = (id: string) => {
    setExtendingClaimId(id);
    setExtendDate(null);
    setExtendModalOpen(true);
  };

  const handleExtend = async () => {
    if (!extendingClaimId || !extendDate) {
      message.error('Please select a new expiration date');
      return;
    }
    try {
      await extendRewardClaim(extendingClaimId, extendDate.toISOString());
      message.success('Reward claim expiration extended');
      setExtendModalOpen(false);
      setExtendingClaimId(null);
      setExtendDate(null);
      loadData();
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Failed to extend reward claim');
    }
  };

  const columns: ColumnsType<RewardClaimListItem> = [
    {
      title: 'User',
      dataIndex: 'userName',
      key: 'userName',
      width: TABLE_COLUMN_WIDTHS.MEDIUM_TEXT,
      ellipsis: true,
      render: (text, record) => text || record.displayName || '—',
    },
    {
      title: 'Amount',
      dataIndex: 'amount',
      key: 'amount',
      width: TABLE_COLUMN_WIDTHS.NUMBER_MEDIUM,
      align: 'right',
      render: (amount) => (amount != null ? amount.toFixed(2) : '—'),
    },
    {
      title: 'Reward Type',
      dataIndex: 'rewardType',
      key: 'rewardType',
      width: TABLE_COLUMN_WIDTHS.SHORT_TEXT,
      ellipsis: true,
    },
    {
      title: 'Source Type',
      dataIndex: 'sourceType',
      key: 'sourceType',
      width: TABLE_COLUMN_WIDTHS.SHORT_TEXT,
      ellipsis: true,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: TABLE_COLUMN_WIDTHS.SHORT_TEXT,
      render: (status: ClaimStatus) => (
        <Tag color={STATUS_COLORS[status] ?? 'default'}>{status}</Tag>
      ),
    },
    {
      title: 'Earned At',
      dataIndex: 'earnedAt',
      key: 'earnedAt',
      width: TABLE_COLUMN_WIDTHS.DATE_SHORT,
      ellipsis: true,
      render: (date) => (date ? new Date(date).toLocaleDateString('en-US') : '—'),
    },
    {
      title: 'Expires At',
      dataIndex: 'expiresAt',
      key: 'expiresAt',
      width: TABLE_COLUMN_WIDTHS.DATE_SHORT,
      ellipsis: true,
      render: (date) => (date ? new Date(date).toLocaleDateString('en-US') : '—'),
    },
    {
      title: '',
      key: 'action',
      width: 160,
      render: (_, record) => (
        <Space size="small">
          {record.status === 'PENDING' && (
            <>
              <Button
                size="small"
                type="primary"
                style={{ backgroundColor: '#52c41a', borderColor: '#52c41a' }}
                icon={<CheckOutlined />}
                onClick={() => handleApprove(record.id)}
              >
                Approve
              </Button>
              <Button
                size="small"
                danger
                icon={<CloseOutlined />}
                onClick={() => handleReject(record.id)}
              >
                Reject
              </Button>
            </>
          )}
          <Button
            size="small"
            type="text"
            icon={<ClockCircleOutlined />}
            onClick={() => openExtendModal(record.id)}
          >
            Extend
          </Button>
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
          icon: <GiftOutlined />,
        },
        {
          label: 'Pending',
          value: stats.pending,
          icon: <ClockCircleOutlined />,
          valueColor: '#fa8c16',
        },
        {
          label: 'Claimed',
          value: stats.claimed,
          icon: <CheckOutlined />,
          valueColor: '#52c41a',
        },
        {
          label: 'Expired',
          value: stats.expired,
          icon: <ClockCircleOutlined />,
        },
        {
          label: 'Rejected',
          value: stats.rejected,
          icon: <CloseOutlined />,
          valueColor: '#ff4d4f',
        },
        {
          label: 'Total Claimed Amount',
          value: stats.totalClaimedAmount?.toFixed(2) ?? '0.00',
          icon: <GiftOutlined />,
          valueColor: '#52c41a',
        },
      ]
    : undefined;

  return (
    <div>
      <PageHeader
        title="Reward Claims"
        description="Review and manage reward claims"
        icon={<GiftOutlined />}
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
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Row justify="start" align="middle">
            <Select
              placeholder="Filter by status"
              value={statusFilter}
              onChange={(value) => {
                setStatusFilter(value);
                setPagination((p) => ({ ...p, offset: 0 }));
              }}
              style={{ width: 180 }}
              allowClear
            >
              <Select.Option value="PENDING">Pending</Select.Option>
              <Select.Option value="CLAIMED">Claimed</Select.Option>
              <Select.Option value="EXPIRED">Expired</Select.Option>
              <Select.Option value="REJECTED">Rejected</Select.Option>
            </Select>
          </Row>

          <Table
            columns={columns}
            dataSource={claims}
            loading={loadingList}
            rowKey="id"
            pagination={{
              current: currentPage,
              pageSize: PAGE_SIZE,
              total: pagination.total,
              showSizeChanger: false,
              showTotal: (total) => `Total ${total} claims`,
            }}
            onChange={handleTableChange}
            scroll={TABLE_SCROLL_CONFIGS.AUTO}
            locale={{
              emptyText: <Empty description="No reward claims found" />,
            }}
          />
        </Space>
      </Card>

      {/* Extend Expiration Modal */}
      <Modal
        title="Extend Reward Claim Expiration"
        open={extendModalOpen}
        onCancel={() => {
          setExtendModalOpen(false);
          setExtendingClaimId(null);
          setExtendDate(null);
        }}
        onOk={handleExtend}
        okText="Extend"
        okButtonProps={{ disabled: !extendDate }}
      >
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <div>Select a new expiration date for this reward claim:</div>
          <DatePicker
            showTime
            style={{ width: '100%' }}
            value={extendDate}
            onChange={(date) => setExtendDate(date)}
            placeholder="Select new expiration date"
          />
        </Space>
      </Modal>
    </div>
  );
}

export default RewardClaims;
