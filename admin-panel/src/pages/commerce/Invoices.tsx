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
  FileTextOutlined,
  SearchOutlined,
  EyeOutlined,
  SendOutlined,
} from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';
import { type StatItemData } from '../../components/StatItem';
import ViewActionButton from '../../components/ViewActionButton';
import {
  fetchInvoiceStats,
  fetchInvoices,
  fetchInvoice,
  resendInvoice,
} from '../../api/admin-commerce';
import type {
  AdminInvoiceStatsResponse,
  AdminInvoiceListItem,
  AdminInvoiceDetailResponse,
} from '../../api/admin-commerce';
import { TABLE_COLUMN_WIDTHS, TABLE_SCROLL_CONFIGS } from '../../constants/table-widths';

const PAGE_SIZE = 20;

type InvoiceStatus = 'DRAFT' | 'OPEN' | 'PAID' | 'VOID' | 'UNCOLLECTIBLE';

function Invoices() {
  const [stats, setStats] = useState<AdminInvoiceStatsResponse | null>(null);
  const [invoices, setInvoices] = useState<AdminInvoiceListItem[]>([]);
  const [pagination, setPagination] = useState({
    total: 0,
    limit: PAGE_SIZE,
    offset: 0,
  });
  const [loading, setLoading] = useState(true);
  const [loadingList, setLoadingList] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<AdminInvoiceDetailResponse | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchInvoiceStats();
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

  const loadInvoices = async () => {
    setLoadingList(true);
    try {
      const res = await fetchInvoices({
        limit: PAGE_SIZE,
        offset: pagination.offset,
        search: search || undefined,
        status: statusFilter,
      });
      setInvoices(res.data ?? []);
      if (res.pagination) setPagination(res.pagination);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load invoices');
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    loadInvoices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.offset, search, statusFilter]);

  const openDetailModal = async (id: string) => {
    setLoadingDetail(true);
    setDetailModalOpen(true);
    try {
      const res = await fetchInvoice(id);
      setSelectedInvoice(res.data);
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Failed to load invoice details');
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleResend = async (id: string, userEmail: string) => {
    Modal.confirm({
      title: 'Resend Invoice',
      content: `Are you sure you want to resend the invoice to ${userEmail}?`,
      okText: 'Resend',
      onOk: async () => {
        try {
          await resendInvoice(id);
          message.success('Invoice resent successfully');
        } catch (e) {
          message.error(e instanceof Error ? e.message : 'Failed to resend invoice');
        }
      },
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PAID':
        return 'green';
      case 'OPEN':
        return 'blue';
      case 'DRAFT':
        return 'default';
      case 'VOID':
        return 'red';
      case 'UNCOLLECTIBLE':
        return 'volcano';
      default:
        return 'default';
    }
  };

  const columns: ColumnsType<AdminInvoiceListItem> = [
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
      render: (text) => text ?? '—',
    },
    {
      title: 'Amount',
      dataIndex: 'amountDue',
      key: 'amountDue',
      width: TABLE_COLUMN_WIDTHS.SHORT_TEXT,
      align: 'right',
      render: (amount) => `$${(amount / 100)?.toFixed(2) ?? '0.00'}`,
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
      title: 'Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: TABLE_COLUMN_WIDTHS.DATE_SHORT,
      ellipsis: true,
      render: (date) => (date ? new Date(date).toLocaleDateString('en-US') : '—'),
    },
    {
      title: 'Paid',
      dataIndex: 'paidAt',
      key: 'paidAt',
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
          {(record.status === 'OPEN' || record.status === 'DRAFT') && (
            <Button
              size="small"
              type="text"
              icon={<SendOutlined />}
              onClick={() => handleResend(record.id, record.userEmail ?? 'user')}
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
          icon: <FileTextOutlined />,
        },
        {
          label: 'Pending',
          value: stats.pending,
          icon: <FileTextOutlined />,
        },
        {
          label: 'Paid',
          value: stats.paid,
          icon: <FileTextOutlined />,
        },
        {
          label: 'Revenue',
          value: `$${(stats.totalRevenue / 100)?.toFixed(2) ?? '0.00'}`,
          icon: <FileTextOutlined />,
        },
      ]
    : undefined;

  return (
    <div>
      <PageHeader
        title="Invoices"
        description="View payment invoices"
        icon={<FileTextOutlined />}
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
                <Select.Option value="DRAFT">Draft</Select.Option>
                <Select.Option value="OPEN">Open</Select.Option>
                <Select.Option value="PAID">Paid</Select.Option>
                <Select.Option value="VOID">Void</Select.Option>
                <Select.Option value="UNCOLLECTIBLE">Uncollectible</Select.Option>
              </Select>
            </Space>
          </Row>

          <Table
            columns={columns}
            dataSource={invoices}
            loading={loadingList}
            rowKey="id"
            pagination={{
              current: currentPage,
              pageSize: PAGE_SIZE,
              total: pagination.total,
              showSizeChanger: false,
              showTotal: (total) => `Total ${total} invoices`,
            }}
            onChange={handleTableChange}
            scroll={TABLE_SCROLL_CONFIGS.DEFAULT}
            locale={{
              emptyText: <Empty description="No invoices found" />,
            }}
          />
        </Space>
      </Card>

      {/* Detail Modal */}
      <Modal
        title="Invoice Details"
        open={detailModalOpen}
        onCancel={() => {
          setDetailModalOpen(false);
          setSelectedInvoice(null);
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
          selectedInvoice && (
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <Descriptions bordered column={2} size="small">
                <Descriptions.Item label="User">
                  {selectedInvoice.username ?? selectedInvoice.userEmail ?? '—'}
                </Descriptions.Item>
                <Descriptions.Item label="Plan">
                  {selectedInvoice.planName ?? '—'}
                </Descriptions.Item>
                <Descriptions.Item label="Status">
                  <Tag color={getStatusColor(selectedInvoice.status)}>
                    {selectedInvoice.status}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Amount Due">
                  ${(selectedInvoice.amountDue / 100)?.toFixed(2) ?? '0.00'}
                </Descriptions.Item>
                <Descriptions.Item label="Amount Paid">
                  ${(selectedInvoice.amountPaid / 100)?.toFixed(2) ?? '0.00'}
                </Descriptions.Item>
                <Descriptions.Item label="Amount Remaining">
                  ${(selectedInvoice.amountRemaining / 100)?.toFixed(2) ?? '0.00'}
                </Descriptions.Item>
                <Descriptions.Item label="Created">
                  {new Date(selectedInvoice.createdAt).toLocaleString('en-US')}
                </Descriptions.Item>
                {selectedInvoice.paidAt && (
                  <Descriptions.Item label="Paid">
                    {new Date(selectedInvoice.paidAt).toLocaleString('en-US')}
                  </Descriptions.Item>
                )}
                {selectedInvoice.stripeInvoiceId && (
                  <Descriptions.Item label="Stripe ID" span={2}>
                    <span style={{ fontFamily: 'monospace', fontSize: '12px' }}>
                      {selectedInvoice.stripeInvoiceId}
                    </span>
                  </Descriptions.Item>
                )}
                {selectedInvoice.hostedInvoiceUrl && (
                  <Descriptions.Item label="Invoice URL" span={2}>
                    <a
                      href={selectedInvoice.hostedInvoiceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ fontSize: '12px' }}
                    >
                      View Invoice
                    </a>
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

export default Invoices;
