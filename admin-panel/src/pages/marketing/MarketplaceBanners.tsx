import { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Tag,
  Space,
  Button,
  Select,
  Input,
  Empty,
  Alert,
  Modal,
  Form,
  InputNumber,
  Switch,
  DatePicker,
  Upload,
  message,
  Image,
  Popconfirm,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { UploadFile } from 'antd/es/upload/interface';
import {
  PictureOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  UploadOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import PageHeader from '../../components/PageHeader';
import { type StatItemData } from '../../components/StatItem';
import {
  fetchMarketplaceBannersStats,
  fetchMarketplaceBanners,
  createMarketplaceBanner,
  updateMarketplaceBanner,
  deleteMarketplaceBanner,
  uploadBannerImage,
  type MarketplaceBannerStatsResponse,
  type MarketplaceBannerListItem,
} from '../../api/admin-marketplace-banners';

const PAGE_SIZE = 20;

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'success',
  SCHEDULED: 'processing',
  EXPIRED: 'default',
  INACTIVE: 'default',
};

function MarketplaceBanners() {
  const [stats, setStats] = useState<MarketplaceBannerStatsResponse | null>(null);
  const [banners, setBanners] = useState<MarketplaceBannerListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingStats, setLoadingStats] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [isActive, setIsActive] = useState<string>('');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedBanner, setSelectedBanner] = useState<MarketplaceBannerListItem | null>(null);
  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchMarketplaceBannersStats();
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

  const loadBanners = async (page = 1) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchMarketplaceBanners({
        limit: PAGE_SIZE,
        offset: (page - 1) * PAGE_SIZE,
        isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
        search: search || undefined,
      });
      setBanners(res.data ?? []);
      setTotal(res.pagination?.total ?? 0);
      setCurrentPage(page);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load marketplace banners');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBanners(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, isActive]);

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const res = await uploadBannerImage(file);
      setUploadedImageUrl(res.url);
      message.success('Image uploaded successfully');
      return res.url;
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
    linkUrl?: string;
    isActive: boolean;
    displayOrder: number;
    startDate?: dayjs.Dayjs;
    endDate?: dayjs.Dayjs;
  }) => {
    if (!uploadedImageUrl) {
      message.error('Please upload a banner image');
      return;
    }

    // Validate date range
    if (values.startDate && values.endDate) {
      if (values.startDate.isAfter(values.endDate)) {
        message.error('Start date must be before end date');
        return;
      }
    }

    try {
      await createMarketplaceBanner({
        title: values.title.trim(),
        description: values.description?.trim() || null,
        imageUrl: uploadedImageUrl,
        linkUrl: values.linkUrl?.trim() || null,
        isActive: values.isActive,
        displayOrder: values.displayOrder,
        startDate: values.startDate ? values.startDate.toISOString() : null,
        endDate: values.endDate ? values.endDate.toISOString() : null,
      });
      message.success('Banner created successfully');
      setCreateModalOpen(false);
      createForm.resetFields();
      setUploadedImageUrl('');
      setFileList([]);
      loadBanners(currentPage);
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Failed to create banner');
    }
  };

  const openEditModal = (banner: MarketplaceBannerListItem) => {
    setSelectedBanner(banner);
    setUploadedImageUrl(banner.imageUrl);
    editForm.setFieldsValue({
      title: banner.title,
      description: banner.description || '',
      linkUrl: banner.linkUrl || '',
      isActive: banner.isActive,
      displayOrder: banner.displayOrder,
      startDate: banner.startDate ? dayjs(banner.startDate) : undefined,
      endDate: banner.endDate ? dayjs(banner.endDate) : undefined,
    });
    setEditModalOpen(true);
  };

  const handleEdit = async (values: {
    title: string;
    description?: string;
    linkUrl?: string;
    isActive: boolean;
    displayOrder: number;
    startDate?: dayjs.Dayjs;
    endDate?: dayjs.Dayjs;
  }) => {
    if (!selectedBanner) return;

    // Validate date range
    if (values.startDate && values.endDate) {
      if (values.startDate.isAfter(values.endDate)) {
        message.error('Start date must be before end date');
        return;
      }
    }

    try {
      await updateMarketplaceBanner(selectedBanner.id, {
        title: values.title.trim(),
        description: values.description?.trim() || null,
        imageUrl: uploadedImageUrl,
        linkUrl: values.linkUrl?.trim() || null,
        isActive: values.isActive,
        displayOrder: values.displayOrder,
        startDate: values.startDate ? values.startDate.toISOString() : null,
        endDate: values.endDate ? values.endDate.toISOString() : null,
      });
      message.success('Banner updated successfully');
      setEditModalOpen(false);
      editForm.resetFields();
      setSelectedBanner(null);
      setUploadedImageUrl('');
      setFileList([]);
      loadBanners(currentPage);
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Failed to update banner');
    }
  };

  const handleDelete = async (id: string, title: string) => {
    try {
      await deleteMarketplaceBanner(id);
      message.success('Banner deleted successfully');
      loadBanners(currentPage);
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Failed to delete banner');
    }
  };

  const columns: ColumnsType<MarketplaceBannerListItem> = [
    {
      title: 'Order',
      dataIndex: 'displayOrder',
      key: 'displayOrder',
      width: 80,
      align: 'center',
    },
    {
      title: 'Preview',
      dataIndex: 'imageUrl',
      key: 'imageUrl',
      width: 100,
      render: (url) => (
        <Image
          src={url}
          alt="Banner"
          width={80}
          height={40}
          style={{ objectFit: 'cover', borderRadius: 4 }}
        />
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
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status) => <Tag color={STATUS_COLORS[status]}>{status}</Tag>,
    },
    {
      title: 'Active',
      dataIndex: 'isActive',
      key: 'isActive',
      width: 80,
      align: 'center',
      render: (isActive) => (
        <Tag color={isActive ? 'success' : 'default'}>{isActive ? 'Yes' : 'No'}</Tag>
      ),
    },
    {
      title: 'Start Date',
      dataIndex: 'startDate',
      key: 'startDate',
      width: 120,
      render: (date) => (date ? new Date(date).toLocaleDateString() : '—'),
    },
    {
      title: 'End Date',
      dataIndex: 'endDate',
      key: 'endDate',
      width: 120,
      render: (date) => (date ? new Date(date).toLocaleDateString() : '—'),
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
            title="Edit banner"
          />
          <Popconfirm
            title="Delete Banner"
            description={`Delete "${record.title}"?`}
            onConfirm={() => handleDelete(record.id, record.title)}
            okText="Delete"
            okType="danger"
          >
            <Button
              size="small"
              type="text"
              danger
              icon={<DeleteOutlined />}
              title="Delete banner"
            />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const statsData: StatItemData[] | undefined = stats
    ? [
        {
          label: 'Total Banners',
          value: stats.total,
          icon: <PictureOutlined />,
        },
        {
          label: 'Currently Showing',
          value: stats.currentlyShowing,
          icon: <PictureOutlined />,
          valueStyle: { color: '#52c41a' },
        },
        {
          label: 'Scheduled',
          value: stats.scheduled,
          icon: <PictureOutlined />,
          valueStyle: { color: '#1890ff' },
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
    onChange: ({ fileList: newFileList }) => setFileList(newFileList),
    maxCount: 1,
  };

  return (
    <div>
      <PageHeader
        title="Marketplace Banners"
        description="Manage marketing banners and campaigns"
        icon={<PictureOutlined />}
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
        title="Banner Management"
        extra={
          <Space wrap>
            <Input
              placeholder="Search title/description"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              prefix={<SearchOutlined />}
              style={{ width: 200 }}
              allowClear
            />
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
              Create Banner
            </Button>
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={banners}
          rowKey="id"
          loading={loading}
          pagination={{
            current: currentPage,
            pageSize: PAGE_SIZE,
            total,
            showSizeChanger: false,
            showTotal: (total) => `Total ${total} banners`,
            onChange: loadBanners,
          }}
          locale={{
            emptyText: <Empty description="No banners found" />,
          }}
        />
      </Card>

      {/* Create Banner Modal */}
      <Modal
        title="Create Banner"
        open={createModalOpen}
        onCancel={() => {
          setCreateModalOpen(false);
          createForm.resetFields();
          setUploadedImageUrl('');
          setFileList([]);
        }}
        onOk={() => createForm.submit()}
        okText="Create"
        width={700}
      >
        <Form
          form={createForm}
          layout="vertical"
          onFinish={handleCreate}
          initialValues={{ isActive: true, displayOrder: 0 }}
        >
          <Form.Item label="Banner Image" required>
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
              { min: 1, max: 500, message: 'Title must be 1-500 characters' },
            ]}
          >
            <Input placeholder="Banner title" />
          </Form.Item>

          <Form.Item name="description" label="Description">
            <Input.TextArea rows={3} maxLength={2000} placeholder="Banner description" />
          </Form.Item>

          <Form.Item
            name="linkUrl"
            label="Link URL (Optional)"
            rules={[{ type: 'url', message: 'Please enter a valid URL' }]}
          >
            <Input placeholder="https://example.com" />
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

          <Space style={{ width: '100%' }} size="large">
            <Form.Item name="startDate" label="Start Date (Optional)">
              <DatePicker showTime style={{ width: 200 }} />
            </Form.Item>

            <Form.Item name="endDate" label="End Date (Optional)">
              <DatePicker showTime style={{ width: 200 }} />
            </Form.Item>
          </Space>
        </Form>
      </Modal>

      {/* Edit Banner Modal */}
      <Modal
        title="Edit Banner"
        open={editModalOpen}
        onCancel={() => {
          setEditModalOpen(false);
          editForm.resetFields();
          setSelectedBanner(null);
          setUploadedImageUrl('');
          setFileList([]);
        }}
        onOk={() => editForm.submit()}
        okText="Update"
        width={700}
      >
        <Form form={editForm} layout="vertical" onFinish={handleEdit}>
          <Form.Item label="Banner Image">
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
              { min: 1, max: 500, message: 'Title must be 1-500 characters' },
            ]}
          >
            <Input placeholder="Banner title" />
          </Form.Item>

          <Form.Item name="description" label="Description">
            <Input.TextArea rows={3} maxLength={2000} placeholder="Banner description" />
          </Form.Item>

          <Form.Item
            name="linkUrl"
            label="Link URL (Optional)"
            rules={[{ type: 'url', message: 'Please enter a valid URL' }]}
          >
            <Input placeholder="https://example.com" />
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

          <Space style={{ width: '100%' }} size="large">
            <Form.Item name="startDate" label="Start Date (Optional)">
              <DatePicker showTime style={{ width: 200 }} />
            </Form.Item>

            <Form.Item name="endDate" label="End Date (Optional)">
              <DatePicker showTime style={{ width: 200 }} />
            </Form.Item>
          </Space>
        </Form>
      </Modal>
    </div>
  );
}

export default MarketplaceBanners;
