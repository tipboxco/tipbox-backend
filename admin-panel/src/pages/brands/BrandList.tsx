import { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Input,
  Space,
  Button,
  Tag,
  Empty,
  Alert,
  Row,
  Modal,
  Form,
  Select,
  Switch,
  Avatar,
  Image,
  Upload,
  message,
  Checkbox,
} from 'antd';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import {
  ShopOutlined,
  SearchOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  PictureOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';
import { type StatItemData } from '../../components/StatItem';
import ViewActionButton from '../../components/ViewActionButton';
import {
  fetchBrandStats,
  fetchBrands,
  createBrand,
  updateBrand,
  deleteBrand,
  fetchBrandImages,
  uploadBrandImage,
  deleteBrandImage,
  fetchBrandCategories,
} from '../../api/admin-brands';
import type {
  AdminBrandStatsResponse,
  AdminBrandListItem,
  CreateBrandInput,
  UpdateBrandInput,
  AdminBrandImageListItem,
} from '../../api/admin-brands';
import { TABLE_COLUMN_WIDTHS, TABLE_SCROLL_CONFIGS } from '../../constants/table-widths';

const PAGE_SIZE = 20;

function BrandList() {
  const [stats, setStats] = useState<AdminBrandStatsResponse | null>(null);
  const [brands, setBrands] = useState<AdminBrandListItem[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [pagination, setPagination] = useState({
    total: 0,
    limit: PAGE_SIZE,
    offset: 0,
  });
  const [loading, setLoading] = useState(true);
  const [loadingList, setLoadingList] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string | undefined>(undefined);
  const [popularOnly, setPopularOnly] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [imagesModalOpen, setImagesModalOpen] = useState(false);
  const [selectedBrand, setSelectedBrand] = useState<AdminBrandListItem | null>(null);
  const [brandImages, setBrandImages] = useState<AdminBrandImageListItem[]>([]);
  const [loadingImages, setLoadingImages] = useState(false);
  const [form] = Form.useForm();
  const [imageForm] = Form.useForm();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchBrandStats();
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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchBrandCategories();
        if (!cancelled && res.data) {
          setCategories(res.data.map(cat => ({ id: cat.id, name: cat.name })));
        }
      } catch (e) {
        console.error('Failed to load categories:', e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadBrands = async () => {
    setLoadingList(true);
    try {
      const res = await fetchBrands({
        limit: PAGE_SIZE,
        offset: pagination.offset,
        search: search || undefined,
        categoryId: categoryFilter,
        isPopular: popularOnly || undefined,
      });
      setBrands(res.data ?? []);
      if (res.pagination) setPagination(res.pagination);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load brands');
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    loadBrands();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.offset, search, categoryFilter, popularOnly]);

  const handleCreate = async (values: CreateBrandInput) => {
    try {
      await createBrand({
        ...values,
        categoryId: values.categoryId || null,
        logoUrl: values.logoUrl || null,
      });
      message.success('Brand created successfully');
      setCreateModalOpen(false);
      form.resetFields();
      loadBrands();
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Failed to create brand');
    }
  };

  const handleEdit = async (values: UpdateBrandInput) => {
    if (!selectedBrand) return;

    try {
      await updateBrand(selectedBrand.id, {
        ...values,
        categoryId: values.categoryId || null,
        logoUrl: values.logoUrl || null,
      });
      message.success('Brand updated successfully');
      setEditModalOpen(false);
      form.resetFields();
      setSelectedBrand(null);
      loadBrands();
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Failed to update brand');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    Modal.confirm({
      title: 'Delete Brand',
      content: `Are you sure you want to delete "${name}"? This action cannot be undone.`,
      okText: 'Delete',
      okType: 'danger',
      onOk: async () => {
        try {
          await deleteBrand(id);
          message.success('Brand deleted successfully');
          loadBrands();
        } catch (e) {
          message.error(e instanceof Error ? e.message : 'Failed to delete brand');
        }
      },
    });
  };

  const openEditModal = (brand: AdminBrandListItem) => {
    setSelectedBrand(brand);
    form.setFieldsValue({
      name: brand.name,
      logoUrl: brand.logoUrl || undefined,
      categoryId: brand.categoryId || undefined,
      isPopular: brand.isPopular,
    });
    setEditModalOpen(true);
  };

  const openImagesModal = async (brand: AdminBrandListItem) => {
    setSelectedBrand(brand);
    setImagesModalOpen(true);
    setLoadingImages(true);
    try {
      const res = await fetchBrandImages(brand.id);
      setBrandImages(res.data ?? []);
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Failed to load brand images');
    } finally {
      setLoadingImages(false);
    }
  };

  const handleImageUpload = async (values: { imageUrl: string; caption?: string }) => {
    if (!selectedBrand) return;

    try {
      await uploadBrandImage(selectedBrand.id, {
        imageUrl: values.imageUrl,
        caption: values.caption || null,
      });
      message.success('Image uploaded successfully');
      imageForm.resetFields();
      const res = await fetchBrandImages(selectedBrand.id);
      setBrandImages(res.data ?? []);
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Failed to upload image');
    }
  };

  const handleImageDelete = async (imageId: string) => {
    if (!selectedBrand) return;

    Modal.confirm({
      title: 'Delete Image',
      content: 'Are you sure you want to delete this image?',
      okText: 'Delete',
      okType: 'danger',
      onOk: async () => {
        try {
          await deleteBrandImage(selectedBrand.id, imageId);
          message.success('Image deleted successfully');
          const res = await fetchBrandImages(selectedBrand.id);
          setBrandImages(res.data ?? []);
        } catch (e) {
          message.error(e instanceof Error ? e.message : 'Failed to delete image');
        }
      },
    });
  };

  const columns: ColumnsType<AdminBrandListItem> = [
    {
      title: '',
      dataIndex: 'logoUrl',
      key: 'logoUrl',
      width: 60,
      render: (url, record) => (
        <Avatar src={url} icon={<ShopOutlined />} shape="square" size={40}>
          {record.name.charAt(0)}
        </Avatar>
      ),
    },
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      width: TABLE_COLUMN_WIDTHS.LONG_TEXT,
      ellipsis: true,
    },
    {
      title: 'Category',
      dataIndex: 'categoryName',
      key: 'categoryName',
      width: TABLE_COLUMN_WIDTHS.MEDIUM_TEXT,
      ellipsis: true,
      render: (text) => text ?? '—',
    },
    {
      title: 'Followers',
      dataIndex: 'followerCount',
      key: 'followerCount',
      width: TABLE_COLUMN_WIDTHS.SHORT_TEXT,
      align: 'right',
    },
    {
      title: 'Posts',
      dataIndex: 'postCount',
      key: 'postCount',
      width: TABLE_COLUMN_WIDTHS.SHORT_TEXT,
      align: 'right',
    },
    {
      title: 'Popular',
      dataIndex: 'isPopular',
      key: 'isPopular',
      width: TABLE_COLUMN_WIDTHS.SHORT_TEXT,
      align: 'center',
      render: (isPopular) => (isPopular ? <Tag color="gold">Popular</Tag> : null),
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
      width: TABLE_COLUMN_WIDTHS.ACTION_BUTTON_QUAD,
      render: (_, record) => (
        <Space size="small">
          <ViewActionButton to={`/brands/${record.id}`} />
          <Button
            size="small"
            type="text"
            icon={<PictureOutlined />}
            onClick={() => openImagesModal(record)}
          />
          <Button
            size="small"
            type="text"
            icon={<EditOutlined />}
            onClick={() => openEditModal(record)}
          />
          <Button
            size="small"
            type="text"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record.id, record.name)}
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
          label: 'Total Brands',
          value: stats.total,
          icon: <ShopOutlined />,
        },
        {
          label: 'Total Followers',
          value: stats.totalFollowers,
          icon: <ShopOutlined />,
        },
        {
          label: 'Active Surveys',
          value: stats.activeSurveys,
          icon: <ShopOutlined />,
        },
        {
          label: 'Most Popular',
          value: stats.mostPopularBrand?.name ?? '—',
          icon: <ShopOutlined />,
        },
      ]
    : undefined;

  return (
    <div>
      <PageHeader
        title="Brands"
        description="Manage brand partnerships"
        icon={<ShopOutlined />}
        statsData={statsData}
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

      <Card bordered={false}>
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Row justify="space-between" align="middle">
            <Space wrap>
              <Input
                placeholder="Search brands..."
                prefix={<SearchOutlined />}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ width: 250 }}
                allowClear
              />
              <Select
                placeholder="Category"
                value={categoryFilter}
                onChange={setCategoryFilter}
                style={{ width: 150 }}
                allowClear
                showSearch
                filterOption={(input, option) =>
                  (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                }
                options={categories.map(cat => ({ label: cat.name, value: cat.id }))}
              />
              <Checkbox checked={popularOnly} onChange={(e) => setPopularOnly(e.target.checked)}>
                Popular only
              </Checkbox>
            </Space>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalOpen(true)}>
              Create Brand
            </Button>
          </Row>

          <Table
            columns={columns}
            dataSource={brands}
            loading={loadingList}
            rowKey="id"
            pagination={{
              current: currentPage,
              pageSize: PAGE_SIZE,
              total: pagination.total,
              showSizeChanger: false,
              showTotal: (total) => `Total ${total} brands`,
            }}
            onChange={handleTableChange}
            scroll={TABLE_SCROLL_CONFIGS.DEFAULT}
            locale={{
              emptyText: <Empty description="No brands found" />,
            }}
          />
        </Space>
      </Card>

      {/* Create Brand Modal */}
      <Modal
        title="Create Brand"
        open={createModalOpen}
        onCancel={() => {
          setCreateModalOpen(false);
          form.resetFields();
        }}
        onOk={() => form.submit()}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item
            name="id"
            label="Brand ID"
            rules={[{ required: true, message: 'Please enter brand ID' }]}
          >
            <Input placeholder="e.g., apple" />
          </Form.Item>
          <Form.Item
            name="name"
            label="Brand Name"
            rules={[{ required: true, message: 'Please enter brand name' }]}
          >
            <Input placeholder="e.g., Apple" />
          </Form.Item>
          <Form.Item name="logoUrl" label="Logo URL">
            <Input placeholder="https://..." />
          </Form.Item>
          <Form.Item name="categoryId" label="Category">
            <Select
              placeholder="Select category (optional)"
              allowClear
              showSearch
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              options={categories.map(cat => ({ label: cat.name, value: cat.id }))}
            />
          </Form.Item>
          <Form.Item name="isPopular" label="Mark as Popular" valuePropName="checked" initialValue={false}>
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      {/* Edit Brand Modal */}
      <Modal
        title="Edit Brand"
        open={editModalOpen}
        onCancel={() => {
          setEditModalOpen(false);
          form.resetFields();
          setSelectedBrand(null);
        }}
        onOk={() => form.submit()}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleEdit}>
          <Form.Item
            name="name"
            label="Brand Name"
            rules={[{ required: true, message: 'Please enter brand name' }]}
          >
            <Input placeholder="e.g., Apple" />
          </Form.Item>
          <Form.Item name="logoUrl" label="Logo URL">
            <Input placeholder="https://..." />
          </Form.Item>
          <Form.Item name="categoryId" label="Category">
            <Select
              placeholder="Select category (optional)"
              allowClear
              showSearch
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              options={categories.map(cat => ({ label: cat.name, value: cat.id }))}
            />
          </Form.Item>
          <Form.Item name="isPopular" label="Mark as Popular" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      {/* Brand Images Modal */}
      <Modal
        title={`Manage Images - ${selectedBrand?.name}`}
        open={imagesModalOpen}
        onCancel={() => {
          setImagesModalOpen(false);
          setSelectedBrand(null);
          setBrandImages([]);
          imageForm.resetFields();
        }}
        footer={null}
        width={800}
      >
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <Card title="Upload New Image" size="small">
            <Form form={imageForm} layout="vertical" onFinish={handleImageUpload}>
              <Form.Item
                name="imageUrl"
                label="Image URL"
                rules={[{ required: true, message: 'Please enter image URL' }]}
              >
                <Input placeholder="https://..." />
              </Form.Item>
              <Form.Item name="caption" label="Caption">
                <Input.TextArea rows={2} placeholder="Optional caption" />
              </Form.Item>
              <Button type="primary" htmlType="submit" icon={<UploadOutlined />}>
                Upload Image
              </Button>
            </Form>
          </Card>

          <Card title="Existing Images" size="small">
            {loadingImages ? (
              <div style={{ textAlign: 'center', padding: '20px' }}>Loading images...</div>
            ) : brandImages.length === 0 ? (
              <Empty description="No images uploaded yet" />
            ) : (
              <Space wrap size="large">
                {brandImages.map((img) => (
                  <div key={img.id} style={{ position: 'relative' }}>
                    <Image
                      width={150}
                      height={150}
                      src={img.imageUrl}
                      alt={img.caption ?? 'Brand image'}
                      style={{ objectFit: 'cover' }}
                    />
                    {img.caption && (
                      <div style={{ fontSize: '12px', marginTop: '4px', textAlign: 'center' }}>
                        {img.caption}
                      </div>
                    )}
                    <Button
                      size="small"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={() => handleImageDelete(img.id)}
                      style={{ marginTop: '4px', width: '100%' }}
                    >
                      Delete
                    </Button>
                  </div>
                ))}
              </Space>
            )}
          </Card>
        </Space>
      </Modal>
    </div>
  );
}

export default BrandList;
