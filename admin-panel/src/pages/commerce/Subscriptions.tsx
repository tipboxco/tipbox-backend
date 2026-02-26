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
  Form,
  InputNumber,
} from 'antd';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import {
  CrownOutlined,
  SearchOutlined,
  EyeOutlined,
  StopOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';
import { type StatItemData } from '../../components/StatItem';
import ViewActionButton from '../../components/ViewActionButton';
import {
  fetchSubscriptionStats,
  fetchSubscriptions,
  fetchSubscription,
  extendSubscription,
} from '../../api/admin-commerce';
import type {
  AdminSubscriptionStatsResponse,
  AdminSubscriptionListItem,
  AdminSubscriptionDetailResponse,
  ExtendSubscriptionInput,
} from '../../api/admin-commerce';
import { TABLE_COLUMN_WIDTHS, TABLE_SCROLL_CONFIGS } from '../../constants/table-widths';

const PAGE_SIZE = 20;

type SubscriptionStatus = 'ACTIVE' | 'TRIALING' | 'PAST_DUE' | 'CANCELED' | 'INCOMPLETE' | 'INCOMPLETE_EXPIRED' | 'UNPAID';

function Subscriptions() {
  const [stats, setStats] = useState<AdminSubscriptionStatsResponse | null>(null);
  const [subscriptions, setSubscriptions] = useState<AdminSubscriptionListItem[]>([]);
  const [pagination, setPagination] = useState({
    total: 0,
    limit: PAGE_SIZE,
    offset: 0,
  });
  const [loading, setLoading] = useState(true);
  const [loadingList, setLoadingList] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<SubscriptionStatus | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [extendModalOpen, setExtendModalOpen] = useState(false);
  const [selectedSubscription, setSelectedSubscription] = useState<AdminSubscriptionDetailResponse | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [extendForm] = Form.useForm();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchSubscriptionStats();
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

  const loadSubscriptions = async () => {
    setLoadingList(true);
    try {
      const res = await fetchSubscriptions({
        limit: PAGE_SIZE,
        offset: pagination.offset,
        search: search || undefined,
        status: statusFilter,
      });
      setSubscriptions(res.data ?? []);
      if (res.pagination) setPagination(res.pagination);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load subscriptions');
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    loadSubscriptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.offset, search, statusFilter]);

  const openDetailModal = async (id: string) => {
    setLoadingDetail(true);
    setDetailModalOpen(true);
    try {
      const res = await fetchSubscription(id);
      setSelectedSubscription(res.data);
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Failed to load subscription details');
    } finally {
      setLoadingDetail(false);
    }
  };

  const openExtendModal = async (subscription: AdminSubscriptionListItem) => {
    try {
      const res = await fetchSubscription(subscription.id);
      setSelectedSubscription(res.data);
      setExtendModalOpen(true);
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Failed to load subscription details');
    }
  };

  const handleExtend = async (values: ExtendSubscriptionInput) => {
    if (!selectedSubscription) return;

    try {
      await extendSubscription(selectedSubscription.id, values);
      message.success('Subscription extended successfully');
      setExtendModalOpen(false);
      extendForm.resetFields();
      setSelectedSubscription(null);
      loadSubscriptions();
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Failed to extend subscription');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'green';
      case 'TRIALING':
        return 'blue';
      case 'PAST_DUE':
        return 'orange';
      case 'CANCELED':
        return 'red';
      case 'INCOMPLETE':
      case 'INCOMPLETE_EXPIRED':
        return 'default';
      case 'UNPAID':
        return 'volcano';
      default:
        return 'default';
    }
  };

  const columns: ColumnsType<AdminSubscriptionListItem> = [
    {
      title: 'User',
      dataIndex: 'username',
      key: 'username',
      width: TABLE_COLUMN_WIDTHS.MEDIUM_TEXT,
      ellipsis: true,
      render: (text, record) => text ?? record.userEmail ?? '—',
    },
    {
      title: 'Plan',
      dataIndex: 'planName',
      key: 'planName',
      width: TABLE_COLUMN_WIDTHS.MEDIUM_TEXT,
      ellipsis: true,
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
      title: 'Period',
      dataIndex: 'interval',
      key: 'interval',
      width: TABLE_COLUMN_WIDTHS.SHORT_TEXT,
      render: (interval) => interval?.toUpperCase() ?? '—',
    },
    {
      title: 'Amount',
      dataIndex: 'amount',
      key: 'amount',
      width: TABLE_COLUMN_WIDTHS.SHORT_TEXT,
      align: 'right',
      render: (amount, record) => `$${amount?.toFixed(2) ?? '0.00'}/${record.interval}`,
    },
    {
      title: 'Current Period End',
      dataIndex: 'currentPeriodEnd',
      key: 'currentPeriodEnd',
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
          {(record.status === 'ACTIVE' || record.status === 'TRIALING') && (
            <Button
              size="small"
              type="text"
              icon={<ClockCircleOutlined />}
              onClick={() => openExtendModal(record)}
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
          label: 'Total',
          value: stats.total,
          icon: <CrownOutlined />,
        },
        {
          label: 'Active',
          value: stats.active,
          icon: <CrownOutlined />,
        },
        {
          label: 'Trialing',
          value: stats.trialing,
          icon: <CrownOutlined />,
        },
        {
          label: 'Canceled',
          value: stats.canceled,
          icon: <CrownOutlined />,
        },
      ]
    : undefined;

  return (
    <div>
      <PageHeader
        title="Subscriptions"
        description="Manage user subscriptions"
        icon={<CrownOutlined />}
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
                style={{ width: 180 }}
                allowClear
              >
                <Select.Option value="ACTIVE">Active</Select.Option>
                <Select.Option value="TRIALING">Trialing</Select.Option>
                <Select.Option value="PAST_DUE">Past Due</Select.Option>
                <Select.Option value="CANCELED">Canceled</Select.Option>
                <Select.Option value="UNPAID">Unpaid</Select.Option>
              </Select>
            </Space>
          </Row>

          <Table
            columns={columns}
            dataSource={subscriptions}
            loading={loadingList}
            rowKey="id"
            pagination={{
              current: currentPage,
              pageSize: PAGE_SIZE,
              total: pagination.total,
              showSizeChanger: false,
              showTotal: (total) => `Total ${total} subscriptions`,
            }}
            onChange={handleTableChange}
            scroll={TABLE_SCROLL_CONFIGS.DEFAULT}
            locale={{
              emptyText: <Empty description="No subscriptions found" />,
            }}
          />
        </Space>
      </Card>

      {/* Detail Modal */}
      <Modal
        title="Subscription Details"
        open={detailModalOpen}
        onCancel={() => {
          setDetailModalOpen(false);
          setSelectedSubscription(null);
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
          selectedSubscription && (
            <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
              <Descriptions bordered column={2} size="small">
                <Descriptions.Item label="User">
                  {selectedSubscription.username ?? selectedSubscription.userEmail ?? '—'}
                </Descriptions.Item>
                <Descriptions.Item label="Plan">
                  {selectedSubscription.planName}
                </Descriptions.Item>
                <Descriptions.Item label="Status">
                  <Tag color={getStatusColor(selectedSubscription.status)}>
                    {selectedSubscription.status}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Amount">
                  ${selectedSubscription.amount?.toFixed(2) ?? '0.00'}/{selectedSubscription.interval}
                </Descriptions.Item>
                <Descriptions.Item label="Current Period Start">
                  {new Date(selectedSubscription.currentPeriodStart).toLocaleString('en-US')}
                </Descriptions.Item>
                <Descriptions.Item label="Current Period End">
                  {new Date(selectedSubscription.currentPeriodEnd).toLocaleString('en-US')}
                </Descriptions.Item>
                <Descriptions.Item label="Created">
                  {new Date(selectedSubscription.createdAt).toLocaleString('en-US')}
                </Descriptions.Item>
                {selectedSubscription.canceledAt && (
                  <Descriptions.Item label="Canceled">
                    {new Date(selectedSubscription.canceledAt).toLocaleString('en-US')}
                  </Descriptions.Item>
                )}
                {selectedSubscription.stripeSubscriptionId && (
                  <Descriptions.Item label="Stripe ID" span={2}>
                    <span style={{ fontFamily: 'monospace', fontSize: '12px' }}>
                      {selectedSubscription.stripeSubscriptionId}
                    </span>
                  </Descriptions.Item>
                )}
              </Descriptions>
            </Space>
          )
        )}
      </Modal>

      {/* Extend Modal */}
      <Modal
        title="Extend Subscription"
        open={extendModalOpen}
        onCancel={() => {
          setExtendModalOpen(false);
          extendForm.resetFields();
          setSelectedSubscription(null);
        }}
        onOk={() => extendForm.submit()}
        width={600}
      >
        <Alert
          message="Info"
          description="Extend the subscription period by adding additional days/months."
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
        <Form form={extendForm} layout="vertical" onFinish={handleExtend}>
          <Form.Item
            name="days"
            label="Days to Extend"
            rules={[
              { required: true, message: 'Please enter number of days' },
              { type: 'number', min: 1, message: 'Must be at least 1 day' },
            ]}
          >
            <InputNumber
              style={{ width: '100%' }}
              placeholder="Number of days"
              min={1}
            />
          </Form.Item>
          <Form.Item name="reason" label="Reason">
            <Input.TextArea rows={3} placeholder="Why is this subscription being extended?" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default Subscriptions;
