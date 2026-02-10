import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Row,
  Col,
  Card,
  Statistic,
  Table,
  Input,
  Select,
  Space,
  Spin,
  Empty,
  Alert,
} from 'antd';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import { CommentOutlined } from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';
import {
  fetchContentCommentsStats,
  fetchContentComments,
} from '../../api/admin-content';
import type {
  AdminContentCommentStatsResponse,
  AdminContentCommentListItem,
} from '../../types/admin';

const PAGE_SIZE = 20;

function ContentComments() {
  const [stats, setStats] = useState<AdminContentCommentStatsResponse | null>(null);
  const [comments, setComments] = useState<AdminContentCommentListItem[]>([]);
  const [pagination, setPagination] = useState({
    total: 0,
    limit: PAGE_SIZE,
    offset: 0,
  });
  const [loading, setLoading] = useState(true);
  const [loadingList, setLoadingList] = useState(true);
  const [postId, setPostId] = useState('');
  const [userId, setUserId] = useState('');
  const [sort, setSort] = useState<'createdAt' | 'likesCount'>('createdAt');
  const [order, setOrder] = useState<'asc' | 'desc'>('desc');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchContentCommentsStats();
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

  useEffect(() => {
    let cancelled = false;
    setLoadingList(true);
    (async () => {
      try {
        const res = await fetchContentComments({
          limit: PAGE_SIZE,
          offset: pagination.offset,
          postId: postId || undefined,
          userId: userId || undefined,
          sort,
          order,
        });
        if (!cancelled) {
          setComments(res.data ?? []);
          if (res.pagination) setPagination((p) => ({ ...p, ...res.pagination }));
        }
      } catch (e) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : 'Failed to load list');
      } finally {
        if (!cancelled) setLoadingList(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pagination.offset, postId, userId, sort, order]);

  const userDisplay = (c: AdminContentCommentListItem) =>
    c.userDisplayName || c.userName || c.userId?.slice(0, 8) || '—';

  const columns: ColumnsType<AdminContentCommentListItem> = [
    {
      title: 'Comment (excerpt)',
      key: 'comment',
      ellipsis: true,
      render: (_, record) => (
        <span title={record.comment}>
          {record.commentExcerpt ??
            (record.comment.length > 80
              ? record.comment.slice(0, 80) + '…'
              : record.comment)}
        </span>
      ),
    },
    {
      title: 'Post',
      key: 'post',
      width: 220,
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
      key: 'user',
      width: 140,
      ellipsis: true,
      render: (_, record) => (
        <Link
          to={`/users/${record.userId}`}
          style={{ color: 'var(--tipbox-badge-outline)', textDecoration: 'underline' }}
        >
          {userDisplay(record)}
        </Link>
      ),
    },
    {
      title: 'Is Answer',
      dataIndex: 'isAnswer',
      key: 'isAnswer',
      width: 88,
      ellipsis: true,
      render: (isAnswer) => (isAnswer ? 'Yes' : '—'),
    },
    {
      title: 'Likes',
      dataIndex: 'likesCount',
      key: 'likesCount',
      width: 72,
      align: 'right',
      ellipsis: true,
    },
    {
      title: 'Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 110,
      ellipsis: true,
      render: (date) => (date ? new Date(date).toLocaleDateString('en-US') : '—'),
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
        title="Comments"
        description="Moderate user comments"
        icon={<CommentOutlined />}
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

      {/* Stats */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 48 }}>
          <Spin size="large" />
        </div>
      ) : (
        stats && (
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col xs={24} sm={12} lg={6}>
              <Card bordered>
                <Statistic
                  title="Total comments"
                  value={stats.total}
                  prefix={<CommentOutlined />}
                  valueStyle={{ fontWeight: 700 }}
                />
              </Card>
            </Col>
          </Row>
        )
      )}

      {/* Comment List */}
      <Card
        bordered
        title="Comment list"
        extra={
          <Space wrap>
            <Input
              placeholder="Post ID"
              value={postId}
              onChange={(e) => {
                setPostId(e.target.value.trim());
                setPagination((p) => ({ ...p, offset: 0 }));
              }}
              style={{ width: 150 }}
              allowClear
            />
            <Input
              placeholder="User ID (UUID)"
              value={userId}
              onChange={(e) => {
                setUserId(e.target.value.trim());
                setPagination((p) => ({ ...p, offset: 0 }));
              }}
              style={{ width: 180 }}
              allowClear
            />
            <Select
              value={sort}
              onChange={(value) => {
                setSort(value as 'createdAt' | 'likesCount');
                setPagination((p) => ({ ...p, offset: 0 }));
              }}
              style={{ width: 120 }}
            >
              <Select.Option value="createdAt">Created</Select.Option>
              <Select.Option value="likesCount">Likes</Select.Option>
            </Select>
            <Select
              value={order}
              onChange={(value) => {
                setOrder(value as 'asc' | 'desc');
                setPagination((p) => ({ ...p, offset: 0 }));
              }}
              style={{ width: 100 }}
            >
              <Select.Option value="desc">Descending</Select.Option>
              <Select.Option value="asc">Ascending</Select.Option>
            </Select>
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={comments}
          rowKey="id"
          loading={loadingList}
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
                description="No comments found. Try adjusting the filters."
              />
            ),
          }}
        />
      </Card>
    </div>
  );
}

export default ContentComments;
