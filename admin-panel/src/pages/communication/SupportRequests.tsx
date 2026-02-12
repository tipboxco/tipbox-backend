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
  Rate,
} from 'antd';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import {
  CustomerServiceOutlined,
  SearchOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';
import { type StatItemData } from '../../components/StatItem';
import ViewActionButton from '../../components/ViewActionButton';
import {
  fetchSupportRequestStats,
  fetchSupportRequests,
  fetchSupportRequest,
} from '../../api/admin-communication';
import type {
  AdminSupportRequestStatsResponse,
  AdminSupportRequestListItem,
  AdminSupportRequestDetailResponse,
} from '../../api/admin-communication';
import { TABLE_COLUMN_WIDTHS, TABLE_SCROLL_CONFIGS } from '../../constants/table-widths';

const PAGE_SIZE = 20;

type SupportStatus = 'PENDING' | 'MATCHED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

function SupportRequests() {
  const [stats, setStats] = useState<AdminSupportRequestStatsResponse | null>(null);
  const [requests, setRequests] = useState<AdminSupportRequestListItem[]>([]);
  const [pagination, setPagination] = useState({
    total: 0,
    limit: PAGE_SIZE,
    offset: 0,
  });
  const [loading, setLoading] = useState(true);
  const [loadingList, setLoadingList] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<SupportStatus | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<AdminSupportRequestDetailResponse | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchSupportRequestStats();
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

  const loadRequests = async () => {
    setLoadingList(true);
    try {
      const res = await fetchSupportRequests({
        limit: PAGE_SIZE,
        offset: pagination.offset,
        search: search || undefined,
        status: statusFilter,
      });
      setRequests(res.data ?? []);
      if (res.pagination) setPagination(res.pagination);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load support requests');
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    loadRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.offset, search, statusFilter]);

  const openDetailModal = async (id: string) => {
    setLoadingDetail(true);
    setDetailModalOpen(true);
    try {
      const res = await fetchSupportRequest(id);
      setSelectedRequest(res.data);
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Failed to load request details');
    } finally {
      setLoadingDetail(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'green';
      case 'IN_PROGRESS':
        return 'blue';
      case 'MATCHED':
        return 'cyan';
      case 'PENDING':
        return 'orange';
      case 'CANCELLED':
        return 'red';
      default:
        return 'default';
    }
  };

  const columns: ColumnsType<AdminSupportRequestListItem> = [
    {
      title: 'Requester',
      dataIndex: 'requesterUsername',
      key: 'requesterUsername',
      width: TABLE_COLUMN_WIDTHS.MEDIUM_TEXT,
      ellipsis: true,
      render: (text, record) => text ?? record.requesterEmail ?? '—',
    },
    {
      title: 'Helper',
      dataIndex: 'helperUsername',
      key: 'helperUsername',
      width: TABLE_COLUMN_WIDTHS.MEDIUM_TEXT,
      ellipsis: true,
      render: (text, record) => text ?? record.helperEmail ?? '—',
    },
    {
      title: 'Category',
      dataIndex: 'category',
      key: 'category',
      width: TABLE_COLUMN_WIDTHS.MEDIUM_TEXT,
      ellipsis: true,
      render: (text) => text ?? '—',
    },
    {
      title: 'Amount',
      dataIndex: 'offerAmount',
      key: 'offerAmount',
      width: TABLE_COLUMN_WIDTHS.SHORT_TEXT,
      align: 'right',
      render: (amount) => (amount ? `${amount.toFixed(2)} TIPS` : '—'),
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
      title: 'Rating',
      dataIndex: 'rating',
      key: 'rating',
      width: TABLE_COLUMN_WIDTHS.SHORT_TEXT,
      align: 'center',
      render: (rating) => (rating ? <Rate disabled value={rating} /> : '—'),
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
      width: TABLE_COLUMN_WIDTHS.ACTION_BUTTON_TRIPLE,
      render: (_, record) => (
        <Space size="small">
          <ViewActionButton to={`/users/${record.requesterId}`} title="View requester" />
          {record.helperId && <ViewActionButton to={`/users/${record.helperId}`} title="View helper" />}
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
          icon: <CustomerServiceOutlined />,
        },
        {
          label: 'Pending',
          value: stats.pending,
          icon: <CustomerServiceOutlined />,
        },
        {
          label: 'Completed',
          value: stats.completed,
          icon: <CustomerServiceOutlined />,
        },
        {
          label: 'Avg Rating',
          value: stats.avgRating?.toFixed(1) ?? '0.0',
          icon: <CustomerServiceOutlined />,
        },
      ]
    : undefined;

  return (
    <div>
      <PageHeader
        title="Support Requests"
        description="Handle user support tickets"
        icon={<CustomerServiceOutlined />}
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
                <Select.Option value="PENDING">Pending</Select.Option>
                <Select.Option value="MATCHED">Matched</Select.Option>
                <Select.Option value="IN_PROGRESS">In Progress</Select.Option>
                <Select.Option value="COMPLETED">Completed</Select.Option>
                <Select.Option value="CANCELLED">Cancelled</Select.Option>
              </Select>
            </Space>
          </Row>

          <Table
            columns={columns}
            dataSource={requests}
            loading={loadingList}
            rowKey="id"
            pagination={{
              current: currentPage,
              pageSize: PAGE_SIZE,
              total: pagination.total,
              showSizeChanger: false,
              showTotal: (total) => `Total ${total} requests`,
            }}
            onChange={handleTableChange}
            scroll={TABLE_SCROLL_CONFIGS.DEFAULT}
            locale={{
              emptyText: <Empty description="No support requests found" />,
            }}
          />
        </Space>
      </Card>

      {/* Detail Modal */}
      <Modal
        title="Support Request Details"
        open={detailModalOpen}
        onCancel={() => {
          setDetailModalOpen(false);
          setSelectedRequest(null);
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
          selectedRequest && (
            <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
              <Descriptions bordered column={2} size="small">
                <Descriptions.Item label="Requester">
                  {selectedRequest.requesterUsername ?? selectedRequest.requesterEmail ?? '—'}
                </Descriptions.Item>
                <Descriptions.Item label="Helper">
                  {selectedRequest.helperUsername ?? selectedRequest.helperEmail ?? '—'}
                </Descriptions.Item>
                <Descriptions.Item label="Category" span={2}>
                  {selectedRequest.category ?? '—'}
                </Descriptions.Item>
                <Descriptions.Item label="Description" span={2}>
                  {selectedRequest.description ?? '—'}
                </Descriptions.Item>
                <Descriptions.Item label="Offer Amount">
                  {selectedRequest.offerAmount ? `${selectedRequest.offerAmount.toFixed(2)} TIPS` : '—'}
                </Descriptions.Item>
                <Descriptions.Item label="Status">
                  <Tag color={getStatusColor(selectedRequest.status)}>{selectedRequest.status}</Tag>
                </Descriptions.Item>
                {selectedRequest.rating && (
                  <>
                    <Descriptions.Item label="Rating">
                      <Rate disabled value={selectedRequest.rating} />
                    </Descriptions.Item>
                    <Descriptions.Item label="Feedback">
                      {selectedRequest.feedback ?? '—'}
                    </Descriptions.Item>
                  </>
                )}
                <Descriptions.Item label="Created">
                  {new Date(selectedRequest.createdAt).toLocaleString('en-US')}
                </Descriptions.Item>
                {selectedRequest.completedAt && (
                  <Descriptions.Item label="Completed">
                    {new Date(selectedRequest.completedAt).toLocaleString('en-US')}
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

export default SupportRequests;
