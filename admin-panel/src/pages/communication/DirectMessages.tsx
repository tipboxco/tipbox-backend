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
  Descriptions,
  message,
  Checkbox,
  List,
} from 'antd';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import {
  MessageOutlined,
  SearchOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';
import { type StatItemData } from '../../components/StatItem';
import {
  fetchDMThreadStats,
  fetchDMThreads,
  fetchDMThread,
} from '../../api/admin-communication';
import type {
  AdminDMThreadStatsResponse,
  AdminDMThreadListItem,
  AdminDMThreadDetailResponse,
} from '../../api/admin-communication';
import { TABLE_COLUMN_WIDTHS, TABLE_SCROLL_CONFIGS } from '../../constants/table-widths';

const PAGE_SIZE = 20;

function DirectMessages() {
  const [stats, setStats] = useState<AdminDMThreadStatsResponse | null>(null);
  const [threads, setThreads] = useState<AdminDMThreadListItem[]>([]);
  const [pagination, setPagination] = useState({
    total: 0,
    limit: PAGE_SIZE,
    offset: 0,
  });
  const [loading, setLoading] = useState(true);
  const [loadingList, setLoadingList] = useState(true);
  const [search, setSearch] = useState('');
  const [activeOnly, setActiveOnly] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedThread, setSelectedThread] = useState<AdminDMThreadDetailResponse | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchDMThreadStats();
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
    setLoadingList(true);
    try {
      const res = await fetchDMThreads({
        limit: PAGE_SIZE,
        offset: pagination.offset,
        search: search || undefined,
        isActive: activeOnly || undefined,
      });
      setThreads(res.data ?? []);
      if (res.pagination) setPagination(res.pagination);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load threads');
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    loadThreads();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.offset, search, activeOnly]);

  const openDetailModal = async (id: string) => {
    setLoadingDetail(true);
    setDetailModalOpen(true);
    try {
      const res = await fetchDMThread(id);
      setSelectedThread(res.data);
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Failed to load thread details');
    } finally {
      setLoadingDetail(false);
    }
  };

  const columns: ColumnsType<AdminDMThreadListItem> = [
    {
      title: 'User 1',
      dataIndex: 'user1Username',
      key: 'user1Username',
      width: TABLE_COLUMN_WIDTHS.MEDIUM_TEXT,
      ellipsis: true,
      render: (text, record) => text ?? record.user1Email ?? '—',
    },
    {
      title: 'User 2',
      dataIndex: 'user2Username',
      key: 'user2Username',
      width: TABLE_COLUMN_WIDTHS.MEDIUM_TEXT,
      ellipsis: true,
      render: (text, record) => text ?? record.user2Email ?? '—',
    },
    {
      title: 'Last Message',
      dataIndex: 'lastMessage',
      key: 'lastMessage',
      width: TABLE_COLUMN_WIDTHS.LONG_TEXT,
      ellipsis: true,
      render: (text) => text ?? '—',
    },
    {
      title: 'Unread',
      dataIndex: 'unreadCount',
      key: 'unreadCount',
      width: TABLE_COLUMN_WIDTHS.SHORT_TEXT,
      align: 'right',
      render: (count) => count ?? 0,
    },
    {
      title: 'Status',
      dataIndex: 'isActive',
      key: 'isActive',
      width: TABLE_COLUMN_WIDTHS.SHORT_TEXT,
      align: 'center',
      render: (active) =>
        active ? <Tag color="green">Active</Tag> : <Tag color="gray">Inactive</Tag>,
    },
    {
      title: 'Updated',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: TABLE_COLUMN_WIDTHS.DATE_SHORT,
      ellipsis: true,
      render: (date) => (date ? new Date(date).toLocaleDateString('en-US') : '—'),
    },
    {
      title: '',
      key: 'action',
      width: TABLE_COLUMN_WIDTHS.ACTION_BUTTON_SINGLE,
      render: (_, record) => (
        <Button
          size="small"
          type="text"
          icon={<EyeOutlined />}
          onClick={() => openDetailModal(record.id)}
        />
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
          label: 'Total Threads',
          value: stats.totalThreads,
          icon: <MessageOutlined />,
        },
        {
          label: 'Active',
          value: stats.activeThreads,
          icon: <MessageOutlined />,
        },
        {
          label: 'Total Messages',
          value: stats.totalMessages,
          icon: <MessageOutlined />,
        },
        {
          label: 'Unread',
          value: stats.unreadMessages,
          icon: <MessageOutlined />,
        },
      ]
    : undefined;

  return (
    <div>
      <PageHeader
        title="Direct Messages"
        description="Monitor user messaging"
        icon={<MessageOutlined />}
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
              <Checkbox checked={activeOnly} onChange={(e) => setActiveOnly(e.target.checked)}>
                Active only
              </Checkbox>
            </Space>
          </Row>

          <Table
            columns={columns}
            dataSource={threads}
            loading={loadingList}
            rowKey="id"
            pagination={{
              current: currentPage,
              pageSize: PAGE_SIZE,
              total: pagination.total,
              showSizeChanger: false,
              showTotal: (total) => `Total ${total} threads`,
            }}
            onChange={handleTableChange}
            scroll={TABLE_SCROLL_CONFIGS.DEFAULT}
            locale={{
              emptyText: <Empty description="No message threads found" />,
            }}
          />
        </Space>
      </Card>

      {/* Detail Modal */}
      <Modal
        title="Thread Details"
        open={detailModalOpen}
        onCancel={() => {
          setDetailModalOpen(false);
          setSelectedThread(null);
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
          selectedThread && (
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <Descriptions bordered column={2} size="small">
                <Descriptions.Item label="User 1">
                  {selectedThread.user1Username ?? selectedThread.user1Email ?? '—'}
                </Descriptions.Item>
                <Descriptions.Item label="User 2">
                  {selectedThread.user2Username ?? selectedThread.user2Email ?? '—'}
                </Descriptions.Item>
                <Descriptions.Item label="Status">
                  {selectedThread.isActive ? (
                    <Tag color="green">Active</Tag>
                  ) : (
                    <Tag color="gray">Inactive</Tag>
                  )}
                </Descriptions.Item>
                <Descriptions.Item label="Messages">
                  {selectedThread.messageCount ?? 0}
                </Descriptions.Item>
                <Descriptions.Item label="Created">
                  {new Date(selectedThread.createdAt).toLocaleString('en-US')}
                </Descriptions.Item>
                <Descriptions.Item label="Updated">
                  {new Date(selectedThread.updatedAt).toLocaleString('en-US')}
                </Descriptions.Item>
              </Descriptions>

              {selectedThread.messages && selectedThread.messages.length > 0 && (
                <Card title="Messages" size="small">
                  <List
                    dataSource={selectedThread.messages}
                    renderItem={(msg) => (
                      <List.Item>
                        <List.Item.Meta
                          title={
                            <Space>
                              <span>{msg.senderUsername ?? msg.senderEmail ?? 'Unknown'}</span>
                              {msg.isRead && <Tag color="green">Read</Tag>}
                            </Space>
                          }
                          description={
                            <Space direction="vertical" size="small" style={{ width: '100%' }}>
                              <div>{msg.content}</div>
                              <div style={{ fontSize: '12px', color: '#888' }}>
                                {new Date(msg.createdAt).toLocaleString('en-US')}
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

export default DirectMessages;
