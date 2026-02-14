import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
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
  DatePicker,
  message,
  Popconfirm,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  GiftOutlined,
  PlusOutlined,
  DeleteOutlined,
  LockOutlined,
  UnlockOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import PageHeader from '../../components/PageHeader';
import { type StatItemData } from '../../components/StatItem';
import {
  fetchLootboxStats,
  fetchLootboxes,
  createLootbox,
  deleteLootbox,
  type LootboxStatsResponse,
  type LootboxListItem,
} from '../../api/admin-lootboxes';

const PAGE_SIZE = 20;

const TIER_COLORS: Record<string, string> = {
  COMMON: 'default',
  RARE: 'blue',
  EPIC: 'purple',
  LEGENDARY: 'gold',
};

function Lootboxes() {
  const [stats, setStats] = useState<LootboxStatsResponse | null>(null);
  const [lootboxes, setLootboxes] = useState<LootboxListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingStats, setLoadingStats] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [opened, setOpened] = useState<string>('');
  const [type, setType] = useState<string>('');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createForm] = Form.useForm();
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchLootboxStats();
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

  const loadLootboxes = async (page = 1) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchLootboxes({
        limit: PAGE_SIZE,
        offset: (page - 1) * PAGE_SIZE,
        opened: opened === 'true' ? true : opened === 'false' ? false : undefined,
        type: type || undefined,
      });
      setLootboxes(res.data ?? []);
      setTotal(res.pagination?.total ?? 0);
      setCurrentPage(page);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load lootboxes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLootboxes(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened, type]);

  const handleCreate = async (values: {
    userId: string;
    type: string;
    tier: 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';
    expiresAt?: dayjs.Dayjs;
  }) => {
    try {
      await createLootbox({
        userId: values.userId.trim(),
        type: values.type.trim(),
        tier: values.tier,
        expiresAt: values.expiresAt ? values.expiresAt.toISOString() : null,
      });
      message.success('Lootbox created successfully');
      setCreateModalOpen(false);
      createForm.resetFields();
      loadLootboxes(currentPage);
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Failed to create lootbox');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteLootbox(id);
      message.success('Lootbox deleted successfully');
      loadLootboxes(currentPage);
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Failed to delete lootbox');
    }
  };

  const columns: ColumnsType<LootboxListItem> = [
    {
      title: 'User',
      key: 'user',
      width: 150,
      ellipsis: true,
      render: (_, record) => (
        <Link to={`/users/${record.userId}`}>
          {record.username || record.userEmail || 'Unknown'}
        </Link>
      ),
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      width: 120,
      ellipsis: true,
    },
    {
      title: 'Tier',
      dataIndex: 'tier',
      key: 'tier',
      width: 120,
      render: (tier) => <Tag color={TIER_COLORS[tier]}>{tier}</Tag>,
    },
    {
      title: 'Status',
      dataIndex: 'opened',
      key: 'opened',
      width: 100,
      render: (opened) =>
        opened ? (
          <Tag icon={<UnlockOutlined />} color="success">
            Opened
          </Tag>
        ) : (
          <Tag icon={<LockOutlined />} color="processing">
            Unopened
          </Tag>
        ),
    },
    {
      title: 'Opened At',
      dataIndex: 'openedAt',
      key: 'openedAt',
      width: 120,
      render: (date) => (date ? new Date(date).toLocaleDateString() : '—'),
    },
    {
      title: 'Expires At',
      dataIndex: 'expiresAt',
      key: 'expiresAt',
      width: 120,
      render: (date) => {
        if (!date) return '—';
        const expiryDate = new Date(date);
        const isExpired = expiryDate < new Date();
        return (
          <span style={{ color: isExpired ? '#ff4d4f' : undefined }}>
            {expiryDate.toLocaleDateString()}
          </span>
        );
      },
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
      width: 80,
      render: (_, record) => (
        <Popconfirm
          title="Delete Lootbox"
          description={
            record.opened
              ? 'This lootbox has been opened. Delete anyway?'
              : 'Are you sure you want to delete this lootbox?'
          }
          onConfirm={() => handleDelete(record.id)}
          okText="Delete"
          okType="danger"
          disabled={record.opened}
        >
          <Button
            size="small"
            type="text"
            danger
            icon={<DeleteOutlined />}
            disabled={record.opened}
            title={record.opened ? 'Cannot delete opened lootbox' : 'Delete lootbox'}
          />
        </Popconfirm>
      ),
    },
  ];

  const statsData: StatItemData[] | undefined = stats
    ? [
        {
          label: 'Total Lootboxes',
          value: stats.total,
          icon: <GiftOutlined />,
        },
        {
          label: 'Unopened',
          value: stats.unopened,
          icon: <LockOutlined />,
          valueStyle: { color: '#1890ff' },
        },
        {
          label: 'Opened',
          value: stats.opened,
          icon: <UnlockOutlined />,
          valueStyle: { color: '#52c41a' },
        },
      ]
    : undefined;

  return (
    <div>
      <PageHeader
        title="Lootboxes"
        description="Manage user lootboxes and rewards"
        icon={<GiftOutlined />}
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
        title="Lootbox Management"
        extra={
          <Space wrap>
            <Input
              placeholder="Lootbox type"
              value={type}
              onChange={(e) => setType(e.target.value)}
              style={{ width: 150 }}
              allowClear
            />
            <Select
              placeholder="Status"
              value={opened || undefined}
              onChange={setOpened}
              style={{ width: 150 }}
              allowClear
            >
              <Select.Option value="false">Unopened</Select.Option>
              <Select.Option value="true">Opened</Select.Option>
            </Select>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setCreateModalOpen(true)}
            >
              Create Lootbox
            </Button>
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={lootboxes}
          rowKey="id"
          loading={loading}
          pagination={{
            current: currentPage,
            pageSize: PAGE_SIZE,
            total,
            showSizeChanger: false,
            showTotal: (total) => `Total ${total} lootboxes`,
            onChange: loadLootboxes,
          }}
          locale={{
            emptyText: <Empty description="No lootboxes found" />,
          }}
        />
      </Card>

      {/* Create Lootbox Modal */}
      <Modal
        title="Create Lootbox"
        open={createModalOpen}
        onCancel={() => {
          setCreateModalOpen(false);
          createForm.resetFields();
        }}
        onOk={() => createForm.submit()}
        okText="Create"
      >
        <Form form={createForm} layout="vertical" onFinish={handleCreate}>
          <Form.Item
            name="userId"
            label="User ID"
            rules={[
              { required: true, message: 'Please enter user ID' },
              {
                pattern: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
                message: 'Please enter a valid UUID',
              },
            ]}
          >
            <Input placeholder="e.g., 123e4567-e89b-12d3-a456-426614174000" />
          </Form.Item>

          <Form.Item
            name="type"
            label="Lootbox Type"
            rules={[
              { required: true, message: 'Please enter lootbox type' },
              { min: 1, max: 50, message: 'Type must be 1-50 characters' },
            ]}
          >
            <Input placeholder="e.g., Daily Reward, Event Prize" />
          </Form.Item>

          <Form.Item
            name="tier"
            label="Tier"
            rules={[{ required: true, message: 'Please select tier' }]}
            initialValue="COMMON"
          >
            <Select>
              <Select.Option value="COMMON">
                <Tag color={TIER_COLORS.COMMON}>COMMON</Tag>
              </Select.Option>
              <Select.Option value="RARE">
                <Tag color={TIER_COLORS.RARE}>RARE</Tag>
              </Select.Option>
              <Select.Option value="EPIC">
                <Tag color={TIER_COLORS.EPIC}>EPIC</Tag>
              </Select.Option>
              <Select.Option value="LEGENDARY">
                <Tag color={TIER_COLORS.LEGENDARY}>LEGENDARY</Tag>
              </Select.Option>
            </Select>
          </Form.Item>

          <Form.Item name="expiresAt" label="Expiration Date (Optional)">
            <DatePicker
              showTime
              style={{ width: '100%' }}
              placeholder="Select expiration date"
              disabledDate={(current) => current && current < dayjs().startOf('day')}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default Lootboxes;
