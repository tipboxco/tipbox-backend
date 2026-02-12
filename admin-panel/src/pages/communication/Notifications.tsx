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
  Switch,
} from 'antd';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import {
  BellOutlined,
  SearchOutlined,
  EyeOutlined,
  SendOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';
import { type StatItemData } from '../../components/StatItem';
import ViewActionButton from '../../components/ViewActionButton';
import {
  fetchNotificationStats,
  fetchNotifications,
  fetchNotification,
  sendNotification,
} from '../../api/admin-communication';
import type {
  AdminNotificationStatsResponse,
  AdminNotificationListItem,
  AdminNotificationDetailResponse,
  SendNotificationInput,
} from '../../api/admin-communication';
import { TABLE_COLUMN_WIDTHS, TABLE_SCROLL_CONFIGS } from '../../constants/table-widths';

const PAGE_SIZE = 20;

type NotificationType = 'SYSTEM' | 'BADGE' | 'EVENT' | 'MESSAGE' | 'REWARD' | 'ANNOUNCEMENT';
type NotificationStatus = 'PENDING' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';

function Notifications() {
  const [stats, setStats] = useState<AdminNotificationStatsResponse | null>(null);
  const [notifications, setNotifications] = useState<AdminNotificationListItem[]>([]);
  const [pagination, setPagination] = useState({
    total: 0,
    limit: PAGE_SIZE,
    offset: 0,
  });
  const [loading, setLoading] = useState(true);
  const [loadingList, setLoadingList] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<NotificationType | undefined>(undefined);
  const [statusFilter, setStatusFilter] = useState<NotificationStatus | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [sendModalOpen, setSendModalOpen] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState<AdminNotificationDetailResponse | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [sendForm] = Form.useForm();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchNotificationStats();
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

  const loadNotifications = async () => {
    setLoadingList(true);
    try {
      const res = await fetchNotifications({
        limit: PAGE_SIZE,
        offset: pagination.offset,
        search: search || undefined,
        type: typeFilter,
        status: statusFilter,
      });
      setNotifications(res.data ?? []);
      if (res.pagination) setPagination(res.pagination);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load notifications');
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    loadNotifications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.offset, search, typeFilter, statusFilter]);

  const openDetailModal = async (id: string) => {
    setLoadingDetail(true);
    setDetailModalOpen(true);
    try {
      const res = await fetchNotification(id);
      setSelectedNotification(res.data);
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Failed to load notification details');
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleSend = async (values: SendNotificationInput) => {
    try {
      await sendNotification(values);
      message.success('Notification sent successfully');
      setSendModalOpen(false);
      sendForm.resetFields();
      setPagination((prev) => ({ ...prev, offset: 0 }));
      loadNotifications();
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Failed to send notification');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'READ':
        return 'green';
      case 'DELIVERED':
        return 'blue';
      case 'SENT':
        return 'cyan';
      case 'PENDING':
        return 'orange';
      case 'FAILED':
        return 'red';
      default:
        return 'default';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'SYSTEM':
        return 'purple';
      case 'BADGE':
        return 'blue';
      case 'EVENT':
        return 'orange';
      case 'MESSAGE':
        return 'green';
      case 'REWARD':
        return 'gold';
      case 'ANNOUNCEMENT':
        return 'red';
      default:
        return 'default';
    }
  };

  const columns: ColumnsType<AdminNotificationListItem> = [
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
      title: 'Title',
      dataIndex: 'title',
      key: 'title',
      width: TABLE_COLUMN_WIDTHS.LONG_TEXT,
      ellipsis: true,
    },
    {
      title: 'Message',
      dataIndex: 'message',
      key: 'message',
      width: TABLE_COLUMN_WIDTHS.LONG_TEXT,
      ellipsis: true,
      render: (text) => text ?? '—',
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
          label: 'Total Sent',
          value: stats.totalSent,
          icon: <BellOutlined />,
        },
        {
          label: 'Delivered',
          value: stats.delivered,
          icon: <BellOutlined />,
        },
        {
          label: 'Read',
          value: stats.read,
          icon: <BellOutlined />,
        },
        {
          label: 'Read Rate',
          value: `${stats.readRate?.toFixed(1) ?? '0.0'}%`,
          icon: <BellOutlined />,
        },
      ]
    : undefined;

  return (
    <div>
      <PageHeader
        title="Notifications"
        description="Manage system notifications"
        icon={<BellOutlined />}
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
                <Select.Option value="SYSTEM">System</Select.Option>
                <Select.Option value="BADGE">Badge</Select.Option>
                <Select.Option value="EVENT">Event</Select.Option>
                <Select.Option value="MESSAGE">Message</Select.Option>
                <Select.Option value="REWARD">Reward</Select.Option>
                <Select.Option value="ANNOUNCEMENT">Announcement</Select.Option>
              </Select>
              <Select
                placeholder="Status"
                value={statusFilter}
                onChange={setStatusFilter}
                style={{ width: 150 }}
                allowClear
              >
                <Select.Option value="PENDING">Pending</Select.Option>
                <Select.Option value="SENT">Sent</Select.Option>
                <Select.Option value="DELIVERED">Delivered</Select.Option>
                <Select.Option value="READ">Read</Select.Option>
                <Select.Option value="FAILED">Failed</Select.Option>
              </Select>
            </Space>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setSendModalOpen(true)}
            >
              Send Notification
            </Button>
          </Row>

          <Table
            columns={columns}
            dataSource={notifications}
            loading={loadingList}
            rowKey="id"
            pagination={{
              current: currentPage,
              pageSize: PAGE_SIZE,
              total: pagination.total,
              showSizeChanger: false,
              showTotal: (total) => `Total ${total} notifications`,
            }}
            onChange={handleTableChange}
            scroll={TABLE_SCROLL_CONFIGS.DEFAULT}
            locale={{
              emptyText: <Empty description="No notifications found" />,
            }}
          />
        </Space>
      </Card>

      {/* Detail Modal */}
      <Modal
        title="Notification Details"
        open={detailModalOpen}
        onCancel={() => {
          setDetailModalOpen(false);
          setSelectedNotification(null);
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
          selectedNotification && (
            <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
              <Descriptions bordered column={2} size="small">
                <Descriptions.Item label="User">
                  {selectedNotification.username ?? selectedNotification.userEmail ?? '—'}
                </Descriptions.Item>
                <Descriptions.Item label="Type">
                  <Tag color={getTypeColor(selectedNotification.type)}>
                    {selectedNotification.type}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Title" span={2}>
                  {selectedNotification.title}
                </Descriptions.Item>
                <Descriptions.Item label="Message" span={2}>
                  {selectedNotification.message ?? '—'}
                </Descriptions.Item>
                <Descriptions.Item label="Status">
                  <Tag color={getStatusColor(selectedNotification.status)}>
                    {selectedNotification.status}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Created">
                  {new Date(selectedNotification.createdAt).toLocaleString('en-US')}
                </Descriptions.Item>
                {selectedNotification.readAt && (
                  <Descriptions.Item label="Read" span={2}>
                    {new Date(selectedNotification.readAt).toLocaleString('en-US')}
                  </Descriptions.Item>
                )}
              </Descriptions>
            </Space>
          )
        )}
      </Modal>

      {/* Send Notification Modal */}
      <Modal
        title="Send Notification"
        open={sendModalOpen}
        onCancel={() => {
          setSendModalOpen(false);
          sendForm.resetFields();
        }}
        onOk={() => sendForm.submit()}
        width={700}
      >
        <Form form={sendForm} layout="vertical" onFinish={handleSend}>
          <Form.Item
            name="userId"
            label="User ID (leave empty for broadcast)"
            extra="Leave empty to send to all users"
          >
            <Input placeholder="User UUID (optional)" />
          </Form.Item>
          <Form.Item
            name="type"
            label="Type"
            rules={[{ required: true, message: 'Please select type' }]}
          >
            <Select placeholder="Select type">
              <Select.Option value="SYSTEM">System</Select.Option>
              <Select.Option value="BADGE">Badge</Select.Option>
              <Select.Option value="EVENT">Event</Select.Option>
              <Select.Option value="MESSAGE">Message</Select.Option>
              <Select.Option value="REWARD">Reward</Select.Option>
              <Select.Option value="ANNOUNCEMENT">Announcement</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="title"
            label="Title"
            rules={[{ required: true, message: 'Please enter title' }]}
          >
            <Input placeholder="Notification title" />
          </Form.Item>
          <Form.Item
            name="message"
            label="Message"
            rules={[{ required: true, message: 'Please enter message' }]}
          >
            <Input.TextArea rows={4} placeholder="Notification message" />
          </Form.Item>
          <Form.Item name="actionUrl" label="Action URL (optional)">
            <Input placeholder="https://..." />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default Notifications;
