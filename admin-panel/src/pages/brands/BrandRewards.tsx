import { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Space,
  Button,
  Empty,
  Alert,
  Row,
  Select,
  message,
  Modal,
  Form,
  Input,
} from 'antd';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import {
  GiftOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';
import ViewActionButton from '../../components/ViewActionButton';
import {
  fetchBrandRewardHistory,
  awardBrandBadge,
  fetchBrands,
} from '../../api/admin-brands';
import type {
  AdminBrandRewardHistoryListItem,
  AwardBrandBadgeInput,
} from '../../api/admin-brands';
import { TABLE_COLUMN_WIDTHS, TABLE_SCROLL_CONFIGS } from '../../constants/table-widths';

const PAGE_SIZE = 20;

function BrandRewards() {
  const [brands, setBrands] = useState<{ id: string; name: string }[]>([]);
  const [rewards, setRewards] = useState<AdminBrandRewardHistoryListItem[]>([]);
  const [pagination, setPagination] = useState({
    total: 0,
    limit: PAGE_SIZE,
    offset: 0,
  });
  const [loadingList, setLoadingList] = useState(false);
  const [selectedBrandId, setSelectedBrandId] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [awardModalOpen, setAwardModalOpen] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchBrands({});
        if (!cancelled && res.data) {
          setBrands(res.data.map(b => ({ id: b.id, name: b.name })));
        }
      } catch (e) {
        console.error('Failed to load brands:', e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadRewards = async () => {
    if (!selectedBrandId) {
      setRewards([]);
      setPagination({ total: 0, limit: PAGE_SIZE, offset: 0 });
      return;
    }

    setLoadingList(true);
    try {
      const res = await fetchBrandRewardHistory(selectedBrandId, {
        limit: PAGE_SIZE,
        offset: pagination.offset,
      });
      setRewards(res.data ?? []);
      if (res.pagination) setPagination(res.pagination);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load reward history');
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    loadRewards();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBrandId, pagination.offset]);

  const handleAward = async (values: Omit<AwardBrandBadgeInput, 'brandId'>) => {
    if (!selectedBrandId) {
      message.warning('Please select a brand first');
      return;
    }

    try {
      await awardBrandBadge({
        brandId: selectedBrandId,
        ...values,
      });
      message.success('Badge awarded successfully');
      setAwardModalOpen(false);
      form.resetFields();
      setPagination((prev) => ({ ...prev, offset: 0 }));
      loadRewards();
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Failed to award badge');
    }
  };

  const columns: ColumnsType<AdminBrandRewardHistoryListItem> = [
    {
      title: 'User',
      dataIndex: 'username',
      key: 'username',
      width: TABLE_COLUMN_WIDTHS.MEDIUM_TEXT,
      ellipsis: true,
      render: (text, record) => text ?? record.userEmail ?? '—',
    },
    {
      title: 'Badge',
      dataIndex: 'badgeName',
      key: 'badgeName',
      width: TABLE_COLUMN_WIDTHS.MEDIUM_TEXT,
      ellipsis: true,
    },
    {
      title: 'Reason',
      dataIndex: 'reason',
      key: 'reason',
      width: TABLE_COLUMN_WIDTHS.LONG_TEXT,
      ellipsis: true,
      render: (text) => text ?? '—',
    },
    {
      title: 'Awarded By',
      dataIndex: 'awardedByEmail',
      key: 'awardedByEmail',
      width: TABLE_COLUMN_WIDTHS.MEDIUM_TEXT,
      ellipsis: true,
      render: (text) => text ?? '—',
    },
    {
      title: 'Awarded',
      dataIndex: 'awardedAt',
      key: 'awardedAt',
      width: TABLE_COLUMN_WIDTHS.DATE_SHORT,
      ellipsis: true,
      render: (date) => (date ? new Date(date).toLocaleDateString('en-US') : '—'),
    },
    {
      title: '',
      key: 'action',
      width: TABLE_COLUMN_WIDTHS.ACTION_BUTTON_SINGLE,
      render: (_, record) => <ViewActionButton to={`/users/${record.userId}`} />,
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
        title="Rewards"
        description="Manage brand rewards and incentives"
        icon={<GiftOutlined />}
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
            <Select
              placeholder="Select brand"
              value={selectedBrandId}
              onChange={setSelectedBrandId}
              style={{ width: 200 }}
              showSearch
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              options={brands.map(b => ({ label: b.name, value: b.id }))}
            />
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setAwardModalOpen(true)}
              disabled={!selectedBrandId}
            >
              Award Badge
            </Button>
          </Row>

          <Table
            columns={columns}
            dataSource={rewards}
            loading={loadingList}
            rowKey="id"
            pagination={{
              current: currentPage,
              pageSize: PAGE_SIZE,
              total: pagination.total,
              showSizeChanger: false,
              showTotal: (total) => `Total ${total} rewards`,
            }}
            onChange={handleTableChange}
            scroll={TABLE_SCROLL_CONFIGS.DEFAULT}
            locale={{
              emptyText: selectedBrandId ? (
                <Empty description="No reward history found" />
              ) : (
                <Empty description="Select a brand to view reward history" />
              ),
            }}
          />
        </Space>
      </Card>

      {/* Award Badge Modal */}
      <Modal
        title="Award Badge"
        open={awardModalOpen}
        onCancel={() => {
          setAwardModalOpen(false);
          form.resetFields();
        }}
        onOk={() => form.submit()}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleAward}>
          <Form.Item
            name="userId"
            label="User ID"
            rules={[{ required: true, message: 'Please enter user ID' }]}
          >
            <Input placeholder="User UUID" />
          </Form.Item>
          <Form.Item
            name="badgeId"
            label="Badge ID"
            rules={[{ required: true, message: 'Please enter badge ID' }]}
          >
            <Input placeholder="Badge UUID" />
          </Form.Item>
          <Form.Item
            name="reason"
            label="Reason"
            rules={[{ required: true, message: 'Please provide a reason' }]}
          >
            <Input.TextArea
              rows={4}
              placeholder="Why is this badge being awarded?"
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default BrandRewards;
