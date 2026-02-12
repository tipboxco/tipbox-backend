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
} from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';
import IdDisplay from '../../components/IdDisplay';
import {
  fetchContentPost,
  deleteContentPost,
  createFeedHighlight,
  createTrending,
} from '../../api/admin-content';
import type { AdminContentPostDetailResponse } from '../../types/admin';
import { BADGE_COLOR_PRIMARY, BADGE_COLOR_SECONDARY } from '../../constants/badge-colors';

const { Text, Paragraph } = Typography;

function ContentPostDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [post, setPost] = useState<AdminContentPostDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

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
        title={post.title || 'Untitled Post'}
        description={`ID: ${post.id}`}
        icon={<FileTextOutlined />}
        backTo="/content/posts"
        backLabel="Back to list"
      />

      {/* Header with badges */}
      <Card bordered style={{ marginBottom: 16 }}>
        <Space size="middle" wrap>
          <Tag color={BADGE_COLOR_PRIMARY}>{post.type}</Tag>
          {post.isBoosted && <Tag color={BADGE_COLOR_SECONDARY}>Boosted</Tag>}
        </Space>
      </Card>

      {/* Summary */}
      <Card bordered title="Summary" style={{ marginBottom: 16 }}>
        <Row gutter={[16, 16]}>
          <Col xs={24} md={12}>
            <Space orientation="vertical" style={{ width: '100%' }} size={12}>
              <div>
                <Text type="secondary">Author</Text>
                <div>
                  <Link
                    to={`/users/${post.userId}`}
                    style={{ color: 'var(--tipbox-badge-outline)', textDecoration: 'underline' }}
                  >
                    {userDisplay}
                  </Link>
                </div>
              </div>
              <div>
                <Text type="secondary">Created</Text>
                <div>
                  <Text>
                    {post.createdAt ? new Date(post.createdAt).toLocaleString('en-US') : '—'}
                  </Text>
                </div>
              </div>
              {(post.mainCategory || post.subCategory) && (
                <div>
                  <Text type="secondary">Category</Text>
                  <div>
                    <Text>
                      {[post.mainCategory?.name, post.subCategory?.name]
                        .filter(Boolean)
                        .join(' / ')}
                    </Text>
                  </div>
                </div>
              )}
            </Space>
          </Col>
          <Col xs={24} md={12}>
            <Space orientation="vertical" style={{ width: '100%' }} size={12}>
              <Space size="large">
                <Space>
                  <HeartOutlined />
                  <Text>{post.likesCount}</Text>
                </Space>
                <Space>
                  <CommentOutlined />
                  <Text>{post.commentsCount}</Text>
                </Space>
                <Space>
                  <EyeOutlined />
                  <Text>{post.viewsCount}</Text>
                </Space>
              </Space>
              {post.product && (
                <div>
                  <Text type="secondary">Product</Text>
                  <div>
                    <Text>{post.product.name}</Text>
                  </div>
                </div>
              )}
              {post.event && (
                <div>
                  <Text type="secondary">Event</Text>
                  <div>
                    <Text>
                      {post.event.title}{' '}
                      <Text type="secondary">({post.event.status})</Text>
                    </Text>
                  </div>
                </div>
              )}
            </Space>
          </Col>
        </Row>

        {post.tags && post.tags.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
              Tags
            </Text>
            <Space size={[8, 8]} wrap>
              {post.tags.map((tag) => (
                <Tag key={tag} color={BADGE_COLOR_PRIMARY}>{tag}</Tag>
              ))}
            </Space>
          </div>
        )}
      </Card>

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
              <Col xs={24} sm={12} md={8} lg={6} key={m.id}>
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

      {/* Actions */}
      <Card bordered title="Actions">
        <Space orientation="vertical" style={{ width: '100%' }} size={16}>
          <div>
            <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
              Highlight
            </Text>
            <Space wrap>
              <Button
                icon={<StarOutlined />}
                disabled={actionLoading}
                onClick={() => handleAddHighlight('STAFF_PICK')}
              >
                Staff Pick
              </Button>
              <Button
                icon={<LineChartOutlined />}
                disabled={actionLoading}
                onClick={() => handleAddTrending('DAILY')}
              >
                Daily Trending
              </Button>
              <Button
                icon={<LineChartOutlined />}
                disabled={actionLoading}
                onClick={() => handleAddTrending('WEEKLY')}
              >
                Weekly Trending
              </Button>
            </Space>
          </div>

          <div>
            <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
              Danger Zone
            </Text>
            <Button
              danger
              icon={<DeleteOutlined />}
              loading={actionLoading}
              onClick={handleDelete}
            >
              Delete Post
            </Button>
          </div>
        </Space>
      </Card>
    </div>
  );
}

export default ContentPostDetail;
