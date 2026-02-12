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
  TransactionOutlined,
  SearchOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';
import { type StatItemData } from '../../components/StatItem';
import ViewActionButton from '../../components/ViewActionButton';
import {
  fetchTransactionStats,
  fetchTransactions,
  fetchTransaction,
} from '../../api/admin-commerce';
import type {
  AdminTransactionStatsResponse,
  AdminTransactionListItem,
  AdminTransactionDetailResponse,
} from '../../api/admin-commerce';
import { TABLE_COLUMN_WIDTHS, TABLE_SCROLL_CONFIGS } from '../../constants/table-widths';

const PAGE_SIZE = 20;

type TransactionType = 'DEPOSIT' | 'WITHDRAWAL' | 'TRANSFER' | 'REWARD' | 'PURCHASE' | 'REFUND';
type TransactionStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'CANCELED';

function Transactions() {
  const [stats, setStats] = useState<AdminTransactionStatsResponse | null>(null);
  const [transactions, setTransactions] = useState<AdminTransactionListItem[]>([]);
  const [pagination, setPagination] = useState({
    total: 0,
    limit: PAGE_SIZE,
    offset: 0,
  });
  const [loading, setLoading] = useState(true);
  const [loadingList, setLoadingList] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<TransactionType | undefined>(undefined);
  const [statusFilter, setStatusFilter] = useState<TransactionStatus | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<AdminTransactionDetailResponse | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchTransactionStats();
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

  const loadTransactions = async () => {
    setLoadingList(true);
    try {
      const res = await fetchTransactions({
        limit: PAGE_SIZE,
        offset: pagination.offset,
        search: search || undefined,
        type: typeFilter,
        status: statusFilter,
      });
      setTransactions(res.data ?? []);
      if (res.pagination) setPagination(res.pagination);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load transactions');
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    loadTransactions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.offset, search, typeFilter, statusFilter]);

  const openDetailModal = async (id: string) => {
    setLoadingDetail(true);
    setDetailModalOpen(true);
    try {
      const res = await fetchTransaction(id);
      setSelectedTransaction(res.data);
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Failed to load transaction details');
    } finally {
      setLoadingDetail(false);
    }
  };

  const truncateHash = (hash: string) => {
    if (!hash) return '—';
    return `${hash.slice(0, 8)}...${hash.slice(-6)}`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'green';
      case 'PENDING':
        return 'blue';
      case 'FAILED':
        return 'red';
      case 'CANCELED':
        return 'orange';
      default:
        return 'default';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'DEPOSIT':
        return 'green';
      case 'WITHDRAWAL':
        return 'red';
      case 'TRANSFER':
        return 'blue';
      case 'REWARD':
        return 'gold';
      case 'PURCHASE':
        return 'purple';
      case 'REFUND':
        return 'orange';
      default:
        return 'default';
    }
  };

  const columns: ColumnsType<AdminTransactionListItem> = [
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
      render: (amount) => `${amount?.toFixed(2) ?? '0.00'} TIPS`,
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
      title: 'TX Hash',
      dataIndex: 'txHash',
      key: 'txHash',
      width: TABLE_COLUMN_WIDTHS.MEDIUM_TEXT,
      ellipsis: true,
      render: (hash) => (
        <span title={hash} style={{ fontFamily: 'monospace', fontSize: '12px' }}>
          {truncateHash(hash)}
        </span>
      ),
    },
    {
      title: 'Date',
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
          icon: <TransactionOutlined />,
        },
        {
          label: 'Completed',
          value: stats.completed,
          icon: <TransactionOutlined />,
        },
        {
          label: 'Pending',
          value: stats.pending,
          icon: <TransactionOutlined />,
        },
        {
          label: 'Total Volume',
          value: `${stats.totalVolume?.toFixed(2) ?? '0.00'} TIPS`,
          icon: <TransactionOutlined />,
        },
      ]
    : undefined;

  return (
    <div>
      <PageHeader
        title="Transactions"
        description="View all platform transactions"
        icon={<TransactionOutlined />}
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
                <Select.Option value="DEPOSIT">Deposit</Select.Option>
                <Select.Option value="WITHDRAWAL">Withdrawal</Select.Option>
                <Select.Option value="TRANSFER">Transfer</Select.Option>
                <Select.Option value="REWARD">Reward</Select.Option>
                <Select.Option value="PURCHASE">Purchase</Select.Option>
                <Select.Option value="REFUND">Refund</Select.Option>
              </Select>
              <Select
                placeholder="Status"
                value={statusFilter}
                onChange={setStatusFilter}
                style={{ width: 150 }}
                allowClear
              >
                <Select.Option value="PENDING">Pending</Select.Option>
                <Select.Option value="COMPLETED">Completed</Select.Option>
                <Select.Option value="FAILED">Failed</Select.Option>
                <Select.Option value="CANCELED">Canceled</Select.Option>
              </Select>
            </Space>
          </Row>

          <Table
            columns={columns}
            dataSource={transactions}
            loading={loadingList}
            rowKey="id"
            pagination={{
              current: currentPage,
              pageSize: PAGE_SIZE,
              total: pagination.total,
              showSizeChanger: false,
              showTotal: (total) => `Total ${total} transactions`,
            }}
            onChange={handleTableChange}
            scroll={TABLE_SCROLL_CONFIGS.DEFAULT}
            locale={{
              emptyText: <Empty description="No transactions found" />,
            }}
          />
        </Space>
      </Card>

      {/* Detail Modal */}
      <Modal
        title="Transaction Details"
        open={detailModalOpen}
        onCancel={() => {
          setDetailModalOpen(false);
          setSelectedTransaction(null);
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
          selectedTransaction && (
            <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
              <Descriptions bordered column={2} size="small">
                <Descriptions.Item label="User">
                  {selectedTransaction.username ?? selectedTransaction.userEmail ?? '—'}
                </Descriptions.Item>
                <Descriptions.Item label="Type">
                  <Tag color={getTypeColor(selectedTransaction.type)}>
                    {selectedTransaction.type}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Amount">
                  {selectedTransaction.amount?.toFixed(2) ?? '0.00'} TIPS
                </Descriptions.Item>
                <Descriptions.Item label="Status">
                  <Tag color={getStatusColor(selectedTransaction.status)}>
                    {selectedTransaction.status}
                  </Tag>
                </Descriptions.Item>
                {selectedTransaction.txHash && (
                  <Descriptions.Item label="TX Hash" span={2}>
                    <span style={{ fontFamily: 'monospace', fontSize: '12px' }}>
                      {selectedTransaction.txHash}
                    </span>
                  </Descriptions.Item>
                )}
                {selectedTransaction.description && (
                  <Descriptions.Item label="Description" span={2}>
                    {selectedTransaction.description}
                  </Descriptions.Item>
                )}
                <Descriptions.Item label="Created">
                  {new Date(selectedTransaction.createdAt).toLocaleString('en-US')}
                </Descriptions.Item>
                {selectedTransaction.completedAt && (
                  <Descriptions.Item label="Completed">
                    {new Date(selectedTransaction.completedAt).toLocaleString('en-US')}
                  </Descriptions.Item>
                )}
                {selectedTransaction.metadata && Object.keys(selectedTransaction.metadata).length > 0 && (
                  <Descriptions.Item label="Metadata" span={2}>
                    <pre style={{ margin: 0, fontSize: '12px' }}>
                      {JSON.stringify(selectedTransaction.metadata, null, 2)}
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

export default Transactions;
