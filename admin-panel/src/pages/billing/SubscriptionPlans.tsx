import { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Tag,
  Space,
  Button,
  Select,
  Empty,
  Alert,
  Modal,
  Form,
  Input,
  InputNumber,
  Switch,
  message,
  Popconfirm,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  CreditCardOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';
import { type StatItemData } from '../../components/StatItem';
import {
  fetchSubscriptionPlansStats,
  fetchSubscriptionPlans,
  createSubscriptionPlan,
  updateSubscriptionPlan,
  deleteSubscriptionPlan,
  type SubscriptionPlanStatsResponse,
  type SubscriptionPlanListItem,
} from '../../api/admin-subscription-plans';

const PAGE_SIZE = 20;

function SubscriptionPlans() {
  const [stats, setStats] = useState<SubscriptionPlanStatsResponse | null>(null);
  const [plans, setPlans] = useState<SubscriptionPlanListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingStats, setLoadingStats] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<string>('');
  const [isActive, setIsActive] = useState<string>('');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlanListItem | null>(null);
  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchSubscriptionPlansStats();
        if (!cancelled && res.data) setStats(res.data);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load statistics');
      } finally {
        if (!cancelled) setLoadingStats(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadPlans = async (page = 1) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchSubscriptionPlans({
        limit: PAGE_SIZE,
        offset: (page - 1) * PAGE_SIZE,
        isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
        period: period ? (period as 'MONTHLY' | 'YEARLY') : undefined,
      });
      setPlans(res.data ?? []);
      setTotal(res.pagination?.total ?? 0);
      setCurrentPage(page);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load subscription plans');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPlans(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, isActive]);

  const handleCreate = async (values: {
    name: string;
    price: number;
    currency: string;
    period: 'MONTHLY' | 'YEARLY';
    benefits: string;
    isActive: boolean;
    displayOrder: number;
  }) => {
    try {
      const benefitsArray = values.benefits
        ? values.benefits.split('\n').filter((b) => b.trim())
        : [];

      await createSubscriptionPlan({
        name: values.name.trim(),
        price: values.price,
        currency: values.currency,
        period: values.period,
        benefits: benefitsArray,
        isActive: values.isActive,
        displayOrder: values.displayOrder,
      });
      message.success('Subscription plan created successfully');
      setCreateModalOpen(false);
      createForm.resetFields();
      loadPlans(currentPage);
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Failed to create subscription plan');
    }
  };

  const openEditModal = (plan: SubscriptionPlanListItem) => {
    setSelectedPlan(plan);
    const benefitsText = Array.isArray(plan.benefits)
      ? plan.benefits.join('\n')
      : '';
    editForm.setFieldsValue({
      name: plan.name,
      price: plan.price,
      currency: plan.currency,
      period: plan.period,
      benefits: benefitsText,
      isActive: plan.isActive,
      displayOrder: plan.displayOrder,
    });
    setEditModalOpen(true);
  };

  const handleEdit = async (values: {
    name: string;
    price: number;
    currency: string;
    period: 'MONTHLY' | 'YEARLY';
    benefits: string;
    isActive: boolean;
    displayOrder: number;
  }) => {
    if (!selectedPlan) return;

    try {
      const benefitsArray = values.benefits
        ? values.benefits.split('\n').filter((b) => b.trim())
        : [];

      await updateSubscriptionPlan(selectedPlan.id, {
        name: values.name.trim(),
        price: values.price,
        currency: values.currency,
        period: values.period,
        benefits: benefitsArray,
        isActive: values.isActive,
        displayOrder: values.displayOrder,
      });
      message.success('Subscription plan updated successfully');
      setEditModalOpen(false);
      editForm.resetFields();
      setSelectedPlan(null);
      loadPlans(currentPage);
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Failed to update subscription plan');
    }
  };

  const handleDelete = async (id: string, name: string, subscriptionCount: number) => {
    if (subscriptionCount > 0) {
      message.warning(`Cannot delete plan with ${subscriptionCount} active subscription(s)`);
      return;
    }

    try {
      await deleteSubscriptionPlan(id);
      message.success('Subscription plan deleted successfully');
      loadPlans(currentPage);
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Failed to delete subscription plan');
    }
  };

  const columns: ColumnsType<SubscriptionPlanListItem> = [
    {
      title: 'Order',
      dataIndex: 'displayOrder',
      key: 'displayOrder',
      width: 80,
      align: 'center',
    },
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      width: 200,
      ellipsis: true,
    },
    {
      title: 'Price',
      key: 'price',
      width: 120,
      render: (_, record) => (
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>
          {record.price.toFixed(2)} {record.currency}
        </span>
      ),
    },
    {
      title: 'Period',
      dataIndex: 'period',
      key: 'period',
      width: 100,
      render: (period) => (
        <Tag color={period === 'MONTHLY' ? 'blue' : 'purple'}>{period}</Tag>
      ),
    },
    {
      title: 'Active',
      dataIndex: 'isActive',
      key: 'isActive',
      width: 80,
      align: 'center',
      render: (isActive) => (
        <Tag color={isActive ? 'success' : 'default'}>
          {isActive ? 'Yes' : 'No'}
        </Tag>
      ),
    },
    {
      title: 'Subscriptions',
      dataIndex: 'subscriptionCount',
      key: 'subscriptionCount',
      width: 120,
      align: 'right',
      render: (count) => <span style={{ fontVariantNumeric: 'tabular-nums' }}>{count}</span>,
    },
    {
      title: 'Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 110,
      render: (date) => new Date(date).toLocaleDateString(),
    },
    {
      title: '',
      key: 'actions',
      width: 120,
      render: (_, record) => (
        <Space size="small">
          <Button
            size="small"
            type="text"
            icon={<EditOutlined />}
            onClick={() => openEditModal(record)}
            title="Edit plan"
          />
          <Popconfirm
            title="Delete Subscription Plan"
            description={
              record.subscriptionCount > 0
                ? `This plan has ${record.subscriptionCount} active subscription(s). Cannot delete.`
                : `Delete "${record.name}"?`
            }
            onConfirm={() => handleDelete(record.id, record.name, record.subscriptionCount)}
            okText="Delete"
            okType="danger"
            disabled={record.subscriptionCount > 0}
          >
            <Button
              size="small"
              type="text"
              danger
              icon={<DeleteOutlined />}
              disabled={record.subscriptionCount > 0}
              title={
                record.subscriptionCount > 0
                  ? 'Cannot delete plan with active subscriptions'
                  : 'Delete plan'
              }
            />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const statsData: StatItemData[] | undefined = stats
    ? [
        {
          label: 'Total Plans',
          value: stats.total,
          icon: <CreditCardOutlined />,
        },
        {
          label: 'Active',
          value: stats.active,
          icon: <CreditCardOutlined />,
          valueStyle: { color: '#52c41a' },
        },
        {
          label: 'Total Subscriptions',
          value: stats.totalSubscriptions,
          icon: <CreditCardOutlined />,
        },
      ]
    : undefined;

  return (
    <div>
      <PageHeader
        title="Subscription Plans"
        description="Manage subscription tiers and pricing"
        icon={<CreditCardOutlined />}
        stats={statsData}
        statsLoading={loadingStats}
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
        title="Subscription Plan Management"
        extra={
          <Space wrap>
            <Select
              placeholder="Period"
              value={period || undefined}
              onChange={setPeriod}
              style={{ width: 150 }}
              allowClear
            >
              <Select.Option value="MONTHLY">Monthly</Select.Option>
              <Select.Option value="YEARLY">Yearly</Select.Option>
            </Select>
            <Select
              placeholder="Status"
              value={isActive || undefined}
              onChange={setIsActive}
              style={{ width: 150 }}
              allowClear
            >
              <Select.Option value="true">Active</Select.Option>
              <Select.Option value="false">Inactive</Select.Option>
            </Select>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setCreateModalOpen(true)}
            >
              Create Plan
            </Button>
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={plans}
          rowKey="id"
          loading={loading}
          pagination={{
            current: currentPage,
            pageSize: PAGE_SIZE,
            total,
            showSizeChanger: false,
            showTotal: (total) => `Total ${total} plans`,
            onChange: loadPlans,
          }}
          locale={{
            emptyText: <Empty description="No subscription plans found" />,
          }}
        />
      </Card>

      {/* Create Plan Modal */}
      <Modal
        title="Create Subscription Plan"
        open={createModalOpen}
        onCancel={() => {
          setCreateModalOpen(false);
          createForm.resetFields();
        }}
        onOk={() => createForm.submit()}
        okText="Create"
        width={600}
      >
        <Form
          form={createForm}
          layout="vertical"
          onFinish={handleCreate}
          initialValues={{ currency: 'USD', isActive: true, displayOrder: 0 }}
        >
          <Form.Item
            name="name"
            label="Plan Name"
            rules={[
              { required: true, message: 'Please enter plan name' },
              { min: 1, max: 200, message: 'Name must be 1-200 characters' },
            ]}
          >
            <Input placeholder="e.g., Pro Plan, Enterprise" />
          </Form.Item>

          <Space style={{ width: '100%' }} size="large">
            <Form.Item
              name="price"
              label="Price"
              rules={[
                { required: true, message: 'Please enter price' },
                { type: 'number', min: 0, message: 'Price must be positive' },
              ]}
            >
              <InputNumber min={0} step={0.01} style={{ width: 150 }} />
            </Form.Item>

            <Form.Item
              name="currency"
              label="Currency"
              rules={[{ required: true, message: 'Please select currency' }]}
            >
              <Select style={{ width: 100 }}>
                <Select.Option value="USD">USD</Select.Option>
                <Select.Option value="EUR">EUR</Select.Option>
                <Select.Option value="GBP">GBP</Select.Option>
                <Select.Option value="TRY">TRY</Select.Option>
              </Select>
            </Form.Item>

            <Form.Item
              name="period"
              label="Period"
              rules={[{ required: true, message: 'Please select period' }]}
            >
              <Select style={{ width: 120 }}>
                <Select.Option value="MONTHLY">Monthly</Select.Option>
                <Select.Option value="YEARLY">Yearly</Select.Option>
              </Select>
            </Form.Item>
          </Space>

          <Form.Item name="benefits" label="Benefits (one per line)">
            <Input.TextArea
              rows={6}
              placeholder="Feature 1&#10;Feature 2&#10;Feature 3"
            />
          </Form.Item>

          <Space style={{ width: '100%' }} size="large">
            <Form.Item
              name="displayOrder"
              label="Display Order"
              rules={[{ required: true, message: 'Please enter display order' }]}
            >
              <InputNumber min={0} style={{ width: 120 }} />
            </Form.Item>

            <Form.Item name="isActive" label="Active" valuePropName="checked">
              <Switch />
            </Form.Item>
          </Space>
        </Form>
      </Modal>

      {/* Edit Plan Modal */}
      <Modal
        title="Edit Subscription Plan"
        open={editModalOpen}
        onCancel={() => {
          setEditModalOpen(false);
          editForm.resetFields();
          setSelectedPlan(null);
        }}
        onOk={() => editForm.submit()}
        okText="Update"
        width={600}
      >
        <Form form={editForm} layout="vertical" onFinish={handleEdit}>
          <Form.Item
            name="name"
            label="Plan Name"
            rules={[
              { required: true, message: 'Please enter plan name' },
              { min: 1, max: 200, message: 'Name must be 1-200 characters' },
            ]}
          >
            <Input placeholder="e.g., Pro Plan, Enterprise" />
          </Form.Item>

          <Space style={{ width: '100%' }} size="large">
            <Form.Item
              name="price"
              label="Price"
              rules={[
                { required: true, message: 'Please enter price' },
                { type: 'number', min: 0, message: 'Price must be positive' },
              ]}
            >
              <InputNumber min={0} step={0.01} style={{ width: 150 }} />
            </Form.Item>

            <Form.Item
              name="currency"
              label="Currency"
              rules={[{ required: true, message: 'Please select currency' }]}
            >
              <Select style={{ width: 100 }}>
                <Select.Option value="USD">USD</Select.Option>
                <Select.Option value="EUR">EUR</Select.Option>
                <Select.Option value="GBP">GBP</Select.Option>
                <Select.Option value="TRY">TRY</Select.Option>
              </Select>
            </Form.Item>

            <Form.Item
              name="period"
              label="Period"
              rules={[{ required: true, message: 'Please select period' }]}
            >
              <Select style={{ width: 120 }}>
                <Select.Option value="MONTHLY">Monthly</Select.Option>
                <Select.Option value="YEARLY">Yearly</Select.Option>
              </Select>
            </Form.Item>
          </Space>

          <Form.Item name="benefits" label="Benefits (one per line)">
            <Input.TextArea
              rows={6}
              placeholder="Feature 1&#10;Feature 2&#10;Feature 3"
            />
          </Form.Item>

          <Space style={{ width: '100%' }} size="large">
            <Form.Item
              name="displayOrder"
              label="Display Order"
              rules={[{ required: true, message: 'Please enter display order' }]}
            >
              <InputNumber min={0} style={{ width: 120 }} />
            </Form.Item>

            <Form.Item name="isActive" label="Active" valuePropName="checked">
              <Switch />
            </Form.Item>
          </Space>
        </Form>
      </Modal>
    </div>
  );
}

export default SubscriptionPlans;
