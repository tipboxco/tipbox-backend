import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Card,
  Table,
  Input,
  Select,
  Space,
  Empty,
  Alert,
  Avatar,
  Tag,
  Button,
  Popconfirm,
  message as antdMessage,
} from 'antd';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import {
  CommentOutlined,
  HeartOutlined,
  UserOutlined,
  CheckCircleOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';
import type { StatItemData } from '../../components/StatItem';
import IdDisplay from '../../components/IdDisplay';
import {
  fetchContentCommentsStats,
  fetchContentComments,
  deleteContentComment,
} from '../../api/admin-content';
import type {
  AdminContentCommentStatsResponse,
  AdminContentCommentListItem,
} from '../../types/admin';
import { TABLE_SCROLL_CONFIGS } from '../../constants/table-widths';

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

  const handleDeleteComment = async (commentId: string) => {
    try {
      await deleteContentComment(commentId);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      setPagination((p) => ({ ...p, total: Math.max(0, p.total - 1) }));
      antdMessage.success('Comment deleted');
    } catch (e) {
      antdMessage.error(e instanceof Error ? e.message : 'Failed to delete comment');
    }
  };

  const handleTableChange = (pag: TablePaginationConfig) => {
    const newOffset = ((pag.current ?? 1) - 1) * PAGE_SIZE;
    setPagination((prev) => ({ ...prev, offset: newOffset }));
  };

  const userDisplay = (c: AdminContentCommentListItem) =>
    c.userDisplayName || c.userName || (c.userId ? <IdDisplay id={c.userId} variant="compact" copyable={false} /> : '—');

  const currentPage = Math.floor(pagination.offset / pagination.limit) + 1;

  const columns: ColumnsType<AdminContentCommentListItem> = [
    {
      title: 'Author',
      key: 'user',
      width: 180,
      ellipsis: true,
      render: (_: unknown, record: AdminContentCommentListItem) => (
        <Link
          to={`/users/${record.userId}`}
          style={{ color: 'var(--tipbox-badge-outline)', display: 'inline-flex', alignItems: 'center', gap: 8 }}
        >
          <Avatar size={28} icon={<UserOutlined />} />
          {userDisplay(record)}
        </Link>
      ),
    },
    {
      title: 'Comment',
      key: 'comment',
      ellipsis: true,
      render: (_: unknown, record: AdminContentCommentListItem) => {
        const text = record.comment.length > 140 ? record.comment.slice(0, 140) + '…' : record.comment;
        return (
          <Space size={8}>
            <span title={record.comment}>{text}</span>
            {record.isAnswer && (
              <Tag color="green" style={{ margin: 0, fontSize: 11 }}>
                <CheckCircleOutlined /> Answer
              </Tag>
            )}
          </Space>
        );
      },
    },
    {
      title: 'Post',
      key: 'post',
      width: 200,
      ellipsis: true,
      render: (_: unknown, record: AdminContentCommentListItem) => (
        <Link
          to={`/content/posts/${record.postId}`}
          style={{ color: 'var(--tipbox-badge-outline)' }}
        >
          {record.postTitle
            ? record.postTitle.length > 45
              ? record.postTitle.slice(0, 45) + '…'
              : record.postTitle
            : <IdDisplay id={record.postId} variant="compact" copyable={false} />}
        </Link>
      ),
    },
    {
      title: 'Likes',
      dataIndex: 'likesCount',
      key: 'likesCount',
      width: 70,
      align: 'center',
      render: (count: number) => (
        <Space size={4}>
          <HeartOutlined style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }} />
          {count}
        </Space>
      ),
    },
    {
      title: 'Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 120,
      render: (date: string) =>
        date ? new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—',
    },
    {
      title: '',
      key: 'action',
      width: 50,
      render: (_: unknown, record: AdminContentCommentListItem) => (
        <Popconfirm
          title="Delete this comment?"
          onConfirm={() => handleDeleteComment(record.id)}
          okText="Delete"
          okButtonProps={{ danger: true }}
        >
          <Button type="text" size="small" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ];

  const statsData: StatItemData[] | undefined = stats
    ? [
        {
          label: 'Total Comments',
          value: stats.total,
          icon: <CommentOutlined />,
        },
      ]
    : undefined;

  return (
    <div>
      <PageHeader
        title="Comments"
        description="Moderate user comments"
        icon={<CommentOutlined />}
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
          style={{ marginBottom: 24 }}
        />
      )}

      <Card
        bordered
        title="Comment list"
        extra={
          <Space wrap>
            <Input
              placeholder="Post ID"
              value={postId}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                setPostId(e.target.value.trim());
                setPagination((p) => ({ ...p, offset: 0 }));
              }}
              style={{ width: 150 }}
              allowClear
              size="small"
            />
            <Input
              placeholder="User ID"
              value={userId}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                setUserId(e.target.value.trim());
                setPagination((p) => ({ ...p, offset: 0 }));
              }}
              style={{ width: 150 }}
              allowClear
              size="small"
            />
            <Select
              value={sort}
              onChange={(value: string) => {
                setSort(value as 'createdAt' | 'likesCount');
                setPagination((p) => ({ ...p, offset: 0 }));
              }}
              style={{ width: 110 }}
              size="small"
            >
              <Select.Option value="createdAt">Created</Select.Option>
              <Select.Option value="likesCount">Likes</Select.Option>
            </Select>
            <Select
              value={order}
              onChange={(value: string) => {
                setOrder(value as 'asc' | 'desc');
                setPagination((p) => ({ ...p, offset: 0 }));
              }}
              style={{ width: 110 }}
              size="small"
            >
              <Select.Option value="desc">Newest</Select.Option>
              <Select.Option value="asc">Oldest</Select.Option>
            </Select>
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={comments}
          rowKey="id"
          loading={loadingList}
          scroll={TABLE_SCROLL_CONFIGS.AUTO}
          size="middle"
          pagination={{
            current: currentPage,
            pageSize: PAGE_SIZE,
            total: pagination.total,
            showSizeChanger: false,
            showTotal: (total: number) => `${total} comments`,
          }}
          onChange={handleTableChange}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="No comments found"
              />
            ),
          }}
        />
      </Card>
    </div>
  );
}

export default ContentComments;
