import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  Table,
  Input,
  Select,
  Space,
  Button,
  Tag,
  Empty,
  Alert,
  Row,
  Col,
  Image,
  Modal,
  message,
  DatePicker,
} from 'antd';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import type { Dayjs } from 'dayjs';
import {
  FileTextOutlined,
  SearchOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';
import type { StatItemData } from '../../components/StatItem';
import NewsCreateModal from './modals/NewsCreateModal';
import NewsEditModal from './modals/NewsEditModal';
import {
  fetchNewsStats,
  fetchNewsList,
  deleteNews,
} from '../../api/admin-news';
import type {
  AdminNewsStatsResponse,
  AdminNewsListItem,
} from '../../types/admin-news';
import { TABLE_COLUMN_WIDTHS, TABLE_SCROLL_CONFIGS } from '../../constants/table-widths';

const { RangePicker } = DatePicker;
const PAGE_SIZE = 20;

function NewsList() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<AdminNewsStatsResponse | null>(null);
  const [newsList, setNewsList] = useState<AdminNewsListItem[]>([]);
  const [pagination, setPagination] = useState({
    total: 0,
    limit: PAGE_SIZE,
    offset: 0,
  });
  const [loading, setLoading] = useState(true);
  const [loadingList, setLoadingList] = useState(true);
  const [search, setSearch] = useState('');
  const [brandFilter, setBrandFilter] = useState<string | undefined>(undefined);
  const [sourceFilter, setSourceFilter] = useState<string | undefined>(undefined);
  const [dateRange, setDateRange] = useState<[Dayjs | null, Dayjs | null] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedNews, setSelectedNews] = useState<AdminNewsListItem | null>(null);

  // Load stats
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchNewsStats();
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

  // Load news list
  const loadNews = async () => {
    setLoadingList(true);
    try {
      const res = await fetchNewsList({
        limit: PAGE_SIZE,
        offset: pagination.offset,
        search: search || undefined,
        brandId: brandFilter,
        source: sourceFilter,
        dateFrom: dateRange?.[0]?.toISOString(),
        dateTo: dateRange?.[1]?.toISOString(),
      });
      setNewsList(res.data ?? []);
      if (res.pagination) setPagination(res.pagination);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load news');
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    loadNews();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.offset, search, brandFilter, sourceFilter, dateRange]);

  const handleCreateSuccess = () => {
    loadNews();
  };

  const handleEditSuccess = () => {
    setEditModalOpen(false);
    setSelectedNews(null);
    loadNews();
  };

  const handleDelete = async (id: string, title: string) => {
    Modal.confirm({
      title: 'Delete News Article',
      content: `Are you sure you want to delete "${title}"? This action cannot be undone.`,
      okText: 'Delete',
      okType: 'danger',
      onOk: async () => {
        try {
          await deleteNews(id);
          message.success('News article deleted successfully');
          loadNews();
        } catch (e) {
          message.error(e instanceof Error ? e.message : 'Failed to delete article');
        }
      },
    });
  };

  const openEditModal = (news: AdminNewsListItem) => {
    setSelectedNews(news);
    setEditModalOpen(true);
  };

  const columns: ColumnsType<AdminNewsListItem> = [
    {
      title: 'Banner',
      dataIndex: 'bannerImageUrl',
      key: 'banner',
      width: TABLE_COLUMN_WIDTHS.IMAGE_SMALL,
      render: (url) =>
        url ? (
          <Image
            src={url}
            alt="Banner"
            width={60}
            height={40}
            style={{ objectFit: 'cover', borderRadius: 4 }}
          />
        ) : (
          <div style={{ width: 60, height: 40, background: '#f0f0f0', borderRadius: 4 }} />
        ),
    },
    {
      title: 'Title',
      dataIndex: 'title',
      key: 'title',
      width: TABLE_COLUMN_WIDTHS.LONG_TEXT,
      ellipsis: true,
      render: (title, record) => (
        <a onClick={() => navigate(`/news/${record.id}`)} style={{ cursor: 'pointer' }}>
          {title}
        </a>
      ),
    },
    {
      title: 'Brand',
      dataIndex: 'brandName',
      key: 'brandName',
      width: TABLE_COLUMN_WIDTHS.MEDIUM_TEXT,
      ellipsis: true,
      render: (text) => text ?? '—',
    },
    {
      title: 'Source',
      dataIndex: 'source',
      key: 'source',
      width: TABLE_COLUMN_WIDTHS.SHORT_TEXT,
      ellipsis: true,
    },
    {
      title: 'Author',
      dataIndex: 'author',
      key: 'author',
      width: TABLE_COLUMN_WIDTHS.MEDIUM_TEXT,
      ellipsis: true,
      render: (text) => text ?? '—',
    },
    {
      title: 'Views',
      dataIndex: 'viewCount',
      key: 'viewCount',
      width: TABLE_COLUMN_WIDTHS.SHORT_TEXT,
      align: 'right',
    },
    {
      title: 'Likes',
      dataIndex: 'likeCount',
      key: 'likeCount',
      width: TABLE_COLUMN_WIDTHS.SHORT_TEXT,
      align: 'right',
    },
    {
      title: 'Comments',
      dataIndex: 'commentCount',
      key: 'commentCount',
      width: TABLE_COLUMN_WIDTHS.SHORT_TEXT,
      align: 'right',
    },
    {
      title: 'Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: TABLE_COLUMN_WIDTHS.DATE_SHORT,
      ellipsis: true,
      render: (date) => (date ? new Date(date).toLocaleDateString('en-US') : '—'),
    },
    {
      title: '',
      key: 'action',
      width: TABLE_COLUMN_WIDTHS.ACTION_BUTTON_TRIPLE,
      render: (_, record) => (
        <Space size="small">
          <Button
            size="small"
            type="text"
            icon={<EyeOutlined />}
            onClick={() => navigate(`/news/${record.id}`)}
          />
          <Button
            size="small"
            type="text"
            icon={<EditOutlined />}
            onClick={() => openEditModal(record)}
          />
          <Button
            size="small"
            type="text"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record.id, record.title)}
          />
        </Space>
      ),
    },
  ];

  const handleTableChange = (pag: TablePaginationConfig) => {
    const newOffset = ((pag.current ?? 1) - 1) * PAGE_SIZE;
    setPagination((prev) => ({ ...prev, offset: newOffset }));
  };

  const currentPage = Math.floor(pagination.offset / pagination.limit) + 1;

  const statsData: StatItemData[] | undefined = stats
    ? [
        {
          label: 'Total Articles',
          value: stats.total,
          icon: <FileTextOutlined />,
        },
        {
          label: 'Views This Month',
          value: stats.viewsThisMonth,
          icon: <EyeOutlined />,
        },
        {
          label: 'Avg Comments',
          value: stats.avgComments,
          icon: <FileTextOutlined />,
        },
        ...(stats.mostPopularBrand
          ? [
              {
                label: `Most Popular: ${stats.mostPopularBrand.brandName}`,
                value: stats.mostPopularBrand.articleCount,
                icon: <FileTextOutlined />,
              },
            ]
          : []),
      ]
    : undefined;

  return (
    <div>
      <PageHeader
        title="News Articles"
        description="Manage brand news and articles"
        icon={<FileTextOutlined />}
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
          style={{ marginBottom: 16 }}
        />
      )}

      <Card>
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Row justify="space-between" align="middle">
            <Col>
              <Space wrap>
                <Input
                  placeholder="Search articles..."
                  prefix={<SearchOutlined />}
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPagination((prev) => ({ ...prev, offset: 0 }));
                  }}
                  style={{ width: 250 }}
                  allowClear
                />
                <Input
                  placeholder="Filter by Brand ID"
                  value={brandFilter}
                  onChange={(e) => {
                    setBrandFilter(e.target.value || undefined);
                    setPagination((prev) => ({ ...prev, offset: 0 }));
                  }}
                  style={{ width: 200 }}
                  allowClear
                />
                <Input
                  placeholder="Filter by Source"
                  value={sourceFilter}
                  onChange={(e) => {
                    setSourceFilter(e.target.value || undefined);
                    setPagination((prev) => ({ ...prev, offset: 0 }));
                  }}
                  style={{ width: 150 }}
                  allowClear
                />
                <RangePicker
                  value={dateRange}
                  onChange={(dates) => {
                    setDateRange(dates as [Dayjs | null, Dayjs | null] | null);
                    setPagination((prev) => ({ ...prev, offset: 0 }));
                  }}
                  style={{ width: 260 }}
                />
              </Space>
            </Col>
            <Col>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => setCreateModalOpen(true)}
              >
                Create Article
              </Button>
            </Col>
          </Row>

          <Table
            columns={columns}
            dataSource={newsList}
            loading={loadingList}
            rowKey="id"
            pagination={{
              current: currentPage,
              pageSize: PAGE_SIZE,
              total: pagination.total,
              showSizeChanger: false,
              showTotal: (total) => `Total ${total} articles`,
            }}
            onChange={handleTableChange}
            scroll={TABLE_SCROLL_CONFIGS.DEFAULT}
            locale={{
              emptyText: <Empty description="No news articles found" />,
            }}
          />
        </Space>
      </Card>

      {/* Create News Modal */}
      <NewsCreateModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onSuccess={handleCreateSuccess}
      />

      {/* Edit News Modal */}
      {selectedNews && (
        <NewsEditModal
          open={editModalOpen}
          newsId={selectedNews.id}
          onClose={() => {
            setEditModalOpen(false);
            setSelectedNews(null);
          }}
          onSuccess={handleEditSuccess}
        />
      )}
    </div>
  );
}

export default NewsList;
