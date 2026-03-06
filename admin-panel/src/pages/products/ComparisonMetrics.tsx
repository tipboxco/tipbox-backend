import { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Space,
  Button,
  Empty,
  Alert,
  Row,
  Modal,
  Form,
  Input,
  Popconfirm,
  message,
} from 'antd';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  BarChartOutlined,
} from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';
import {
  fetchComparisonMetrics,
  createComparisonMetric,
  updateComparisonMetric,
  deleteComparisonMetric,
} from '../../api/admin-comparison-metrics';
import type { ComparisonMetricListItem } from '../../api/admin-comparison-metrics';
import { TABLE_COLUMN_WIDTHS, TABLE_SCROLL_CONFIGS } from '../../constants/table-widths';

const PAGE_SIZE = 20;

function ComparisonMetrics() {
  const [metrics, setMetrics] = useState<ComparisonMetricListItem[]>([]);
  const [pagination, setPagination] = useState({
    total: 0,
    limit: PAGE_SIZE,
    offset: 0,
  });
  const [loadingList, setLoadingList] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingMetric, setEditingMetric] = useState<ComparisonMetricListItem | null>(null);
  const [form] = Form.useForm();

  const loadData = async () => {
    setLoadingList(true);
    try {
      const res = await fetchComparisonMetrics({
        limit: PAGE_SIZE,
        offset: pagination.offset,
      });
      setMetrics(res.data ?? []);
      if (res.pagination) setPagination(res.pagination);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load comparison metrics');
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    setLoadingList(true);
    (async () => {
      try {
        const res = await fetchComparisonMetrics({
          limit: PAGE_SIZE,
          offset: pagination.offset,
        });
        if (!cancelled) {
          setMetrics(res.data ?? []);
          if (res.pagination) setPagination((p) => ({ ...p, ...res.pagination }));
        }
      } catch (e) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : 'Failed to load comparison metrics');
      } finally {
        if (!cancelled) setLoadingList(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pagination.offset]);

  const openCreateModal = () => {
    setEditingMetric(null);
    form.resetFields();
    setModalOpen(true);
  };

  const openEditModal = (record: ComparisonMetricListItem) => {
    setEditingMetric(record);
    form.setFieldsValue({
      name: record.name,
      description: record.description ?? '',
    });
    setModalOpen(true);
  };

  const handleSubmit = async (values: { name: string; description?: string }) => {
    try {
      if (editingMetric) {
        await updateComparisonMetric(editingMetric.id, {
          name: values.name,
          description: values.description || null,
        });
        message.success('Comparison metric updated successfully');
      } else {
        await createComparisonMetric({
          name: values.name,
          description: values.description || null,
        });
        message.success('Comparison metric created successfully');
      }
      setModalOpen(false);
      form.resetFields();
      setEditingMetric(null);
      loadData();
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Failed to save comparison metric');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteComparisonMetric(id);
      message.success('Comparison metric deleted successfully');
      loadData();
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Failed to delete comparison metric');
    }
  };

  const columns: ColumnsType<ComparisonMetricListItem> = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      width: TABLE_COLUMN_WIDTHS.LONG_TEXT_FLEXIBLE,
      ellipsis: true,
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      width: TABLE_COLUMN_WIDTHS.VERY_LONG_TEXT,
      ellipsis: true,
      render: (text) => text ?? '—',
    },
    {
      title: 'Usage Count',
      dataIndex: 'usageCount',
      key: 'usageCount',
      width: TABLE_COLUMN_WIDTHS.NUMBER_MEDIUM,
      align: 'right',
    },
    {
      title: '',
      key: 'action',
      width: TABLE_COLUMN_WIDTHS.ACTION_BUTTONS,
      render: (_, record) => (
        <Space size="small">
          <Button
            size="small"
            type="text"
            icon={<EditOutlined />}
            onClick={() => openEditModal(record)}
          />
          <Popconfirm
            title="Delete comparison metric"
            description={
              record.usageCount > 0
                ? `This metric is used in ${record.usageCount} comparison(s) and cannot be deleted.`
                : 'Are you sure you want to delete this metric?'
            }
            onConfirm={() => handleDelete(record.id)}
            okText="Delete"
            okType="danger"
            okButtonProps={{ disabled: record.usageCount > 0 }}
            cancelText="Cancel"
          >
            <Button
              size="small"
              type="text"
              danger
              icon={<DeleteOutlined />}
              disabled={record.usageCount > 0}
            />
          </Popconfirm>
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
        title="Comparison Metrics"
        description="Manage metrics used in product comparisons"
        icon={<BarChartOutlined />}
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
          <Row justify="end" align="middle">
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
              Create Metric
            </Button>
          </Row>

          <Table
            columns={columns}
            dataSource={metrics}
            loading={loadingList}
            rowKey="id"
            pagination={{
              current: currentPage,
              pageSize: PAGE_SIZE,
              total: pagination.total,
              showSizeChanger: false,
              showTotal: (total) => `Total ${total} metrics`,
            }}
            onChange={handleTableChange}
            scroll={TABLE_SCROLL_CONFIGS.AUTO}
            locale={{
              emptyText: <Empty description="No comparison metrics found" />,
            }}
          />
        </Space>
      </Card>

      {/* Create / Edit Modal */}
      <Modal
        title={editingMetric ? 'Edit Comparison Metric' : 'Create Comparison Metric'}
        open={modalOpen}
        onCancel={() => {
          setModalOpen(false);
          setEditingMetric(null);
          form.resetFields();
        }}
        onOk={() => form.submit()}
        okText={editingMetric ? 'Update' : 'Create'}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item
            name="name"
            label="Name"
            rules={[{ required: true, message: 'Please enter a metric name' }]}
          >
            <Input placeholder="e.g., Battery Life" maxLength={200} />
          </Form.Item>

          <Form.Item name="description" label="Description">
            <Input.TextArea
              rows={4}
              placeholder="Optional description for this metric"
              maxLength={1000}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default ComparisonMetrics;
