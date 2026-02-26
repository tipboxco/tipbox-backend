import { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Input,
  Select,
  Space,
  Empty,
  Alert,
  Image,
  Tag,
  Button,
  Row,
  Col,
  Dropdown,
  message,
} from 'antd';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import {
  CalendarOutlined,
  FileOutlined,
  SignalFilled,
  InboxOutlined,
  SearchOutlined,
  PlusOutlined,
  DownloadOutlined,
} from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';
import type { StatItemData } from '../../components/StatItem';
import ViewActionButton from '../../components/ViewActionButton';
import EventCreateModal from './modals/EventCreateModal';
import { fetchEventsStats, fetchEvents } from '../../api/admin-events';
import type { AdminEventListItem, AdminEventStatsResponse } from '../../types/admin';
import { BADGE_COLOR_PRIMARY, BADGE_COLOR_SECONDARY } from '../../constants/badge-colors';
import { TABLE_COLUMN_WIDTHS, TABLE_SCROLL_CONFIGS } from '../../constants/table-widths';
import { exportToCSV, exportToJSON, exportToExcel, sanitizeFilename, formatDateForExport } from '../../utils/export';

const PAGE_SIZE = 20;

function EventList() {
  const [stats, setStats] = useState<AdminEventStatsResponse | null>(null);
  const [events, setEvents] = useState<AdminEventListItem[]>([]);
  const [pagination, setPagination] = useState({ total: 0, limit: PAGE_SIZE, offset: 0 });
  const [loading, setLoading] = useState(true);
  const [loadingList, setLoadingList] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string>('');
  const [feedType, setFeedType] = useState<string>('');
  const [sort, setSort] = useState<'createdAt' | 'startDate' | 'endDate' | 'title'>('createdAt');
  const [order, setOrder] = useState<'asc' | 'desc'>('desc');
  const [error, setError] = useState<string | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchEventsStats();
        if (!cancelled && res.data) setStats(res.data);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load statistics');
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
        const res = await fetchEvents({
          limit: PAGE_SIZE,
          offset: pagination.offset,
          search: search || undefined,
          status: status || undefined,
          feedType: feedType || undefined,
          sort,
          order,
        });
        if (!cancelled) {
          setEvents(res.data ?? []);
          if (res.pagination) setPagination(res.pagination);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load list');
      } finally {
        if (!cancelled) setLoadingList(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pagination.offset, search, status, feedType, sort, order]);

  const handleCreateSuccess = () => {
    // Reload the first page of events
    setPagination((prev) => ({ ...prev, offset: 0 }));
    // Trigger a reload by updating dependencies
    setSearch((s) => s); // Force re-render to trigger useEffect
  };

  const handleExport = async (format: 'csv' | 'json' | 'excel') => {
    const hide = message.loading(`Preparing ${format.toUpperCase()} export...`, 0);

    try {
      // Fetch all data with current filters (limit 10,000 for safety)
      const res = await fetchEvents({
        limit: 10000,
        offset: 0,
        search: search || undefined,
        status: status || undefined,
        feedType: feedType || undefined,
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
        { key: 'id' as const, label: 'Event ID' },
        { key: 'title' as const, label: 'Title' },
        { key: 'status' as const, label: 'Status' },
        { key: 'feedType' as const, label: 'Feed Type' },
        { key: 'productName' as const, label: 'Product' },
        { key: 'brandName' as const, label: 'Brand' },
        { key: 'participantCount' as const, label: 'Participants' },
        { key: 'startDate' as const, label: 'Start Date' },
        { key: 'endDate' as const, label: 'End Date' },
        { key: 'createdAt' as const, label: 'Created At' },
      ];

      // Transform data for export
      const transformedData = exportData.map((event) => ({
        id: event.id,
        title: event.title,
        status: event.status,
        feedType: event.feedType,
        productName: event.productName ?? '',
        brandName: event.brandName ?? '',
        participantCount: event.participantCount ?? 0,
        startDate: formatDateForExport(event.startDate),
        endDate: formatDateForExport(event.endDate),
        createdAt: formatDateForExport(event.createdAt),
      }));

      const filename = sanitizeFilename(`events_${new Date().toISOString().split('T')[0]}`);

      if (format === 'csv') {
        exportToCSV(transformedData, filename, columns);
      } else if (format === 'json') {
        exportToJSON(exportData, filename);
      } else if (format === 'excel') {
        exportToExcel(transformedData, filename, columns);
      }

      hide();
      message.success(`Exported ${exportData.length} events to ${format.toUpperCase()}`);
    } catch (e) {
      hide();
      message.error(e instanceof Error ? e.message : 'Export failed');
    }
  };

  const columns: ColumnsType<AdminEventListItem> = [
    {
      title: 'Image',
      dataIndex: 'imageUrl',
      key: 'image',
      width: TABLE_COLUMN_WIDTHS.IMAGE_SMALL,
      render: (url) =>
        url ? (
          <Image
            src={url}
            alt=""
            width={48}
            height={48}
            style={{ objectFit: 'cover', borderRadius: 4 }}
            preview={false}
          />
        ) : (
          <div
            style={{
              width: 48,
              height: 48,
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
      dataIndex: 'title',
      key: 'title',
      width: TABLE_COLUMN_WIDTHS.LONG_TEXT_FLEXIBLE - 50,
      ellipsis: true,
      render: (title) => title ?? '—',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: TABLE_COLUMN_WIDTHS.SHORT_TEXT,
      ellipsis: true,
      render: (status) => {
        const colorMap: Record<string, string> = {
          DRAFT: 'default',
          PUBLISHED: BADGE_COLOR_PRIMARY,
          CLOSED: BADGE_COLOR_SECONDARY,
        };
        return <Tag color={colorMap[status] || 'default'}>{status}</Tag>;
      },
    },
    {
      title: 'Feed',
      dataIndex: 'feedType',
      key: 'feedType',
      width: TABLE_COLUMN_WIDTHS.SHORT_TEXT,
      ellipsis: true,
    },
    {
      title: 'Start',
      dataIndex: 'startDate',
      key: 'startDate',
      width: TABLE_COLUMN_WIDTHS.DATE_SHORT,
      ellipsis: true,
      render: (date) => (date ? new Date(date).toLocaleDateString() : '—'),
    },
    {
      title: 'End',
      dataIndex: 'endDate',
      key: 'endDate',
      width: TABLE_COLUMN_WIDTHS.DATE_SHORT,
      ellipsis: true,
      render: (date) => (date ? new Date(date).toLocaleDateString() : '—'),
    },
    {
      title: 'Participants',
      dataIndex: 'participantsCount',
      key: 'participantsCount',
      width: TABLE_COLUMN_WIDTHS.SHORT_TEXT,
      align: 'right',
      ellipsis: true,
      render: (count) => count ?? 0,
    },
    {
      title: 'Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: TABLE_COLUMN_WIDTHS.DATE_SHORT,
      ellipsis: true,
      render: (date) => (date ? new Date(date).toLocaleDateString() : '—'),
    },
    {
      title: '',
      key: 'action',
      width: TABLE_COLUMN_WIDTHS.ACTION_BUTTON,
      render: (_, record) => <ViewActionButton to={`/events/${record.id}`} />,
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
          icon: <CalendarOutlined />,
        },
        {
          label: 'Draft',
          value: stats.draft,
          icon: <FileOutlined />,
        },
        {
          label: 'Published',
          value: stats.published,
          icon: <SignalFilled />,
        },
        {
          label: 'Closed',
          value: stats.closed,
          icon: <InboxOutlined />,
        },
      ]
    : undefined;

  return (
    <div>
      <PageHeader
        title="Events"
        description="Event list, filtering and management"
        icon={<CalendarOutlined />}
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

      {/* Event List */}
      <Card
        bordered
        title={
          <Row justify="space-between" align="middle" style={{ width: '100%' }}>
            <Col>Event list</Col>
            <Col>
              <Space>
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
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => setCreateModalOpen(true)}
                >
                  Create Event
                </Button>
              </Space>
            </Col>
          </Row>
        }
        extra={
          <Space wrap>
            <Input
              placeholder="Search (title, description)"
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
              value={status}
              onChange={(value) => {
                setStatus(value);
                setPagination((p) => ({ ...p, offset: 0 }));
              }}
              style={{ width: 130 }}
              placeholder="All statuses"
            >
              <Select.Option value="">All statuses</Select.Option>
              <Select.Option value="DRAFT">Draft</Select.Option>
              <Select.Option value="PUBLISHED">Published</Select.Option>
              <Select.Option value="CLOSED">Closed</Select.Option>
            </Select>
            <Select
              value={feedType}
              onChange={(value) => {
                setFeedType(value);
                setPagination((p) => ({ ...p, offset: 0 }));
              }}
              style={{ width: 150 }}
              placeholder="All feed types"
            >
              <Select.Option value="">All feed types</Select.Option>
              <Select.Option value="PICKS">PICKS</Select.Option>
              <Select.Option value="ROASTS">ROASTS</Select.Option>
            </Select>
            <Select
              value={sort}
              onChange={(value) => {
                setSort(value as 'createdAt' | 'startDate' | 'endDate' | 'title');
                setPagination((p) => ({ ...p, offset: 0 }));
              }}
              style={{ width: 130 }}
            >
              <Select.Option value="createdAt">Created</Select.Option>
              <Select.Option value="startDate">Start</Select.Option>
              <Select.Option value="endDate">End</Select.Option>
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
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={events}
          rowKey="id"
          loading={loadingList}
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
                description="No events found. Try changing the filters."
              />
            ),
          }}
        />
      </Card>

      {/* Create Event Modal */}
      <EventCreateModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onSuccess={handleCreateSuccess}
      />
    </div>
  );
}

export default EventList;
