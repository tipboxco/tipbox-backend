import { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Input,
  Space,
  Button,
  Empty,
  Alert,
  Row,
  Modal,
  Descriptions,
  List,
} from 'antd';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import {
  SwapOutlined,
  SearchOutlined,
  EyeOutlined,
  LikeOutlined,
  CommentOutlined,
  EyeInvisibleOutlined,
} from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';
import { type StatItemData } from '../../components/StatItem';
import ViewActionButton from '../../components/ViewActionButton';
import {
  fetchProductComparisonStats,
  fetchProductComparisons,
  fetchProductComparison,
} from '../../api/admin-products';
import type {
  AdminProductComparisonStatsResponse,
  AdminProductComparisonListItem,
  AdminProductComparisonDetailResponse,
} from '../../api/admin-products';
import { TABLE_COLUMN_WIDTHS, TABLE_SCROLL_CONFIGS } from '../../constants/table-widths';

const PAGE_SIZE = 20;

function ProductComparisons() {
  const [stats, setStats] = useState<AdminProductComparisonStatsResponse | null>(null);
  const [comparisons, setComparisons] = useState<AdminProductComparisonListItem[]>([]);
  const [pagination, setPagination] = useState({
    total: 0,
    limit: PAGE_SIZE,
    offset: 0,
  });
  const [loading, setLoading] = useState(true);
  const [loadingList, setLoadingList] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedComparison, setSelectedComparison] = useState<AdminProductComparisonDetailResponse | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchProductComparisonStats();
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

  const loadComparisons = async () => {
    setLoadingList(true);
    try {
      const res = await fetchProductComparisons({
        limit: PAGE_SIZE,
        offset: pagination.offset,
        search: search || undefined,
      });
      setComparisons(res.data ?? []);
      if (res.pagination) setPagination(res.pagination);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load comparisons');
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    loadComparisons();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.offset, search]);

  const openDetailModal = async (id: string) => {
    setLoadingDetail(true);
    setDetailModalOpen(true);
    try {
      const res = await fetchProductComparison(id);
      setSelectedComparison(res.data);
    } catch (e) {
      Alert.error({
        title: 'Error',
        content: e instanceof Error ? e.message : 'Failed to load comparison details',
      });
    } finally {
      setLoadingDetail(false);
    }
  };

  const columns: ColumnsType<AdminProductComparisonListItem> = [
    {
      title: 'Title',
      dataIndex: 'title',
      key: 'title',
      width: TABLE_COLUMN_WIDTHS.LONG_TEXT,
      ellipsis: true,
    },
    {
      title: 'User',
      dataIndex: 'username',
      key: 'username',
      width: TABLE_COLUMN_WIDTHS.MEDIUM_TEXT,
      ellipsis: true,
      render: (text, record) => text ?? record.userEmail ?? '—',
    },
    {
      title: 'Products',
      dataIndex: 'productCount',
      key: 'productCount',
      width: TABLE_COLUMN_WIDTHS.SHORT_TEXT,
      align: 'right',
    },
    {
      title: 'Category',
      dataIndex: 'categoryName',
      key: 'categoryName',
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
      render: (count) => count ?? 0,
    },
    {
      title: 'Likes',
      dataIndex: 'likeCount',
      key: 'likeCount',
      width: TABLE_COLUMN_WIDTHS.SHORT_TEXT,
      align: 'right',
      render: (count) => count ?? 0,
    },
    {
      title: 'Comments',
      dataIndex: 'commentCount',
      key: 'commentCount',
      width: TABLE_COLUMN_WIDTHS.SHORT_TEXT,
      align: 'right',
      render: (count) => count ?? 0,
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
      width: TABLE_COLUMN_WIDTHS.ACTION_BUTTON_DOUBLE,
      render: (_, record) => (
        <Space size="small">
          <Button
            size="small"
            type="text"
            icon={<EyeOutlined />}
            onClick={() => openDetailModal(record.id)}
          />
          <ViewActionButton to={`/content/posts/${record.id}`} />
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
          label: 'Total Comparisons',
          value: stats.total,
          icon: <SwapOutlined />,
        },
        {
          label: 'This Week',
          value: stats.thisWeek,
          icon: <SwapOutlined />,
        },
        {
          label: 'Avg Products',
          value: stats.avgProductsCompared ?? '—',
          icon: <SwapOutlined />,
        },
        {
          label: 'Top Category',
          value: stats.topCategory ?? '—',
          icon: <SwapOutlined />,
        },
      ]
    : undefined;

  return (
    <div>
      <PageHeader
        title="Comparisons"
        description="Manage product comparison posts"
        icon={<SwapOutlined />}
        statsData={statsData}
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

      <Card bordered={false}>
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Row justify="space-between" align="middle">
            <Input
              placeholder="Search comparisons..."
              prefix={<SearchOutlined />}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: 250 }}
              allowClear
            />
          </Row>

          <Table
            columns={columns}
            dataSource={comparisons}
            loading={loadingList}
            rowKey="id"
            pagination={{
              current: currentPage,
              pageSize: PAGE_SIZE,
              total: pagination.total,
              showSizeChanger: false,
              showTotal: (total) => `Total ${total} comparisons`,
            }}
            onChange={handleTableChange}
            scroll={TABLE_SCROLL_CONFIGS.DEFAULT}
            locale={{
              emptyText: <Empty description="No product comparisons found" />,
            }}
          />
        </Space>
      </Card>

      {/* Detail Modal */}
      <Modal
        title="Comparison Details"
        open={detailModalOpen}
        onCancel={() => {
          setDetailModalOpen(false);
          setSelectedComparison(null);
        }}
        footer={[
          <Button key="close" onClick={() => setDetailModalOpen(false)}>
            Close
          </Button>,
        ]}
        width={900}
      >
        {loadingDetail ? (
          <div style={{ textAlign: 'center', padding: '20px' }}>Loading...</div>
        ) : (
          selectedComparison && (
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
              <Descriptions bordered column={2} size="small">
                <Descriptions.Item label="Title" span={2}>
                  {selectedComparison.title}
                </Descriptions.Item>
                <Descriptions.Item label="User">
                  {selectedComparison.username ?? selectedComparison.userEmail ?? '—'}
                </Descriptions.Item>
                <Descriptions.Item label="Category">
                  {selectedComparison.categoryName ?? '—'}
                </Descriptions.Item>
                <Descriptions.Item label="Products Compared">
                  {selectedComparison.productCount}
                </Descriptions.Item>
                <Descriptions.Item label="Created">
                  {new Date(selectedComparison.createdAt).toLocaleString('en-US')}
                </Descriptions.Item>
                <Descriptions.Item label="Views">
                  <Space>
                    <EyeOutlined />
                    {selectedComparison.viewCount ?? 0}
                  </Space>
                </Descriptions.Item>
                <Descriptions.Item label="Likes">
                  <Space>
                    <LikeOutlined />
                    {selectedComparison.likeCount ?? 0}
                  </Space>
                </Descriptions.Item>
                <Descriptions.Item label="Comments">
                  <Space>
                    <CommentOutlined />
                    {selectedComparison.commentCount ?? 0}
                  </Space>
                </Descriptions.Item>
              </Descriptions>

              {selectedComparison.body && (
                <Card title="Comparison Description" size="small">
                  <div style={{ whiteSpace: 'pre-wrap' }}>{selectedComparison.body}</div>
                </Card>
              )}

              {selectedComparison.comparedProducts && selectedComparison.comparedProducts.length > 0 && (
                <Card title="Compared Products" size="small">
                  <List
                    dataSource={selectedComparison.comparedProducts}
                    renderItem={(product) => (
                      <List.Item>
                        <List.Item.Meta
                          title={
                            <Space>
                              <span>{product.name}</span>
                              {product.score !== null && product.score !== undefined && (
                                <span style={{ color: '#1890ff', fontWeight: 'bold' }}>
                                  Score: {product.score}/10
                                </span>
                              )}
                            </Space>
                          }
                          description={product.notes ?? 'No notes'}
                        />
                      </List.Item>
                    )}
                  />
                </Card>
              )}
            </Space>
          )
        )}
      </Modal>
    </div>
  );
}

export default ProductComparisons;
