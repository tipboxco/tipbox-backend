import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Card,
  Table,
  Input,
  Empty,
  Alert,
  Typography,
  Button,
  Space,
  Modal,
  Form,
  message,
  Select,
  Popconfirm,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  TagsOutlined,
  SearchOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  MergeCellsOutlined,
} from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';
import { type StatItemData } from '../../components/StatItem';
import {
  fetchContentTags,
  fetchTagsCategoriesStats,
  createTag,
  updateTag,
  deleteTag,
  mergeTags,
  type TagsCategoriesStatsResponse,
} from '../../api/admin-content';
import type { AdminContentTagListItem } from '../../types/admin';

const { Text } = Typography;
const PAGE_SIZE = 50;

function TagsCategories() {
  const [stats, setStats] = useState<TagsCategoriesStatsResponse | null>(null);
  const [tags, setTags] = useState<AdminContentTagListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingStats, setLoadingStats] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [mergeModalOpen, setMergeModalOpen] = useState(false);
  const [selectedTag, setSelectedTag] = useState<string>('');
  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();
  const [mergeForm] = Form.useForm();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchTagsCategoriesStats();
        if (!cancelled && res.data) setStats(res.data);
      } catch (e) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : 'Failed to load statistics');
      } finally {
        if (!cancelled) setLoadingStats(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadTags = async () => {
    setLoading(true);
    try {
      const res = await fetchContentTags({
        limit: PAGE_SIZE,
        offset: 0,
        search: search || undefined,
      });
      setTags(res.data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load tag list');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTags();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const handleCreate = async (values: { tag: string }) => {
    try {
      await createTag({ tag: values.tag.trim() });
      message.success('Tag created successfully');
      setCreateModalOpen(false);
      createForm.resetFields();
      loadTags();
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Failed to create tag');
    }
  };

  const handleEdit = async (values: { newTag: string }) => {
    try {
      await updateTag(selectedTag, values.newTag.trim());
      message.success('Tag renamed successfully');
      setEditModalOpen(false);
      editForm.resetFields();
      setSelectedTag('');
      loadTags();
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Failed to rename tag');
    }
  };

  const handleDelete = async (tag: string) => {
    try {
      await deleteTag(tag);
      message.success('Tag deleted successfully');
      loadTags();
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Failed to delete tag');
    }
  };

  const handleMerge = async (values: { sourceTags: string[]; targetTag: string }) => {
    try {
      await mergeTags({
        sourceTags: values.sourceTags,
        targetTag: values.targetTag.trim(),
      });
      message.success('Tags merged successfully');
      setMergeModalOpen(false);
      mergeForm.resetFields();
      loadTags();
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Failed to merge tags');
    }
  };

  const openEditModal = (tag: string) => {
    setSelectedTag(tag);
    editForm.setFieldsValue({ newTag: tag });
    setEditModalOpen(true);
  };

  const columns: ColumnsType<AdminContentTagListItem> = [
    {
      title: 'Tag',
      dataIndex: 'tag',
      key: 'tag',
      ellipsis: true,
    },
    {
      title: 'Usage Count',
      dataIndex: 'count',
      key: 'count',
      width: 120,
      align: 'right',
      sorter: (a, b) => (a.count ?? 0) - (b.count ?? 0),
      render: (count) => <span style={{ fontVariantNumeric: 'tabular-nums' }}>{count ?? 0}</span>,
    },
    {
      title: '',
      key: 'action',
      width: 120,
      render: (_, record) => (
        <Space size="small">
          <Button
            size="small"
            type="text"
            icon={<EditOutlined />}
            onClick={() => openEditModal(record.tag)}
            title="Rename tag"
          />
          <Popconfirm
            title="Delete Tag"
            description={
              record.count && record.count > 0
                ? `This tag is used in ${record.count} post(s). Are you sure you want to delete it?`
                : 'Are you sure you want to delete this tag?'
            }
            onConfirm={() => handleDelete(record.tag)}
            okText="Delete"
            okType="danger"
          >
            <Button
              size="small"
              type="text"
              danger
              icon={<DeleteOutlined />}
              title="Delete tag"
            />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const statsData: StatItemData[] | undefined = stats
    ? [
        {
          label: 'Total Tags',
          value: stats.totalTags,
          icon: <TagsOutlined />,
        },
        {
          label: 'Categories',
          value: stats.totalCategories,
          icon: <TagsOutlined />,
        },
      ]
    : undefined;

  return (
    <div>
      <PageHeader
        title="Tags & Categories"
        description="Manage content tags and categories"
        icon={<TagsOutlined />}
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
        title="Tag Management"
        extra={
          <Space wrap>
            <Input
              placeholder="Search tags"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              prefix={<SearchOutlined />}
              style={{ width: 200 }}
              allowClear
            />
            <Button
              icon={<MergeCellsOutlined />}
              onClick={() => setMergeModalOpen(true)}
            >
              Merge Tags
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setCreateModalOpen(true)}
            >
              Create Tag
            </Button>
          </Space>
        }
        style={{ marginBottom: 16 }}
      >
        <Table
          columns={columns}
          dataSource={tags}
          rowKey="tag"
          loading={loading}
          pagination={{
            pageSize: PAGE_SIZE,
            showSizeChanger: false,
            showTotal: (total) => `Total ${total} tags`,
          }}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="No tags found. Tags used in content are listed here."
              />
            ),
          }}
        />
      </Card>

      <Card bordered title="Categories">
        <Text type="secondary">
          For category, main category, and subcategory management, use the{' '}
          <Link to="/products/categories" style={{ color: 'inherit', textDecoration: 'underline' }}>
            Product Categories
          </Link>{' '}
          page.
        </Text>
      </Card>

      {/* Create Tag Modal */}
      <Modal
        title="Create Tag"
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
            name="tag"
            label="Tag Name"
            rules={[
              { required: true, message: 'Please enter tag name' },
              { min: 2, message: 'Tag must be at least 2 characters' },
              { max: 50, message: 'Tag must be at most 50 characters' },
            ]}
          >
            <Input placeholder="e.g., technology" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Edit Tag Modal */}
      <Modal
        title="Rename Tag"
        open={editModalOpen}
        onCancel={() => {
          setEditModalOpen(false);
          editForm.resetFields();
          setSelectedTag('');
        }}
        onOk={() => editForm.submit()}
        okText="Rename"
      >
        <Alert
          message="Warning"
          description={`This will rename "${selectedTag}" in all posts that use this tag.`}
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
        />
        <Form form={editForm} layout="vertical" onFinish={handleEdit}>
          <Form.Item
            name="newTag"
            label="New Tag Name"
            rules={[
              { required: true, message: 'Please enter new tag name' },
              { min: 2, message: 'Tag must be at least 2 characters' },
              { max: 50, message: 'Tag must be at most 50 characters' },
            ]}
          >
            <Input placeholder="New tag name" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Merge Tags Modal */}
      <Modal
        title="Merge Tags"
        open={mergeModalOpen}
        onCancel={() => {
          setMergeModalOpen(false);
          mergeForm.resetFields();
        }}
        onOk={() => mergeForm.submit()}
        okText="Merge"
        width={600}
      >
        <Alert
          message="How Tag Merging Works"
          description="Select source tags that will be merged into a target tag. All posts using source tags will be updated to use the target tag instead. Source tags will be removed."
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
        <Form form={mergeForm} layout="vertical" onFinish={handleMerge}>
          <Form.Item
            name="sourceTags"
            label="Source Tags (to be merged)"
            rules={[
              { required: true, message: 'Please select source tags' },
              { type: 'array', min: 1, message: 'Select at least one source tag' },
            ]}
          >
            <Select
              mode="multiple"
              placeholder="Select tags to merge"
              style={{ width: '100%' }}
              options={tags.map((t) => ({
                label: `${t.tag} (${t.count} uses)`,
                value: t.tag,
              }))}
            />
          </Form.Item>

          <Form.Item
            name="targetTag"
            label="Target Tag (result)"
            rules={[
              { required: true, message: 'Please enter target tag name' },
              { min: 2, message: 'Tag must be at least 2 characters' },
              { max: 50, message: 'Tag must be at most 50 characters' },
            ]}
          >
            <Input placeholder="Target tag name (can be new or existing)" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default TagsCategories;
