import { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Select,
  InputNumber,
  Button,
  Space,
  Empty,
  Alert,
  Modal,
  Tag,
  Form,
  message as antdMessage,
} from 'antd';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import { FireOutlined, ReloadOutlined } from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';
import PostSearchSelect from '../../components/PostSearchSelect';
import IdDisplay from '../../components/IdDisplay';
import {
  fetchTrending,
  createTrending,
  deleteTrending,
  refreshTrending,
} from '../../api/admin-content';
import type { AdminTrendingPostListItem } from '../../types/admin';
import { BADGE_COLOR_PRIMARY } from '../../constants/badge-colors';
import { TABLE_COLUMN_WIDTHS, TABLE_SCROLL_CONFIGS } from '../../constants/table-widths';

const PAGE_SIZE = 20;

function TrendingPosts() {
  const [rows, setRows] = useState<AdminTrendingPostListItem[]>([]);
  const [pagination, setPagination] = useState({
    total: 0,
    limit: PAGE_SIZE,
    offset: 0,
  });
  const [loading, setLoading] = useState(true);
  const [trendPeriod, setTrendPeriod] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Add modal state
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [newPostId, setNewPostId] = useState('');
  const [newPeriod, setNewPeriod] = useState('DAILY');
  const [newScore, setNewScore] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetchTrending({
        limit: PAGE_SIZE,
        offset: pagination.offset,
        trendPeriod: trendPeriod || undefined,
      });
      setRows(res.data ?? []);
      if (res.pagination) setPagination((p) => ({ ...p, ...res.pagination }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load list');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [pagination.offset, trendPeriod]);

  const handleAdd = async () => {
    if (!newPostId.trim()) {
      antdMessage.warning('Please select a post');
      return;
    }
    setActionLoading('add');
    try {
      await createTrending({
        postId: newPostId.trim(),
        trendPeriod: newPeriod,
        score: newScore ?? undefined,
      });
      setAddModalOpen(false);
      setNewPostId('');
      setNewPeriod('DAILY');
      setNewScore(null);
      antdMessage.success('Added to trending');
      load();
    } catch (e) {
      antdMessage.error(e instanceof Error ? e.message : 'Failed to add');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCloseModal = () => {
    setAddModalOpen(false);
    setNewPostId('');
    setNewPeriod('DAILY');
    setNewScore(null);
  };

  const handleRefresh = async (id: string) => {
    setActionLoading(`refresh-${id}`);
    try {
      await refreshTrending(id);
      antdMessage.success('Timer refreshed (+7 days)');
      load();
    } catch (e) {
      antdMessage.error(e instanceof Error ? e.message : 'Failed to refresh');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (id: string) => {
    Modal.confirm({
      title: 'Remove from Trending',
      content: 'Are you sure you want to remove this from trending?',
      okText: 'Remove',
      cancelText: 'Cancel',
      okButtonProps: { danger: true },
      onOk: async () => {
        setActionLoading(id);
        try {
          await deleteTrending(id);
          antdMessage.success('Removed from trending');
          load();
        } catch (e) {
          antdMessage.error(e instanceof Error ? e.message : 'Failed to remove');
        } finally {
          setActionLoading(null);
        }
      },
    });
  };

  const titleDisplay = (record: AdminTrendingPostListItem) =>
    record.postTitle?.trim() || record.bodyExcerpt?.trim().slice(0, 80) || '—';

  const columns: ColumnsType<AdminTrendingPostListItem> = [
    {
      title: 'Post',
      key: 'title',
      width: TABLE_COLUMN_WIDTHS.LONG_TEXT_FLEXIBLE,
      ellipsis: true,
      render: (_, record) => titleDisplay(record),
    },
    {
      title: 'Type',
      dataIndex: 'postType',
      key: 'postType',
      width: TABLE_COLUMN_WIDTHS.SHORT_TEXT,
      ellipsis: true,
      render: (type) => (type ? <Tag color={BADGE_COLOR_PRIMARY}>{type}</Tag> : '—'),
    },
    {
      title: 'Author',
      dataIndex: 'userDisplayName',
      key: 'userDisplayName',
      width: TABLE_COLUMN_WIDTHS.MEDIUM_TEXT,
      ellipsis: true,
      render: (text) => text ?? '—',
    },
    {
      title: 'Post ID',
      dataIndex: 'postId',
      key: 'postId',
      width: TABLE_COLUMN_WIDTHS.MEDIUM_TEXT,
      ellipsis: true,
      render: (id) => <IdDisplay id={id} variant="compact" />,
    },
    {
      title: 'Score',
      dataIndex: 'score',
      key: 'score',
      width: TABLE_COLUMN_WIDTHS.NUMBER_MEDIUM,
      align: 'right',
      ellipsis: true,
      render: (score) => <span style={{ fontVariantNumeric: 'tabular-nums' }}>{score}</span>,
    },
    {
      title: 'Period',
      dataIndex: 'trendPeriod',
      key: 'trendPeriod',
      width: TABLE_COLUMN_WIDTHS.SHORT_TEXT,
      ellipsis: true,
    },
    {
      title: 'Remaining',
      key: 'daysRemaining',
      width: TABLE_COLUMN_WIDTHS.SHORT_TEXT,
      align: 'center',
      render: (_, record) => {
        if (record.isExpired) {
          return <Tag color="red">Expired</Tag>;
        }
        const color = record.daysRemaining <= 2 ? 'orange' : 'green';
        return <Tag color={color}>{record.daysRemaining}d left</Tag>;
      },
    },
    {
      title: '',
      key: 'action',
      width: TABLE_COLUMN_WIDTHS.ACTION_BUTTONS + 40,
      render: (_, record) => (
        <Space size="small">
          <Button
            size="small"
            icon={<ReloadOutlined />}
            loading={actionLoading === `refresh-${record.id}`}
            onClick={() => handleRefresh(record.id)}
          >
            Refresh
          </Button>
          <Button
            danger
            size="small"
            loading={actionLoading === record.id}
            onClick={() => handleDelete(record.id)}
          >
            Remove
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

  return (
    <div>
      <PageHeader
        title="Trending Posts"
        description="View and manage trending content"
        icon={<FireOutlined />}
      />

      {error && (
        <Alert
          message="Error"
          description={error}
          type="error"
          closable
          onClose={() => setError(null)}
          style={{ marginBottom: 24 }}
        />
      )}

      <Card
        bordered
        title="Trending list"
        extra={
          <Space>
            <Select
              value={trendPeriod}
              onChange={(value) => {
                setTrendPeriod(value);
                setPagination((p) => ({ ...p, offset: 0 }));
              }}
              style={{ width: 140 }}
              placeholder="All periods"
            >
              <Select.Option value="">All periods</Select.Option>
              <Select.Option value="DAILY">Daily</Select.Option>
              <Select.Option value="WEEKLY">Weekly</Select.Option>
            </Select>
            <Button type="primary" onClick={() => setAddModalOpen(true)}>
              Add to trending
            </Button>
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={rows}
          rowKey="id"
          loading={loading}
          scroll={TABLE_SCROLL_CONFIGS.AUTO}
          pagination={{
            current: currentPage,
            pageSize: PAGE_SIZE,
            total: pagination.total,
            showSizeChanger: false,
            showTotal: (total) => `Total ${total} records`,
          }}
          onChange={handleTableChange}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="No trending posts. Adjust filters or add new ones."
              />
            ),
          }}
        />
      </Card>

      <Modal
        title="Add to Trending"
        open={addModalOpen}
        onCancel={handleCloseModal}
        onOk={handleAdd}
        okText="Add"
        confirmLoading={actionLoading === 'add'}
        destroyOnClose
        width={560}
      >
        <Form layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item label="Post" required>
            <PostSearchSelect
              value={newPostId}
              onChange={(id) => setNewPostId(id)}
              style={{ width: '100%' }}
            />
          </Form.Item>
          <Space size="middle">
            <Form.Item label="Period">
              <Select
                value={newPeriod}
                onChange={setNewPeriod}
                style={{ width: 140 }}
              >
                <Select.Option value="DAILY">DAILY</Select.Option>
                <Select.Option value="WEEKLY">WEEKLY</Select.Option>
              </Select>
            </Form.Item>
            <Form.Item label="Score (optional)">
              <InputNumber
                placeholder="Score"
                value={newScore}
                onChange={setNewScore}
                style={{ width: 150 }}
                min={0}
              />
            </Form.Item>
          </Space>
        </Form>
      </Modal>
    </div>
  );
}

export default TrendingPosts;
