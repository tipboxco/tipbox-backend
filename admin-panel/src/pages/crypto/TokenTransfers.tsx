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
  Form,
  InputNumber,
  message,
  Descriptions,
} from 'antd';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import {
  SwapOutlined,
  SearchOutlined,
  PlusOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';
import { type StatItemData } from '../../components/StatItem';
import ViewActionButton from '../../components/ViewActionButton';
import {
  fetchTokenTransferStats,
  fetchTokenTransfers,
  fetchTokenTransfer,
  createTokenTransfer,
} from '../../api/admin-crypto';
import type {
  AdminTokenTransferStatsResponse,
  AdminTokenTransferListItem,
  AdminTokenTransferDetailResponse,
  CreateTokenTransferInput,
} from '../../api/admin-crypto';
import { TABLE_COLUMN_WIDTHS, TABLE_SCROLL_CONFIGS } from '../../constants/table-widths';

const PAGE_SIZE = 20;

function TokenTransfers() {
  const [stats, setStats] = useState<AdminTokenTransferStatsResponse | null>(null);
  const [transfers, setTransfers] = useState<AdminTokenTransferListItem[]>([]);
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
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedTransfer, setSelectedTransfer] = useState<AdminTokenTransferDetailResponse | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [createForm] = Form.useForm();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchTokenTransferStats();
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

  const loadTransfers = async () => {
    setLoadingList(true);
    try {
      const res = await fetchTokenTransfers({
        limit: PAGE_SIZE,
        offset: pagination.offset,
        search: search || undefined,
      });
      setTransfers(res.data ?? []);
      if (res.pagination) setPagination(res.pagination);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load token transfers');
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    loadTransfers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.offset, search]);

  const openDetailModal = async (id: string) => {
    setLoadingDetail(true);
    setDetailModalOpen(true);
    try {
      const res = await fetchTokenTransfer(id);
      setSelectedTransfer(res.data ?? null);
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Failed to load transfer details');
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleCreate = async (values: CreateTokenTransferInput) => {
    try {
      await createTokenTransfer(values);
      message.success('Transfer created successfully');
      setCreateModalOpen(false);
      createForm.resetFields();
      setPagination((prev) => ({ ...prev, offset: 0 }));
      loadTransfers();
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Failed to create transfer');
    }
  };

  const columns: ColumnsType<AdminTokenTransferListItem> = [
    {
      title: 'From',
      dataIndex: 'fromUsername',
      key: 'fromUsername',
      width: TABLE_COLUMN_WIDTHS.MEDIUM_TEXT,
      ellipsis: true,
      render: (text, record) => text ?? record.fromEmail ?? '—',
    },
    {
      title: 'To',
      dataIndex: 'toUsername',
      key: 'toUsername',
      width: TABLE_COLUMN_WIDTHS.MEDIUM_TEXT,
      ellipsis: true,
      render: (text, record) => text ?? record.toEmail ?? '—',
    },
    {
      title: 'Amount',
      dataIndex: 'amount',
      key: 'amount',
      width: TABLE_COLUMN_WIDTHS.SHORT_TEXT,
      align: 'right',
      render: (amount) => `${amount?.toFixed(2) ?? '0.00'} TIPS`,
    },
    {
      title: 'Reason',
      dataIndex: 'reason',
      key: 'reason',
      width: TABLE_COLUMN_WIDTHS.LONG_TEXT_FLEXIBLE,
      ellipsis: true,
      render: (text) => text ?? '—',
    },
    {
      title: 'Date',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: TABLE_COLUMN_WIDTHS.DATE_SHORT,
      ellipsis: true,
      render: (date) => (date ? new Date(date).toLocaleDateString('en-US') : '—'),
    },
    {
      title: '',
      key: 'action',
      width: TABLE_COLUMN_WIDTHS.ACTION_BUTTONS,
      render: (_, record) => (
        <Space size="small">
          <ViewActionButton to={`/users/${record.fromUserId}`} label="From" />
          <ViewActionButton to={`/users/${record.toUserId}`} label="To" />
          <Button
            size="small"
            type="text"
            icon={<EyeOutlined />}
            onClick={() => openDetailModal(record.id)}
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
          label: 'Total Transfers',
          value: stats.total,
          icon: <SwapOutlined />,
        },
        {
          label: 'Total Volume',
          value: `${stats.totalVolume?.toFixed(2) ?? '0.00'} TIPS`,
          icon: <SwapOutlined />,
        },
        {
          label: 'This Week',
          value: stats.thisWeek,
          icon: <SwapOutlined />,
        },
        {
          label: 'Avg Amount',
          value: `${stats.avgAmount?.toFixed(2) ?? '0.00'} TIPS`,
          icon: <SwapOutlined />,
        },
      ]
    : undefined;

  return (
    <div>
      <PageHeader
        title="Token Transfers"
        description="View TIPS token transactions"
        icon={<SwapOutlined />}
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
        <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
          <Row justify="space-between" align="middle">
            <Input
              placeholder="Search users..."
              prefix={<SearchOutlined />}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: 250 }}
              allowClear
            />
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setCreateModalOpen(true)}
            >
              Create Transfer
            </Button>
          </Row>

          <Table
            columns={columns}
            dataSource={transfers}
            loading={loadingList}
            rowKey="id"
            pagination={{
              current: currentPage,
              pageSize: PAGE_SIZE,
              total: pagination.total,
              showSizeChanger: false,
              showTotal: (total) => `Total ${total} transfers`,
            }}
            onChange={handleTableChange}
            scroll={TABLE_SCROLL_CONFIGS.AUTO}
            locale={{
              emptyText: <Empty description="No token transfers found" />,
            }}
          />
        </Space>
      </Card>

      {/* Detail Modal */}
      <Modal
        title="Transfer Details"
        open={detailModalOpen}
        onCancel={() => {
          setDetailModalOpen(false);
          setSelectedTransfer(null);
        }}
        footer={[
          <Button key="close" onClick={() => setDetailModalOpen(false)}>
            Close
          </Button>,
        ]}
        width={800}
      >
        {loadingDetail ? (
          <div style={{ textAlign: 'center', padding: '20px' }}>Loading...</div>
        ) : (
          selectedTransfer && (
            <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
              <Descriptions bordered column={2} size="small">
                <Descriptions.Item label="From">
                  {selectedTransfer.fromUsername ?? selectedTransfer.fromEmail ?? '—'}
                </Descriptions.Item>
                <Descriptions.Item label="To">
                  {selectedTransfer.toUsername ?? selectedTransfer.toEmail ?? '—'}
                </Descriptions.Item>
                <Descriptions.Item label="Amount" span={2}>
                  {selectedTransfer.amount?.toFixed(2) ?? '0.00'} TIPS
                </Descriptions.Item>
                <Descriptions.Item label="Reason" span={2}>
                  {selectedTransfer.reason ?? '—'}
                </Descriptions.Item>
                <Descriptions.Item label="Date" span={2}>
                  {new Date(selectedTransfer.createdAt).toLocaleString('en-US')}
                </Descriptions.Item>
              </Descriptions>
            </Space>
          )
        )}
      </Modal>

      {/* Create Transfer Modal */}
      <Modal
        title="Create Transfer"
        open={createModalOpen}
        onCancel={() => {
          setCreateModalOpen(false);
          createForm.resetFields();
        }}
        onOk={() => createForm.submit()}
        width={600}
      >
        <Alert
          message="Warning"
          description="This will directly transfer TIPS tokens between users. Use with caution."
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
        />
        <Form form={createForm} layout="vertical" onFinish={handleCreate}>
          <Form.Item
            name="fromUserId"
            label="From User ID"
            rules={[{ required: true, message: 'Please enter sender user ID' }]}
          >
            <Input placeholder="User UUID" />
          </Form.Item>
          <Form.Item
            name="toUserId"
            label="To User ID"
            rules={[{ required: true, message: 'Please enter recipient user ID' }]}
          >
            <Input placeholder="User UUID" />
          </Form.Item>
          <Form.Item
            name="amount"
            label="Amount"
            rules={[
              { required: true, message: 'Please enter amount' },
              { type: 'number', min: 0.01, message: 'Amount must be positive' },
            ]}
          >
            <InputNumber
              style={{ width: '100%' }}
              placeholder="Amount in TIPS"
              step={0.01}
              precision={2}
            />
          </Form.Item>
          <Form.Item
            name="reason"
            label="Reason"
            rules={[{ required: true, message: 'Please provide a reason' }]}
          >
            <Input.TextArea rows={3} placeholder="Why is this transfer being made?" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default TokenTransfers;
