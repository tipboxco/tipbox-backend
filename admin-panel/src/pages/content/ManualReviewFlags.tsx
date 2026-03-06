import { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Tag,
  Select,
  Space,
  Button,
  Empty,
  Alert,
  Modal,
  Descriptions,
  message as antdMessage,
} from 'antd';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import { FlagOutlined, EyeOutlined } from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';
import IdDisplay from '../../components/IdDisplay';
import {
  fetchManualReviewFlags,
  fetchManualReviewFlag,
  updateManualReviewFlag,
} from '../../api/admin-content';
import type { AdminManualReviewFlagListItem } from '../../types/admin';
import { TABLE_COLUMN_WIDTHS, TABLE_SCROLL_CONFIGS } from '../../constants/table-widths';

const PAGE_SIZE = 20;

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'OPEN', label: 'Open' },
  { value: 'IN_REVIEW', label: 'In Review' },
  { value: 'RESOLVED', label: 'Resolved' },
];

const STATUS_COLORS: Record<string, string> = {
  OPEN: 'orange',
  IN_REVIEW: 'blue',
  RESOLVED: 'green',
};

type FlagDetail = AdminManualReviewFlagListItem & { contentSummary?: string };

function ManualReviewFlags() {
  const [rows, setRows] = useState<AdminManualReviewFlagListItem[]>([]);
  const [pagination, setPagination] = useState({
    total: 0,
    limit: PAGE_SIZE,
    offset: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [contentTypeFilter, setContentTypeFilter] = useState<string>('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Detail modal state
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailData, setDetailData] = useState<FlagDetail | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetchManualReviewFlags({
        limit: PAGE_SIZE,
        offset: pagination.offset,
        status: statusFilter || undefined,
        contentType: contentTypeFilter || undefined,
      });
      setRows(res.data ?? []);
      if (res.pagination) setPagination((p) => ({ ...p, ...res.pagination }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load flags');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.offset, statusFilter, contentTypeFilter]);

  const handleStatusChange = async (id: string, newStatus: string) => {
    setActionLoading(id);
    try {
      await updateManualReviewFlag(id, { status: newStatus });
      antdMessage.success(`Flag status updated to ${newStatus}`);
      load();
    } catch (e) {
      antdMessage.error(e instanceof Error ? e.message : 'Failed to update status');
    } finally {
      setActionLoading(null);
    }
  };

  const handleViewDetail = async (id: string) => {
    setDetailModalOpen(true);
    setDetailLoading(true);
    setDetailData(null);
    try {
      const res = await fetchManualReviewFlag(id);
      setDetailData(res.data ?? null);
    } catch (e) {
      antdMessage.error(e instanceof Error ? e.message : 'Failed to load flag details');
      setDetailModalOpen(false);
    } finally {
      setDetailLoading(false);
    }
  };

  const columns: ColumnsType<AdminManualReviewFlagListItem> = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: TABLE_COLUMN_WIDTHS.MEDIUM_TEXT,
      render: (id: string) => <IdDisplay id={id} variant="compact" />,
    },
    {
      title: 'Content Type',
      dataIndex: 'contentType',
      key: 'contentType',
      width: TABLE_COLUMN_WIDTHS.SHORT_TEXT + 20,
      ellipsis: true,
    },
    {
      title: 'Content ID',
      dataIndex: 'contentId',
      key: 'contentId',
      width: TABLE_COLUMN_WIDTHS.NUMBER_MEDIUM,
      ellipsis: true,
    },
    {
      title: 'Reason',
      dataIndex: 'reason',
      key: 'reason',
      width: TABLE_COLUMN_WIDTHS.LONG_TEXT_FLEXIBLE,
      ellipsis: true,
      render: (reason: string) => (
        <span title={reason}>
          {reason.length > 60 ? reason.slice(0, 60) + '...' : reason}
        </span>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: TABLE_COLUMN_WIDTHS.SHORT_TEXT + 10,
      render: (status: string) => (
        <Tag color={STATUS_COLORS[status] ?? 'default'}>{status}</Tag>
      ),
    },
    {
      title: 'Flagged By',
      key: 'flaggedBy',
      width: TABLE_COLUMN_WIDTHS.MEDIUM_TEXT + 20,
      ellipsis: true,
      render: (_, record) =>
        record.flaggedByUserDisplayName ||
        record.flaggedByUserEmail || (
          <IdDisplay id={record.flaggedByUserId} variant="compact" copyable={false} />
        ),
    },
    {
      title: 'Created At',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: TABLE_COLUMN_WIDTHS.DATE_SHORT,
      ellipsis: true,
      render: (date: string) => (date ? new Date(date).toLocaleDateString('en-US') : '—'),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: TABLE_COLUMN_WIDTHS.LONG_TEXT_FIXED,
      render: (_, record) => (
        <Space size="small">
          <Select
            size="small"
            value={record.status}
            loading={actionLoading === record.id}
            onChange={(value) => handleStatusChange(record.id, value)}
            style={{ width: 120 }}
          >
            <Select.Option value="OPEN">Open</Select.Option>
            <Select.Option value="IN_REVIEW">In Review</Select.Option>
            <Select.Option value="RESOLVED">Resolved</Select.Option>
          </Select>
          <Button
            size="small"
            type="text"
            icon={<EyeOutlined />}
            onClick={() => handleViewDetail(record.id)}
            title="View details"
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

  return (
    <div>
      <PageHeader
        title="Manual Review Flags"
        description="Review and manage flagged content"
        icon={<FlagOutlined />}
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
        title="Flag list"
        extra={
          <Space wrap>
            <Select
              value={statusFilter}
              onChange={(value) => {
                setStatusFilter(value);
                setPagination((p) => ({ ...p, offset: 0 }));
              }}
              style={{ width: 140 }}
              placeholder="All Statuses"
            >
              {STATUS_OPTIONS.map((opt) => (
                <Select.Option key={opt.value} value={opt.value}>
                  {opt.label}
                </Select.Option>
              ))}
            </Select>
            <Select
              value={contentTypeFilter}
              onChange={(value) => {
                setContentTypeFilter(value);
                setPagination((p) => ({ ...p, offset: 0 }));
              }}
              style={{ width: 150 }}
              placeholder="All Content Types"
              allowClear
            >
              <Select.Option value="">All Content Types</Select.Option>
              <Select.Option value="POST">Post</Select.Option>
              <Select.Option value="COMMENT">Comment</Select.Option>
              <Select.Option value="USER">User</Select.Option>
            </Select>
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={rows}
          rowKey="id"
          loading={loading}
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
                description="No flags found. Try adjusting the filters."
              />
            ),
          }}
        />
      </Card>

      {/* Detail Modal */}
      <Modal
        title="Flag Details"
        open={detailModalOpen}
        onCancel={() => {
          setDetailModalOpen(false);
          setDetailData(null);
        }}
        footer={
          <Button onClick={() => setDetailModalOpen(false)}>Close</Button>
        }
        width={640}
      >
        {detailLoading ? (
          <div style={{ textAlign: 'center', padding: 40 }}>Loading...</div>
        ) : detailData ? (
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="ID">{detailData.id}</Descriptions.Item>
            <Descriptions.Item label="Content Type">{detailData.contentType}</Descriptions.Item>
            <Descriptions.Item label="Content ID">{detailData.contentId}</Descriptions.Item>
            <Descriptions.Item label="Reason">{detailData.reason}</Descriptions.Item>
            <Descriptions.Item label="Status">
              <Tag color={STATUS_COLORS[detailData.status] ?? 'default'}>
                {detailData.status}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Flagged By">
              {detailData.flaggedByUserDisplayName ||
                detailData.flaggedByUserEmail ||
                detailData.flaggedByUserId}
            </Descriptions.Item>
            <Descriptions.Item label="Flagged By User ID">
              <IdDisplay id={detailData.flaggedByUserId} variant="inline" />
            </Descriptions.Item>
            <Descriptions.Item label="Created At">
              {new Date(detailData.createdAt).toLocaleString('en-US')}
            </Descriptions.Item>
            <Descriptions.Item label="Updated At">
              {new Date(detailData.updatedAt).toLocaleString('en-US')}
            </Descriptions.Item>
            {detailData.contentSummary && (
              <Descriptions.Item label="Content Summary">
                {detailData.contentSummary}
              </Descriptions.Item>
            )}
          </Descriptions>
        ) : (
          <Empty description="No data available" />
        )}
      </Modal>
    </div>
  );
}

export default ManualReviewFlags;
