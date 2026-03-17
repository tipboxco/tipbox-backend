import { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import {
  Row,
  Col,
  Card,
  Button,
  Spin,
  Alert,
  Typography,
  Space,
  Tag,
  Image,
  Modal,
  Empty,
  Avatar,
  Popconfirm,
  message as antdMessage,
} from 'antd';
import {
  FileTextOutlined,
  HeartOutlined,
  CommentOutlined,
  EyeOutlined,
  StarOutlined,
  LineChartOutlined,
  DeleteOutlined,
  UserOutlined,
  CheckCircleOutlined,
  LoadingOutlined,
  EditOutlined,
} from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';
import IdDisplay from '../../components/IdDisplay';
import {
  fetchContentPost,
  deleteContentPost,
  createFeedHighlight,
  createTrending,
  fetchContentComments,
  deleteContentComment,
} from '../../api/admin-content';
import type { AdminContentPostDetailResponse, AdminContentCommentListItem } from '../../types/admin';
import { BADGE_COLOR_PRIMARY, BADGE_COLOR_SECONDARY } from '../../constants/badge-colors';
import EditPostModal from '../../components/content/EditPostModal';

const { Text, Paragraph } = Typography;

function ContentPostDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [post, setPost] = useState<AdminContentPostDetailResponse | null>(null);
  const [comments, setComments] = useState<AdminContentCommentListItem[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const res = await fetchContentPost(id);
        if (!cancelled && res.data) setPost(res.data);
      } catch (e) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : 'Failed to load post');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setCommentsLoading(true);
    (async () => {
      try {
        const res = await fetchContentComments({ postId: id, limit: 50, sort: 'createdAt', order: 'desc' });
        if (!cancelled) setComments(res.data ?? []);
      } catch {
        // silently fail
      } finally {
        if (!cancelled) setCommentsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  const reloadPost = async () => {
    if (!id) return;
    try {
      const res = await fetchContentPost(id);
      if (res.data) setPost(res.data);
    } catch (e) {
      antdMessage.error(e instanceof Error ? e.message : 'Failed to reload post');
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      await deleteContentComment(commentId);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      antdMessage.success('Comment deleted');
    } catch (e) {
      antdMessage.error(e instanceof Error ? e.message : 'Failed to delete comment');
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    Modal.confirm({
      title: 'Delete Post',
      content: 'Are you sure you want to delete this post? This action cannot be undone.',
      okText: 'Delete',
      cancelText: 'Cancel',
      okButtonProps: { danger: true },
      onOk: async () => {
        setActionLoading(true);
        try {
          await deleteContentPost(id);
          antdMessage.success('Post deleted');
          setTimeout(() => navigate('/content/posts'), 1000);
        } catch (e) {
          antdMessage.error(e instanceof Error ? e.message : 'Failed to delete');
        } finally {
          setActionLoading(false);
        }
      },
    });
  };

  const handleAddHighlight = async (reason: string) => {
    if (!id) return;
    setActionLoading(true);
    try {
      await createFeedHighlight({ postId: id, reason });
      antdMessage.success('Feed highlight added');
      const res = await fetchContentPost(id);
      if (res.data) setPost(res.data);
    } catch (e) {
      antdMessage.error(e instanceof Error ? e.message : 'Failed to add');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddTrending = async (trendPeriod: string) => {
    if (!id) return;
    setActionLoading(true);
    try {
      await createTrending({ postId: id, trendPeriod });
      antdMessage.success('Added to trending');
    } catch (e) {
      antdMessage.error(e instanceof Error ? e.message : 'Failed to add');
    } finally {
      setActionLoading(false);
    }
  };

  if (!id) {
    return (
      <div>
        <Alert message="Invalid post ID" type="error" />
        <Link to="/content/posts">
          <Button style={{ marginTop: 16 }}>Back to list</Button>
        </Link>
      </div>
    );
  }

  if (loading || !post) {
    return (
      <div style={{ textAlign: 'center', padding: 48 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <Alert
          message="Error"
          description={error || 'Post not found'}
          type="error"
          style={{ marginBottom: 16 }}
        />
        <Link to="/content/posts">
          <Button>Back to list</Button>
        </Link>
      </div>
    );
  }

  const userDisplay = post.userDisplayName || post.userName || (post.userId ? <IdDisplay id={post.userId} variant="compact" copyable={false} /> : '—');
  const isImageUrl = (url: string) =>
    /\.(jpe?g|png|gif|webp|avif)(\?|$)/i.test(url) || /\/image\//i.test(url);

  return (
    <div>
      <PageHeader
        title={post.title || (post.body ? post.body.slice(0, 60) + (post.body.length > 60 ? '...' : '') : `Post ${post.type}`)}
        description={`ID: ${post.id}`}
        icon={<FileTextOutlined />}
        backTo="/content/posts"
        backLabel="Back to list"
      />

      <Row gutter={[16, 16]}>
        {/* Left: Content + Media (16/24) */}
        <Col xs={24} lg={16}>
          {/* Body Content */}
          {post.body && (
            <Card bordered title="Content" style={{ marginBottom: 16 }}>
              <Paragraph style={{ whiteSpace: 'pre-wrap' }}>{post.body}</Paragraph>
            </Card>
          )}

          {/* Media */}
          {post.media && post.media.length > 0 && (
            <Card bordered title="Media" style={{ marginBottom: 16 }}>
              <Row gutter={[16, 16]}>
                {post.media.map((m) => (
                  <Col xs={24} sm={12} md={8} key={m.id}>
                    {isImageUrl(m.mediaUrl) ? (
                      <Image
                        src={m.mediaUrl}
                        alt={`Media ${m.orderIndex + 1}`}
                        style={{
                          width: '100%',
                          height: 200,
                          objectFit: 'cover',
                          borderRadius: 4,
                        }}
                      />
                    ) : (
                      <a
                        href={m.mediaUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          height: 200,
                          border: '1px dashed rgba(255,255,255,0.12)',
                          borderRadius: 4,
                          textDecoration: 'none',
                        }}
                      >
                        <Space orientation="vertical" align="center">
                          <FileTextOutlined style={{ fontSize: 37 }} />
                          <Text>Media {m.orderIndex + 1}</Text>
                          <Text type="secondary" style={{ fontSize: 14 }}>
                            Open
                          </Text>
                        </Space>
                      </a>
                    )}
                  </Col>
                ))}
              </Row>
            </Card>
          )}

          {/* Comments */}
          <Card
            bordered
            title={
              <Space size={8}>
                <CommentOutlined />
                <span>Comments</span>
                <Tag>{comments.length}</Tag>
              </Space>
            }
          >
            {commentsLoading ? (
              <div style={{ textAlign: 'center', padding: 32 }}>
                <Spin indicator={<LoadingOutlined />} />
              </div>
            ) : comments.length === 0 ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No comments yet" />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {comments.map((c, idx) => {
                  const commentUser = c.userDisplayName || c.userName || 'Anonymous';
                  return (
                    <div
                      key={c.id}
                      style={{
                        padding: '12px 0',
                        borderBottom: idx < comments.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                      }}
                    >
                      <div style={{ display: 'flex', gap: 10 }}>
                        <Link to={`/users/${c.userId}`}>
                          <Avatar size={32} icon={<UserOutlined />} style={{ flexShrink: 0 }} />
                        </Link>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                            <Link
                              to={`/users/${c.userId}`}
                              style={{ color: 'var(--tipbox-badge-outline)', fontWeight: 500, fontSize: 13 }}
                            >
                              {commentUser}
                            </Link>
                            {c.isAnswer && (
                              <Tag color="green" style={{ margin: 0, fontSize: 11, lineHeight: '18px' }}>
                                <CheckCircleOutlined /> Answer
                              </Tag>
                            )}
                            <Text type="secondary" style={{ fontSize: 12, marginLeft: 'auto', flexShrink: 0 }}>
                              {new Date(c.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </Text>
                          </div>
                          <Paragraph style={{ margin: 0, fontSize: 13, whiteSpace: 'pre-wrap' }}>
                            {c.comment}
                          </Paragraph>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 6 }}>
                            <Space size={4}>
                              <HeartOutlined style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }} />
                              <Text type="secondary" style={{ fontSize: 12 }}>{c.likesCount}</Text>
                            </Space>
                            <Popconfirm
                              title="Delete this comment?"
                              onConfirm={() => handleDeleteComment(c.id)}
                              okText="Delete"
                              okButtonProps={{ danger: true }}
                            >
                              <Button type="text" size="small" danger icon={<DeleteOutlined />} style={{ fontSize: 12, height: 22, padding: '0 4px' }}>
                                Delete
                              </Button>
                            </Popconfirm>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </Col>

        {/* Right: Summary + Actions (8/24) */}
        <Col xs={24} lg={8}>
          {/* Info */}
          <Card bordered style={{ marginBottom: 16 }}>
            <Space direction="vertical" style={{ width: '100%' }} size={16}>
              {/* Type badges */}
              <Space size="small" wrap>
                <Tag color={BADGE_COLOR_PRIMARY}>{post.type}</Tag>
                {post.isBoosted && <Tag color={BADGE_COLOR_SECONDARY}>Boosted</Tag>}
              </Space>

              {/* Stats */}
              <Space size="large" wrap>
                <Space size={4}>
                  <HeartOutlined />
                  <Text>{post.likesCount}</Text>
                </Space>
                <Space size={4}>
                  <CommentOutlined />
                  <Text>{post.commentsCount}</Text>
                </Space>
                <Space size={4}>
                  <EyeOutlined />
                  <Text>{post.viewsCount}</Text>
                </Space>
              </Space>

              {/* Author */}
              <div>
                <Text type="secondary" style={{ fontSize: 12 }}>Author</Text>
                <div>
                  <Link
                    to={`/users/${post.userId}`}
                    style={{ color: 'var(--tipbox-badge-outline)', textDecoration: 'underline' }}
                  >
                    {userDisplay}
                  </Link>
                </div>
              </div>

              {/* Created */}
              <div>
                <Text type="secondary" style={{ fontSize: 12 }}>Created</Text>
                <div>
                  <Text>{post.createdAt ? new Date(post.createdAt).toLocaleString('en-US') : '—'}</Text>
                </div>
              </div>

              {/* Category */}
              {(post.mainCategory || post.subCategory) && (
                <div>
                  <Text type="secondary" style={{ fontSize: 12 }}>Category</Text>
                  <div>
                    <Text>
                      {[post.mainCategory?.name, post.subCategory?.name].filter(Boolean).join(' / ')}
                    </Text>
                  </div>
                </div>
              )}

              {/* Product */}
              {post.product && (
                <div>
                  <Text type="secondary" style={{ fontSize: 12 }}>Product</Text>
                  <div><Text>{post.product.name}</Text></div>
                </div>
              )}

              {/* Event */}
              {post.event && (
                <div>
                  <Text type="secondary" style={{ fontSize: 12 }}>Event</Text>
                  <div>
                    <Text>{post.event.title} <Text type="secondary">({post.event.status})</Text></Text>
                  </div>
                </div>
              )}

              {/* Tags */}
              {post.tags && post.tags.length > 0 && (
                <div>
                  <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Tags</Text>
                  <Space size={[4, 4]} wrap>
                    {post.tags.map((tag) => (
                      <Tag key={tag} color={BADGE_COLOR_PRIMARY}>{tag}</Tag>
                    ))}
                  </Space>
                </div>
              )}
            </Space>
          </Card>

          {/* Actions */}
          <Card bordered title="Actions">
            <Space direction="vertical" style={{ width: '100%' }} size={12}>
              <Button
                type="primary"
                icon={<EditOutlined />}
                size="small"
                onClick={() => setEditModalOpen(true)}
                block
              >
                Edit Post
              </Button>
              <Space wrap>
                <Button
                  icon={<StarOutlined />}
                  size="small"
                  disabled={actionLoading}
                  onClick={() => handleAddHighlight('STAFF_PICK')}
                >
                  Staff Pick
                </Button>
                <Button
                  icon={<LineChartOutlined />}
                  size="small"
                  disabled={actionLoading}
                  onClick={() => handleAddTrending('DAILY')}
                >
                  Daily Trending
                </Button>
                <Button
                  icon={<LineChartOutlined />}
                  size="small"
                  disabled={actionLoading}
                  onClick={() => handleAddTrending('WEEKLY')}
                >
                  Weekly Trending
                </Button>
              </Space>
              <Button
                danger
                icon={<DeleteOutlined />}
                size="small"
                loading={actionLoading}
                onClick={handleDelete}
              >
                Delete Post
              </Button>
            </Space>
          </Card>
        </Col>
      </Row>

      {/* Edit Post Modal */}
      {post && (
        <EditPostModal
          open={editModalOpen}
          post={post}
          onClose={() => setEditModalOpen(false)}
          onSuccess={reloadPost}
        />
      )}
    </div>
  );
}

export default ContentPostDetail;
