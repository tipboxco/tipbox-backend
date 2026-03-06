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
  Switch,
  Tabs,
  message,
  Popconfirm,
  Tag,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  SettingOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SearchOutlined,
  ClockCircleOutlined,
  EnvironmentOutlined,
  AimOutlined,
} from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';
import { type StatItemData } from '../../components/StatItem';
import {
  fetchExperienceConfigStats,
  fetchDurations,
  createDuration,
  updateDuration,
  deleteDuration,
  fetchLocations,
  createLocation,
  updateLocation,
  deleteLocation,
  fetchPurposes,
  createPurpose,
  updatePurpose,
  deletePurpose,
  type ExperienceConfigStatsResponse,
  type ExperienceConfigItem,
} from '../../api/admin-experience-config';

const PAGE_SIZE = 20;

type ConfigType = 'durations' | 'locations' | 'purposes';

function ExperienceConfig() {
  const [stats, setStats] = useState<ExperienceConfigStatsResponse | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ConfigType>('durations');

  // Durations state
  const [durations, setDurations] = useState<ExperienceConfigItem[]>([]);
  const [durationsLoading, setDurationsLoading] = useState(true);
  const [durationsSearch, setDurationsSearch] = useState('');
  const [durationsTotal, setDurationsTotal] = useState(0);
  const [durationsPage, setDurationsPage] = useState(1);

  // Locations state
  const [locations, setLocations] = useState<ExperienceConfigItem[]>([]);
  const [locationsLoading, setLocationsLoading] = useState(true);
  const [locationsSearch, setLocationsSearch] = useState('');
  const [locationsTotal, setLocationsTotal] = useState(0);
  const [locationsPage, setLocationsPage] = useState(1);

  // Purposes state
  const [purposes, setPurposes] = useState<ExperienceConfigItem[]>([]);
  const [purposesLoading, setPurposesLoading] = useState(true);
  const [purposesSearch, setPurposesSearch] = useState('');
  const [purposesTotal, setPurposesTotal] = useState(0);
  const [purposesPage, setPurposesPage] = useState(1);

  // Modal state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createModalType, setCreateModalType] = useState<ConfigType>('durations');
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editModalType, setEditModalType] = useState<ConfigType>('durations');
  const [selectedItem, setSelectedItem] = useState<ExperienceConfigItem | null>(null);

  // Form state
  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();

  // Load stats
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchExperienceConfigStats();
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

  const reloadStats = async () => {
    try {
      const res = await fetchExperienceConfigStats();
      if (res.data) setStats(res.data);
    } catch {
      // silently ignore stats reload errors
    }
  };

  // Load durations
  const loadDurations = async (page = 1) => {
    setDurationsLoading(true);
    setError(null);
    try {
      const res = await fetchDurations({
        limit: PAGE_SIZE,
        offset: (page - 1) * PAGE_SIZE,
        search: durationsSearch || undefined,
      });
      setDurations(res.data ?? []);
      setDurationsTotal(res.pagination?.total ?? 0);
      setDurationsPage(page);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load durations');
    } finally {
      setDurationsLoading(false);
    }
  };

  useEffect(() => {
    loadDurations(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [durationsSearch]);

  // Load locations
  const loadLocations = async (page = 1) => {
    setLocationsLoading(true);
    setError(null);
    try {
      const res = await fetchLocations({
        limit: PAGE_SIZE,
        offset: (page - 1) * PAGE_SIZE,
        search: locationsSearch || undefined,
      });
      setLocations(res.data ?? []);
      setLocationsTotal(res.pagination?.total ?? 0);
      setLocationsPage(page);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load locations');
    } finally {
      setLocationsLoading(false);
    }
  };

  useEffect(() => {
    loadLocations(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationsSearch]);

  // Load purposes
  const loadPurposes = async (page = 1) => {
    setPurposesLoading(true);
    setError(null);
    try {
      const res = await fetchPurposes({
        limit: PAGE_SIZE,
        offset: (page - 1) * PAGE_SIZE,
        search: purposesSearch || undefined,
      });
      setPurposes(res.data ?? []);
      setPurposesTotal(res.pagination?.total ?? 0);
      setPurposesPage(page);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load purposes');
    } finally {
      setPurposesLoading(false);
    }
  };

  useEffect(() => {
    loadPurposes(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [purposesSearch]);

  // Toggle active handlers
  const handleToggleActive = async (type: ConfigType, record: ExperienceConfigItem, checked: boolean) => {
    try {
      if (type === 'durations') {
        await updateDuration(record.id, { isActive: checked });
      } else if (type === 'locations') {
        await updateLocation(record.id, { isActive: checked });
      } else {
        await updatePurpose(record.id, { isActive: checked });
      }
      message.success(`${record.name} ${checked ? 'activated' : 'deactivated'}`);
      reloadCurrentTab(type);
      reloadStats();
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Failed to update status');
    }
  };

  // Create handlers
  const openCreateModal = (type: ConfigType) => {
    setCreateModalType(type);
    createForm.resetFields();
    setCreateModalOpen(true);
  };

  const handleCreate = async (values: { name: string; isActive: boolean }) => {
    try {
      if (createModalType === 'durations') {
        await createDuration({ name: values.name.trim(), isActive: values.isActive });
      } else if (createModalType === 'locations') {
        await createLocation({ name: values.name.trim(), isActive: values.isActive });
      } else {
        await createPurpose({ name: values.name.trim(), isActive: values.isActive });
      }
      message.success(`${getTypeLabel(createModalType)} created successfully`);
      setCreateModalOpen(false);
      createForm.resetFields();
      reloadCurrentTab(createModalType);
      reloadStats();
    } catch (e) {
      message.error(e instanceof Error ? e.message : `Failed to create ${getTypeLabel(createModalType).toLowerCase()}`);
    }
  };

  // Edit handlers
  const openEditModal = (type: ConfigType, item: ExperienceConfigItem) => {
    setEditModalType(type);
    setSelectedItem(item);
    editForm.setFieldsValue({
      name: item.name,
      isActive: item.isActive,
    });
    setEditModalOpen(true);
  };

  const handleEdit = async (values: { name: string; isActive: boolean }) => {
    if (!selectedItem) return;
    try {
      if (editModalType === 'durations') {
        await updateDuration(selectedItem.id, { name: values.name.trim(), isActive: values.isActive });
      } else if (editModalType === 'locations') {
        await updateLocation(selectedItem.id, { name: values.name.trim(), isActive: values.isActive });
      } else {
        await updatePurpose(selectedItem.id, { name: values.name.trim(), isActive: values.isActive });
      }
      message.success(`${getTypeLabel(editModalType)} updated successfully`);
      setEditModalOpen(false);
      editForm.resetFields();
      setSelectedItem(null);
      reloadCurrentTab(editModalType);
      reloadStats();
    } catch (e) {
      message.error(e instanceof Error ? e.message : `Failed to update ${getTypeLabel(editModalType).toLowerCase()}`);
    }
  };

  // Delete handlers
  const handleDelete = async (type: ConfigType, id: string) => {
    try {
      if (type === 'durations') {
        await deleteDuration(id);
      } else if (type === 'locations') {
        await deleteLocation(id);
      } else {
        await deletePurpose(id);
      }
      message.success(`${getTypeLabel(type)} deleted successfully`);
      reloadCurrentTab(type);
      reloadStats();
    } catch (e) {
      message.error(e instanceof Error ? e.message : `Failed to delete ${getTypeLabel(type).toLowerCase()}`);
    }
  };

  const reloadCurrentTab = (type: ConfigType) => {
    if (type === 'durations') loadDurations(durationsPage);
    else if (type === 'locations') loadLocations(locationsPage);
    else loadPurposes(purposesPage);
  };

  const getTypeLabel = (type: ConfigType): string => {
    if (type === 'durations') return 'Duration';
    if (type === 'locations') return 'Location';
    return 'Purpose';
  };

  const buildColumns = (type: ConfigType): ColumnsType<ExperienceConfigItem> => [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      width: 250,
      ellipsis: true,
    },
    {
      title: 'Active',
      dataIndex: 'isActive',
      key: 'isActive',
      width: 100,
      align: 'center',
      render: (isActive, record) => (
        <Switch
          checked={isActive}
          onChange={(checked) => handleToggleActive(type, record, checked)}
        />
      ),
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
      title: 'Inventories',
      dataIndex: 'inventoriesCount',
      key: 'inventoriesCount',
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
            onClick={() => openEditModal(type, record)}
            title={`Edit ${getTypeLabel(type).toLowerCase()}`}
          />
          <Popconfirm
            title={`Delete ${getTypeLabel(type)}`}
            description={`Delete "${record.name}"?`}
            onConfirm={() => handleDelete(type, record.id)}
            okText="Delete"
            okType="danger"
          >
            <Button
              size="small"
              type="text"
              danger
              icon={<DeleteOutlined />}
              title={`Delete ${getTypeLabel(type).toLowerCase()}`}
            />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const statsData: StatItemData[] | undefined = stats
    ? [
        {
          label: 'Durations',
          value: `${stats.durations.active}/${stats.durations.total}`,
          icon: <ClockCircleOutlined />,
        },
        {
          label: 'Locations',
          value: `${stats.locations.active}/${stats.locations.total}`,
          icon: <EnvironmentOutlined />,
          valueColor: '#1890ff',
        },
        {
          label: 'Purposes',
          value: `${stats.purposes.active}/${stats.purposes.total}`,
          icon: <AimOutlined />,
          valueColor: '#52c41a',
        },
      ]
    : undefined;

  const buildTabContent = (
    type: ConfigType,
    data: ExperienceConfigItem[],
    loading: boolean,
    search: string,
    setSearch: (val: string) => void,
    total: number,
    page: number,
    loadFn: (page?: number) => Promise<void>,
    label: string,
  ) => (
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
          placeholder={`Search ${label.toLowerCase()}`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          prefix={<SearchOutlined />}
          style={{ width: 250 }}
          allowClear
        />
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => openCreateModal(type)}
        >
          Create {label}
        </Button>
      </div>
      <Table
        columns={buildColumns(type)}
        dataSource={data}
        rowKey="id"
        loading={loading}
        pagination={{
          current: page,
          pageSize: PAGE_SIZE,
          total,
          showSizeChanger: false,
          showTotal: (total) => `Total ${total} ${label.toLowerCase()}s`,
          onChange: loadFn,
        }}
        locale={{
          emptyText: <Empty description={`No ${label.toLowerCase()}s found`} />,
        }}
      />
    </>
  );

  return (
    <div>
      <PageHeader
        title="Experience Config"
        description="Manage experience duration, location, and purpose options"
        icon={<SettingOutlined />}
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
          onChange={(key) => setActiveTab(key as ConfigType)}
          items={[
            {
              key: 'durations',
              label: (
                <Space>
                  <ClockCircleOutlined />
                  Durations
                </Space>
              ),
              children: buildTabContent(
                'durations',
                durations,
                durationsLoading,
                durationsSearch,
                setDurationsSearch,
                durationsTotal,
                durationsPage,
                loadDurations,
                'Duration',
              ),
            },
            {
              key: 'locations',
              label: (
                <Space>
                  <EnvironmentOutlined />
                  Locations
                </Space>
              ),
              children: buildTabContent(
                'locations',
                locations,
                locationsLoading,
                locationsSearch,
                setLocationsSearch,
                locationsTotal,
                locationsPage,
                loadLocations,
                'Location',
              ),
            },
            {
              key: 'purposes',
              label: (
                <Space>
                  <AimOutlined />
                  Purposes
                </Space>
              ),
              children: buildTabContent(
                'purposes',
                purposes,
                purposesLoading,
                purposesSearch,
                setPurposesSearch,
                purposesTotal,
                purposesPage,
                loadPurposes,
                'Purpose',
              ),
            },
          ]}
        />
      </Card>

      {/* Create Modal */}
      <Modal
        title={`Create ${getTypeLabel(createModalType)}`}
        open={createModalOpen}
        onCancel={() => {
          setCreateModalOpen(false);
          createForm.resetFields();
        }}
        onOk={() => createForm.submit()}
        okText="Create"
        width={500}
      >
        <Form
          form={createForm}
          layout="vertical"
          onFinish={handleCreate}
          initialValues={{ isActive: true }}
        >
          <Form.Item
            name="name"
            label="Name"
            rules={[
              { required: true, message: 'Please enter a name' },
              { min: 1, max: 200, message: 'Name must be 1-200 characters' },
            ]}
          >
            <Input placeholder={`${getTypeLabel(createModalType)} name`} />
          </Form.Item>

          <Form.Item name="isActive" label="Active" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      {/* Edit Modal */}
      <Modal
        title={`Edit ${getTypeLabel(editModalType)}`}
        open={editModalOpen}
        onCancel={() => {
          setEditModalOpen(false);
          editForm.resetFields();
          setSelectedItem(null);
        }}
        onOk={() => editForm.submit()}
        okText="Update"
        width={500}
      >
        <Form form={editForm} layout="vertical" onFinish={handleEdit}>
          <Form.Item
            name="name"
            label="Name"
            rules={[
              { required: true, message: 'Please enter a name' },
              { min: 1, max: 200, message: 'Name must be 1-200 characters' },
            ]}
          >
            <Input placeholder={`${getTypeLabel(editModalType)} name`} />
          </Form.Item>

          <Form.Item name="isActive" label="Active" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default ExperienceConfig;
