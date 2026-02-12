import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
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
  Modal,
  Form,
  message,
} from 'antd';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import {
  BulbOutlined,
  SearchOutlined,
  CheckOutlined,
  CloseOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';
import { type StatItemData } from '../../components/StatItem';
import {
  fetchProductSuggestionStats,
  fetchProductSuggestions,
  approveSuggestion,
  rejectSuggestion,
} from '../../api/admin-products';
import type {
  AdminProductSuggestionStatsResponse,
  AdminProductSuggestionListItem,
  ApproveSuggestionInput,
} from '../../api/admin-products';
import { TABLE_COLUMN_WIDTHS, TABLE_SCROLL_CONFIGS } from '../../constants/table-widths';

const PAGE_SIZE = 20;

type SuggestionStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

function ProductSuggestions() {
  const [searchParams] = useSearchParams();
  const [stats, setStats] = useState<AdminProductSuggestionStatsResponse | null>(null);
  const [suggestions, setSuggestions] = useState<AdminProductSuggestionListItem[]>([]);
  const [pagination, setPagination] = useState({
    total: 0,
    limit: PAGE_SIZE,
    offset: 0,
  });
  const [loading, setLoading] = useState(true);
  const [loadingList, setLoadingList] = useState(true);
  const [search, setSearch] = useState(searchParams.get('search') ?? '');
  const [statusFilter, setStatusFilter] = useState<SuggestionStatus | undefined>(
    (searchParams.get('status') as SuggestionStatus) ?? undefined
  );
  const [error, setError] = useState<string | null>(null);
  const [approveModalOpen, setApproveModalOpen] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState<AdminProductSuggestionListItem | null>(
    null
  );
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [approveForm] = Form.useForm();
  const [rejectForm] = Form.useForm();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchProductSuggestionStats();
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

  const loadSuggestions = async () => {
    setLoadingList(true);
    try {
      const res = await fetchProductSuggestions({
        limit: PAGE_SIZE,
        offset: pagination.offset,
        search: search || undefined,
        status: statusFilter,
      });
      setSuggestions(res.data ?? []);
      if (res.pagination) setPagination(res.pagination);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load suggestions');
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    loadSuggestions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.offset, search, statusFilter]);

  const handleApprove = async (values: ApproveSuggestionInput) => {
    if (!selectedSuggestion) return;

    try {
      await approveSuggestion(selectedSuggestion.id, values);
      message.success('Product suggestion approved successfully');
      setApproveModalOpen(false);
      approveForm.resetFields();
      setSelectedSuggestion(null);
      loadSuggestions();
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Failed to approve suggestion');
    }
  };

  const handleReject = async (values: { reason: string }) => {
    if (!selectedSuggestion) return;

    try {
      await rejectSuggestion(selectedSuggestion.id, values.reason);
      message.success('Product suggestion rejected');
      setRejectModalOpen(false);
      rejectForm.resetFields();
      setSelectedSuggestion(null);
      loadSuggestions();
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Failed to reject suggestion');
    }
  };

  const openApproveModal = (record: AdminProductSuggestionListItem) => {
    setSelectedSuggestion(record);
    approveForm.setFieldsValue({
      productName: record.suggestedName,
      groupId: record.groupId ?? undefined,
      brandId: record.suggestedBrand ?? undefined,
    });
    setApproveModalOpen(true);
  };

  const openRejectModal = (record: AdminProductSuggestionListItem) => {
    setSelectedSuggestion(record);
    setRejectModalOpen(true);
  };

  const openDetailModal = (record: AdminProductSuggestionListItem) => {
    setSelectedSuggestion(record);
    setDetailModalOpen(true);
  };

  const getStatusTag = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <Tag color="orange">Pending</Tag>;
      case 'APPROVED':
        return <Tag color="green">Approved</Tag>;
      case 'REJECTED':
        return <Tag color="red">Rejected</Tag>;
      default:
        return <Tag>{status}</Tag>;
    }
  };

  const columns: ColumnsType<AdminProductSuggestionListItem> = [
    {
      title: 'Suggested Name',
      dataIndex: 'suggestedName',
      key: 'suggestedName',
      width: TABLE_COLUMN_WIDTHS.LONG_TEXT,
      ellipsis: true,
    },
    {
      title: 'Brand',
      dataIndex: 'suggestedBrand',
      key: 'suggestedBrand',
      width: TABLE_COLUMN_WIDTHS.MEDIUM_TEXT,
      ellipsis: true,
      render: (text) => text ?? '—',
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
      title: 'Submitted By',
      dataIndex: 'submittedByUsername',
      key: 'submittedByUsername',
      width: TABLE_COLUMN_WIDTHS.MEDIUM_TEXT,
      ellipsis: true,
      render: (text, record) => text ?? record.submittedByEmail ?? '—',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: TABLE_COLUMN_WIDTHS.SHORT_TEXT,
      render: (status) => getStatusTag(status),
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
            onClick={() => openDetailModal(record)}
          />
          {record.status === 'PENDING' && (
            <>
              <Button
                size="small"
                type="text"
                icon={<CheckOutlined />}
                onClick={() => openApproveModal(record)}
                style={{ color: '#52c41a' }}
              />
              <Button
                size="small"
                type="text"
                danger
                icon={<CloseOutlined />}
                onClick={() => openRejectModal(record)}
              />
            </>
          )}
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
          label: 'Total Suggestions',
          value: stats.total,
          icon: <BulbOutlined />,
        },
        {
          label: 'Pending',
          value: stats.pending,
          icon: <BulbOutlined />,
        },
        {
          label: 'Approved',
          value: stats.approved,
          icon: <CheckOutlined />,
        },
        {
          label: 'Rejected',
          value: stats.rejected,
          icon: <CloseOutlined />,
        },
      ]
    : undefined;

  return (
    <div>
      <PageHeader
        title="Product Suggestions"
        description="Review user-submitted products"
        icon={<BulbOutlined />}
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

      <Card bordered={false}>
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Row justify="space-between" align="middle">
            <Space wrap>
              <Input
                placeholder="Search suggestions..."
                prefix={<SearchOutlined />}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ width: 250 }}
                allowClear
              />
              <Select
                placeholder="Status"
                value={statusFilter}
                onChange={setStatusFilter}
                style={{ width: 150 }}
                allowClear
              >
                <Select.Option value="PENDING">Pending</Select.Option>
                <Select.Option value="APPROVED">Approved</Select.Option>
                <Select.Option value="REJECTED">Rejected</Select.Option>
              </Select>
            </Space>
          </Row>

          <Table
            columns={columns}
            dataSource={suggestions}
            loading={loadingList}
            rowKey="id"
            pagination={{
              current: currentPage,
              pageSize: PAGE_SIZE,
              total: pagination.total,
              showSizeChanger: false,
              showTotal: (total) => `Total ${total} suggestions`,
            }}
            onChange={handleTableChange}
            scroll={TABLE_SCROLL_CONFIGS.DEFAULT}
            locale={{
              emptyText: <Empty description="No product suggestions found" />,
            }}
          />
        </Space>
      </Card>

      {/* Approve Suggestion Modal */}
      <Modal
        title="Approve Product Suggestion"
        open={approveModalOpen}
        onCancel={() => {
          setApproveModalOpen(false);
          approveForm.resetFields();
          setSelectedSuggestion(null);
        }}
        onOk={() => approveForm.submit()}
        width={600}
      >
        <Alert
          message="This will create a new product in the catalog"
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
        <Form form={approveForm} layout="vertical" onFinish={handleApprove}>
          <Form.Item
            name="productId"
            label="Product ID"
            rules={[{ required: true, message: 'Please enter product ID' }]}
          >
            <Input placeholder="e.g., airpods-pro-2" />
          </Form.Item>
          <Form.Item
            name="productName"
            label="Product Name"
            rules={[{ required: true, message: 'Please enter product name' }]}
          >
            <Input placeholder="e.g., AirPods Pro (2nd generation)" />
          </Form.Item>
          <Form.Item name="groupId" label="Group ID">
            <Input placeholder="Optional group ID" />
          </Form.Item>
          <Form.Item name="brandId" label="Brand ID">
            <Input placeholder="Optional brand ID" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Reject Suggestion Modal */}
      <Modal
        title="Reject Product Suggestion"
        open={rejectModalOpen}
        onCancel={() => {
          setRejectModalOpen(false);
          rejectForm.resetFields();
          setSelectedSuggestion(null);
        }}
        onOk={() => rejectForm.submit()}
        width={500}
      >
        <Form form={rejectForm} layout="vertical" onFinish={handleReject}>
          <Form.Item
            name="reason"
            label="Rejection Reason"
            rules={[{ required: true, message: 'Please provide a reason for rejection' }]}
          >
            <Input.TextArea
              rows={4}
              placeholder="Explain why this suggestion is being rejected..."
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* Detail Modal */}
      <Modal
        title="Suggestion Details"
        open={detailModalOpen}
        onCancel={() => {
          setDetailModalOpen(false);
          setSelectedSuggestion(null);
        }}
        footer={[
          <Button key="close" onClick={() => setDetailModalOpen(false)}>
            Close
          </Button>,
        ]}
        width={700}
      >
        {selectedSuggestion && (
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <div>
              <strong>Suggested Name:</strong> {selectedSuggestion.suggestedName}
            </div>
            {selectedSuggestion.suggestedBrand && (
              <div>
                <strong>Brand:</strong> {selectedSuggestion.suggestedBrand}
              </div>
            )}
            {selectedSuggestion.subName && (
              <div>
                <strong>Sub Name:</strong> {selectedSuggestion.subName}
              </div>
            )}
            {selectedSuggestion.description && (
              <div>
                <strong>Description:</strong> {selectedSuggestion.description}
              </div>
            )}
            {selectedSuggestion.categoryName && (
              <div>
                <strong>Category:</strong> {selectedSuggestion.categoryName}
              </div>
            )}
            {selectedSuggestion.groupName && (
              <div>
                <strong>Group:</strong> {selectedSuggestion.groupName}
              </div>
            )}
            <div>
              <strong>Status:</strong> {getStatusTag(selectedSuggestion.status)}
            </div>
            <div>
              <strong>Submitted By:</strong>{' '}
              {selectedSuggestion.submittedByUsername ??
                selectedSuggestion.submittedByEmail ??
                '—'}
            </div>
            <div>
              <strong>Created:</strong>{' '}
              {new Date(selectedSuggestion.createdAt).toLocaleString('en-US')}
            </div>
            {selectedSuggestion.approvedAt && (
              <>
                <div>
                  <strong>Approved At:</strong>{' '}
                  {new Date(selectedSuggestion.approvedAt).toLocaleString('en-US')}
                </div>
                <div>
                  <strong>Approved By:</strong>{' '}
                  {selectedSuggestion.approvedByEmail ?? '—'}
                </div>
              </>
            )}
            {selectedSuggestion.rejectedAt && (
              <>
                <div>
                  <strong>Rejected At:</strong>{' '}
                  {new Date(selectedSuggestion.rejectedAt).toLocaleString('en-US')}
                </div>
                {selectedSuggestion.rejectionReason && (
                  <Alert
                    message="Rejection Reason"
                    description={selectedSuggestion.rejectionReason}
                    type="warning"
                    showIcon
                  />
                )}
              </>
            )}
            {selectedSuggestion.imageUrl && (
              <div>
                <strong>Image:</strong>
                <br />
                <img
                  src={selectedSuggestion.imageUrl}
                  alt={selectedSuggestion.suggestedName}
                  style={{ maxWidth: '100%', marginTop: 8 }}
                />
              </div>
            )}
          </Space>
        )}
      </Modal>
    </div>
  );
}

export default ProductSuggestions;
