import { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Tag,
  Space,
  Button,
  Input,
  Empty,
  Alert,
  Modal,
  Form,
  InputNumber,
  Switch,
  Upload,
  message,
  Image,
  Popconfirm,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { UploadFile } from 'antd/es/upload/interface';
import {
  RocketOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  UploadOutlined,
  SearchOutlined,
  ThunderboltOutlined,
  StarOutlined,
} from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';
import { type StatItemData } from '../../components/StatItem';
import {
  fetchBoostOptionStats,
  fetchBoostOptions,
  createBoostOption,
  updateBoostOption,
  deleteBoostOption,
  uploadBoostOptionImage,
  type BoostOptionStatsResponse,
  type BoostOptionListItem,
} from '../../api/admin-boost-options';

const PAGE_SIZE = 20;

function BoostOptions() {
  const [stats, setStats] = useState<BoostOptionStatsResponse | null>(null);
  const [boostOptions, setBoostOptions] = useState<BoostOptionListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingStats, setLoadingStats] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedOption, setSelectedOption] = useState<BoostOptionListItem | null>(null);
  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);

  // Load stats
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchBoostOptionStats();
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

  const loadData = async (page = 1) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchBoostOptions({
        limit: PAGE_SIZE,
        offset: (page - 1) * PAGE_SIZE,
        search: search || undefined,
      });
      setBoostOptions(res.data ?? []);
      setTotal(res.pagination?.total ?? 0);
      setCurrentPage(page);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load boost options');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const reloadStats = async () => {
    try {
      const res = await fetchBoostOptionStats();
      if (res.data) setStats(res.data);
    } catch {
      // silently ignore stats reload errors
    }
  };

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const res = await uploadBoostOptionImage(file);
      const url = res.data?.url ?? (res as unknown as { url: string }).url;
      setUploadedImageUrl(url);
      message.success('Image uploaded successfully');
      return url;
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Failed to upload image');
      throw e;
    } finally {
      setUploading(false);
    }
  };

  const handleCreate = async (values: {
    title: string;
    description?: string;
    amount: number;
    isActive: boolean;
    isPopular: boolean;
  }) => {
    try {
      await createBoostOption({
        title: values.title.trim(),
        description: values.description?.trim() || null,
        image: uploadedImageUrl || null,
        amount: values.amount,
        isActive: values.isActive,
        isPopular: values.isPopular,
      });
      message.success('Boost option created successfully');
      setCreateModalOpen(false);
      createForm.resetFields();
      setUploadedImageUrl('');
      setFileList([]);
      loadData(currentPage);
      reloadStats();
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Failed to create boost option');
    }
  };

  const openEditModal = (option: BoostOptionListItem) => {
    setSelectedOption(option);
    setUploadedImageUrl(option.image || '');
    editForm.setFieldsValue({
      title: option.title,
      description: option.description || '',
      amount: option.amount,
      isActive: option.isActive,
      isPopular: option.isPopular,
    });
    setEditModalOpen(true);
  };

  const handleEdit = async (values: {
    title: string;
    description?: string;
    amount: number;
    isActive: boolean;
    isPopular: boolean;
  }) => {
    if (!selectedOption) return;
    try {
      await updateBoostOption(selectedOption.id, {
        title: values.title.trim(),
        description: values.description?.trim() || null,
        image: uploadedImageUrl || null,
        amount: values.amount,
        isActive: values.isActive,
        isPopular: values.isPopular,
      });
      message.success('Boost option updated successfully');
      setEditModalOpen(false);
      editForm.resetFields();
      setSelectedOption(null);
      setUploadedImageUrl('');
      setFileList([]);
      loadData(currentPage);
      reloadStats();
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Failed to update boost option');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteBoostOption(id);
      message.success('Boost option deleted successfully');
      loadData(currentPage);
      reloadStats();
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Failed to delete boost option');
    }
  };

  const handleToggleActive = async (record: BoostOptionListItem, checked: boolean) => {
    try {
      await updateBoostOption(record.id, { isActive: checked });
      message.success(`Boost option ${checked ? 'activated' : 'deactivated'}`);
      loadData(currentPage);
      reloadStats();
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Failed to update status');
    }
  };

  const handleTogglePopular = async (record: BoostOptionListItem, checked: boolean) => {
    try {
      await updateBoostOption(record.id, { isPopular: checked });
      message.success(`Boost option ${checked ? 'marked as popular' : 'unmarked as popular'}`);
      loadData(currentPage);
      reloadStats();
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Failed to update popular status');
    }
  };

  const columns: ColumnsType<BoostOptionListItem> = [
    {
      title: 'Image',
      dataIndex: 'image',
      key: 'image',
      width: 80,
      render: (url) =>
        url ? (
          <Image
            src={url}
            alt="Boost"
            width={48}
            height={48}
            style={{ objectFit: 'cover', borderRadius: 4 }}
          />
        ) : (
          <div
            style={{
              width: 48,
              height: 48,
              background: '#f0f0f0',
              borderRadius: 4,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <RocketOutlined style={{ color: '#ccc' }} />
          </div>
        ),
    },
    {
      title: 'Title',
      dataIndex: 'title',
      key: 'title',
      width: 200,
      ellipsis: true,
    },
    {
      title: 'Amount',
      dataIndex: 'amount',
      key: 'amount',
      width: 120,
      align: 'right',
      render: (amount) => (
        <span style={{ fontWeight: 600 }}>
          {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)}
        </span>
      ),
    },
    {
      title: 'Active',
      dataIndex: 'isActive',
      key: 'isActive',
      width: 100,
      align: 'center',
      render: (isActive, record) => (
        <Switch checked={isActive} onChange={(checked) => handleToggleActive(record, checked)} />
      ),
    },
    {
      title: 'Popular',
      dataIndex: 'isPopular',
      key: 'isPopular',
      width: 100,
      align: 'center',
      render: (isPopular, record) => (
        <Switch checked={isPopular} onChange={(checked) => handleTogglePopular(record, checked)} />
      ),
    },
    {
      title: 'Tags',
      key: 'tags',
      width: 120,
      render: (_, record) => (
        <Space size={4}>
          {record.isPopular && <Tag color="gold">Popular</Tag>}
          {!record.isActive && <Tag color="default">Inactive</Tag>}
        </Space>
      ),
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
            title="Edit boost option"
          />
          <Popconfirm
            title="Delete Boost Option"
            description={`Delete "${record.title}"?`}
            onConfirm={() => handleDelete(record.id)}
            okText="Delete"
            okType="danger"
          >
            <Button
              size="small"
              type="text"
              danger
              icon={<DeleteOutlined />}
              title="Delete boost option"
            />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const statsData: StatItemData[] | undefined = stats
    ? [
        {
          label: 'Total',
          value: stats.total,
          icon: <RocketOutlined />,
        },
        {
          label: 'Active',
          value: stats.active,
          icon: <ThunderboltOutlined />,
          valueColor: '#52c41a',
        },
        {
          label: 'Inactive',
          value: stats.inactive,
          icon: <ThunderboltOutlined />,
          valueColor: '#ff4d4f',
        },
        {
          label: 'Popular',
          value: stats.popular,
          icon: <StarOutlined />,
          valueColor: '#faad14',
        },
      ]
    : undefined;

  const uploadProps = {
    beforeUpload: async (file: File) => {
      const isImage = file.type.startsWith('image/');
      if (!isImage) {
        message.error('You can only upload image files!');
        return Upload.LIST_IGNORE;
      }
      const isLt10M = file.size / 1024 / 1024 < 10;
      if (!isLt10M) {
        message.error('Image must be smaller than 10MB!');
        return Upload.LIST_IGNORE;
      }
      await handleUpload(file);
      return false;
    },
    fileList,
    onChange: ({ fileList: newFileList }: { fileList: UploadFile[] }) => setFileList(newFileList),
    maxCount: 1,
  };

  return (
    <div>
      <PageHeader
        title="Boost Options"
        description="Manage content boost options and pricing"
        icon={<RocketOutlined />}
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
        title="Boost Options Management"
        extra={
          <Space wrap>
            <Input
              placeholder="Search boost options"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              prefix={<SearchOutlined />}
              style={{ width: 220 }}
              allowClear
            />
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                setUploadedImageUrl('');
                setFileList([]);
                setCreateModalOpen(true);
              }}
            >
              Create Boost Option
            </Button>
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={boostOptions}
          rowKey="id"
          loading={loading}
          pagination={{
            current: currentPage,
            pageSize: PAGE_SIZE,
            total,
            showSizeChanger: false,
            showTotal: (total) => `Total ${total} boost options`,
            onChange: loadData,
          }}
          locale={{
            emptyText: <Empty description="No boost options found" />,
          }}
        />
      </Card>

      {/* Create Boost Option Modal */}
      <Modal
        title="Create Boost Option"
        open={createModalOpen}
        onCancel={() => {
          setCreateModalOpen(false);
          createForm.resetFields();
          setUploadedImageUrl('');
          setFileList([]);
        }}
        onOk={() => createForm.submit()}
        okText="Create"
        width={600}
      >
        <Form
          form={createForm}
          layout="vertical"
          onFinish={handleCreate}
          initialValues={{ isActive: true, isPopular: false, amount: 0 }}
        >
          <Form.Item label="Boost Image">
            <Upload {...uploadProps} listType="picture">
              <Button icon={<UploadOutlined />} loading={uploading}>
                Upload Image
              </Button>
            </Upload>
            {uploadedImageUrl && (
              <Image
                src={uploadedImageUrl}
                alt="Preview"
                style={{ marginTop: 8, maxWidth: '100%', maxHeight: 200 }}
              />
            )}
          </Form.Item>

          <Form.Item
            name="title"
            label="Title"
            rules={[
              { required: true, message: 'Please enter title' },
              { min: 1, max: 200, message: 'Title must be 1-200 characters' },
            ]}
          >
            <Input placeholder="Boost option title" />
          </Form.Item>

          <Form.Item name="description" label="Description">
            <Input.TextArea rows={3} maxLength={1000} placeholder="Boost option description" />
          </Form.Item>

          <Form.Item
            name="amount"
            label="Amount (USD)"
            rules={[{ required: true, message: 'Please enter amount' }]}
          >
            <InputNumber
              min={0}
              step={0.01}
              precision={2}
              style={{ width: 200 }}
              prefix="$"
              placeholder="0.00"
            />
          </Form.Item>

          <Space style={{ width: '100%' }} size="large">
            <Form.Item name="isActive" label="Active" valuePropName="checked">
              <Switch />
            </Form.Item>

            <Form.Item name="isPopular" label="Popular" valuePropName="checked">
              <Switch />
            </Form.Item>
          </Space>
        </Form>
      </Modal>

      {/* Edit Boost Option Modal */}
      <Modal
        title="Edit Boost Option"
        open={editModalOpen}
        onCancel={() => {
          setEditModalOpen(false);
          editForm.resetFields();
          setSelectedOption(null);
          setUploadedImageUrl('');
          setFileList([]);
        }}
        onOk={() => editForm.submit()}
        okText="Update"
        width={600}
      >
        <Form form={editForm} layout="vertical" onFinish={handleEdit}>
          <Form.Item label="Boost Image">
            <Upload {...uploadProps} listType="picture">
              <Button icon={<UploadOutlined />} loading={uploading}>
                Change Image
              </Button>
            </Upload>
            {uploadedImageUrl && (
              <Image
                src={uploadedImageUrl}
                alt="Preview"
                style={{ marginTop: 8, maxWidth: '100%', maxHeight: 200 }}
              />
            )}
          </Form.Item>

          <Form.Item
            name="title"
            label="Title"
            rules={[
              { required: true, message: 'Please enter title' },
              { min: 1, max: 200, message: 'Title must be 1-200 characters' },
            ]}
          >
            <Input placeholder="Boost option title" />
          </Form.Item>

          <Form.Item name="description" label="Description">
            <Input.TextArea rows={3} maxLength={1000} placeholder="Boost option description" />
          </Form.Item>

          <Form.Item
            name="amount"
            label="Amount (USD)"
            rules={[{ required: true, message: 'Please enter amount' }]}
          >
            <InputNumber
              min={0}
              step={0.01}
              precision={2}
              style={{ width: 200 }}
              prefix="$"
              placeholder="0.00"
            />
          </Form.Item>

          <Space style={{ width: '100%' }} size="large">
            <Form.Item name="isActive" label="Active" valuePropName="checked">
              <Switch />
            </Form.Item>

            <Form.Item name="isPopular" label="Popular" valuePropName="checked">
              <Switch />
            </Form.Item>
          </Space>
        </Form>
      </Modal>
    </div>
  );
}

export default BoostOptions;
