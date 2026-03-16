import { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Select,
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
import { StarOutlined } from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';
import PostSearchSelect from '../../components/PostSearchSelect';
import IdDisplay from '../../components/IdDisplay';
import {
  fetchFeedHighlights,
  createFeedHighlight,
  deleteFeedHighlight,
} from '../../api/admin-content';
import type { AdminFeedHighlightListItem } from '../../types/admin';
import { BADGE_COLOR_PRIMARY } from '../../constants/badge-colors';
import { TABLE_COLUMN_WIDTHS, TABLE_SCROLL_CONFIGS } from '../../constants/table-widths';

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

  // Add modal state
  const [addModalOpen, setAddModalOpen] = useState(false);
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
      antdMessage.warning('Please select a post');
      return;
    }
    setActionLoading('add');
    try {
      await createFeedHighlight({
        postId: newPostId.trim(),
        reason: newReason,
      });
      setAddModalOpen(false);
      setNewPostId('');
      setNewReason('STAFF_PICK');
      antdMessage.success('Highlight added');
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
    setNewReason('STAFF_PICK');
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

  const titleDisplay = (record: AdminFeedHighlightListItem) =>
    record.postTitle?.trim() || record.bodyExcerpt?.trim().slice(0, 80) || '—';

  const columns: ColumnsType<AdminFeedHighlightListItem> = [
    {
      title: 'Title',
      key: 'title',
      width: TABLE_COLUMN_WIDTHS.LONG_TEXT_FLEXIBLE,
      ellipsis: true,
      render: (_, record) => titleDisplay(record),
    },
    {
      title: 'Excerpt',
      dataIndex: 'bodyExcerpt',
      key: 'bodyExcerpt',
      width: TABLE_COLUMN_WIDTHS.LONG_TEXT_FLEXIBLE,
      ellipsis: true,
      render: (text) => text ?? '—',
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
      width: TABLE_COLUMN_WIDTHS.DATETIME_FULL,
      ellipsis: true,
      render: (date) => new Date(date).toLocaleString('en-US'),
    },
    {
      title: '',
      key: 'action',
      width: TABLE_COLUMN_WIDTHS.ACTION_BUTTONS,
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
            <Button type="primary" onClick={() => setAddModalOpen(true)}>
              Add highlight
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
                description="No highlights. Adjust filters or add new ones."
              />
            ),
          }}
        />
      </Card>

      <Modal
        title="Add Highlight"
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
          <Form.Item label="Reason">
            <Select
              value={newReason}
              onChange={setNewReason}
              style={{ width: 200 }}
            >
              {REASONS.map((r) => (
                <Select.Option key={r.value} value={r.value}>
                  {r.label}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default FeedHighlights;
