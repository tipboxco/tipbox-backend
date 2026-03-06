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
  Switch,
  Tabs,
  Upload,
  message,
  Image,
  Popconfirm,
  Spin,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { UploadFile } from 'antd/es/upload/interface';
import {
  AppstoreOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  UploadOutlined,
  SearchOutlined,
  FolderOutlined,
  TagsOutlined,
} from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';
import { type StatItemData } from '../../components/StatItem';
import {
  fetchCategoryStats,
  fetchMainCategories,
  createMainCategory,
  updateMainCategory,
  deleteMainCategory,
  uploadMainCategoryImage,
  fetchSubCategories,
  createSubCategory,
  updateSubCategory,
  deleteSubCategory,
  uploadSubCategoryImage,
  type CategoryStatsResponse,
  type MainCategoryListItem,
  type SubCategoryListItem,
} from '../../api/admin-categories';

const PAGE_SIZE = 20;

function CategoryManagement() {
  const [stats, setStats] = useState<CategoryStatsResponse | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('main');

  // Main Categories state
  const [mainCategories, setMainCategories] = useState<MainCategoryListItem[]>([]);
  const [mainLoading, setMainLoading] = useState(true);
  const [mainSearch, setMainSearch] = useState('');
  const [mainTotal, setMainTotal] = useState(0);
  const [mainPage, setMainPage] = useState(1);

  // Sub Categories state
  const [subCategories, setSubCategories] = useState<SubCategoryListItem[]>([]);
  const [subLoading, setSubLoading] = useState(true);
  const [subSearch, setSubSearch] = useState('');
  const [subTotal, setSubTotal] = useState(0);
  const [subPage, setSubPage] = useState(1);
  const [filterMainCategoryId, setFilterMainCategoryId] = useState<string>('');

  // Modal state
  const [createMainModalOpen, setCreateMainModalOpen] = useState(false);
  const [editMainModalOpen, setEditMainModalOpen] = useState(false);
  const [selectedMainCategory, setSelectedMainCategory] = useState<MainCategoryListItem | null>(
    null,
  );
  const [createSubModalOpen, setCreateSubModalOpen] = useState(false);
  const [editSubModalOpen, setEditSubModalOpen] = useState(false);
  const [selectedSubCategory, setSelectedSubCategory] = useState<SubCategoryListItem | null>(null);

  // Form state
  const [createMainForm] = Form.useForm();
  const [editMainForm] = Form.useForm();
  const [createSubForm] = Form.useForm();
  const [editSubForm] = Form.useForm();

  // Upload state
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  const [fileList, setFileList] = useState<UploadFile[]>([]);

  // Load stats
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchCategoryStats();
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

  // Load main categories
  const loadMainCategories = async (page = 1) => {
    setMainLoading(true);
    setError(null);
    try {
      const res = await fetchMainCategories({
        limit: PAGE_SIZE,
        offset: (page - 1) * PAGE_SIZE,
        search: mainSearch || undefined,
      });
      setMainCategories(res.data ?? []);
      setMainTotal(res.pagination?.total ?? 0);
      setMainPage(page);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load main categories');
    } finally {
      setMainLoading(false);
    }
  };

  useEffect(() => {
    loadMainCategories(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mainSearch]);

  // Load sub categories
  const loadSubCategories = async (page = 1) => {
    setSubLoading(true);
    setError(null);
    try {
      const res = await fetchSubCategories({
        limit: PAGE_SIZE,
        offset: (page - 1) * PAGE_SIZE,
        mainCategoryId: filterMainCategoryId || undefined,
        search: subSearch || undefined,
      });
      setSubCategories(res.data ?? []);
      setSubTotal(res.pagination?.total ?? 0);
      setSubPage(page);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load sub categories');
    } finally {
      setSubLoading(false);
    }
  };

  useEffect(() => {
    loadSubCategories(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subSearch, filterMainCategoryId]);

  // Upload handlers
  const handleUploadMainImage = async (file: File) => {
    setUploading(true);
    try {
      const res = await uploadMainCategoryImage(file);
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

  const handleUploadSubImage = async (file: File) => {
    setUploading(true);
    try {
      const res = await uploadSubCategoryImage(file);
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

  // Main category CRUD
  const handleCreateMain = async (values: { name: string; description?: string }) => {
    try {
      await createMainCategory({
        name: values.name.trim(),
        description: values.description?.trim() || null,
        imageUrl: uploadedImageUrl || null,
      });
      message.success('Main category created successfully');
      setCreateMainModalOpen(false);
      createMainForm.resetFields();
      setUploadedImageUrl('');
      setFileList([]);
      loadMainCategories(mainPage);
      reloadStats();
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Failed to create main category');
    }
  };

  const openEditMainModal = (category: MainCategoryListItem) => {
    setSelectedMainCategory(category);
    setUploadedImageUrl(category.imageUrl || '');
    editMainForm.setFieldsValue({
      name: category.name,
      description: category.description || '',
    });
    setEditMainModalOpen(true);
  };

  const handleEditMain = async (values: { name: string; description?: string }) => {
    if (!selectedMainCategory) return;
    try {
      await updateMainCategory(selectedMainCategory.id, {
        name: values.name.trim(),
        description: values.description?.trim() || null,
        imageUrl: uploadedImageUrl || null,
      });
      message.success('Main category updated successfully');
      setEditMainModalOpen(false);
      editMainForm.resetFields();
      setSelectedMainCategory(null);
      setUploadedImageUrl('');
      setFileList([]);
      loadMainCategories(mainPage);
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Failed to update main category');
    }
  };

  const handleDeleteMain = async (id: string) => {
    try {
      await deleteMainCategory(id);
      message.success('Main category deleted successfully');
      loadMainCategories(mainPage);
      reloadStats();
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Failed to delete main category');
    }
  };

  // Sub category CRUD
  const handleCreateSub = async (values: {
    name: string;
    description?: string;
    mainCategoryId: string;
  }) => {
    try {
      await createSubCategory({
        name: values.name.trim(),
        description: values.description?.trim() || null,
        imageUrl: uploadedImageUrl || null,
        mainCategoryId: values.mainCategoryId,
      });
      message.success('Sub category created successfully');
      setCreateSubModalOpen(false);
      createSubForm.resetFields();
      setUploadedImageUrl('');
      setFileList([]);
      loadSubCategories(subPage);
      reloadStats();
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Failed to create sub category');
    }
  };

  const openEditSubModal = (category: SubCategoryListItem) => {
    setSelectedSubCategory(category);
    setUploadedImageUrl(category.imageUrl || '');
    editSubForm.setFieldsValue({
      name: category.name,
      description: category.description || '',
      mainCategoryId: category.mainCategoryId,
    });
    setEditSubModalOpen(true);
  };

  const handleEditSub = async (values: {
    name: string;
    description?: string;
    mainCategoryId: string;
  }) => {
    if (!selectedSubCategory) return;
    try {
      await updateSubCategory(selectedSubCategory.id, {
        name: values.name.trim(),
        description: values.description?.trim() || null,
        imageUrl: uploadedImageUrl || null,
        mainCategoryId: values.mainCategoryId,
      });
      message.success('Sub category updated successfully');
      setEditSubModalOpen(false);
      editSubForm.resetFields();
      setSelectedSubCategory(null);
      setUploadedImageUrl('');
      setFileList([]);
      loadSubCategories(subPage);
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Failed to update sub category');
    }
  };

  const handleDeleteSub = async (id: string) => {
    try {
      await deleteSubCategory(id);
      message.success('Sub category deleted successfully');
      loadSubCategories(subPage);
      reloadStats();
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Failed to delete sub category');
    }
  };

  const reloadStats = async () => {
    try {
      const res = await fetchCategoryStats();
      if (res.data) setStats(res.data);
    } catch {
      // silently ignore stats reload errors
    }
  };

  // Main category columns
  const mainColumns: ColumnsType<MainCategoryListItem> = [
    {
      title: 'Image',
      dataIndex: 'imageUrl',
      key: 'imageUrl',
      width: 80,
      render: (url) =>
        url ? (
          <Image
            src={url}
            alt="Category"
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
            <FolderOutlined style={{ color: '#ccc' }} />
          </div>
        ),
    },
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      width: 200,
      ellipsis: true,
    },
    {
      title: 'Sub Categories',
      dataIndex: 'subCategoriesCount',
      key: 'subCategoriesCount',
      width: 140,
      align: 'center',
      render: (count) => <Tag color="blue">{count}</Tag>,
    },
    {
      title: 'Content Posts',
      dataIndex: 'contentPostsCount',
      key: 'contentPostsCount',
      width: 140,
      align: 'center',
      render: (count) => <Tag>{count}</Tag>,
    },
    {
      title: 'Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 120,
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
            onClick={() => openEditMainModal(record)}
            title="Edit category"
          />
          <Popconfirm
            title="Delete Main Category"
            description={`Delete "${record.name}"? This may affect sub categories.`}
            onConfirm={() => handleDeleteMain(record.id)}
            okText="Delete"
            okType="danger"
          >
            <Button
              size="small"
              type="text"
              danger
              icon={<DeleteOutlined />}
              title="Delete category"
            />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // Sub category columns
  const subColumns: ColumnsType<SubCategoryListItem> = [
    {
      title: 'Image',
      dataIndex: 'imageUrl',
      key: 'imageUrl',
      width: 80,
      render: (url) =>
        url ? (
          <Image
            src={url}
            alt="Category"
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
            <TagsOutlined style={{ color: '#ccc' }} />
          </div>
        ),
    },
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      width: 200,
      ellipsis: true,
    },
    {
      title: 'Main Category',
      dataIndex: 'mainCategoryName',
      key: 'mainCategoryName',
      width: 180,
      render: (name) => <Tag color="purple">{name}</Tag>,
    },
    {
      title: 'Content Posts',
      dataIndex: 'contentPostsCount',
      key: 'contentPostsCount',
      width: 140,
      align: 'center',
      render: (count) => <Tag>{count}</Tag>,
    },
    {
      title: 'Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 120,
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
            onClick={() => openEditSubModal(record)}
            title="Edit sub category"
          />
          <Popconfirm
            title="Delete Sub Category"
            description={`Delete "${record.name}"?`}
            onConfirm={() => handleDeleteSub(record.id)}
            okText="Delete"
            okType="danger"
          >
            <Button
              size="small"
              type="text"
              danger
              icon={<DeleteOutlined />}
              title="Delete sub category"
            />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const statsData: StatItemData[] | undefined = stats
    ? [
        {
          label: 'Main Categories',
          value: stats.mainCategories,
          icon: <FolderOutlined />,
        },
        {
          label: 'Sub Categories',
          value: stats.subCategories,
          icon: <TagsOutlined />,
          valueColor: '#1890ff',
        },
        {
          label: 'Total',
          value: stats.total,
          icon: <AppstoreOutlined />,
          valueColor: '#52c41a',
        },
      ]
    : undefined;

  const mainUploadProps = {
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
      await handleUploadMainImage(file);
      return false;
    },
    fileList,
    onChange: ({ fileList: newFileList }: { fileList: UploadFile[] }) => setFileList(newFileList),
    maxCount: 1,
  };

  const subUploadProps = {
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
      await handleUploadSubImage(file);
      return false;
    },
    fileList,
    onChange: ({ fileList: newFileList }: { fileList: UploadFile[] }) => setFileList(newFileList),
    maxCount: 1,
  };

  return (
    <div>
      <PageHeader
        title="Category Management"
        description="Manage main categories and sub categories"
        icon={<AppstoreOutlined />}
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

      <Card bordered>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: 'main',
              label: 'Main Categories',
              children: (
                <>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      marginBottom: 16,
                      flexWrap: 'wrap',
                      gap: 8,
                    }}
                  >
                    <Input
                      placeholder="Search main categories"
                      value={mainSearch}
                      onChange={(e) => setMainSearch(e.target.value)}
                      prefix={<SearchOutlined />}
                      style={{ width: 250 }}
                      allowClear
                    />
                    <Button
                      type="primary"
                      icon={<PlusOutlined />}
                      onClick={() => {
                        setUploadedImageUrl('');
                        setFileList([]);
                        setCreateMainModalOpen(true);
                      }}
                    >
                      Create Main Category
                    </Button>
                  </div>
                  <Table
                    columns={mainColumns}
                    dataSource={mainCategories}
                    rowKey="id"
                    loading={mainLoading}
                    pagination={{
                      current: mainPage,
                      pageSize: PAGE_SIZE,
                      total: mainTotal,
                      showSizeChanger: false,
                      showTotal: (total) => `Total ${total} main categories`,
                      onChange: loadMainCategories,
                    }}
                    locale={{
                      emptyText: <Empty description="No main categories found" />,
                    }}
                  />
                </>
              ),
            },
            {
              key: 'sub',
              label: 'Sub Categories',
              children: (
                <>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      marginBottom: 16,
                      flexWrap: 'wrap',
                      gap: 8,
                    }}
                  >
                    <Space wrap>
                      <Input
                        placeholder="Search sub categories"
                        value={subSearch}
                        onChange={(e) => setSubSearch(e.target.value)}
                        prefix={<SearchOutlined />}
                        style={{ width: 250 }}
                        allowClear
                      />
                      <Select
                        placeholder="Filter by main category"
                        value={filterMainCategoryId || undefined}
                        onChange={(val) => setFilterMainCategoryId(val || '')}
                        style={{ width: 220 }}
                        allowClear
                      >
                        {mainCategories.map((mc) => (
                          <Select.Option key={mc.id} value={mc.id}>
                            {mc.name}
                          </Select.Option>
                        ))}
                      </Select>
                    </Space>
                    <Button
                      type="primary"
                      icon={<PlusOutlined />}
                      onClick={() => {
                        setUploadedImageUrl('');
                        setFileList([]);
                        setCreateSubModalOpen(true);
                      }}
                    >
                      Create Sub Category
                    </Button>
                  </div>
                  <Table
                    columns={subColumns}
                    dataSource={subCategories}
                    rowKey="id"
                    loading={subLoading}
                    pagination={{
                      current: subPage,
                      pageSize: PAGE_SIZE,
                      total: subTotal,
                      showSizeChanger: false,
                      showTotal: (total) => `Total ${total} sub categories`,
                      onChange: loadSubCategories,
                    }}
                    locale={{
                      emptyText: <Empty description="No sub categories found" />,
                    }}
                  />
                </>
              ),
            },
          ]}
        />
      </Card>

      {/* Create Main Category Modal */}
      <Modal
        title="Create Main Category"
        open={createMainModalOpen}
        onCancel={() => {
          setCreateMainModalOpen(false);
          createMainForm.resetFields();
          setUploadedImageUrl('');
          setFileList([]);
        }}
        onOk={() => createMainForm.submit()}
        okText="Create"
        width={600}
      >
        <Form form={createMainForm} layout="vertical" onFinish={handleCreateMain}>
          <Form.Item label="Category Image">
            <Upload {...mainUploadProps} listType="picture">
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
            name="name"
            label="Name"
            rules={[
              { required: true, message: 'Please enter category name' },
              { min: 1, max: 200, message: 'Name must be 1-200 characters' },
            ]}
          >
            <Input placeholder="Category name" />
          </Form.Item>

          <Form.Item name="description" label="Description">
            <Input.TextArea rows={3} maxLength={1000} placeholder="Category description" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Edit Main Category Modal */}
      <Modal
        title="Edit Main Category"
        open={editMainModalOpen}
        onCancel={() => {
          setEditMainModalOpen(false);
          editMainForm.resetFields();
          setSelectedMainCategory(null);
          setUploadedImageUrl('');
          setFileList([]);
        }}
        onOk={() => editMainForm.submit()}
        okText="Update"
        width={600}
      >
        <Form form={editMainForm} layout="vertical" onFinish={handleEditMain}>
          <Form.Item label="Category Image">
            <Upload {...mainUploadProps} listType="picture">
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
            name="name"
            label="Name"
            rules={[
              { required: true, message: 'Please enter category name' },
              { min: 1, max: 200, message: 'Name must be 1-200 characters' },
            ]}
          >
            <Input placeholder="Category name" />
          </Form.Item>

          <Form.Item name="description" label="Description">
            <Input.TextArea rows={3} maxLength={1000} placeholder="Category description" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Create Sub Category Modal */}
      <Modal
        title="Create Sub Category"
        open={createSubModalOpen}
        onCancel={() => {
          setCreateSubModalOpen(false);
          createSubForm.resetFields();
          setUploadedImageUrl('');
          setFileList([]);
        }}
        onOk={() => createSubForm.submit()}
        okText="Create"
        width={600}
      >
        <Form form={createSubForm} layout="vertical" onFinish={handleCreateSub}>
          <Form.Item label="Category Image">
            <Upload {...subUploadProps} listType="picture">
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
            name="name"
            label="Name"
            rules={[
              { required: true, message: 'Please enter sub category name' },
              { min: 1, max: 200, message: 'Name must be 1-200 characters' },
            ]}
          >
            <Input placeholder="Sub category name" />
          </Form.Item>

          <Form.Item name="description" label="Description">
            <Input.TextArea rows={3} maxLength={1000} placeholder="Sub category description" />
          </Form.Item>

          <Form.Item
            name="mainCategoryId"
            label="Main Category"
            rules={[{ required: true, message: 'Please select a main category' }]}
          >
            <Select placeholder="Select main category">
              {mainCategories.map((mc) => (
                <Select.Option key={mc.id} value={mc.id}>
                  {mc.name}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* Edit Sub Category Modal */}
      <Modal
        title="Edit Sub Category"
        open={editSubModalOpen}
        onCancel={() => {
          setEditSubModalOpen(false);
          editSubForm.resetFields();
          setSelectedSubCategory(null);
          setUploadedImageUrl('');
          setFileList([]);
        }}
        onOk={() => editSubForm.submit()}
        okText="Update"
        width={600}
      >
        <Form form={editSubForm} layout="vertical" onFinish={handleEditSub}>
          <Form.Item label="Category Image">
            <Upload {...subUploadProps} listType="picture">
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
            name="name"
            label="Name"
            rules={[
              { required: true, message: 'Please enter sub category name' },
              { min: 1, max: 200, message: 'Name must be 1-200 characters' },
            ]}
          >
            <Input placeholder="Sub category name" />
          </Form.Item>

          <Form.Item name="description" label="Description">
            <Input.TextArea rows={3} maxLength={1000} placeholder="Sub category description" />
          </Form.Item>

          <Form.Item
            name="mainCategoryId"
            label="Main Category"
            rules={[{ required: true, message: 'Please select a main category' }]}
          >
            <Select placeholder="Select main category">
              {mainCategories.map((mc) => (
                <Select.Option key={mc.id} value={mc.id}>
                  {mc.name}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default CategoryManagement;
