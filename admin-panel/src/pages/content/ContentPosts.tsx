import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Card,
  Table,
  Input,
  Select,
  Space,
  Tag,
  Empty,
  Alert,
  Image,
  Modal,
  Form,
  Button,
  message,
  Dropdown,
} from 'antd';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import {
  FileTextOutlined,
  FireOutlined,
  CalendarOutlined,
  TagsOutlined,
  SearchOutlined,
  PlusOutlined,
  DeleteOutlined,
  ThunderboltOutlined,
  DownOutlined,
  DownloadOutlined,
  CloseCircleOutlined,
  FilterOutlined,
} from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';
import type { StatItemData } from '../../components/StatItem';
import ViewActionButton from '../../components/ViewActionButton';
import IdDisplay from '../../components/IdDisplay';
import {
  fetchContentPostsStats,
  fetchContentPosts,
  createContentPost,
  deleteContentPost,
  updateContentPost,
} from '../../api/admin-content';
import type {
  AdminContentPostsStatsResponse,
  AdminContentPostListItem,
} from '../../types/admin';
import { BADGE_COLOR_PRIMARY } from '../../constants/badge-colors';
import { TABLE_COLUMN_WIDTHS, TABLE_SCROLL_CONFIGS } from '../../constants/table-widths';
import { exportToCSV, exportToJSON, exportToExcel, sanitizeFilename, formatDateForExport } from '../../utils/export';

const PAGE_SIZE = 20;

const POST_TYPES = [
  { value: '', label: 'All types' },
  { value: 'FREE', label: 'FREE' },
  { value: 'TIPS', label: 'TIPS' },
  { value: 'COMPARE', label: 'COMPARE' },
  { value: 'QUESTION', label: 'QUESTION' },
  { value: 'EXPERIENCE', label: 'EXPERIENCE' },
  { value: 'UPDATE', label: 'UPDATE' },
];

type SortField = 'createdAt' | 'likesCount' | 'commentsCount' | 'viewsCount' | 'title';

function ContentPosts() {
  const [stats, setStats] = useState<AdminContentPostsStatsResponse | null>(null);
  const [posts, setPosts] = useState<AdminContentPostListItem[]>([]);
  const [pagination, setPagination] = useState({
    total: 0,
    limit: PAGE_SIZE,
    offset: 0,
  });
  const [loading, setLoading] = useState(true);
  const [loadingList, setLoadingList] = useState(true);
  const [search, setSearch] = useState('');
  const [type, setType] = useState<string>('');
  const [sort, setSort] = useState<SortField>('createdAt');
  const [order, setOrder] = useState<'asc' | 'desc'>('desc');
  const [error, setError] = useState<string | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [form] = Form.useForm();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchContentPostsStats();
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
        const res = await fetchContentPosts({
          limit: PAGE_SIZE,
          offset: pagination.offset,
          search: search || undefined,
          type: type || undefined,
          sort,
          order,
        });
        if (!cancelled) {
          setPosts(res.data ?? []);
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
  }, [pagination.offset, search, type, sort, order]);

  const loadPosts = async () => {
    setLoadingList(true);
    try {
      const res = await fetchContentPosts({
        limit: PAGE_SIZE,
        offset: pagination.offset,
        search: search || undefined,
        type: type || undefined,
        sort,
        order,
      });
      setPosts(res.data ?? []);
      if (res.pagination) setPagination((p) => ({ ...p, ...res.pagination }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load list');
    } finally {
      setLoadingList(false);
    }
  };

  const handleCreate = async (values: {
    userId: string;
    type: string;
    title: string;
    body: string;
    categoryId?: string;
    productId?: string;
    eventId?: string;
  }) => {
    try {
      await createContentPost({
        userId: values.userId,
        type: values.type,
        title: values.title,
        body: values.body,
        categoryId: values.categoryId || null,
        productId: values.productId || null,
        eventId: values.eventId || null,
        mainCategoryId: null,
        subCategoryId: null,
        productGroupId: null,
      });
      message.success('Content post created successfully');
      setCreateModalOpen(false);
      form.resetFields();
      loadPosts();
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Failed to create content post');
    }
  };

  const handleBulkDelete = () => {
    if (selectedRowKeys.length === 0) {
      message.warning('Please select posts to delete');
      return;
    }

    Modal.confirm({
      title: 'Delete Posts',
      content: `Are you sure you want to delete ${selectedRowKeys.length} post(s)? This action cannot be undone.`,
      okText: 'Delete',
      okType: 'danger',
      onOk: async () => {
        const hide = message.loading('Deleting posts...', 0);
        let successCount = 0;
        let failCount = 0;

        for (const postId of selectedRowKeys) {
          try {
            await deleteContentPost(postId as string);
            successCount++;
          } catch (e) {
            failCount++;
          }
        }

        hide();

        if (successCount > 0) {
          message.success(`Successfully deleted ${successCount} post(s)`);
        }
        if (failCount > 0) {
          message.error(`Failed to delete ${failCount} post(s)`);
        }

        setSelectedRowKeys([]);
        loadPosts();
      },
    });
  };

  const handleBulkBoost = () => {
    if (selectedRowKeys.length === 0) {
      message.warning('Please select posts to boost');
      return;
    }

    Modal.confirm({
      title: 'Boost Posts',
      content: `Are you sure you want to boost ${selectedRowKeys.length} post(s)?`,
      okText: 'Boost',
      onOk: async () => {
        const hide = message.loading('Boosting posts...', 0);
        let successCount = 0;
        let failCount = 0;

        // Calculate boost until date (30 days from now)
        const boostedUntil = new Date();
        boostedUntil.setDate(boostedUntil.getDate() + 30);

        for (const postId of selectedRowKeys) {
          try {
            await updateContentPost(postId as string, {
              isBoosted: true,
              boostedUntil: boostedUntil.toISOString(),
            });
            successCount++;
          } catch (e) {
            failCount++;
          }
        }

        hide();

        if (successCount > 0) {
          message.success(`Successfully boosted ${successCount} post(s)`);
        }
        if (failCount > 0) {
          message.error(`Failed to boost ${failCount} post(s)`);
        }

        setSelectedRowKeys([]);
        loadPosts();
      },
    });
  };

  const handleBulkUnboost = () => {
    if (selectedRowKeys.length === 0) {
      message.warning('Please select posts to unboost');
      return;
    }

    Modal.confirm({
      title: 'Remove Boost',
      content: `Are you sure you want to remove boost from ${selectedRowKeys.length} post(s)?`,
      okText: 'Remove Boost',
      onOk: async () => {
        const hide = message.loading('Removing boost...', 0);
        let successCount = 0;
        let failCount = 0;

        for (const postId of selectedRowKeys) {
          try {
            await updateContentPost(postId as string, {
              isBoosted: false,
              boostedUntil: null,
            });
            successCount++;
          } catch (e) {
            failCount++;
          }
        }

        hide();

        if (successCount > 0) {
          message.success(`Successfully removed boost from ${successCount} post(s)`);
        }
        if (failCount > 0) {
          message.error(`Failed to remove boost from ${failCount} post(s)`);
        }

        setSelectedRowKeys([]);
        loadPosts();
      },
    });
  };

  const handleClearAllFilters = () => {
    setSearch('');
    setType('');
    setSort('createdAt');
    setOrder('desc');
    setPagination((p) => ({ ...p, offset: 0 }));
  };

  const activeFiltersCount = [
    search,
    type !== '' ? type : null,
    sort !== 'createdAt' || order !== 'desc' ? true : null,
  ].filter(Boolean).length;

  const handleExport = async (format: 'csv' | 'json' | 'excel') => {
    const hide = message.loading(`Preparing ${format.toUpperCase()} export...`, 0);

    try {
      // Fetch all data with current filters (limit 10,000 for safety)
      const res = await fetchContentPosts({
        limit: 10000,
        offset: 0,
        search: search || undefined,
        type: type || undefined,
        sort,
        order,
      });

      const exportData = res.data ?? [];

      if (exportData.length === 0) {
        hide();
        message.warning('No data to export');
        return;
      }

      // Define columns for export
      const columns = [
        { key: 'id' as const, label: 'ID' },
        { key: 'title' as const, label: 'Title' },
        { key: 'type' as const, label: 'Type' },
        { key: 'userDisplayName' as const, label: 'Author Display Name' },
        { key: 'userName' as const, label: 'Author Username' },
        { key: 'userId' as const, label: 'Author ID' },
        { key: 'likesCount' as const, label: 'Likes' },
        { key: 'commentsCount' as const, label: 'Comments' },
        { key: 'viewsCount' as const, label: 'Views' },
        { key: 'isBoosted' as const, label: 'Boosted' },
        { key: 'createdAt' as const, label: 'Created At' },
      ];

      // Transform data for export
      const transformedData = exportData.map((post) => ({
        id: post.id,
        title: titleDisplay(post),
        type: post.type ?? '',
        userDisplayName: post.userDisplayName ?? '',
        userName: post.userName ?? '',
        userId: post.userId ?? '',
        likesCount: post.likesCount ?? 0,
        commentsCount: post.commentsCount ?? 0,
        viewsCount: post.viewsCount ?? 0,
        isBoosted: post.isBoosted ? 'Yes' : 'No',
        createdAt: formatDateForExport(post.createdAt),
      }));

      const filename = sanitizeFilename(`content_posts_${new Date().toISOString().split('T')[0]}`);

      if (format === 'csv') {
        exportToCSV(transformedData, filename, columns);
      } else if (format === 'json') {
        exportToJSON(exportData, filename);
      } else if (format === 'excel') {
        exportToExcel(transformedData, filename, columns);
      }

      hide();
      message.success(`Exported ${exportData.length} posts to ${format.toUpperCase()}`);
    } catch (e) {
      hide();
      message.error(e instanceof Error ? e.message : 'Export failed');
    }
  };

  const userDisplay = (p: AdminContentPostListItem) =>
    p.userDisplayName || p.userName || (p.userId ? <IdDisplay id={p.userId} variant="compact" copyable={false} /> : '—');

  const titleDisplay = (p: AdminContentPostListItem) =>
    (p.title && p.title.trim()) || (p.bodyExcerpt && p.bodyExcerpt.trim().slice(0, 80)) || '—';

  const columns: ColumnsType<AdminContentPostListItem> = [
    {
      title: 'Image',
      dataIndex: 'thumbnailUrl',
      key: 'thumbnail',
      width: TABLE_COLUMN_WIDTHS.IMAGE_SMALL,
      ellipsis: false,
      render: (url) =>
        url ? (
          <Image
            src={url}
            alt=""
            width={60}
            height={60}
            style={{ objectFit: 'cover', borderRadius: 4 }}
            preview={false}
          />
        ) : (
          <div
            style={{
              width: 60,
              height: 60,
              background: '#f0f0f0',
              borderRadius: 4,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            —
          </div>
        ),
    },
    {
      title: 'Title',
      key: 'title',
      width: TABLE_COLUMN_WIDTHS.LONG_TEXT_FLEXIBLE,
      ellipsis: true,
      render: (_, record) => titleDisplay(record),
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      width: TABLE_COLUMN_WIDTHS.SHORT_TEXT,
      ellipsis: true,
      render: (type) => <Tag color={BADGE_COLOR_PRIMARY}>{type}</Tag>,
    },
    {
      title: 'Author',
      key: 'user',
      width: TABLE_COLUMN_WIDTHS.MEDIUM_TEXT,
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
      title: 'Likes',
      dataIndex: 'likesCount',
      key: 'likesCount',
      width: TABLE_COLUMN_WIDTHS.NUMBER_SMALL,
      align: 'right',
      ellipsis: true,
    },
    {
      title: 'Comments',
      dataIndex: 'commentsCount',
      key: 'commentsCount',
      width: TABLE_COLUMN_WIDTHS.NUMBER_MEDIUM,
      align: 'right',
      ellipsis: true,
    },
    {
      title: 'Boosted',
      dataIndex: 'isBoosted',
      key: 'isBoosted',
      width: TABLE_COLUMN_WIDTHS.NUMBER_SMALL,
      ellipsis: true,
      render: (boosted) => (boosted ? 'Yes' : '—'),
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
      width: TABLE_COLUMN_WIDTHS.ACTION_BUTTON,
      render: (_, record) => <ViewActionButton to={`/content/posts/${record.id}`} />,
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
          label: 'Total',
          value: stats.total,
          icon: <FileTextOutlined />,
        },
        {
          label: 'Boosted',
          value: stats.boostedCount,
          icon: <FireOutlined />,
          valueColor: '#8B9D2D',
        },
        {
          label: 'With Event',
          value: stats.withEventCount,
          icon: <CalendarOutlined />,
        },
        {
          label: 'By Type',
          value: Object.keys(stats.byType).length,
          icon: <TagsOutlined />,
        },
      ]
    : undefined;

  return (
    <div>
      <PageHeader
        title="All Posts"
        description="Manage user-generated content posts"
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
          style={{ marginBottom: 24 }}
        />
      )}

      {/* Post List Table */}
      <Card
        bordered
        title="Post list"
        extra={
          <Space wrap>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setCreateModalOpen(true)}
            >
              Create Post
            </Button>
            <Dropdown
              menu={{
                items: [
                  {
                    key: 'csv',
                    label: 'Export as CSV',
                    icon: <DownloadOutlined />,
                    onClick: () => handleExport('csv'),
                  },
                  {
                    key: 'excel',
                    label: 'Export as Excel',
                    icon: <DownloadOutlined />,
                    onClick: () => handleExport('excel'),
                  },
                  {
                    key: 'json',
                    label: 'Export as JSON',
                    icon: <DownloadOutlined />,
                    onClick: () => handleExport('json'),
                  },
                ],
              }}
            >
              <Button icon={<DownloadOutlined />}>
                Export
              </Button>
            </Dropdown>
            <Input
              placeholder="Search (title, content)"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPagination((p) => ({ ...p, offset: 0 }));
              }}
              prefix={<SearchOutlined />}
              style={{ width: 200 }}
              allowClear
            />
            <Select
              value={type}
              onChange={(value) => {
                setType(value);
                setPagination((p) => ({ ...p, offset: 0 }));
              }}
              style={{ width: 140 }}
              placeholder="All types"
            >
              {POST_TYPES.map((opt) => (
                <Select.Option key={opt.value || 'all'} value={opt.value}>
                  {opt.label}
                </Select.Option>
              ))}
            </Select>
            <Select
              value={sort}
              onChange={(value) => {
                setSort(value as SortField);
                setPagination((p) => ({ ...p, offset: 0 }));
              }}
              style={{ width: 130 }}
            >
              <Select.Option value="createdAt">Created</Select.Option>
              <Select.Option value="likesCount">Likes</Select.Option>
              <Select.Option value="commentsCount">Comments</Select.Option>
              <Select.Option value="viewsCount">Views</Select.Option>
              <Select.Option value="title">Title</Select.Option>
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
            <Button
              icon={<FilterOutlined />}
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            >
              Advanced {activeFiltersCount > 0 && `(${activeFiltersCount})`}
            </Button>
          </Space>
        }
      >
        {/* Active Filters Display */}
        {activeFiltersCount > 0 && (
          <Alert
            message={
              <Space wrap size="small" align="center">
                <span style={{ fontWeight: 500 }}>Active Filters:</span>
                {search && (
                  <Tag
                    closable
                    onClose={() => {
                      setSearch('');
                      setPagination((p) => ({ ...p, offset: 0 }));
                    }}
                  >
                    Search: {search}
                  </Tag>
                )}
                {type && (
                  <Tag
                    closable
                    onClose={() => {
                      setType('');
                      setPagination((p) => ({ ...p, offset: 0 }));
                    }}
                  >
                    Type: {POST_TYPES.find((t) => t.value === type)?.label || type}
                  </Tag>
                )}
                {(sort !== 'createdAt' || order !== 'desc') && (
                  <Tag
                    closable
                    onClose={() => {
                      setSort('createdAt');
                      setOrder('desc');
                      setPagination((p) => ({ ...p, offset: 0 }));
                    }}
                  >
                    Sort: {sort} ({order})
                  </Tag>
                )}
                <Button
                  size="small"
                  type="link"
                  danger
                  icon={<CloseCircleOutlined />}
                  onClick={handleClearAllFilters}
                >
                  Clear All
                </Button>
              </Space>
            }
            type="info"
            style={{ marginBottom: 16 }}
            closable
            onClose={() => setShowAdvancedFilters(false)}
          />
        )}
      
        {selectedRowKeys.length > 0 && (
          <Alert
            message={`${selectedRowKeys.length} post(s) selected`}
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
            action={
              <Space>
                <Dropdown
                  menu={{
                    items: [
                      {
                        key: 'boost',
                        label: 'Boost Posts',
                        icon: <ThunderboltOutlined />,
                        onClick: handleBulkBoost,
                      },
                      {
                        key: 'unboost',
                        label: 'Remove Boost',
                        icon: <ThunderboltOutlined />,
                        onClick: handleBulkUnboost,
                      },
                      {
                        type: 'divider',
                      },
                      {
                        key: 'delete',
                        label: 'Delete Posts',
                        icon: <DeleteOutlined />,
                        danger: true,
                        onClick: handleBulkDelete,
                      },
                    ],
                  }}
                >
                  <Button>
                    Bulk Actions <DownOutlined />
                  </Button>
                </Dropdown>
                <Button onClick={() => setSelectedRowKeys([])}>Clear Selection</Button>
              </Space>
            }
          />
        )}
        <Table
          columns={columns}
          dataSource={posts}
          rowKey="id"
          loading={loadingList}
          scroll={TABLE_SCROLL_CONFIGS.AUTO}
          rowSelection={{
            selectedRowKeys,
            onChange: (newSelectedRowKeys) => setSelectedRowKeys(newSelectedRowKeys),
          }}
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
                description="No posts found"
              />
            ),
          }}
        />
      </Card>

      {/* Create Post Modal */}
      <Modal
        title="Create Content Post"
        open={createModalOpen}
        onCancel={() => {
          setCreateModalOpen(false);
          form.resetFields();
        }}
        onOk={() => form.submit()}
        width={700}
        okText="Create"
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item
            name="userId"
            label="User ID"
            rules={[{ required: true, message: 'Please enter user ID' }]}
          >
            <Input placeholder="e.g., 480f5de9-b691-4d70-a6a8-2789226f4e07" />
          </Form.Item>

          <Form.Item
            name="type"
            label="Post Type"
            rules={[{ required: true, message: 'Please select post type' }]}
          >
            <Select placeholder="Select post type">
              <Select.Option value="FREE">FREE</Select.Option>
              <Select.Option value="TIPS">TIPS</Select.Option>
              <Select.Option value="COMPARE">COMPARE</Select.Option>
              <Select.Option value="QUESTION">QUESTION</Select.Option>
              <Select.Option value="EXPERIENCE">EXPERIENCE</Select.Option>
              <Select.Option value="UPDATE">UPDATE</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="title"
            label="Title"
            rules={[{ required: true, message: 'Please enter title' }]}
          >
            <Input placeholder="Post title" maxLength={500} />
          </Form.Item>

          <Form.Item
            name="body"
            label="Body"
            rules={[{ required: true, message: 'Please enter body content' }]}
          >
            <Input.TextArea rows={6} placeholder="Post content" maxLength={10000} />
          </Form.Item>

          <Form.Item name="categoryId" label="Category ID (Optional)">
            <Input placeholder="e.g., category-uuid" />
          </Form.Item>

          <Form.Item name="productId" label="Product ID (Optional)">
            <Input placeholder="e.g., airpods-pro-2" />
          </Form.Item>

          <Form.Item name="eventId" label="Event ID (Optional)">
            <Input placeholder="e.g., event-id" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default ContentPosts;
