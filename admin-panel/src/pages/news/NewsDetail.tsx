import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  Descriptions,
  Space,
  Button,
  Tag,
  Alert,
  Image,
  Modal,
  message,
  Row,
  Col,
  Statistic,
  Table,
  Typography,
  Divider,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  ArrowLeftOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  LikeOutlined,
  CommentOutlined,
  ShareAltOutlined,
  HeartOutlined,
} from '@ant-design/icons';
import {
  fetchNewsDetail,
  deleteNews,
  fetchNewsComments,
  deleteNewsComment,
} from '../../api/admin-news';
import NewsEditModal from './modals/NewsEditModal';
import type {
  AdminNewsDetailResponse,
  AdminNewsCommentListItem,
} from '../../types/admin-news';

const { Paragraph, Title } = Typography;

function NewsDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [news, setNews] = useState<AdminNewsDetailResponse | null>(null);
  const [comments, setComments] = useState<AdminNewsCommentListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingComments, setLoadingComments] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);

  const loadNewsDetail = async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchNewsDetail(id);
      if (res.data) {
        setNews(res.data);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load news details');
    } finally {
      setLoading(false);
    }
  };

  const loadComments = async () => {
    if (!id) return;
    setLoadingComments(true);
    try {
      const res = await fetchNewsComments(id);
      if (res.data) {
        setComments(res.data);
      }
    } catch (e) {
      console.error('Failed to load comments:', e);
    } finally {
      setLoadingComments(false);
    }
  };

  useEffect(() => {
    loadNewsDetail();
    loadComments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleDelete = async () => {
    if (!id || !news) return;

    Modal.confirm({
      title: 'Delete News Article',
      content: `Are you sure you want to delete "${news.title}"? This action cannot be undone.`,
      okText: 'Delete',
      okType: 'danger',
      onOk: async () => {
        try {
          await deleteNews(id);
          message.success('News article deleted successfully');
          navigate('/news');
        } catch (e) {
          message.error(e instanceof Error ? e.message : 'Failed to delete article');
        }
      },
    });
  };

  const handleDeleteComment = async (commentId: string) => {
    Modal.confirm({
      title: 'Delete Comment',
      content: 'Are you sure you want to delete this comment? This action cannot be undone.',
      okText: 'Delete',
      okType: 'danger',
      onOk: async () => {
        try {
          await deleteNewsComment(commentId);
          message.success('Comment deleted successfully');
          loadComments();
        } catch (e) {
          message.error(e instanceof Error ? e.message : 'Failed to delete comment');
        }
      },
    });
  };

  const handleEditSuccess = () => {
    setEditModalOpen(false);
    loadNewsDetail();
  };

  const commentColumns: ColumnsType<AdminNewsCommentListItem> = [
    {
      title: 'User',
      dataIndex: 'username',
      key: 'username',
      render: (text, record) => text ?? record.userEmail ?? '—',
    },
    {
      title: 'Comment',
      dataIndex: 'content',
      key: 'content',
      ellipsis: true,
    },
    {
      title: 'Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date) => new Date(date).toLocaleString('en-US'),
    },
    {
      title: '',
      key: 'action',
      width: 100,
      render: (_, record) => (
        <Button
          size="small"
          danger
          icon={<DeleteOutlined />}
          onClick={() => handleDeleteComment(record.id)}
        >
          Delete
        </Button>
      ),
    },
  ];

  if (loading) {
    return (
      <div style={{ padding: 24 }}>
        <Alert message="Loading..." type="info" />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 24 }}>
        <Alert
          message="Error"
          description={error}
          type="error"
          action={
            <Button onClick={() => navigate('/news')}>Back to News List</Button>
          }
        />
      </div>
    );
  }

  if (!news) {
    return (
      <div style={{ padding: 24 }}>
        <Alert
          message="News article not found"
          type="warning"
          action={
            <Button onClick={() => navigate('/news')}>Back to News List</Button>
          }
        />
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* Header */}
        <Row justify="space-between" align="middle">
          <Col>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/news')}>
              Back to News List
            </Button>
          </Col>
          <Col>
            <Space>
              <Button icon={<EditOutlined />} onClick={() => setEditModalOpen(true)}>
                Edit
              </Button>
              <Button danger icon={<DeleteOutlined />} onClick={handleDelete}>
                Delete
              </Button>
            </Space>
          </Col>
        </Row>

        {/* Engagement Metrics */}
        <Card title="Engagement Metrics">
          <Row gutter={16}>
            <Col span={4}>
              <Statistic
                title="Views"
                value={news.viewCount}
                prefix={<EyeOutlined />}
              />
            </Col>
            <Col span={4}>
              <Statistic
                title="Likes"
                value={news.likeCount}
                prefix={<LikeOutlined />}
              />
            </Col>
            <Col span={4}>
              <Statistic
                title="Comments"
                value={news.commentCount}
                prefix={<CommentOutlined />}
              />
            </Col>
            <Col span={4}>
              <Statistic
                title="Shares"
                value={news.shareCount}
                prefix={<ShareAltOutlined />}
              />
            </Col>
            <Col span={4}>
              <Statistic
                title="Favorites"
                value={news.favoriteCount}
                prefix={<HeartOutlined />}
              />
            </Col>
          </Row>
        </Card>

        {/* Article Details */}
        <Card title="Article Information">
          {news.bannerImageUrl && (
            <div style={{ marginBottom: 16 }}>
              <Image
                src={news.bannerImageUrl}
                alt="Banner"
                style={{ maxWidth: '100%', maxHeight: 400, borderRadius: 8 }}
              />
            </div>
          )}

          <Title level={2}>{news.title}</Title>

          <Descriptions bordered column={2} style={{ marginTop: 16 }}>
            <Descriptions.Item label="Brand">{news.brandName ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="Source">{news.source}</Descriptions.Item>
            <Descriptions.Item label="Author">{news.author ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="Article ID">{news.id}</Descriptions.Item>
            <Descriptions.Item label="Created">
              {new Date(news.createdAt).toLocaleString('en-US')}
            </Descriptions.Item>
            <Descriptions.Item label="Last Updated">
              {new Date(news.updatedAt).toLocaleString('en-US')}
            </Descriptions.Item>
          </Descriptions>

          {news.tags && news.tags.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <strong>Tags: </strong>
              {news.tags.map((tag) => (
                <Tag key={tag} style={{ marginRight: 4, marginBottom: 4 }}>
                  {tag}
                </Tag>
              ))}
            </div>
          )}

          <Divider />

          <div>
            <Title level={4}>Content</Title>
            <Paragraph>
              <div
                dangerouslySetInnerHTML={{ __html: news.content }}
                style={{
                  border: '1px solid #f0f0f0',
                  padding: 16,
                  borderRadius: 4,
                  maxHeight: 600,
                  overflow: 'auto',
                }}
              />
            </Paragraph>
          </div>
        </Card>

        {/* Recent Comments */}
        <Card title={`Recent Comments (${comments.length})`}>
          <Table
            columns={commentColumns}
            dataSource={comments}
            rowKey="id"
            loading={loadingComments}
            pagination={{
              pageSize: 10,
              showSizeChanger: false,
            }}
          />
        </Card>

        {/* Related Articles */}
        {news.relatedArticles && news.relatedArticles.length > 0 && (
          <Card title="Related Articles from Same Brand">
            <Row gutter={[16, 16]}>
              {news.relatedArticles.map((article) => (
                <Col key={article.id} span={8}>
                  <Card
                    hoverable
                    cover={
                      article.bannerImageUrl ? (
                        <img
                          alt={article.title}
                          src={article.bannerImageUrl}
                          style={{ height: 150, objectFit: 'cover' }}
                        />
                      ) : null
                    }
                    onClick={() => navigate(`/news/${article.id}`)}
                  >
                    <Card.Meta
                      title={article.title}
                      description={
                        <Space>
                          <EyeOutlined /> {article.viewCount}
                          <span style={{ marginLeft: 8 }}>
                            {new Date(article.createdAt).toLocaleDateString()}
                          </span>
                        </Space>
                      }
                    />
                  </Card>
                </Col>
              ))}
            </Row>
          </Card>
        )}
      </Space>

      {/* Edit Modal */}
      {news && (
        <NewsEditModal
          open={editModalOpen}
          newsId={news.id}
          onClose={() => setEditModalOpen(false)}
          onSuccess={handleEditSuccess}
        />
      )}
    </div>
  );
}

export default NewsDetail;
