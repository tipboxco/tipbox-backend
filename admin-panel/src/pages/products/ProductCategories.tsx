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
  Tag,
  Avatar,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  AppstoreOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  PictureOutlined,
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
} from '../../api/admin-products';
import { TABLE_COLUMN_WIDTHS, TABLE_SCROLL_CONFIGS } from '../../constants/table-widths';

const LEVEL_COLORS: Record<number, string> = {
  0: 'blue',
  1: 'green',
  2: 'orange',
};

const LEVEL_LABELS: Record<number, string> = {
  0: 'Level 1',
  1: 'Level 2',
  2: 'Level 3',
};

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
      setCategories([]);
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

  // Count all categories recursively
  const countAll = (cats: AdminCategoryListItem[]): number => {
    let count = 0;
    for (const cat of cats) {
      count += 1;
      if (cat.children && cat.children.length > 0) {
        count += countAll(cat.children);
      }
    }
    return count;
  };

  const countByLevel = (cats: AdminCategoryListItem[], targetLevel: number): number => {
    let count = 0;
    for (const cat of cats) {
      if ((cat.level ?? 0) === targetLevel) count += 1;
      if (cat.children && cat.children.length > 0) {
        count += countByLevel(cat.children, targetLevel);
      }
    }
    return count;
  };

  // Filter to only root categories (parentId is null) for the tree table
  const rootCategories = categories.filter(cat => !cat.parentId);

  const columns: ColumnsType<AdminCategoryListItem> = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      width: TABLE_COLUMN_WIDTHS.LONG_TEXT_FLEXIBLE,
      render: (text: string, record: AdminCategoryListItem) => {
        const isEditing = editingKey === record.id;
        const thumb = record.thumbnail;

        return (
          <Space size="small" align="center">
            {thumb ? (
              <Avatar src={thumb} shape="square" size={32} />
            ) : (
              <Avatar icon={<PictureOutlined />} shape="square" size={32} />
            )}
            {isEditing ? (
              <Input
                value={editingValue}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditingValue(e.target.value)}
                onKeyDown={(e: React.KeyboardEvent) => handleKeyDown(e, record)}
                onBlur={() => saveEditingName(record)}
                autoFocus
                size="small"
              />
            ) : (
              <span
                onDoubleClick={() => startEditingName(record)}
                style={{ cursor: 'pointer' }}
                title="Double-click to edit"
              >
                {text}
              </span>
            )}
          </Space>
        );
      },
    },
    {
      title: 'Level',
      dataIndex: 'level',
      key: 'level',
      width: TABLE_COLUMN_WIDTHS.SHORT_TEXT,
      align: 'center',
      render: (level: number | null) => {
        const lvl = level ?? 0;
        return (
          <Tag color={LEVEL_COLORS[lvl] ?? 'default'}>
            {LEVEL_LABELS[lvl] ?? `Level ${lvl + 1}`}
          </Tag>
        );
      },
    },
    {
      title: 'Order',
      dataIndex: 'rank',
      key: 'rank',
      width: TABLE_COLUMN_WIDTHS.SHORT_TEXT,
      align: 'center',
      render: (rank: number | null) => rank ?? 0,
    },
    {
      title: 'Active',
      dataIndex: 'isActive',
      key: 'isActive',
      width: TABLE_COLUMN_WIDTHS.SHORT_TEXT,
      align: 'center',
      render: (isActive: boolean | null, record: AdminCategoryListItem) => (
        <Switch
          checked={isActive ?? false}
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
      key: 'subcategoryCount',
      width: TABLE_COLUMN_WIDTHS.SHORT_TEXT,
      align: 'right',
      render: (_: unknown, record: AdminCategoryListItem) =>
        record.children?.length ?? 0,
    },
    {
      title: '',
      key: 'action',
      width: TABLE_COLUMN_WIDTHS.ACTION_BUTTONS,
      render: (_: unknown, record: AdminCategoryListItem) => (
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

  const level1Count = countByLevel(rootCategories, 0);
  const level2Count = countByLevel(rootCategories, 1);
  const level3Count = countByLevel(rootCategories, 2);

  const statsData: StatItemData[] | undefined = stats
    ? [
        {
          label: 'Total Categories',
          value: stats.total,
          icon: <AppstoreOutlined />,
        },
        {
          label: 'Level 1',
          value: level1Count,
          icon: <AppstoreOutlined />,
        },
        {
          label: 'Level 2',
          value: level2Count,
          icon: <AppstoreOutlined />,
        },
        {
          label: 'Level 3',
          value: level3Count,
          icon: <AppstoreOutlined />,
        },
      ]
    : undefined;

  return (
    <div>
      <PageHeader
        title="Categories"
        description="Manage product categories (3-level hierarchy)"
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
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Row justify="end" align="middle">
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalOpen(true)}>
              Create Category
            </Button>
          </Row>

          <Table
            columns={columns}
            dataSource={rootCategories}
            loading={loadingList}
            rowKey="id"
            pagination={false}
            scroll={TABLE_SCROLL_CONFIGS.AUTO}
            expandable={{
              defaultExpandAllRows: true,
              childrenColumnName: 'children',
            }}
            locale={{
              emptyText: <Empty description="No categories found" />,
            }}
          />
        </Space>
      </Card>

      <CategoryCreateModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onSuccess={handleCreateSuccess}
      />

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
