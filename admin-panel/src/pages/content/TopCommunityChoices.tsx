import { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Empty,
  Alert,
  Modal,
  Form,
  Input,
  Popconfirm,
  message as antdMessage,
} from 'antd';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import { TrophyOutlined, EditOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';
import {
  fetchTopCommunityChoices,
  createTopCommunityChoice,
  updateTopCommunityChoice,
  deleteTopCommunityChoice,
} from '../../api/admin-content';
import type { AdminTopCommunityChoiceListItem } from '../../types/admin';
import { TABLE_COLUMN_WIDTHS, TABLE_SCROLL_CONFIGS } from '../../constants/table-widths';

const PAGE_SIZE = 20;

function TopCommunityChoices() {
  const [rows, setRows] = useState<AdminTopCommunityChoiceListItem[]>([]);
  const [pagination, setPagination] = useState({
    total: 0,
    limit: PAGE_SIZE,
    offset: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<AdminTopCommunityChoiceListItem | null>(
    null,
  );

  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetchTopCommunityChoices({
        limit: PAGE_SIZE,
        offset: pagination.offset,
      });
      setRows(res.data ?? []);
      if (res.pagination) setPagination((p) => ({ ...p, ...res.pagination }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load list');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [pagination.offset]);

  const handleCreate = async (values: {
    postId: string;
    badgeLabel: string;
    reason?: string;
  }) => {
    setActionLoading('create');
    try {
      await createTopCommunityChoice({
        postId: values.postId.trim(),
        badgeLabel: values.badgeLabel.trim(),
        reason: values.reason?.trim() || null,
      });
      antdMessage.success('Top community choice created');
      setCreateModalOpen(false);
      createForm.resetFields();
      load();
    } catch (e) {
      antdMessage.error(e instanceof Error ? e.message : 'Failed to create');
    } finally {
      setActionLoading(null);
    }
  };

  const openEditModal = (record: AdminTopCommunityChoiceListItem) => {
    setSelectedRecord(record);
    editForm.setFieldsValue({
      badgeLabel: record.badgeLabel,
      reason: record.reason ?? '',
    });
    setEditModalOpen(true);
  };

  const handleEdit = async (values: { badgeLabel: string; reason?: string }) => {
    if (!selectedRecord) return;
    setActionLoading('edit');
    try {
      await updateTopCommunityChoice(selectedRecord.id, {
        badgeLabel: values.badgeLabel.trim(),
        reason: values.reason?.trim() || null,
      });
      antdMessage.success('Top community choice updated');
      setEditModalOpen(false);
      editForm.resetFields();
      setSelectedRecord(null);
      load();
    } catch (e) {
      antdMessage.error(e instanceof Error ? e.message : 'Failed to update');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (id: string) => {
    setActionLoading(id);
    try {
      await deleteTopCommunityChoice(id);
      antdMessage.success('Top community choice deleted');
      load();
    } catch (e) {
      antdMessage.error(e instanceof Error ? e.message : 'Failed to delete');
    } finally {
      setActionLoading(null);
    }
  };

  const columns: ColumnsType<AdminTopCommunityChoiceListItem> = [
    {
      title: 'Post ID',
      dataIndex: 'postId',
      key: 'postId',
      width: TABLE_COLUMN_WIDTHS.LONG_TEXT_FIXED,
      ellipsis: true,
    },
    {
      title: 'Post Title',
      dataIndex: 'postTitle',
      key: 'postTitle',
      width: TABLE_COLUMN_WIDTHS.LONG_TEXT_FLEXIBLE,
      ellipsis: true,
      render: (text) => text ?? '—',
    },
    {
      title: 'Badge Label',
      dataIndex: 'badgeLabel',
      key: 'badgeLabel',
      width: TABLE_COLUMN_WIDTHS.MEDIUM_TEXT,
      ellipsis: true,
    },
    {
      title: 'Reason',
      dataIndex: 'reason',
      key: 'reason',
      width: TABLE_COLUMN_WIDTHS.LONG_TEXT_FIXED,
      ellipsis: true,
      render: (text) => text ?? '—',
    },
    {
      title: 'Awarded At',
      dataIndex: 'awardedAt',
      key: 'awardedAt',
      width: TABLE_COLUMN_WIDTHS.DATETIME_FULL,
      ellipsis: true,
      render: (date) => (date ? new Date(date).toLocaleString('en-US') : '—'),
    },
    {
      title: '',
      key: 'actions',
      width: TABLE_COLUMN_WIDTHS.ACTION_BUTTONS,
      render: (_, record) => (
        <Space size="small">
          <Button
            size="small"
            type="text"
            icon={<EditOutlined />}
            onClick={() => openEditModal(record)}
            title="Edit"
          />
          <Popconfirm
            title="Delete Top Community Choice"
            description="Are you sure you want to delete this entry?"
            onConfirm={() => handleDelete(record.id)}
            okText="Delete"
            okType="danger"
          >
            <Button
              size="small"
              type="text"
              danger
              icon={<DeleteOutlined />}
              loading={actionLoading === record.id}
              title="Delete"
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
        title="Top Community Choices"
        description="Manage top community choice awards for posts"
        icon={<TrophyOutlined />}
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
        title="Top community choices list"
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setCreateModalOpen(true)}
          >
            Add choice
          </Button>
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
                description="No top community choices yet."
              />
            ),
          }}
        />
      </Card>

      {/* Create Modal */}
      <Modal
        title="Create Top Community Choice"
        open={createModalOpen}
        onCancel={() => {
          setCreateModalOpen(false);
          createForm.resetFields();
        }}
        onOk={() => createForm.submit()}
        okText="Create"
        confirmLoading={actionLoading === 'create'}
        width={520}
      >
        <Form form={createForm} layout="vertical" onFinish={handleCreate}>
          <Form.Item
            name="postId"
            label="Post ID"
            rules={[{ required: true, message: 'Please enter post ID' }]}
          >
            <Input placeholder="Enter post ID" />
          </Form.Item>

          <Form.Item
            name="badgeLabel"
            label="Badge Label"
            rules={[{ required: true, message: 'Please enter badge label' }]}
          >
            <Input placeholder="Enter badge label" />
          </Form.Item>

          <Form.Item name="reason" label="Reason">
            <Input.TextArea rows={3} placeholder="Optional reason" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Edit Modal */}
      <Modal
        title="Edit Top Community Choice"
        open={editModalOpen}
        onCancel={() => {
          setEditModalOpen(false);
          editForm.resetFields();
          setSelectedRecord(null);
        }}
        onOk={() => editForm.submit()}
        okText="Update"
        confirmLoading={actionLoading === 'edit'}
        width={520}
      >
        <Form form={editForm} layout="vertical" onFinish={handleEdit}>
          <Form.Item
            name="badgeLabel"
            label="Badge Label"
            rules={[{ required: true, message: 'Please enter badge label' }]}
          >
            <Input placeholder="Enter badge label" />
          </Form.Item>

          <Form.Item name="reason" label="Reason">
            <Input.TextArea rows={3} placeholder="Optional reason" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default TopCommunityChoices;
