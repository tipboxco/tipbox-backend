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
  UserOutlined,
  SearchOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';
import { type StatItemData } from '../../components/StatItem';
import ViewActionButton from '../../components/ViewActionButton';
import {
  fetchExpertRequestStats,
  fetchExpertRequests,
  fetchExpertRequest,
} from '../../api/admin-communication';
import type {
  AdminExpertRequestStatsResponse,
  AdminExpertRequestListItem,
  AdminExpertRequestDetailResponse,
} from '../../api/admin-communication';
import { TABLE_COLUMN_WIDTHS, TABLE_SCROLL_CONFIGS } from '../../constants/table-widths';

const PAGE_SIZE = 20;

type ExpertStatus = 'PENDING' | 'BROADCASTING' | 'ANSWERED' | 'EXPIRED' | 'CANCELLED';

function ExpertRequests() {
  const [stats, setStats] = useState<AdminExpertRequestStatsResponse | null>(null);
  const [requests, setRequests] = useState<AdminExpertRequestListItem[]>([]);
  const [pagination, setPagination] = useState({
    total: 0,
    limit: PAGE_SIZE,
    offset: 0,
  });
  const [loading, setLoading] = useState(true);
  const [loadingList, setLoadingList] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ExpertStatus | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<AdminExpertRequestDetailResponse | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchExpertRequestStats();
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
      const res = await fetchExpertRequests({
        limit: PAGE_SIZE,
        offset: pagination.offset,
        search: search || undefined,
        status: statusFilter,
      });
      setRequests(res.data ?? []);
      if (res.pagination) setPagination(res.pagination);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load expert requests');
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
      const res = await fetchExpertRequest(id);
      setSelectedRequest(res.data);
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Failed to load request details');
    } finally {
      setLoadingDetail(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ANSWERED':
        return 'green';
      case 'BROADCASTING':
        return 'blue';
      case 'PENDING':
        return 'orange';
      case 'EXPIRED':
        return 'gray';
      case 'CANCELLED':
        return 'red';
      default:
        return 'default';
    }
  };

  const columns: ColumnsType<AdminExpertRequestListItem> = [
    {
      title: 'User',
      dataIndex: 'username',
      key: 'username',
      width: TABLE_COLUMN_WIDTHS.MEDIUM_TEXT,
      ellipsis: true,
      render: (text, record) => text ?? record.userEmail ?? '—',
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
      title: 'Question',
      dataIndex: 'question',
      key: 'question',
      width: TABLE_COLUMN_WIDTHS.LONG_TEXT,
      ellipsis: true,
    },
    {
      title: 'Offer Amount',
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
      title: 'Answers',
      dataIndex: 'answerCount',
      key: 'answerCount',
      width: TABLE_COLUMN_WIDTHS.SHORT_TEXT,
      align: 'right',
      render: (count) => count ?? 0,
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
          icon: <UserOutlined />,
        },
        {
          label: 'Pending',
          value: stats.pending,
          icon: <UserOutlined />,
        },
        {
          label: 'Broadcasting',
          value: stats.broadcasting,
          icon: <UserOutlined />,
        },
        {
          label: 'Answered',
          value: stats.answered,
          icon: <UserOutlined />,
        },
      ]
    : undefined;

  return (
    <div>
      <PageHeader
        title="Expert Requests"
        description="Manage expert Q&A system"
        icon={<UserOutlined />}
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
                <Select.Option value="BROADCASTING">Broadcasting</Select.Option>
                <Select.Option value="ANSWERED">Answered</Select.Option>
                <Select.Option value="EXPIRED">Expired</Select.Option>
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
              emptyText: <Empty description="No expert requests found" />,
            }}
          />
        </Space>
      </Card>

      {/* Detail Modal */}
      <Modal
        title="Expert Request Details"
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
        width={900}
      >
        {loadingDetail ? (
          <div style={{ textAlign: 'center', padding: '20px' }}>Loading...</div>
        ) : (
          selectedRequest && (
            <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
              <Descriptions bordered column={2} size="small">
                <Descriptions.Item label="User">
                  {selectedRequest.username ?? selectedRequest.userEmail ?? '—'}
                </Descriptions.Item>
                <Descriptions.Item label="Category">
                  {selectedRequest.category ?? '—'}
                </Descriptions.Item>
                <Descriptions.Item label="Question" span={2}>
                  {selectedRequest.question}
                </Descriptions.Item>
                <Descriptions.Item label="Offer Amount">
                  {selectedRequest.offerAmount ? `${selectedRequest.offerAmount.toFixed(2)} TIPS` : '—'}
                </Descriptions.Item>
                <Descriptions.Item label="Status">
                  <Tag color={getStatusColor(selectedRequest.status)}>{selectedRequest.status}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Created">
                  {new Date(selectedRequest.createdAt).toLocaleString('en-US')}
                </Descriptions.Item>
                {selectedRequest.expiresAt && (
                  <Descriptions.Item label="Expires">
                    {new Date(selectedRequest.expiresAt).toLocaleString('en-US')}
                  </Descriptions.Item>
                )}
              </Descriptions>

              {selectedRequest.answers && selectedRequest.answers.length > 0 && (
                <Card title="Answers" size="small">
                  <List
                    dataSource={selectedRequest.answers}
                    renderItem={(answer) => (
                      <List.Item>
                        <List.Item.Meta
                          title={
                            <Space>
                              <span>{answer.expertUsername ?? answer.expertEmail ?? 'Unknown'}</span>
                              {answer.isAccepted && <Tag color="green">Accepted</Tag>}
                            </Space>
                          }
                          description={
                            <Space orientation="vertical" size="small" style={{ width: '100%' }}>
                              <div>{answer.answer}</div>
                              <div style={{ fontSize: '12px', color: '#888' }}>
                                {new Date(answer.createdAt).toLocaleString('en-US')}
                              </div>
                            </Space>
                          }
                        />
                      </List.Item>
                    )}
                  />
                </Card>
              )}
            </Space>
          )
        )}
      </Modal>
    </div>
  );
}

export default ExpertRequests;
