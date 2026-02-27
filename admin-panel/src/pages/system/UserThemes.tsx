import { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Space,
  Button,
  Input,
  Empty,
  Alert,
  Modal,
  Form,
  message,
  Popconfirm,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { BgColorsOutlined, PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined } from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';
import { type StatItemData } from '../../components/StatItem';
import {
  fetchUserThemesStats,
  fetchUserThemes,
  createUserTheme,
  updateUserTheme,
  deleteUserTheme,
  type UserThemeStatsResponse,
  type UserThemeListItem,
} from '../../api/admin-user-themes';

const PAGE_SIZE = 20;

function UserThemes() {
  const [stats, setStats] = useState<UserThemeStatsResponse | null>(null);
  const [themes, setThemes] = useState<UserThemeListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingStats, setLoadingStats] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedTheme, setSelectedTheme] = useState<UserThemeListItem | null>(null);
  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchUserThemesStats();
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

  const loadThemes = async (page = 1) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchUserThemes({
        limit: PAGE_SIZE,
        offset: (page - 1) * PAGE_SIZE,
        search: search || undefined,
      });
      setThemes(res.data ?? []);
      setTotal(res.pagination?.total ?? 0);
      setCurrentPage(page);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load themes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadThemes(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const handleCreate = async (values: { name: string; description?: string }) => {
    try {
      await createUserTheme({
        name: values.name.trim(),
        description: values.description?.trim() || null,
      });
      message.success('Theme created successfully');
      setCreateModalOpen(false);
      createForm.resetFields();
      loadThemes(currentPage);
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Failed to create theme');
    }
  };

  const openEditModal = (theme: UserThemeListItem) => {
    setSelectedTheme(theme);
    editForm.setFieldsValue({
      name: theme.name,
      description: theme.description || '',
    });
    setEditModalOpen(true);
  };

  const handleEdit = async (values: { name: string; description?: string }) => {
    if (!selectedTheme) return;
    try {
      await updateUserTheme(selectedTheme.id, {
        name: values.name.trim(),
        description: values.description?.trim() || null,
      });
      message.success('Theme updated successfully');
      setEditModalOpen(false);
      editForm.resetFields();
      setSelectedTheme(null);
      loadThemes(currentPage);
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Failed to update theme');
    }
  };

  const handleDelete = async (id: string, name: string, userCount: number) => {
    try {
      await deleteUserTheme(id);
      message.success('Theme deleted successfully');
      loadThemes(currentPage);
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Failed to delete theme');
    }
  };

  const columns: ColumnsType<UserThemeListItem> = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      width: 200,
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (text) => text || '—',
    },
    {
      title: 'Users',
      dataIndex: 'userCount',
      key: 'userCount',
      width: 100,
      align: 'right',
    },
    {
      title: 'Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 110,
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
            onClick={() => openEditModal(record)}
          />
          <Popconfirm
            title="Delete Theme"
            description={
              record.userCount > 0
                ? `Theme is used by ${record.userCount} user(s). Cannot delete.`
                : `Delete "${record.name}"?`
            }
            onConfirm={() => handleDelete(record.id, record.name, record.userCount)}
            okText="Delete"
            okType="danger"
            disabled={record.userCount > 0}
          >
            <Button
              size="small"
              type="text"
              danger
              icon={<DeleteOutlined />}
              disabled={record.userCount > 0}
            />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const statsData: StatItemData[] | undefined = stats
    ? [
        { label: 'Total Themes', value: stats.totalThemes, icon: <BgColorsOutlined /> },
        { label: 'Users with Themes', value: stats.totalUsersWithThemes, icon: <BgColorsOutlined /> },
      ]
    : undefined;

  return (
    <div>
      <PageHeader
        title="User Themes"
        description="Manage UI theme catalog"
        icon={<BgColorsOutlined />}
        stats={statsData}
        statsLoading={loadingStats}
      />

      {error && (
        <Alert message="Error" description={error} type="error" closable onClose={() => setError(null)} style={{ marginBottom: 24 }} />
      )}

      <Card
        bordered
        title="Theme Management"
        extra={
          <Space wrap>
            <Input placeholder="Search themes" value={search} onChange={(e) => setSearch(e.target.value)} prefix={<SearchOutlined />} style={{ width: 200 }} allowClear />
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalOpen(true)}>Create Theme</Button>
          </Space>
        }
      >
        <Table columns={columns} dataSource={themes} rowKey="id" loading={loading} pagination={{ current: currentPage, pageSize: PAGE_SIZE, total, showSizeChanger: false, showTotal: (total) => `Total ${total} themes`, onChange: loadThemes }} locale={{ emptyText: <Empty description="No themes found" /> }} />
      </Card>

      <Modal title="Create Theme" open={createModalOpen} onCancel={() => { setCreateModalOpen(false); createForm.resetFields(); }} onOk={() => createForm.submit()} okText="Create">
        <Form form={createForm} layout="vertical" onFinish={handleCreate}>
          <Form.Item name="name" label="Theme Name" rules={[{ required: true, message: 'Please enter theme name' }, { min: 1, max: 200 }]}>
            <Input placeholder="e.g., Dark Mode, Light Mode" />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={3} maxLength={2000} placeholder="Theme description" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="Edit Theme" open={editModalOpen} onCancel={() => { setEditModalOpen(false); editForm.resetFields(); setSelectedTheme(null); }} onOk={() => editForm.submit()} okText="Update">
        <Form form={editForm} layout="vertical" onFinish={handleEdit}>
          <Form.Item name="name" label="Theme Name" rules={[{ required: true, message: 'Please enter theme name' }, { min: 1, max: 200 }]}>
            <Input placeholder="e.g., Dark Mode, Light Mode" />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={3} maxLength={2000} placeholder="Theme description" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default UserThemes;
