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
  Popconfirm,
  message,
} from 'antd';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import {
  FolderOutlined,
  EditOutlined,
  DeleteOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';
import { get, patch, del } from '../../api/client';
import { TABLE_COLUMN_WIDTHS, TABLE_SCROLL_CONFIGS } from '../../constants/table-widths';

const PAGE_SIZE = 20;

interface ContentCollectionItem {
  id: string;
  name: string;
  description: string | null;
  userId: string;
  userName: string | null;
  createdAt: string;
  updatedAt: string;
}

function ContentCollections() {
  const [collections, setCollections] = useState<ContentCollectionItem[]>([]);
  const [pagination, setPagination] = useState({
    total: 0,
    limit: PAGE_SIZE,
    offset: 0,
  });
  const [loadingList, setLoadingList] = useState(true);
  const [search, setSearch] = useState('');
  const [userIdFilter, setUserIdFilter] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingCollection, setEditingCollection] = useState<ContentCollectionItem | null>(null);
  const [form] = Form.useForm();

  useEffect(() => {
    let cancelled = false;
    setLoadingList(true);
    (async () => {
      try {
        const query: Record<string, string | number | boolean | undefined> = {
          limit: PAGE_SIZE,
          offset: pagination.offset,
        };
        if (search) query.search = search;
        if (userIdFilter) query.userId = userIdFilter;

        const res = await get<ContentCollectionItem[]>('/admin/content/collections', query);
        if (!cancelled) {
          setCollections(res.data ?? []);
          if (res.pagination) setPagination((p) => ({ ...p, ...res.pagination }));
        }
      } catch (e) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : 'Failed to load content collections');
      } finally {
        if (!cancelled) setLoadingList(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pagination.offset, search, userIdFilter]);

  const loadData = async () => {
    setLoadingList(true);
    try {
      const query: Record<string, string | number | boolean | undefined> = {
        limit: PAGE_SIZE,
        offset: pagination.offset,
      };
      if (search) query.search = search;
      if (userIdFilter) query.userId = userIdFilter;

      const res = await get<ContentCollectionItem[]>('/admin/content/collections', query);
      setCollections(res.data ?? []);
      if (res.pagination) setPagination((p) => ({ ...p, ...res.pagination }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load content collections');
    } finally {
      setLoadingList(false);
    }
  };

  const openEditModal = (record: ContentCollectionItem) => {
    setEditingCollection(record);
    form.setFieldsValue({
      name: record.name,
      description: record.description ?? '',
    });
    setEditModalOpen(true);
  };

  const handleEdit = async (values: { name: string; description?: string }) => {
    if (!editingCollection) return;
    try {
      await patch(`/admin/content/collections/${editingCollection.id}`, {
        name: values.name,
        description: values.description || null,
      });
      message.success('Collection updated successfully');
      setEditModalOpen(false);
      setEditingCollection(null);
      form.resetFields();
      loadData();
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Failed to update collection');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await del(`/admin/content/collections/${id}`);
      message.success('Collection deleted successfully');
      loadData();
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Failed to delete collection');
    }
  };

  const columns: ColumnsType<ContentCollectionItem> = [
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
      title: 'User',
      dataIndex: 'userName',
      key: 'userName',
      width: TABLE_COLUMN_WIDTHS.MEDIUM_TEXT,
      ellipsis: true,
      render: (text) => text ?? '—',
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
            title="Delete collection"
            description="Are you sure you want to delete this collection?"
            onConfirm={() => handleDelete(record.id)}
            okText="Delete"
            okType="danger"
            cancelText="Cancel"
          >
            <Button size="small" type="text" danger icon={<DeleteOutlined />} />
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
        title="Content Collections"
        description="Moderate user content collections"
        icon={<FolderOutlined />}
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
          <Row justify="start" align="middle">
            <Space wrap>
              <Input
                placeholder="Search by name..."
                prefix={<SearchOutlined />}
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPagination((p) => ({ ...p, offset: 0 }));
                }}
                style={{ width: 250 }}
                allowClear
              />
              <Input
                placeholder="Filter by User ID"
                value={userIdFilter}
                onChange={(e) => {
                  setUserIdFilter(e.target.value);
                  setPagination((p) => ({ ...p, offset: 0 }));
                }}
                style={{ width: 300 }}
                allowClear
              />
            </Space>
          </Row>

          <Table
            columns={columns}
            dataSource={collections}
            loading={loadingList}
            rowKey="id"
            pagination={{
              current: currentPage,
              pageSize: PAGE_SIZE,
              total: pagination.total,
              showSizeChanger: false,
              showTotal: (total) => `Total ${total} collections`,
            }}
            onChange={handleTableChange}
            scroll={TABLE_SCROLL_CONFIGS.AUTO}
            locale={{
              emptyText: <Empty description="No content collections found" />,
            }}
          />
        </Space>
      </Card>

      {/* Edit Collection Modal */}
      <Modal
        title="Edit Collection"
        open={editModalOpen}
        onCancel={() => {
          setEditModalOpen(false);
          setEditingCollection(null);
          form.resetFields();
        }}
        onOk={() => form.submit()}
        okText="Update"
      >
        <Form form={form} layout="vertical" onFinish={handleEdit}>
          <Form.Item
            name="name"
            label="Name"
            rules={[{ required: true, message: 'Please enter a collection name' }]}
          >
            <Input placeholder="Collection name" maxLength={300} />
          </Form.Item>

          <Form.Item name="description" label="Description">
            <Input.TextArea
              rows={4}
              placeholder="Optional description"
              maxLength={2000}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default ContentCollections;
