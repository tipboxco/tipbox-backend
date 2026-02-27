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
  message,
  Tabs,
  Switch,
} from 'antd';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import {
  MessageOutlined,
  SearchOutlined,
  EyeOutlined,
  StopOutlined,
  FlagOutlined,
} from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';
import type { StatItemData } from '../../components/StatItem';
import DMThreadView from '../../components/communication/DMThreadView';
import {
  fetchDMStats,
  fetchDMThreads,
  fetchDMMessages,
  deactivateDMThread,
  type AdminDirectMessageStatsResponse,
  type AdminDMThreadListItem,
  type AdminDMMessageListItem,
} from '../../api/admin-communication';
import { TABLE_COLUMN_WIDTHS, TABLE_SCROLL_CONFIGS } from '../../constants/table-widths';

const PAGE_SIZE = 20;

function DMModeration() {
  const [stats, setStats] = useState<AdminDirectMessageStatsResponse | null>(null);
  const [threads, setThreads] = useState<AdminDMThreadListItem[]>([]);
  const [flaggedMessages, setFlaggedMessages] = useState<AdminDMMessageListItem[]>([]);
  const [threadPagination, setThreadPagination] = useState({
    total: 0,
    limit: PAGE_SIZE,
    offset: 0,
  });
  const [messagePagination, setMessagePagination] = useState({
    total: 0,
    limit: PAGE_SIZE,
    offset: 0,
  });
  const [loading, setLoading] = useState(true);
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<boolean | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [threadViewOpen, setThreadViewOpen] = useState(false);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchDMStats();
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

  const loadThreads = async () => {
    setLoadingThreads(true);
    try {
      const res = await fetchDMThreads({
        limit: PAGE_SIZE,
        offset: threadPagination.offset,
        isActive: activeFilter,
      });
      setThreads(res.data ?? []);
      if (res.pagination) setThreadPagination(res.pagination);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load threads');
    } finally {
      setLoadingThreads(false);
    }
  };

  const loadFlaggedMessages = async () => {
    setLoadingMessages(true);
    try {
      const res = await fetchDMMessages({
        limit: PAGE_SIZE,
        offset: messagePagination.offset,
        isFlagged: true,
      });
      setFlaggedMessages(res.data ?? []);
      if (res.pagination) setMessagePagination(res.pagination);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load flagged messages');
    } finally {
      setLoadingMessages(false);
    }
  };

  useEffect(() => {
    loadThreads();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadPagination.offset, activeFilter]);

  useEffect(() => {
    loadFlaggedMessages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messagePagination.offset]);

  const openThreadView = (threadId: string) => {
    setSelectedThreadId(threadId);
    setThreadViewOpen(true);
  };

  const handleDeactivateThread = async (id: string, user1: string, user2: string) => {
    Modal.confirm({
      title: 'Deactivate Thread',
      content: `Are you sure you want to deactivate the conversation between ${user1} and ${user2}? Both users will no longer be able to send messages in this thread.`,
      okText: 'Deactivate',
      okType: 'danger',
      onOk: async () => {
        try {
          await deactivateDMThread(id);
          message.success('Thread deactivated successfully');
          loadThreads();
        } catch (e) {
          message.error(e instanceof Error ? e.message : 'Failed to deactivate thread');
        }
      },
    });
  };

  const handleThreadViewClose = () => {
    setThreadViewOpen(false);
    setSelectedThreadId(null);
    // Refresh flagged messages in case any were handled
    loadFlaggedMessages();
  };

  const threadColumns: ColumnsType<AdminDMThreadListItem> = [
    {
      title: 'User 1',
      key: 'user1',
      width: TABLE_COLUMN_WIDTHS.MEDIUM_TEXT,
      ellipsis: true,
      render: (_, record) => record.user1Username || record.user1Email || record.user1Id,
    },
    {
      title: 'User 2',
      key: 'user2',
      width: TABLE_COLUMN_WIDTHS.MEDIUM_TEXT,
      ellipsis: true,
      render: (_, record) => record.user2Username || record.user2Email || record.user2Id,
    },
    {
      title: 'Messages',
      dataIndex: 'messageCount',
      key: 'messageCount',
      width: TABLE_COLUMN_WIDTHS.SHORT_TEXT,
      align: 'right',
    },
    {
      title: 'Status',
      dataIndex: 'isActive',
      key: 'isActive',
      width: TABLE_COLUMN_WIDTHS.SHORT_TEXT,
      align: 'center',
      render: (isActive) =>
        isActive ? (
          <Tag color="green">Active</Tag>
        ) : (
          <Tag color="red">Inactive</Tag>
        ),
    },
    {
      title: 'Last Message',
      dataIndex: 'lastMessageAt',
      key: 'lastMessageAt',
      width: TABLE_COLUMN_WIDTHS.DATE_SHORT,
      ellipsis: true,
      render: (date) => (date ? new Date(date).toLocaleDateString('en-US') : '—'),
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
      title: '',
      key: 'action',
      width: TABLE_COLUMN_WIDTHS.ACTION_BUTTON_DOUBLE,
      render: (_, record) => (
        <Space size="small">
          <Button
            size="small"
            type="text"
            icon={<EyeOutlined />}
            onClick={() => openThreadView(record.id)}
          />
          {record.isActive && (
            <Button
              size="small"
              type="text"
              danger
              icon={<StopOutlined />}
              onClick={() =>
                handleDeactivateThread(
                  record.id,
                  record.user1Username || record.user1Email || 'User 1',
                  record.user2Username || record.user2Email || 'User 2'
                )
              }
            />
          )}
        </Space>
      ),
    },
  ];

  const messageColumns: ColumnsType<AdminDMMessageListItem> = [
    {
      title: 'Sender',
      key: 'sender',
      width: TABLE_COLUMN_WIDTHS.MEDIUM_TEXT,
      ellipsis: true,
      render: (_, record) => record.senderUsername || record.senderEmail || record.senderId,
    },
    {
      title: 'Message',
      dataIndex: 'message',
      key: 'message',
      width: TABLE_COLUMN_WIDTHS.LONG_TEXT_FLEXIBLE,
      ellipsis: true,
    },
    {
      title: 'Status',
      key: 'status',
      width: TABLE_COLUMN_WIDTHS.SHORT_TEXT,
      align: 'center',
      render: (_, record) => (
        <Space size="small">
          {record.isFlagged && <Tag color="red" icon={<FlagOutlined />}>Flagged</Tag>}
          {record.isRead && <Tag color="blue">Read</Tag>}
        </Space>
      ),
    },
    {
      title: 'Sent',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: TABLE_COLUMN_WIDTHS.DATETIME_FULL,
      ellipsis: true,
      render: (date) => new Date(date).toLocaleString('en-US'),
    },
    {
      title: '',
      key: 'action',
      width: TABLE_COLUMN_WIDTHS.ACTION_BUTTON,
      render: (_, record) => (
        <Button
          size="small"
          type="text"
          icon={<EyeOutlined />}
          onClick={() => openThreadView(record.threadId)}
        />
      ),
    },
  ];

  const handleThreadTableChange = (pag: TablePaginationConfig) => {
    const newOffset = ((pag.current ?? 1) - 1) * PAGE_SIZE;
    setThreadPagination((prev) => ({ ...prev, offset: newOffset }));
  };

  const handleMessageTableChange = (pag: TablePaginationConfig) => {
    const newOffset = ((pag.current ?? 1) - 1) * PAGE_SIZE;
    setMessagePagination((prev) => ({ ...prev, offset: newOffset }));
  };

  const threadCurrentPage = Math.floor(threadPagination.offset / threadPagination.limit) + 1;
  const messageCurrentPage = Math.floor(messagePagination.offset / messagePagination.limit) + 1;

  const statsData: StatItemData[] | undefined = stats
    ? [
        {
          label: 'Total Threads',
          value: stats.totalThreads,
          icon: <MessageOutlined />,
        },
        {
          label: 'Active Threads',
          value: stats.activeThreads,
          icon: <MessageOutlined />,
        },
        {
          label: 'Total Messages',
          value: stats.totalMessages,
          icon: <MessageOutlined />,
        },
        {
          label: 'Messages This Week',
          value: stats.messagesThisWeek,
          icon: <MessageOutlined />,
        },
      ]
    : undefined;

  return (
    <div>
      <PageHeader
        title="Direct Messages Moderation"
        description="Monitor and moderate direct message conversations"
        icon={<MessageOutlined />}
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

      <Alert
        message="Privacy Notice"
        description="Direct message content is private. Only view message content when investigating reported violations or policy concerns. All moderation actions are logged."
        type="warning"
        showIcon
        closable
        style={{ marginBottom: 16 }}
      />

      <Card>
        <Tabs
          defaultActiveKey="threads"
          items={[
            {
              key: 'threads',
              label: 'All Threads',
              children: (
                <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
                  <Row justify="space-between" align="middle">
                    <Space wrap>
                      <Switch
                        checkedChildren="Active Only"
                        unCheckedChildren="All"
                        checked={activeFilter === true}
                        onChange={(checked) => setActiveFilter(checked ? true : undefined)}
                      />
                    </Space>
                  </Row>

                  <Table
                    columns={threadColumns}
                    dataSource={threads}
                    loading={loadingThreads}
                    rowKey="id"
                    pagination={{
                      current: threadCurrentPage,
                      pageSize: PAGE_SIZE,
                      total: threadPagination.total,
                      showSizeChanger: false,
                      showTotal: (total) => `Total ${total} threads`,
                    }}
                    onChange={handleThreadTableChange}
                    scroll={TABLE_SCROLL_CONFIGS.DEFAULT}
                    locale={{
                      emptyText: <Empty description="No threads found" />,
                    }}
                  />
                </Space>
              ),
            },
            {
              key: 'flagged',
              label: (
                <span>
                  <FlagOutlined />
                  Flagged Messages
                </span>
              ),
              children: (
                <Table
                  columns={messageColumns}
                  dataSource={flaggedMessages}
                  loading={loadingMessages}
                  rowKey="id"
                  pagination={{
                    current: messageCurrentPage,
                    pageSize: PAGE_SIZE,
                    total: messagePagination.total,
                    showSizeChanger: false,
                    showTotal: (total) => `Total ${total} flagged messages`,
                  }}
                  onChange={handleMessageTableChange}
                  scroll={TABLE_SCROLL_CONFIGS.DEFAULT}
                  locale={{
                    emptyText: <Empty description="No flagged messages" />,
                  }}
                />
              ),
            },
          ]}
        />
      </Card>

      {/* Thread View Modal */}
      {selectedThreadId && (
        <DMThreadView
          open={threadViewOpen}
          threadId={selectedThreadId}
          onClose={handleThreadViewClose}
        />
      )}
    </div>
  );
}

export default DMModeration;
