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
import {
  fetchContentPost,
  deleteContentPost,
  createFeedHighlight,
  createTrending,
} from '../../api/admin-content';
import type { AdminContentPostDetailResponse } from '../../types/admin';

const { Text, Paragraph } = Typography;

const getTypeColor = (type: string) => {
  const map: Record<string, string> = {
    FREE: 'default',
    TIPS: 'gold',
    EXPERIENCE: 'blue',
    QUESTION: 'purple',
    COMPARE: 'cyan',
    UPDATE: 'green',
  };
  return map[type] ?? 'default';
};

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
          setError(e instanceof Error ? e.message : 'Post yüklenemedi');
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
      title: 'Postu Sil',
      content: 'Bu postu silmek istediğinize emin misiniz? Bu işlem geri alınamaz.',
      okText: 'Sil',
      cancelText: 'İptal',
      okButtonProps: { danger: true },
      onOk: async () => {
        setActionLoading(true);
        try {
          await deleteContentPost(id);
          antdMessage.success('Post silindi');
          setTimeout(() => navigate('/content/posts'), 1000);
        } catch (e) {
          antdMessage.error(e instanceof Error ? e.message : 'Silinemedi');
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
      antdMessage.success('Feed highlight eklendi');
      const res = await fetchContentPost(id);
      if (res.data) setPost(res.data);
    } catch (e) {
      antdMessage.error(e instanceof Error ? e.message : 'Eklenemedi');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddTrending = async (trendPeriod: string) => {
    if (!id) return;
    setActionLoading(true);
    try {
      await createTrending({ postId: id, trendPeriod });
      antdMessage.success("Trending'e eklendi");
    } catch (e) {
      antdMessage.error(e instanceof Error ? e.message : 'Eklenemedi');
    } finally {
      setActionLoading(false);
    }
  };

  if (!id) {
    return (
      <div>
        <Alert message="Geçersiz post ID" type="error" />
        <Link to="/content/posts">
          <Button style={{ marginTop: 16 }}>Listeye dön</Button>
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
          message="Hata"
          description={error || 'Post bulunamadı'}
          type="error"
          style={{ marginBottom: 16 }}
        />
        <Link to="/content/posts">
          <Button>Listeye dön</Button>
        </Link>
      </div>
    );
  }

  const userDisplay = post.userDisplayName || post.userName || post.userId?.slice(0, 8) || '—';
  const isImageUrl = (url: string) =>
    /\.(jpe?g|png|gif|webp|avif)(\?|$)/i.test(url) || /\/image\//i.test(url);

  return (
    <div>
      <PageHeader
        title={post.title || 'Başlıksız Post'}
        description={`ID: ${post.id}`}
        icon={<FileTextOutlined />}
        backTo="/content/posts"
        backLabel="Listeye dön"
      />

      {/* Header with badges */}
      <Card bordered style={{ marginBottom: 16 }}>
        <Space size="middle" wrap>
          <Tag color={getTypeColor(post.type)}>{post.type}</Tag>
          {post.isBoosted && <Tag color="gold">Boosted</Tag>}
        </Space>
      </Card>

      {/* Summary */}
      <Card bordered title="Özet" style={{ marginBottom: 16 }}>
        <Row gutter={[16, 16]}>
          <Col xs={24} md={12}>
            <Space direction="vertical" style={{ width: '100%' }} size={12}>
              <div>
                <Text type="secondary">Yazar</Text>
                <div>
                  <Link to={`/users/${post.userId}`}>
                    <Button type="link" size="small" style={{ padding: 0 }}>
                      {userDisplay}
                    </Button>
                  </Link>
                </div>
              </div>
              <div>
                <Text type="secondary">Oluşturulma</Text>
                <div>
                  <Text>
                    {post.createdAt ? new Date(post.createdAt).toLocaleString('tr-TR') : '—'}
                  </Text>
                </div>
              </div>
              {(post.mainCategory || post.subCategory) && (
                <div>
                  <Text type="secondary">Kategori</Text>
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
            <Space direction="vertical" style={{ width: '100%' }} size={12}>
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
                  <Text type="secondary">Ürün</Text>
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
              Tag'ler
            </Text>
            <Space size={[8, 8]} wrap>
              {post.tags.map((tag) => (
                <Tag key={tag}>{tag}</Tag>
              ))}
            </Space>
          </div>
        )}
      </Card>

      {/* Body Content */}
      {post.body && (
        <Card bordered title="İçerik" style={{ marginBottom: 16 }}>
          <Paragraph style={{ whiteSpace: 'pre-wrap' }}>{post.body}</Paragraph>
        </Card>
      )}

      {/* Media */}
      {post.media && post.media.length > 0 && (
        <Card bordered title="Medya" style={{ marginBottom: 16 }}>
          <Row gutter={[16, 16]}>
            {post.media.map((m) => (
              <Col xs={24} sm={12} md={8} lg={6} key={m.id}>
                {isImageUrl(m.mediaUrl) ? (
                  <Image
                    src={m.mediaUrl}
                    alt={`Medya ${m.orderIndex + 1}`}
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
                    <Space direction="vertical" align="center">
                      <FileTextOutlined style={{ fontSize: 32 }} />
                      <Text>Medya {m.orderIndex + 1}</Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        Aç
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
      <Card bordered title="İşlemler">
        <Space direction="vertical" style={{ width: '100%' }} size={16}>
          <div>
            <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
              Öne Çıkarma
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
                Günlük Trending
              </Button>
              <Button
                icon={<LineChartOutlined />}
                disabled={actionLoading}
                onClick={() => handleAddTrending('WEEKLY')}
              >
                Haftalık Trending
              </Button>
            </Space>
          </div>

          <div>
            <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
              Tehlikeli İşlemler
            </Text>
            <Button
              danger
              icon={<DeleteOutlined />}
              loading={actionLoading}
              onClick={handleDelete}
            >
              Postu Sil
            </Button>
          </div>
        </Space>
      </Card>
    </div>
  );
}

export default ContentPostDetail;
