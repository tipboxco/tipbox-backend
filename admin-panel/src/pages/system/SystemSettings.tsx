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
  Select,
  Descriptions,
  message,
  Form,
  Switch,
  Tabs,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  SettingOutlined,
  SearchOutlined,
  EyeOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  FlagOutlined,
} from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';
import {
  fetchSystemSettings,
  fetchSystemSetting,
  createSystemSetting,
  updateSystemSetting,
  deleteSystemSetting,
  fetchFeatureFlags,
  updateFeatureFlag,
} from '../../api/admin-system';
import type {
  AdminSystemSettingListItem,
  AdminSystemSettingDetailResponse,
  CreateSystemSettingInput,
  UpdateSystemSettingInput,
  AdminFeatureFlagListItem,
  UpdateFeatureFlagInput,
} from '../../api/admin-system';
import { TABLE_COLUMN_WIDTHS, TABLE_SCROLL_CONFIGS } from '../../constants/table-widths';

function SystemSettings() {
  const [settings, setSettings] = useState<AdminSystemSettingListItem[]>([]);
  const [flags, setFlags] = useState<AdminFeatureFlagListItem[]>([]);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [loadingFlags, setLoadingFlags] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedSetting, setSelectedSetting] = useState<AdminSystemSettingDetailResponse | null>(
    null
  );
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();

  const loadSettings = async () => {
    setLoadingSettings(true);
    try {
      const res = await fetchSystemSettings({
        search: search || undefined,
        category: categoryFilter,
      });
      setSettings(res.data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load settings');
    } finally {
      setLoadingSettings(false);
    }
  };

  const loadFlags = async () => {
    setLoadingFlags(true);
    try {
      const res = await fetchFeatureFlags();
      setFlags(res.data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load feature flags');
    } finally {
      setLoadingFlags(false);
    }
  };

  useEffect(() => {
    loadSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, categoryFilter]);

  useEffect(() => {
    loadFlags();
  }, []);

  const openDetailModal = async (id: string) => {
    setLoadingDetail(true);
    setDetailModalOpen(true);
    try {
      const res = await fetchSystemSetting(id);
      setSelectedSetting(res.data);
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Failed to load setting details');
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleCreate = async (values: CreateSystemSettingInput) => {
    try {
      await createSystemSetting(values);
      message.success('Setting created successfully');
      setCreateModalOpen(false);
      createForm.resetFields();
      loadSettings();
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Failed to create setting');
    }
  };

  const handleEdit = async (values: UpdateSystemSettingInput) => {
    if (!selectedSetting) return;
    try {
      await updateSystemSetting(selectedSetting.id, values);
      message.success('Setting updated successfully');
      setEditModalOpen(false);
      editForm.resetFields();
      setSelectedSetting(null);
      loadSettings();
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Failed to update setting');
    }
  };

  const handleDelete = async (id: string) => {
    Modal.confirm({
      title: 'Delete Setting',
      content: 'Are you sure you want to delete this setting?',
      onOk: async () => {
        try {
          await deleteSystemSetting(id);
          message.success('Setting deleted successfully');
          loadSettings();
        } catch (e) {
          message.error(e instanceof Error ? e.message : 'Failed to delete setting');
        }
      },
    });
  };

  const openEditModal = (setting: AdminSystemSettingListItem) => {
    setSelectedSetting(setting);
    editForm.setFieldsValue({
      value: setting.value,
      description: setting.description,
      category: setting.category,
      isPublic: setting.isPublic,
    });
    setEditModalOpen(true);
  };

  const handleFlagToggle = async (flag: AdminFeatureFlagListItem, enabled: boolean) => {
    try {
      await updateFeatureFlag(flag.id, { isEnabled: enabled });
      message.success(`Feature flag ${enabled ? 'enabled' : 'disabled'}`);
      loadFlags();
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Failed to update feature flag');
    }
  };

  const handleRolloutChange = async (flag: AdminFeatureFlagListItem, percentage: number) => {
    try {
      await updateFeatureFlag(flag.id, { rolloutPercentage: percentage });
      message.success('Rollout percentage updated');
      loadFlags();
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Failed to update rollout percentage');
    }
  };

  const settingColumns: ColumnsType<AdminSystemSettingListItem> = [
    {
      title: 'Key',
      dataIndex: 'key',
      key: 'key',
      width: TABLE_COLUMN_WIDTHS.MEDIUM_TEXT,
      ellipsis: true,
    },
    {
      title: 'Value',
      dataIndex: 'value',
      key: 'value',
      width: TABLE_COLUMN_WIDTHS.LONG_TEXT,
      ellipsis: true,
    },
    {
      title: 'Category',
      dataIndex: 'category',
      key: 'category',
      width: TABLE_COLUMN_WIDTHS.SHORT_TEXT,
      render: (text) => text ?? '—',
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      width: TABLE_COLUMN_WIDTHS.LONG_TEXT,
      ellipsis: true,
      render: (text) => text ?? '—',
    },
    {
      title: 'Public',
      dataIndex: 'isPublic',
      key: 'isPublic',
      width: TABLE_COLUMN_WIDTHS.SHORT_TEXT,
      align: 'center',
      render: (isPublic) =>
        isPublic ? <Tag color="green">Yes</Tag> : <Tag color="red">No</Tag>,
    },
    {
      title: 'Updated',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: TABLE_COLUMN_WIDTHS.DATE_SHORT,
      ellipsis: true,
      render: (date) => (date ? new Date(date).toLocaleDateString('en-US') : '—'),
    },
    {
      title: '',
      key: 'action',
      width: TABLE_COLUMN_WIDTHS.ACTION_BUTTON_TRIPLE,
      render: (_, record) => (
        <Space size="small">
          <Button
            size="small"
            type="text"
            icon={<EyeOutlined />}
            onClick={() => openDetailModal(record.id)}
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
            onClick={() => handleDelete(record.id)}
          />
        </Space>
      ),
    },
  ];

  const flagColumns: ColumnsType<AdminFeatureFlagListItem> = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      width: TABLE_COLUMN_WIDTHS.MEDIUM_TEXT,
      ellipsis: true,
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      width: TABLE_COLUMN_WIDTHS.LONG_TEXT,
      ellipsis: true,
      render: (text) => text ?? '—',
    },
    {
      title: 'Enabled',
      dataIndex: 'isEnabled',
      key: 'isEnabled',
      width: TABLE_COLUMN_WIDTHS.SHORT_TEXT,
      align: 'center',
      render: (enabled, record) => (
        <Switch
          checked={enabled}
          onChange={(checked) => handleFlagToggle(record, checked)}
        />
      ),
    },
    {
      title: 'Rollout %',
      dataIndex: 'rolloutPercentage',
      key: 'rolloutPercentage',
      width: TABLE_COLUMN_WIDTHS.SHORT_TEXT,
      align: 'right',
      render: (percentage, record) => (
        <Select
          value={percentage}
          onChange={(value) => handleRolloutChange(record, value)}
          style={{ width: 80 }}
          size="small"
        >
          <Select.Option value={0}>0%</Select.Option>
          <Select.Option value={10}>10%</Select.Option>
          <Select.Option value={25}>25%</Select.Option>
          <Select.Option value={50}>50%</Select.Option>
          <Select.Option value={75}>75%</Select.Option>
          <Select.Option value={100}>100%</Select.Option>
        </Select>
      ),
    },
    {
      title: 'Updated By',
      dataIndex: 'updatedBy',
      key: 'updatedBy',
      width: TABLE_COLUMN_WIDTHS.MEDIUM_TEXT,
      ellipsis: true,
      render: (text) => text ?? '—',
    },
    {
      title: 'Updated',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: TABLE_COLUMN_WIDTHS.DATE_SHORT,
      ellipsis: true,
      render: (date) => (date ? new Date(date).toLocaleDateString('en-US') : '—'),
    },
  ];

  const categories = Array.from(new Set(settings.map((s) => s.category).filter(Boolean)));

  return (
    <div>
      <PageHeader
        title="System Settings"
        description="Configure system settings and feature flags"
        icon={<SettingOutlined />}
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
        <Tabs
          defaultActiveKey="settings"
          items={[
            {
              key: 'settings',
              label: (
                <span>
                  <SettingOutlined />
                  System Settings
                </span>
              ),
              children: (
                <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                  <Row justify="space-between" align="middle">
                    <Space wrap>
                      <Input
                        placeholder="Search settings..."
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
                        style={{ width: 180 }}
                        allowClear
                      >
                        {categories.map((cat) => (
                          <Select.Option key={cat} value={cat}>
                            {cat}
                          </Select.Option>
                        ))}
                      </Select>
                    </Space>
                    <Button
                      type="primary"
                      icon={<PlusOutlined />}
                      onClick={() => setCreateModalOpen(true)}
                    >
                      Create Setting
                    </Button>
                  </Row>

                  <Table
                    columns={settingColumns}
                    dataSource={settings}
                    loading={loadingSettings}
                    rowKey="id"
                    pagination={false}
                    scroll={TABLE_SCROLL_CONFIGS.DEFAULT}
                    locale={{
                      emptyText: <Empty description="No settings found" />,
                    }}
                  />
                </Space>
              ),
            },
            {
              key: 'flags',
              label: (
                <span>
                  <FlagOutlined />
                  Feature Flags
                </span>
              ),
              children: (
                <Table
                  columns={flagColumns}
                  dataSource={flags}
                  loading={loadingFlags}
                  rowKey="id"
                  pagination={false}
                  scroll={TABLE_SCROLL_CONFIGS.DEFAULT}
                  locale={{
                    emptyText: <Empty description="No feature flags found" />,
                  }}
                />
              ),
            },
          ]}
        />
      </Card>

      {/* Detail Modal */}
      <Modal
        title="Setting Details"
        open={detailModalOpen}
        onCancel={() => {
          setDetailModalOpen(false);
          setSelectedSetting(null);
        }}
        footer={[
          <Button key="close" onClick={() => setDetailModalOpen(false)}>
            Close
          </Button>,
        ]}
        width={800}
      >
        {loadingDetail ? (
          <div style={{ textAlign: 'center', padding: '20px' }}>Loading...</div>
        ) : (
          selectedSetting && (
            <Descriptions bordered column={2} size="small">
              <Descriptions.Item label="Key" span={2}>
                {selectedSetting.key}
              </Descriptions.Item>
              <Descriptions.Item label="Value" span={2}>
                {selectedSetting.value}
              </Descriptions.Item>
              <Descriptions.Item label="Description" span={2}>
                {selectedSetting.description ?? '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Category">
                {selectedSetting.category ?? '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Public">
                {selectedSetting.isPublic ? (
                  <Tag color="green">Yes</Tag>
                ) : (
                  <Tag color="red">No</Tag>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="Updated By">
                {selectedSetting.updatedBy ?? '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Created">
                {new Date(selectedSetting.createdAt).toLocaleString('en-US')}
              </Descriptions.Item>
              <Descriptions.Item label="Updated">
                {new Date(selectedSetting.updatedAt).toLocaleString('en-US')}
              </Descriptions.Item>
              {selectedSetting.metadata && Object.keys(selectedSetting.metadata).length > 0 && (
                <Descriptions.Item label="Metadata" span={2}>
                  <pre style={{ margin: 0, fontSize: '12px' }}>
                    {JSON.stringify(selectedSetting.metadata, null, 2)}
                  </pre>
                </Descriptions.Item>
              )}
            </Descriptions>
          )
        )}
      </Modal>

      {/* Create Modal */}
      <Modal
        title="Create Setting"
        open={createModalOpen}
        onCancel={() => {
          setCreateModalOpen(false);
          createForm.resetFields();
        }}
        onOk={() => createForm.submit()}
        width={600}
      >
        <Form form={createForm} layout="vertical" onFinish={handleCreate}>
          <Form.Item
            name="key"
            label="Key"
            rules={[{ required: true, message: 'Please enter key' }]}
          >
            <Input placeholder="SETTING_NAME" />
          </Form.Item>
          <Form.Item
            name="value"
            label="Value"
            rules={[{ required: true, message: 'Please enter value' }]}
          >
            <Input.TextArea rows={3} placeholder="Setting value" />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={2} placeholder="Setting description" />
          </Form.Item>
          <Form.Item name="category" label="Category">
            <Input placeholder="e.g., system, feature, integration" />
          </Form.Item>
          <Form.Item name="isPublic" label="Public" valuePropName="checked" initialValue={false}>
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      {/* Edit Modal */}
      <Modal
        title="Edit Setting"
        open={editModalOpen}
        onCancel={() => {
          setEditModalOpen(false);
          editForm.resetFields();
          setSelectedSetting(null);
        }}
        onOk={() => editForm.submit()}
        width={600}
      >
        <Form form={editForm} layout="vertical" onFinish={handleEdit}>
          <Form.Item
            name="value"
            label="Value"
            rules={[{ required: true, message: 'Please enter value' }]}
          >
            <Input.TextArea rows={3} placeholder="Setting value" />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={2} placeholder="Setting description" />
          </Form.Item>
          <Form.Item name="category" label="Category">
            <Input placeholder="e.g., system, feature, integration" />
          </Form.Item>
          <Form.Item name="isPublic" label="Public" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default SystemSettings;
