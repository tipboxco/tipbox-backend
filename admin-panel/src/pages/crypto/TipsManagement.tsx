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
  Col,
  Modal,
  Form,
  InputNumber,
  Tabs,
  Typography,
  message as antdMessage,
} from 'antd';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import {
  WalletOutlined,
  SearchOutlined,
  PlusOutlined,
  SendOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
} from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';
import { type StatItemData } from '../../components/StatItem';
import ViewActionButton from '../../components/ViewActionButton';
import {
  fetchTipsStats,
  fetchTipsTransfers,
  fetchTipsAnalytics,
  createTipsTransfer,
} from '../../api/admin-crypto';
import type {
  AdminTipsStatsResponse,
  AdminTipsListItem,
  AdminTipsAnalyticsResponse,
  TipsQueryParams,
} from '../../api/admin-crypto';
import { TABLE_COLUMN_WIDTHS, TABLE_SCROLL_CONFIGS } from '../../constants/table-widths';

const { Text } = Typography;

const PAGE_SIZE = 20;

function TipsManagement() {
  // Stats
  const [stats, setStats] = useState<AdminTipsStatsResponse | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  // Transfers tab
  const [transfers, setTransfers] = useState<AdminTipsListItem[]>([]);
  const [pagination, setPagination] = useState({
    total: 0,
    limit: PAGE_SIZE,
    offset: 0,
  });
  const [loadingList, setLoadingList] = useState(true);
  const [fromUserFilter, setFromUserFilter] = useState('');
  const [toUserFilter, setToUserFilter] = useState('');
  const [minAmount, setMinAmount] = useState<number | undefined>(undefined);
  const [maxAmount, setMaxAmount] = useState<number | undefined>(undefined);

  // Analytics tab
  const [analytics, setAnalytics] = useState<AdminTipsAnalyticsResponse | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('transfers');

  // Create modal
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createForm] = Form.useForm();

  // General
  const [error, setError] = useState<string | null>(null);

  // Load stats on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchTipsStats();
        if (!cancelled && res.data) setStats(res.data);
      } catch (e) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : 'Failed to load statistics');
      } finally {
        if (!cancelled) setStatsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Load transfers
  const loadTransfers = useCallback(async () => {
    setLoadingList(true);
    try {
      const params: TipsQueryParams = {
        limit: PAGE_SIZE,
        offset: pagination.offset,
        fromUserId: fromUserFilter || undefined,
        toUserId: toUserFilter || undefined,
        minAmount: minAmount,
        maxAmount: maxAmount,
        sort: 'createdAt',
        order: 'desc',
      };
      const res = await fetchTipsTransfers(params);
      setTransfers(res.data ?? []);
      if (res.pagination) setPagination(res.pagination);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load tips transfers');
    } finally {
      setLoadingList(false);
    }
  }, [pagination.offset, fromUserFilter, toUserFilter, minAmount, maxAmount]);

  useEffect(() => {
    loadTransfers();
  }, [loadTransfers]);

  // Load analytics when tab switches
  useEffect(() => {
    if (activeTab !== 'analytics' || analytics) return;

    let cancelled = false;
    (async () => {
      setAnalyticsLoading(true);
      try {
        const res = await fetchTipsAnalytics();
        if (!cancelled && res.data) setAnalytics(res.data);
      } catch (e) {
        if (!cancelled)
          antdMessage.error(e instanceof Error ? e.message : 'Failed to load analytics');
      } finally {
        if (!cancelled) setAnalyticsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeTab, analytics]);

  // Create transfer handler
  const handleCreate = async (values: {
    fromUserId: string;
    toUserId: string;
    amount: number;
    reason?: string;
  }) => {
    try {
      await createTipsTransfer(values);
      antdMessage.success('Transfer created successfully');
      setCreateModalOpen(false);
      createForm.resetFields();
      setPagination((prev) => ({ ...prev, offset: 0 }));
      loadTransfers();
      // Refresh stats
      const statsRes = await fetchTipsStats();
      if (statsRes.data) setStats(statsRes.data);
    } catch (e) {
      antdMessage.error(e instanceof Error ? e.message : 'Failed to create transfer');
    }
  };

  // Table columns
  const columns: ColumnsType<AdminTipsListItem> = [
    {
      title: 'From User',
      dataIndex: 'fromUsername',
      key: 'fromUsername',
      width: TABLE_COLUMN_WIDTHS.MEDIUM_TEXT,
      ellipsis: true,
      render: (text, record) => text ?? record.fromUserEmail ?? '—',
    },
    {
      title: 'To User',
      dataIndex: 'toUsername',
      key: 'toUsername',
      width: TABLE_COLUMN_WIDTHS.MEDIUM_TEXT,
      ellipsis: true,
      render: (text, record) => text ?? record.toUserEmail ?? '—',
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
      title: 'Reason',
      dataIndex: 'reason',
      key: 'reason',
      width: TABLE_COLUMN_WIDTHS.LONG_TEXT_FIXED,
      ellipsis: true,
      render: (text) => text ?? '—',
    },
    {
      title: 'Created At',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: TABLE_COLUMN_WIDTHS.DATE_SHORT,
      ellipsis: true,
      render: (date) => (date ? new Date(date).toLocaleDateString('en-US') : '—'),
    },
    {
      title: '',
      key: 'action',
      width: TABLE_COLUMN_WIDTHS.ACTION_BUTTONS,
      render: (_, record) => (
        <Space size="small">
          <ViewActionButton to={`/users/${record.fromUserId}`} label="Sender" />
          <ViewActionButton to={`/users/${record.toUserId}`} label="Receiver" />
        </Space>
      ),
    },
  ];

  const handleTableChange = (pag: TablePaginationConfig) => {
    const newOffset = ((pag.current ?? 1) - 1) * PAGE_SIZE;
    setPagination((prev) => ({ ...prev, offset: newOffset }));
  };

  const currentPage = Math.floor(pagination.offset / pagination.limit) + 1;

  // Stats row
  const statsData: StatItemData[] | undefined = stats
    ? [
        {
          label: 'Total Tips',
          value: stats.total,
          icon: <SendOutlined />,
        },
        {
          label: 'Total Volume',
          value: `${stats.totalVolume?.toFixed(2) ?? '0.00'} TIPS`,
          icon: <WalletOutlined />,
        },
        {
          label: 'This Month',
          value: stats.thisMonth,
          icon: <WalletOutlined />,
        },
        {
          label: 'Avg Amount',
          value: `${stats.avgAmount?.toFixed(2) ?? '0.00'} TIPS`,
          icon: <WalletOutlined />,
        },
      ]
    : undefined;

  // Top senders table columns
  const topSendersColumns: ColumnsType<AdminTipsStatsResponse['topSenders'][number]> = [
    {
      title: '#',
      key: 'rank',
      width: 50,
      render: (_, __, index) => index + 1,
    },
    {
      title: 'Username',
      dataIndex: 'username',
      key: 'username',
      ellipsis: true,
      render: (text) => text ?? '—',
    },
    {
      title: 'Total Sent',
      dataIndex: 'totalSent',
      key: 'totalSent',
      align: 'right',
      render: (val) => (
        <Text type="danger">
          <ArrowUpOutlined /> {val?.toFixed(2) ?? '0.00'} TIPS
        </Text>
      ),
    },
    {
      title: '',
      key: 'action',
      width: TABLE_COLUMN_WIDTHS.ACTION_BUTTON,
      render: (_, record) => <ViewActionButton to={`/users/${record.userId}`} />,
    },
  ];

  // Top receivers table columns
  const topReceiversColumns: ColumnsType<AdminTipsStatsResponse['topReceivers'][number]> = [
    {
      title: '#',
      key: 'rank',
      width: 50,
      render: (_, __, index) => index + 1,
    },
    {
      title: 'Username',
      dataIndex: 'username',
      key: 'username',
      ellipsis: true,
      render: (text) => text ?? '—',
    },
    {
      title: 'Total Received',
      dataIndex: 'totalReceived',
      key: 'totalReceived',
      align: 'right',
      render: (val) => (
        <Text type="success">
          <ArrowDownOutlined /> {val?.toFixed(2) ?? '0.00'} TIPS
        </Text>
      ),
    },
    {
      title: '',
      key: 'action',
      width: TABLE_COLUMN_WIDTHS.ACTION_BUTTON,
      render: (_, record) => <ViewActionButton to={`/users/${record.userId}`} />,
    },
  ];

  // Volume by day table columns
  const volumeByDayColumns: ColumnsType<
    AdminTipsAnalyticsResponse['volumeByDay'][number]
  > = [
    {
      title: 'Date',
      dataIndex: 'date',
      key: 'date',
      width: TABLE_COLUMN_WIDTHS.DATE_SHORT,
      render: (date) => (date ? new Date(date).toLocaleDateString('en-US') : '—'),
    },
    {
      title: 'Volume',
      dataIndex: 'volume',
      key: 'volume',
      align: 'right',
      render: (val) => `${val?.toFixed(2) ?? '0.00'} TIPS`,
    },
    {
      title: 'Transfers',
      dataIndex: 'count',
      key: 'count',
      align: 'right',
    },
  ];

  // Volume by reason table columns
  const volumeByReasonColumns: ColumnsType<
    AdminTipsAnalyticsResponse['volumeByReason'][number]
  > = [
    {
      title: 'Reason',
      dataIndex: 'reason',
      key: 'reason',
      ellipsis: true,
      render: (text) => text ?? '—',
    },
    {
      title: 'Volume',
      dataIndex: 'volume',
      key: 'volume',
      align: 'right',
      render: (val) => `${val?.toFixed(2) ?? '0.00'} TIPS`,
    },
    {
      title: 'Count',
      dataIndex: 'count',
      key: 'count',
      align: 'right',
    },
  ];

  // Transfers tab content
  const transfersTab = (
    <>
      <Card>
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Row justify="space-between" align="middle">
            <Space wrap>
              <Input
                placeholder="From User ID..."
                prefix={<SearchOutlined />}
                value={fromUserFilter}
                onChange={(e) => {
                  setFromUserFilter(e.target.value);
                  setPagination((prev) => ({ ...prev, offset: 0 }));
                }}
                style={{ width: 200 }}
                allowClear
              />
              <Input
                placeholder="To User ID..."
                prefix={<SearchOutlined />}
                value={toUserFilter}
                onChange={(e) => {
                  setToUserFilter(e.target.value);
                  setPagination((prev) => ({ ...prev, offset: 0 }));
                }}
                style={{ width: 200 }}
                allowClear
              />
              <InputNumber
                placeholder="Min amount"
                value={minAmount}
                onChange={(val) => {
                  setMinAmount(val ?? undefined);
                  setPagination((prev) => ({ ...prev, offset: 0 }));
                }}
                style={{ width: 130 }}
                min={0}
                step={0.01}
              />
              <InputNumber
                placeholder="Max amount"
                value={maxAmount}
                onChange={(val) => {
                  setMaxAmount(val ?? undefined);
                  setPagination((prev) => ({ ...prev, offset: 0 }));
                }}
                style={{ width: 130 }}
                min={0}
                step={0.01}
              />
            </Space>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setCreateModalOpen(true)}
            >
              Create Transfer
            </Button>
          </Row>

          <Table
            columns={columns}
            dataSource={transfers}
            loading={loadingList}
            rowKey="id"
            pagination={{
              current: currentPage,
              pageSize: PAGE_SIZE,
              total: pagination.total,
              showSizeChanger: false,
              showTotal: (total) => `Total ${total} transfers`,
            }}
            onChange={handleTableChange}
            scroll={TABLE_SCROLL_CONFIGS.AUTO}
            locale={{
              emptyText: <Empty description="No tips transfers found" />,
            }}
          />
        </Space>
      </Card>
    </>
  );

  // Analytics tab content
  const analyticsTab = (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      {analytics && (
        <Row gutter={[16, 16]}>
          <Col span={8}>
            <Card size="small">
              <Text type="secondary">Total Volume</Text>
              <div style={{ fontSize: 24, fontWeight: 700 }}>
                {analytics.totalVolume?.toFixed(2) ?? '0.00'} TIPS
              </div>
            </Card>
          </Col>
          <Col span={8}>
            <Card size="small">
              <Text type="secondary">Total Transfers</Text>
              <div style={{ fontSize: 24, fontWeight: 700 }}>
                {analytics.totalTransfers?.toLocaleString() ?? 0}
              </div>
            </Card>
          </Col>
          <Col span={8}>
            <Card size="small">
              <Text type="secondary">Avg Transfer Amount</Text>
              <div style={{ fontSize: 24, fontWeight: 700 }}>
                {analytics.avgTransferAmount?.toFixed(2) ?? '0.00'} TIPS
              </div>
            </Card>
          </Col>
        </Row>
      )}

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card title="Top Senders" size="small" loading={analyticsLoading}>
            <Table
              columns={topSendersColumns}
              dataSource={stats?.topSenders ?? []}
              rowKey="userId"
              pagination={false}
              size="small"
              locale={{
                emptyText: <Empty description="No data" image={Empty.PRESENTED_IMAGE_SIMPLE} />,
              }}
            />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="Top Receivers" size="small" loading={analyticsLoading}>
            <Table
              columns={topReceiversColumns}
              dataSource={stats?.topReceivers ?? []}
              rowKey="userId"
              pagination={false}
              size="small"
              locale={{
                emptyText: <Empty description="No data" image={Empty.PRESENTED_IMAGE_SIMPLE} />,
              }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={14}>
          <Card title="Volume by Day" size="small" loading={analyticsLoading}>
            <Table
              columns={volumeByDayColumns}
              dataSource={analytics?.volumeByDay ?? []}
              rowKey="date"
              pagination={{ pageSize: 10, showSizeChanger: false }}
              size="small"
              locale={{
                emptyText: <Empty description="No data" image={Empty.PRESENTED_IMAGE_SIMPLE} />,
              }}
            />
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card title="Volume by Reason" size="small" loading={analyticsLoading}>
            <Table
              columns={volumeByReasonColumns}
              dataSource={analytics?.volumeByReason ?? []}
              rowKey="reason"
              pagination={{ pageSize: 10, showSizeChanger: false }}
              size="small"
              locale={{
                emptyText: <Empty description="No data" image={Empty.PRESENTED_IMAGE_SIMPLE} />,
              }}
            />
          </Card>
        </Col>
      </Row>
    </Space>
  );

  return (
    <div>
      <PageHeader
        title="Tips Management"
        description="Manage TIPS token transfers and view analytics"
        icon={<WalletOutlined />}
        stats={statsData}
        statsLoading={statsLoading}
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

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'transfers',
            label: 'Transfers',
            children: transfersTab,
          },
          {
            key: 'analytics',
            label: 'Analytics',
            children: analyticsTab,
          },
        ]}
      />

      {/* Create Transfer Modal */}
      <Modal
        title="Create Transfer"
        open={createModalOpen}
        onCancel={() => {
          setCreateModalOpen(false);
          createForm.resetFields();
        }}
        onOk={() => createForm.submit()}
        width={600}
      >
        <Alert
          message="Warning"
          description="This will directly transfer TIPS tokens between users. Use with caution."
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
        />
        <Form form={createForm} layout="vertical" onFinish={handleCreate}>
          <Form.Item
            name="fromUserId"
            label="From User ID"
            rules={[{ required: true, message: 'Please enter sender user ID' }]}
          >
            <Input placeholder="User UUID" />
          </Form.Item>
          <Form.Item
            name="toUserId"
            label="To User ID"
            rules={[{ required: true, message: 'Please enter recipient user ID' }]}
          >
            <Input placeholder="User UUID" />
          </Form.Item>
          <Form.Item
            name="amount"
            label="Amount"
            rules={[
              { required: true, message: 'Please enter amount' },
              { type: 'number', min: 0.01, message: 'Amount must be positive' },
            ]}
          >
            <InputNumber
              style={{ width: '100%' }}
              placeholder="Amount in TIPS"
              step={0.01}
              precision={2}
            />
          </Form.Item>
          <Form.Item name="reason" label="Reason">
            <Input.TextArea rows={3} placeholder="Optional reason for this transfer" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default TipsManagement;
