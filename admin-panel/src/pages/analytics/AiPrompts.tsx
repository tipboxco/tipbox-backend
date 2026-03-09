import { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Table,
  Tag,
  Space,
  Button,
  Modal,
  Form,
  Input,
  Switch,
  Empty,
  Alert,
  Typography,
  Tooltip,
  Timeline,
  message,
  Popconfirm,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  RobotOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  HistoryOutlined,
  ReloadOutlined,
  CopyOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';
import { type StatItemData } from '../../components/StatItem';
import {
  fetchAiPromptStats,
  fetchAiPrompts,
  fetchAiPromptDetail,
  fetchAiPromptVersionDetail,
  createAiPrompt,
  updateAiPrompt,
  restoreAiPromptVersion,
  deleteAiPrompt,
  type AiPromptStatsResponse,
  type AiPromptListItem,
  type AiPromptDetail,
  type AiPromptVersionDetail,
} from '../../api/admin-ai-prompts';

const { TextArea } = Input;
const { Text, Paragraph } = Typography;

const PAGE_SIZE = 20;

function AiPrompts() {
  const [stats, setStats] = useState<AiPromptStatsResponse | null>(null);
  const [prompts, setPrompts] = useState<AiPromptListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingStats, setLoadingStats] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);

  // Create modal
  const [createOpen, setCreateOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createForm] = Form.useForm();

  // Edit modal
  const [editOpen, setEditOpen] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editForm] = Form.useForm();
  const [editingPrompt, setEditingPrompt] = useState<AiPromptDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Version detail modal
  const [versionOpen, setVersionOpen] = useState(false);
  const [versionDetail, setVersionDetail] = useState<AiPromptVersionDetail | null>(null);
  const [versionLoading, setVersionLoading] = useState(false);

  const loadStats = useCallback(async () => {
    try {
      const res = await fetchAiPromptStats();
      if (res.data) setStats(res.data);
    } catch (e) {
      console.error('Failed to load stats', e);
    } finally {
      setLoadingStats(false);
    }
  }, []);

  const loadPrompts = useCallback(async (page = 1) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchAiPrompts({ limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE });
      setPrompts(res.data ?? []);
      setTotal(res.pagination?.total ?? 0);
      setCurrentPage(page);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load AI prompts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
    loadPrompts(1);
  }, [loadStats, loadPrompts]);

  // ==================== Create ====================

  const handleCreate = async () => {
    try {
      const values = await createForm.validateFields();
      setCreateLoading(true);
      await createAiPrompt(values);
      message.success('AI prompt template created successfully');
      setCreateOpen(false);
      createForm.resetFields();
      loadPrompts(1);
      loadStats();
    } catch (e) {
      if (e instanceof Error) message.error(e.message);
    } finally {
      setCreateLoading(false);
    }
  };

  // ==================== Edit ====================

  const openEdit = async (id: string) => {
    setEditOpen(true);
    setDetailLoading(true);
    try {
      const res = await fetchAiPromptDetail(id);
      if (res.data) {
        setEditingPrompt(res.data);
        editForm.setFieldsValue({
          name: res.data.name,
          description: res.data.description,
          promptText: res.data.promptText,
          isActive: res.data.isActive,
          changeNote: '',
        });
      }
    } catch (e) {
      message.error('Failed to load prompt details');
      setEditOpen(false);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleEdit = async () => {
    if (!editingPrompt) return;
    try {
      const values = await editForm.validateFields();
      setEditLoading(true);
      await updateAiPrompt(editingPrompt.id, values);
      message.success('AI prompt template updated successfully');
      setEditOpen(false);
      setEditingPrompt(null);
      editForm.resetFields();
      loadPrompts(currentPage);
      loadStats();
    } catch (e) {
      if (e instanceof Error) message.error(e.message);
    } finally {
      setEditLoading(false);
    }
  };

  // ==================== Version ====================

  const openVersionDetail = async (versionId: string) => {
    setVersionOpen(true);
    setVersionLoading(true);
    try {
      const res = await fetchAiPromptVersionDetail(versionId);
      if (res.data) setVersionDetail(res.data);
    } catch (e) {
      message.error('Failed to load version detail');
      setVersionOpen(false);
    } finally {
      setVersionLoading(false);
    }
  };

  const handleRestore = async (templateId: string, versionId: string) => {
    try {
      await restoreAiPromptVersion(templateId, versionId);
      message.success('Prompt restored successfully');
      // Refresh the edit modal
      openEdit(templateId);
      loadPrompts(currentPage);
    } catch (e) {
      if (e instanceof Error) message.error(e.message);
    }
  };

  // ==================== Delete ====================

  const handleDelete = async (id: string) => {
    try {
      await deleteAiPrompt(id);
      message.success('AI prompt template deleted');
      loadPrompts(currentPage);
      loadStats();
    } catch (e) {
      if (e instanceof Error) message.error(e.message);
    }
  };

  // ==================== Columns ====================

  const columns: ColumnsType<AiPromptListItem> = [
    {
      title: 'Key',
      dataIndex: 'key',
      key: 'key',
      width: 180,
      render: (key) => (
        <Text code copyable={{ text: key }}>
          {key}
        </Text>
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
      title: 'Version',
      dataIndex: 'version',
      key: 'version',
      width: 100,
      render: (v) => <Tag color="blue">{v}</Tag>,
    },
    {
      title: 'Status',
      dataIndex: 'isActive',
      key: 'isActive',
      width: 100,
      render: (active) =>
        active ? (
          <Tag icon={<CheckCircleOutlined />} color="success">Active</Tag>
        ) : (
          <Tag icon={<CloseCircleOutlined />} color="default">Inactive</Tag>
        ),
    },
    {
      title: 'Preview',
      dataIndex: 'promptTextPreview',
      key: 'promptTextPreview',
      ellipsis: true,
      render: (text) => (
        <Tooltip title={text}>
          <Text type="secondary" style={{ fontSize: 12 }}>{text}</Text>
        </Tooltip>
      ),
    },
    {
      title: 'Updated',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: 110,
      render: (date) => new Date(date).toLocaleDateString(),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 120,
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="Edit">
            <Button type="text" size="small" icon={<EditOutlined />} onClick={() => openEdit(record.id)} />
          </Tooltip>
          <Popconfirm
            title="Delete this prompt template?"
            description="This will also delete all version history."
            onConfirm={() => handleDelete(record.id)}
            okText="Delete"
            okButtonProps={{ danger: true }}
          >
            <Tooltip title="Delete">
              <Button type="text" size="small" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const statsData: StatItemData[] | undefined = stats
    ? [
        { label: 'Total Prompts', value: stats.total, icon: <RobotOutlined /> },
        { label: 'Active', value: stats.active, icon: <CheckCircleOutlined />, valueStyle: { color: '#52c41a' } },
        { label: 'Inactive', value: stats.inactive, icon: <CloseCircleOutlined />, valueStyle: { color: '#d9d9d9' } },
        { label: 'Total Versions', value: stats.totalVersions, icon: <HistoryOutlined /> },
      ]
    : undefined;

  return (
    <div>
      <PageHeader
        title="Experience Prompts"
        description="Manage and version AI prompt templates used in experience splitting"
        icon={<RobotOutlined />}
        stats={statsData}
        statsLoading={loadingStats}
      />

      {error && (
        <Alert message="Error" description={error} type="error" closable onClose={() => setError(null)} style={{ marginBottom: 24 }} />
      )}

      <Card
        bordered
        title="Prompt Templates"
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={() => loadPrompts(currentPage)}>Refresh</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>New Prompt</Button>
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={prompts}
          rowKey="id"
          loading={loading}
          pagination={{
            current: currentPage,
            pageSize: PAGE_SIZE,
            total,
            showSizeChanger: false,
            showTotal: (total) => `Total ${total} templates`,
            onChange: loadPrompts,
          }}
          locale={{ emptyText: <Empty description="No AI prompt templates found" /> }}
        />
      </Card>

      {/* ==================== Create Modal ==================== */}
      <Modal
        title="Create AI Prompt Template"
        open={createOpen}
        onOk={handleCreate}
        onCancel={() => { setCreateOpen(false); createForm.resetFields(); }}
        confirmLoading={createLoading}
        width={800}
        okText="Create"
      >
        <Form form={createForm} layout="vertical">
          <Form.Item
            name="key"
            label="Key"
            rules={[
              { required: true, message: 'Key is required' },
              { pattern: /^[a-z0-9_-]+$/, message: 'Only lowercase letters, numbers, hyphens and underscores' },
            ]}
            extra="Unique identifier (e.g., split-experience). Used by the backend to load this prompt."
          >
            <Input placeholder="split-experience" />
          </Form.Item>
          <Form.Item name="name" label="Name" rules={[{ required: true }]}>
            <Input placeholder="Experience Split Prompt" />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <TextArea rows={2} placeholder="Describe what this prompt does..." />
          </Form.Item>
          <Form.Item
            name="promptText"
            label="Prompt Text"
            rules={[{ required: true, message: 'Prompt text is required' }]}
            extra="Use {{PRODUCT_INFO}} and {{EXPERIENCE_TEXT}} as placeholders for dynamic content."
          >
            <TextArea
              rows={16}
              placeholder="Enter the AI prompt text..."
              style={{ fontFamily: 'monospace', fontSize: 13 }}
            />
          </Form.Item>
          <Form.Item name="version" label="Version" initialValue="v1.0">
            <Input placeholder="v1.0" />
          </Form.Item>
          <Form.Item name="isActive" label="Active" valuePropName="checked" initialValue={true}>
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      {/* ==================== Edit Modal ==================== */}
      <Modal
        title={editingPrompt ? `Edit: ${editingPrompt.name}` : 'Edit Prompt'}
        open={editOpen}
        onOk={handleEdit}
        onCancel={() => { setEditOpen(false); setEditingPrompt(null); editForm.resetFields(); }}
        confirmLoading={editLoading}
        width={900}
        okText="Save Changes"
      >
        {detailLoading ? (
          <div style={{ textAlign: 'center', padding: 40 }}>Loading...</div>
        ) : (
          <>
            <Form form={editForm} layout="vertical">
              <Space style={{ marginBottom: 16 }}>
                <Tag color="blue">{editingPrompt?.key}</Tag>
                <Tag color="green">Current: {editingPrompt?.version}</Tag>
              </Space>
              <Form.Item name="name" label="Name" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
              <Form.Item name="description" label="Description">
                <TextArea rows={2} />
              </Form.Item>
              <Form.Item
                name="promptText"
                label="Prompt Text"
                rules={[{ required: true }]}
                extra="Changing the prompt text will auto-increment the version and save a version history entry."
              >
                <TextArea
                  rows={16}
                  style={{ fontFamily: 'monospace', fontSize: 13 }}
                />
              </Form.Item>
              <Form.Item
                name="changeNote"
                label="Change Note"
                extra="Optional: Describe what you changed"
              >
                <Input placeholder="e.g., Improved category separation rules" />
              </Form.Item>
              <Form.Item name="isActive" label="Active" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Form>

            {/* Version History */}
            {editingPrompt && editingPrompt.versions.length > 0 && (
              <Card
                size="small"
                title={<><HistoryOutlined /> Version History</>}
                style={{ marginTop: 16 }}
              >
                <Timeline
                  items={editingPrompt.versions.map((v) => ({
                    color: v.version === editingPrompt.version ? 'green' : 'gray',
                    children: (
                      <div key={v.id}>
                        <Space>
                          <Tag color={v.version === editingPrompt.version ? 'green' : 'default'}>
                            {v.version}
                          </Tag>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {new Date(v.createdAt).toLocaleString()}
                          </Text>
                          {v.changeNote && (
                            <Text style={{ fontSize: 12 }}>{v.changeNote}</Text>
                          )}
                        </Space>
                        <div style={{ marginTop: 4 }}>
                          <Space size="small">
                            <Button
                              type="link"
                              size="small"
                              icon={<EyeOutlined />}
                              onClick={() => openVersionDetail(v.id)}
                            >
                              View
                            </Button>
                            {v.version !== editingPrompt.version && (
                              <Popconfirm
                                title={`Restore version ${v.version}?`}
                                description="This will create a new version with the content from this version."
                                onConfirm={() => handleRestore(editingPrompt.id, v.id)}
                              >
                                <Button type="link" size="small" icon={<ReloadOutlined />}>
                                  Restore
                                </Button>
                              </Popconfirm>
                            )}
                          </Space>
                        </div>
                      </div>
                    ),
                  }))}
                />
              </Card>
            )}
          </>
        )}
      </Modal>

      {/* ==================== Version Detail Modal ==================== */}
      <Modal
        title={versionDetail ? `Version: ${versionDetail.version}` : 'Version Detail'}
        open={versionOpen}
        onCancel={() => { setVersionOpen(false); setVersionDetail(null); }}
        footer={[
          <Button key="copy" icon={<CopyOutlined />} onClick={() => {
            if (versionDetail) {
              navigator.clipboard.writeText(versionDetail.promptText);
              message.success('Prompt text copied to clipboard');
            }
          }}>
            Copy Prompt
          </Button>,
          <Button key="close" onClick={() => { setVersionOpen(false); setVersionDetail(null); }}>
            Close
          </Button>,
        ]}
        width={800}
      >
        {versionLoading ? (
          <div style={{ textAlign: 'center', padding: 40 }}>Loading...</div>
        ) : versionDetail ? (
          <div>
            <Space style={{ marginBottom: 16 }}>
              <Tag color="blue">{versionDetail.version}</Tag>
              <Text type="secondary">{new Date(versionDetail.createdAt).toLocaleString()}</Text>
            </Space>
            {versionDetail.changeNote && (
              <Paragraph type="secondary" style={{ marginBottom: 16 }}>
                <strong>Change Note:</strong> {versionDetail.changeNote}
              </Paragraph>
            )}
            <div
              style={{
                background: '#f5f5f5',
                padding: 16,
                borderRadius: 8,
                maxHeight: 500,
                overflow: 'auto',
                fontFamily: 'monospace',
                fontSize: 13,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {versionDetail.promptText}
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

export default AiPrompts;
