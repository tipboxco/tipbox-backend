import { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Select,
  Input,
  Button,
  Space,
  Empty,
  Alert,
  Modal,
  message as antdMessage,
} from 'antd';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import { StarOutlined } from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';
import {
  fetchFeedHighlights,
  createFeedHighlight,
  deleteFeedHighlight,
} from '../../api/admin-content';
import type { AdminFeedHighlightListItem } from '../../types/admin';

const PAGE_SIZE = 20;

const REASONS = [
  { value: 'STAFF_PICK', label: 'Staff Pick' },
  { value: 'MOST_LIKED', label: 'Most Liked' },
  { value: 'BOOSTED', label: 'Boosted' },
];

function FeedHighlights() {
  const [rows, setRows] = useState<AdminFeedHighlightListItem[]>([]);
  const [pagination, setPagination] = useState({
    total: 0,
    limit: PAGE_SIZE,
    offset: 0,
  });
  const [loading, setLoading] = useState(true);
  const [reasonFilter, setReasonFilter] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newPostId, setNewPostId] = useState('');
  const [newReason, setNewReason] = useState('STAFF_PICK');

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetchFeedHighlights({
        limit: PAGE_SIZE,
        offset: pagination.offset,
        reason: reasonFilter || undefined,
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
  }, [pagination.offset, reasonFilter]);

  const handleAdd = async () => {
    if (!newPostId.trim()) {
      antdMessage.warning('Please enter Post ID');
      return;
    }
    setActionLoading('add');
    try {
      await createFeedHighlight({
        postId: newPostId.trim(),
        reason: newReason,
      });
      setShowAdd(false);
      setNewPostId('');
      antdMessage.success('Highlight added');
      load();
    } catch (e) {
      antdMessage.error(e instanceof Error ? e.message : 'Failed to add');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (id: string) => {
    Modal.confirm({
      title: 'Remove Highlight',
      content: 'Are you sure you want to remove this highlight?',
      okText: 'Remove',
      cancelText: 'Cancel',
      okButtonProps: { danger: true },
      onOk: async () => {
        setActionLoading(id);
        try {
          await deleteFeedHighlight(id);
          antdMessage.success('Highlight removed');
          load();
        } catch (e) {
          antdMessage.error(e instanceof Error ? e.message : 'Failed to remove');
        } finally {
          setActionLoading(null);
        }
      },
    });
  };

  const columns: ColumnsType<AdminFeedHighlightListItem> = [
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
      title: 'Reason',
      dataIndex: 'reason',
      key: 'reason',
      width: 120,
      ellipsis: true,
    },
    {
      title: 'Highlighted',
      dataIndex: 'highlightedAt',
      key: 'highlightedAt',
      width: 160,
      ellipsis: true,
      render: (date) => new Date(date).toLocaleString('en-US'),
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
        title="Feed Highlights"
        description="Manage feed highlighted posts"
        icon={<StarOutlined />}
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
        title="Feed highlight list"
        extra={
          <Space>
            <Select
              value={reasonFilter}
              onChange={(value) => {
                setReasonFilter(value);
                setPagination((p) => ({ ...p, offset: 0 }));
              }}
              style={{ width: 140 }}
              placeholder="All reasons"
            >
              <Select.Option value="">All reasons</Select.Option>
              {REASONS.map((r) => (
                <Select.Option key={r.value} value={r.value}>
                  {r.label}
                </Select.Option>
              ))}
            </Select>
            <Button type="primary" onClick={() => setShowAdd(!showAdd)}>
              {showAdd ? 'Cancel' : 'Add highlight'}
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
              value={newReason}
              onChange={setNewReason}
              style={{ width: 140 }}
            >
              {REASONS.map((r) => (
                <Select.Option key={r.value} value={r.value}>
                  {r.label}
                </Select.Option>
              ))}
            </Select>
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
                description="No highlights. Adjust filters or add new ones."
              />
            ),
          }}
        />
      </Card>
    </div>
  );
}

export default FeedHighlights;
