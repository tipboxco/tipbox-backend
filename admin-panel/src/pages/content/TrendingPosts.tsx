import { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Select,
  Input,
  InputNumber,
  Button,
  Space,
  Empty,
  Alert,
  Modal,
  message as antdMessage,
} from 'antd';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import { FireOutlined } from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';
import {
  fetchTrending,
  createTrending,
  deleteTrending,
} from '../../api/admin-content';
import type { AdminTrendingPostListItem } from '../../types/admin';

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
  const [showAdd, setShowAdd] = useState(false);
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
      antdMessage.warning('Please enter Post ID');
      return;
    }
    setActionLoading('add');
    try {
      await createTrending({
        postId: newPostId.trim(),
        trendPeriod: newPeriod,
        score: newScore ?? undefined,
      });
      setShowAdd(false);
      setNewPostId('');
      setNewScore(null);
      antdMessage.success('Added to trending');
      load();
    } catch (e) {
      antdMessage.error(e instanceof Error ? e.message : 'Failed to add');
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

  const columns: ColumnsType<AdminTrendingPostListItem> = [
    {
      title: 'Post',
      key: 'post',
      width: 240,
      ellipsis: true,
      render: (_, record) =>
        record.postTitle
          ? record.postTitle.length > 50
            ? record.postTitle.slice(0, 50) + '…'
            : record.postTitle
          : record.postId,
    },
    {
      title: 'Author',
      dataIndex: 'userDisplayName',
      key: 'userDisplayName',
      width: 140,
      ellipsis: true,
      render: (text) => text ?? '—',
    },
    {
      title: 'Score',
      dataIndex: 'score',
      key: 'score',
      width: 88,
      align: 'right',
      ellipsis: true,
      render: (score) => <span style={{ fontVariantNumeric: 'tabular-nums' }}>{score}</span>,
    },
    {
      title: 'Period',
      dataIndex: 'trendPeriod',
      key: 'trendPeriod',
      width: 100,
      ellipsis: true,
    },
    {
      title: 'Calculated',
      dataIndex: 'calculatedAt',
      key: 'calculatedAt',
      width: 140,
      ellipsis: true,
      render: (date) => (date ? new Date(date).toLocaleString('en-US') : '—'),
    },
    {
      title: '',
      key: 'action',
      width: 100,
      render: (_, record) => (
        <Button
          danger
          size="small"
          loading={actionLoading === record.id}
          onClick={() => handleDelete(record.id)}
        >
          Remove
        </Button>
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
            <Button type="primary" onClick={() => setShowAdd(!showAdd)}>
              {showAdd ? 'Cancel' : 'Add to trending'}
            </Button>
          </Space>
        }
      >
        {showAdd && (
          <Space style={{ marginBottom: 16, width: '100%' }}>
            <Input
              placeholder="Post ID"
              value={newPostId}
              onChange={(e) => setNewPostId(e.target.value)}
              style={{ width: 200 }}
            />
            <Select
              value={newPeriod}
              onChange={setNewPeriod}
              style={{ width: 120 }}
            >
              <Select.Option value="DAILY">DAILY</Select.Option>
              <Select.Option value="WEEKLY">WEEKLY</Select.Option>
            </Select>
            <InputNumber
              placeholder="Score (optional)"
              value={newScore}
              onChange={setNewScore}
              style={{ width: 150 }}
            />
            <Button
              type="primary"
              loading={actionLoading === 'add'}
              onClick={handleAdd}
            >
              Add
            </Button>
          </Space>
        )}

        <Table
          columns={columns}
          dataSource={rows}
          rowKey="id"
          loading={loading}
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
    </div>
  );
}

export default TrendingPosts;
