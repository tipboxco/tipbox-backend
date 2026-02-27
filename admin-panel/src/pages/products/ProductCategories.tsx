import { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Space,
  Button,
  Switch,
  Empty,
  Alert,
  Row,
  Modal,
  message,
  Input,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  AppstoreOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';
import { type StatItemData } from '../../components/StatItem';
import CategoryCreateModal from './modals/CategoryCreateModal';
import CategoryEditModal from './modals/CategoryEditModal';
import {
  fetchCategoryStats,
  fetchCategories,
  updateCategory,
  deleteCategory,
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
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [editingKey, setEditingKey] = useState<string>('');
  const [editingValue, setEditingValue] = useState<string>('');

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
    setError(null);
    try {
      const res = await fetchCategories();
      setCategories(res.data ?? []);
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : 'Failed to load categories';
      setError(errorMsg);
      setCategories([]); // Ensure categories is always an array
      console.error('Failed to load categories:', e);
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  const handleCreateSuccess = () => {
    loadCategories();
  };

  const handleEditSuccess = () => {
    setEditModalOpen(false);
    setSelectedCategoryId(null);
    loadCategories();
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

  const openEditModal = (categoryId: string) => {
    setSelectedCategoryId(categoryId);
    setEditModalOpen(true);
  };

  const startEditingName = (record: AdminCategoryListItem) => {
    setEditingKey(record.id);
    setEditingValue(record.name);
  };

  const cancelEditingName = () => {
    setEditingKey('');
    setEditingValue('');
  };

  const saveEditingName = async (record: AdminCategoryListItem) => {
    if (!editingValue.trim()) {
      message.error('Category name cannot be empty');
      cancelEditingName();
      return;
    }

    try {
      await updateCategory(record.id, {
        name: editingValue.trim(),
      });
      message.success('Category name updated successfully');

      // Update local state optimistically
      const updateCategoryInTree = (cats: AdminCategoryListItem[]): AdminCategoryListItem[] => {
        return cats.map(cat => {
          if (cat.id === record.id) {
            return { ...cat, name: editingValue.trim() };
          }
          if (cat.children && cat.children.length > 0) {
            return { ...cat, children: updateCategoryInTree(cat.children) };
          }
          return cat;
        });
      };

      setCategories(updateCategoryInTree(categories));
      cancelEditingName();
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Failed to update category name');
      cancelEditingName();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, record: AdminCategoryListItem) => {
    if (e.key === 'Enter') {
      saveEditingName(record);
    } else if (e.key === 'Escape') {
      cancelEditingName();
    }
  };

  // Backend already sends hierarchical data with children
  // We only need to flatten it for display and filter to root categories only
  const flattenHierarchy = (
    nodes: AdminCategoryListItem[],
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

  // Build a flat map of all categories for parent lookup
  const buildCategoryMap = (cats: AdminCategoryListItem[]): Map<string, AdminCategoryListItem> => {
    const map = new Map<string, AdminCategoryListItem>();
    const addToMap = (cat: AdminCategoryListItem) => {
      map.set(cat.id, cat);
      if (cat.children && cat.children.length > 0) {
        cat.children.forEach(addToMap);
      }
    };
    cats.forEach(addToMap);
    return map;
  };

  const categoryMap = buildCategoryMap(categories);

  // Filter to only root categories (parentId is null)
  const rootCategories = categories.filter(cat => !cat.parentId);
  const hierarchicalData = flattenHierarchy(rootCategories);

  const columns: ColumnsType<AdminCategoryListItem & { level: number; displayOrder?: number }> = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      width: TABLE_COLUMN_WIDTHS.LONG_TEXT_FLEXIBLE,
      render: (text, record) => {
        const isEditing = editingKey === record.id;
        const indent = record.level * 24;

        return (
          <div style={{ paddingLeft: `${indent}px`, display: 'flex', alignItems: 'center' }}>
            {record.level > 0 && <span style={{ marginRight: 4 }}>└ </span>}
            {isEditing ? (
              <Input
                value={editingValue}
                onChange={(e) => setEditingValue(e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, record)}
                onBlur={() => saveEditingName(record)}
                autoFocus
                style={{ flex: 1 }}
                size="small"
              />
            ) : (
              <span
                onDoubleClick={() => startEditingName(record)}
                style={{ cursor: 'pointer', flex: 1 }}
                title="Double-click to edit"
              >
                {text}
              </span>
            )}
          </div>
        );
      },
    },
    {
      title: 'Parent',
      dataIndex: 'parentId',
      key: 'parentName',
      width: TABLE_COLUMN_WIDTHS.MEDIUM_TEXT,
      ellipsis: true,
      render: (_: unknown, record: AdminCategoryListItem) =>
        record.parentId ? (categoryMap.get(record.parentId)?.name ?? '—') : '—',
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
            onClick={() => openEditModal(record.id)}
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
          title="Error"
          description={error}
          type="error"
          closable
          onClose={() => setError(null)}
          style={{ marginBottom: 16 }}
        />
      )}

      <Card variant="outlined">
        <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
          <Row justify="end" align="middle">
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
      <CategoryCreateModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onSuccess={handleCreateSuccess}
      />

      {/* Edit Category Modal */}
      {selectedCategoryId && (
        <CategoryEditModal
          open={editModalOpen}
          categoryId={selectedCategoryId}
          onClose={() => {
            setEditModalOpen(false);
            setSelectedCategoryId(null);
          }}
          onSuccess={handleEditSuccess}
        />
      )}
    </div>
  );
}

export default ProductCategories;
