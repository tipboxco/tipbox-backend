import { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Input,
  Space,
  Button,
  Switch,
  Empty,
  Alert,
  Row,
  Modal,
  Form,
  Select,
  InputNumber,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  AppstoreOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SortAscendingOutlined,
} from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';
import { type StatItemData } from '../../components/StatItem';
import {
  fetchCategoryStats,
  fetchCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  reorderCategory,
} from '../../api/admin-products';
import type {
  AdminCategoryStatsResponse,
  AdminCategoryListItem,
  UpdateCategoryInput,
} from '../../api/admin-products';
import { TABLE_COLUMN_WIDTHS, TABLE_SCROLL_CONFIGS } from '../../constants/table-widths';

function ProductCategories() {
  const [stats, setStats] = useState<AdminCategoryStatsResponse | null>(null);
  const [categories, setCategories] = useState<AdminCategoryListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingList, setLoadingList] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [reorderModalOpen, setReorderModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<AdminCategoryListItem | null>(null);
  const [form] = Form.useForm();
  const [reorderForm] = Form.useForm();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchCategoryStats();
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

  const loadCategories = async () => {
    setLoadingList(true);
    try {
      const res = await fetchCategories();
      setCategories(res.data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load categories');
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  const handleCreate = async (values: Record<string, unknown>) => {
    try {
      await createCategory({
        id: crypto.randomUUID(),
        name: values.name as string,
        parentId: (values.parentId as string) || null,
        rank: (values.rank as number) ?? null,
        isActive: values.isActive as boolean,
      });
      message.success('Category created successfully');
      setCreateModalOpen(false);
      form.resetFields();
      loadCategories();
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Failed to create category');
    }
  };

  const handleEdit = async (values: UpdateCategoryInput) => {
    if (!selectedCategory) return;

    try {
      await updateCategory(selectedCategory.id, {
        name: values.name,
        parentId: values.parentId ?? null,
        rank: values.rank ?? null,
        isActive: values.isActive,
      });
      message.success('Category updated successfully');
      setEditModalOpen(false);
      form.resetFields();
      setSelectedCategory(null);
      loadCategories();
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Failed to update category');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    Modal.confirm({
      title: 'Delete Category',
      content: `Are you sure you want to delete "${name}"? This will also affect any subcategories.`,
      okText: 'Delete',
      okType: 'danger',
      onOk: async () => {
        try {
          await deleteCategory(id);
          message.success('Category deleted successfully');
          loadCategories();
        } catch (e) {
          message.error(e instanceof Error ? e.message : 'Failed to delete category');
        }
      },
    });
  };

  const handleToggleActive = async (category: AdminCategoryListItem) => {
    try {
      await updateCategory(category.id, {
        isActive: !(category.isActive ?? true),
      });
      message.success(`Category ${category.isActive ? 'deactivated' : 'activated'}`);
      loadCategories();
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Failed to update category');
    }
  };

  const openEditModal = (category: AdminCategoryListItem) => {
    setSelectedCategory(category);
    form.setFieldsValue({
      name: category.name,
      parentId: category.parentId ?? undefined,
      rank: category.rank ?? 0,
      isActive: category.isActive ?? true,
    });
    setEditModalOpen(true);
  };

  const handleReorder = async (values: { categoryOrders: { categoryId: string; displayOrder: number }[] }) => {
    try {
      for (const order of values.categoryOrders) {
        await reorderCategory(order.categoryId, { rank: order.displayOrder });
      }
      message.success('Categories reordered successfully');
      setReorderModalOpen(false);
      reorderForm.resetFields();
      loadCategories();
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Failed to reorder categories');
    }
  };

  const openReorderModal = () => {
    const initialOrders = categories.map(cat => ({
      categoryId: cat.id,
      displayOrder: cat.rank ?? 0,
    }));
    reorderForm.setFieldsValue({ categoryOrders: initialOrders });
    setReorderModalOpen(true);
  };

  // Build hierarchical data for display
  const buildHierarchy = () => {
    const categoryMap = new Map<string, AdminCategoryListItem & { children?: AdminCategoryListItem[] }>();
    const rootCategories: (AdminCategoryListItem & { children?: AdminCategoryListItem[] })[] = [];

    // First pass: create map
    categories.forEach(cat => {
      categoryMap.set(cat.id, { ...cat, children: [] });
    });

    // Second pass: build hierarchy
    categories.forEach(cat => {
      const node = categoryMap.get(cat.id)!;
      if (cat.parentId) {
        const parent = categoryMap.get(cat.parentId);
        if (parent) {
          parent.children = parent.children || [];
          parent.children.push(node);
        } else {
          rootCategories.push(node);
        }
      } else {
        rootCategories.push(node);
      }
    });

    return rootCategories;
  };

  // Flatten hierarchy for table display with indentation
  const flattenHierarchy = (
    nodes: (AdminCategoryListItem & { children?: AdminCategoryListItem[] })[],
    level = 0
  ): (AdminCategoryListItem & { level: number; displayOrder?: number })[] => {
    let result: (AdminCategoryListItem & { level: number; displayOrder?: number })[] = [];
    nodes.forEach(node => {
      result.push({ ...node, level, displayOrder: node.rank ?? 0 });
      if (node.children && node.children.length > 0) {
        result = result.concat(flattenHierarchy(node.children, level + 1));
      }
    });
    return result;
  };

  const hierarchicalData = flattenHierarchy(buildHierarchy());

  const columns: ColumnsType<AdminCategoryListItem & { level: number; displayOrder?: number }> = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      width: TABLE_COLUMN_WIDTHS.LONG_TEXT_FLEXIBLE,
      render: (text, record) => (
        <span style={{ paddingLeft: `${record.level * 24}px` }}>
          {record.level > 0 && '└ '}
          {text}
        </span>
      ),
    },
    {
      title: 'Parent',
      dataIndex: 'parentId',
      key: 'parentName',
      width: TABLE_COLUMN_WIDTHS.MEDIUM_TEXT,
      ellipsis: true,
      render: (_: unknown, record: AdminCategoryListItem) =>
        categories.find(c => c.id === record.parentId)?.name ?? '—',
    },
    {
      title: 'Order',
      dataIndex: 'displayOrder',
      key: 'displayOrder',
      width: TABLE_COLUMN_WIDTHS.SHORT_TEXT,
      align: 'center',
    },
    {
      title: 'Active',
      dataIndex: 'isActive',
      key: 'isActive',
      width: TABLE_COLUMN_WIDTHS.SHORT_TEXT,
      align: 'center',
      render: (isActive, record) => (
        <Switch
          checked={isActive}
          onChange={() => handleToggleActive(record)}
          size="small"
        />
      ),
    },
    {
      title: 'Products',
      dataIndex: 'productCount',
      key: 'productCount',
      width: TABLE_COLUMN_WIDTHS.SHORT_TEXT,
      align: 'right',
    },
    {
      title: 'Subcategories',
      dataIndex: 'children',
      key: 'subcategoryCount',
      width: TABLE_COLUMN_WIDTHS.SHORT_TEXT,
      align: 'right',
      render: (_: unknown, record: AdminCategoryListItem & { children?: AdminCategoryListItem[] }) =>
        record.children?.length ?? 0,
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

  const topLevelCount = categories.filter(c => !c.parentId).length;
  const withSubcategoriesCount = categories.filter(
    c => c.children && c.children.length > 0
  ).length;
  const statsData: StatItemData[] | undefined = stats
    ? [
        {
          label: 'Total Categories',
          value: stats.total,
          icon: <AppstoreOutlined />,
        },
        {
          label: 'Active',
          value: stats.active,
          icon: <AppstoreOutlined />,
        },
        {
          label: 'Top Level',
          value: topLevelCount,
          icon: <AppstoreOutlined />,
        },
        {
          label: 'With Subcategories',
          value: withSubcategoriesCount,
          icon: <AppstoreOutlined />,
        },
      ]
    : undefined;

  const parentOptions = categories
    .filter(cat => !selectedCategory || cat.id !== selectedCategory.id)
    .map(cat => ({
      label: cat.name,
      value: cat.id,
    }));

  return (
    <div>
      <PageHeader
        title="Categories"
        description="Manage product categories"
        icon={<AppstoreOutlined />}
        stats={statsData}
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
            <Space>
              <Button icon={<SortAscendingOutlined />} onClick={openReorderModal}>
                Reorder Categories
              </Button>
            </Space>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalOpen(true)}>
              Create Category
            </Button>
          </Row>

          <Table
            columns={columns}
            dataSource={hierarchicalData}
            loading={loadingList}
            rowKey="id"
            pagination={false}
            scroll={TABLE_SCROLL_CONFIGS.AUTO}
            locale={{
              emptyText: <Empty description="No categories found" />,
            }}
          />
        </Space>
      </Card>

      {/* Create Category Modal */}
      <Modal
        title="Create Category"
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
            name="name"
            label="Category Name"
            rules={[{ required: true, message: 'Please enter category name' }]}
          >
            <Input placeholder="e.g., Electronics" />
          </Form.Item>
          <Form.Item name="parentId" label="Parent Category">
            <Select
              placeholder="Select parent category (optional)"
              allowClear
              options={parentOptions}
            />
          </Form.Item>
          <Form.Item name="rank" label="Display Order" initialValue={0}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="isActive" label="Active" valuePropName="checked" initialValue={true}>
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      {/* Edit Category Modal */}
      <Modal
        title="Edit Category"
        open={editModalOpen}
        onCancel={() => {
          setEditModalOpen(false);
          form.resetFields();
          setSelectedCategory(null);
        }}
        onOk={() => form.submit()}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleEdit}>
          <Form.Item
            name="name"
            label="Category Name"
            rules={[{ required: true, message: 'Please enter category name' }]}
          >
            <Input placeholder="e.g., Electronics" />
          </Form.Item>
          <Form.Item name="parentId" label="Parent Category">
            <Select
              placeholder="Select parent category (optional)"
              allowClear
              options={parentOptions}
            />
          </Form.Item>
          <Form.Item name="rank" label="Display Order">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="isActive" label="Active" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      {/* Reorder Categories Modal */}
      <Modal
        title="Reorder Categories"
        open={reorderModalOpen}
        onCancel={() => {
          setReorderModalOpen(false);
          reorderForm.resetFields();
        }}
        onOk={() => reorderForm.submit()}
        width={700}
      >
        <Alert
          message="Adjust display order numbers to reorder categories"
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
        <Form form={reorderForm} layout="vertical" onFinish={handleReorder}>
          <Form.List name="categoryOrders">
            {(fields) => (
              <div style={{ maxHeight: 400, overflow: 'auto' }}>
                {fields.map((field) => {
                  const category = categories[field.name];
                  return (
                    <Row key={field.key} gutter={16} align="middle" style={{ marginBottom: 8 }}>
                      <div style={{ flex: 1, paddingLeft: 8 }}>
                        {category?.name ?? 'Unknown'}
                      </div>
                      <Form.Item
                        {...field}
                        name={[field.name, 'categoryId']}
                        style={{ display: 'none' }}
                      >
                        <Input />
                      </Form.Item>
                      <Form.Item
                        {...field}
                        name={[field.name, 'displayOrder']}
                        style={{ margin: 0, width: 100 }}
                      >
                        <InputNumber min={0} style={{ width: '100%' }} />
                      </Form.Item>
                    </Row>
                  );
                })}
              </div>
            )}
          </Form.List>
        </Form>
      </Modal>
    </div>
  );
}

export default ProductCategories;
