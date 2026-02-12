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
  message,
  List,
  Descriptions,
} from 'antd';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import {
  FormOutlined,
  SearchOutlined,
  PlusOutlined,
  EyeOutlined,
  CloseCircleOutlined,
  MinusCircleOutlined,
} from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';
import { type StatItemData } from '../../components/StatItem';
import {
  fetchBrandSurveyStats,
  fetchBrandSurveys,
  fetchBrandSurvey,
  createBrandSurvey,
  closeBrandSurvey,
  fetchBrandSurveyResponses,
  fetchBrands,
} from '../../api/admin-brands';
import type {
  AdminBrandSurveyStatsResponse,
  AdminBrandSurveyListItem,
  AdminBrandSurveyDetailResponse,
  CreateBrandSurveyInput,
  AdminBrandSurveyResponseListItem,
} from '../../api/admin-brands';
import { TABLE_COLUMN_WIDTHS, TABLE_SCROLL_CONFIGS } from '../../constants/table-widths';

const PAGE_SIZE = 20;

function BrandSurveys() {
  const [stats, setStats] = useState<AdminBrandSurveyStatsResponse | null>(null);
  const [surveys, setSurveys] = useState<AdminBrandSurveyListItem[]>([]);
  const [brands, setBrands] = useState<{ id: string; name: string }[]>([]);
  const [pagination, setPagination] = useState({
    total: 0,
    limit: PAGE_SIZE,
    offset: 0,
  });
  const [loading, setLoading] = useState(true);
  const [loadingList, setLoadingList] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [responsesModalOpen, setResponsesModalOpen] = useState(false);
  const [selectedSurvey, setSelectedSurvey] = useState<AdminBrandSurveyDetailResponse | null>(null);
  const [responses, setResponses] = useState<AdminBrandSurveyResponseListItem[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [loadingResponses, setLoadingResponses] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchBrandSurveyStats();
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
        const res = await fetchBrands({});
        if (!cancelled && res.data) {
          setBrands(res.data.map(b => ({ id: b.id, name: b.name })));
        }
      } catch (e) {
        console.error('Failed to load brands:', e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadSurveys = async () => {
    setLoadingList(true);
    try {
      const res = await fetchBrandSurveys({
        limit: PAGE_SIZE,
        offset: pagination.offset,
        search: search || undefined,
      });
      setSurveys(res.data ?? []);
      if (res.pagination) setPagination(res.pagination);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load surveys');
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    loadSurveys();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.offset, search]);

  const handleCreate = async (values: CreateBrandSurveyInput) => {
    try {
      await createBrandSurvey(values);
      message.success('Survey created successfully');
      setCreateModalOpen(false);
      form.resetFields();
      loadSurveys();
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Failed to create survey');
    }
  };

  const handleClose = async (id: string, title: string) => {
    Modal.confirm({
      title: 'Close Survey',
      content: `Are you sure you want to close "${title}"? Users will no longer be able to respond.`,
      okText: 'Close Survey',
      okType: 'danger',
      onOk: async () => {
        try {
          await closeBrandSurvey(id);
          message.success('Survey closed successfully');
          loadSurveys();
        } catch (e) {
          message.error(e instanceof Error ? e.message : 'Failed to close survey');
        }
      },
    });
  };

  const openDetailModal = async (id: string) => {
    setLoadingDetail(true);
    setDetailModalOpen(true);
    try {
      const res = await fetchBrandSurvey(id);
      setSelectedSurvey(res.data);
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Failed to load survey details');
    } finally {
      setLoadingDetail(false);
    }
  };

  const openResponsesModal = async (survey: AdminBrandSurveyListItem) => {
    setSelectedSurvey(survey as AdminBrandSurveyDetailResponse);
    setResponsesModalOpen(true);
    setLoadingResponses(true);
    try {
      const res = await fetchBrandSurveyResponses(survey.id, { limit: 100, offset: 0 });
      setResponses(res.data ?? []);
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Failed to load responses');
    } finally {
      setLoadingResponses(false);
    }
  };

  const columns: ColumnsType<AdminBrandSurveyListItem> = [
    {
      title: 'Brand',
      dataIndex: 'brandName',
      key: 'brandName',
      width: TABLE_COLUMN_WIDTHS.MEDIUM_TEXT,
      ellipsis: true,
    },
    {
      title: 'Title',
      dataIndex: 'title',
      key: 'title',
      width: TABLE_COLUMN_WIDTHS.LONG_TEXT,
      ellipsis: true,
    },
    {
      title: 'Status',
      dataIndex: 'isActive',
      key: 'isActive',
      width: TABLE_COLUMN_WIDTHS.SHORT_TEXT,
      align: 'center',
      render: (isActive) =>
        isActive ? <Tag color="green">Active</Tag> : <Tag color="gray">Closed</Tag>,
    },
    {
      title: 'Responses',
      dataIndex: 'responseCount',
      key: 'responseCount',
      width: TABLE_COLUMN_WIDTHS.SHORT_TEXT,
      align: 'right',
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
      title: 'Closed',
      dataIndex: 'closedAt',
      key: 'closedAt',
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
            icon={<FormOutlined />}
            onClick={() => openResponsesModal(record)}
          >
            {record.responseCount}
          </Button>
          {record.isActive && (
            <Button
              size="small"
              type="text"
              danger
              icon={<CloseCircleOutlined />}
              onClick={() => handleClose(record.id, record.title)}
            />
          )}
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
          label: 'Total Surveys',
          value: stats.total,
          icon: <FormOutlined />,
        },
        {
          label: 'Active',
          value: stats.active,
          icon: <FormOutlined />,
        },
        {
          label: 'Completed',
          value: stats.completed,
          icon: <FormOutlined />,
        },
        {
          label: 'Total Responses',
          value: stats.totalResponses,
          icon: <FormOutlined />,
        },
      ]
    : undefined;

  return (
    <div>
      <PageHeader
        title="Brand Surveys"
        description="Create and manage brand surveys"
        icon={<FormOutlined />}
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
            <Input
              placeholder="Search surveys..."
              prefix={<SearchOutlined />}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: 250 }}
              allowClear
            />
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalOpen(true)}>
              Create Survey
            </Button>
          </Row>

          <Table
            columns={columns}
            dataSource={surveys}
            loading={loadingList}
            rowKey="id"
            pagination={{
              current: currentPage,
              pageSize: PAGE_SIZE,
              total: pagination.total,
              showSizeChanger: false,
              showTotal: (total) => `Total ${total} surveys`,
            }}
            onChange={handleTableChange}
            scroll={TABLE_SCROLL_CONFIGS.DEFAULT}
            locale={{
              emptyText: <Empty description="No surveys found" />,
            }}
          />
        </Space>
      </Card>

      {/* Create Survey Modal */}
      <Modal
        title="Create Survey"
        open={createModalOpen}
        onCancel={() => {
          setCreateModalOpen(false);
          form.resetFields();
        }}
        onOk={() => form.submit()}
        width={700}
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item
            name="brandId"
            label="Brand"
            rules={[{ required: true, message: 'Please select a brand' }]}
          >
            <Select
              placeholder="Select brand"
              showSearch
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              options={brands.map(b => ({ label: b.name, value: b.id }))}
            />
          </Form.Item>
          <Form.Item
            name="title"
            label="Survey Title"
            rules={[{ required: true, message: 'Please enter survey title' }]}
          >
            <Input placeholder="e.g., Product Satisfaction Survey" />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={3} placeholder="Optional survey description" />
          </Form.Item>
          <Form.List name="questions">
            {(fields, { add, remove }) => (
              <>
                <div style={{ marginBottom: 8, fontWeight: 'bold' }}>Questions</div>
                {fields.map((field, index) => (
                  <Card key={field.key} size="small" style={{ marginBottom: 8 }}>
                    <Space direction="vertical" style={{ width: '100%' }}>
                      <Form.Item
                        {...field}
                        name={[field.name, 'questionText']}
                        rules={[{ required: true, message: 'Please enter question text' }]}
                        style={{ marginBottom: 8 }}
                      >
                        <Input placeholder={`Question ${index + 1}`} />
                      </Form.Item>
                      <Space>
                        <Form.Item
                          {...field}
                          name={[field.name, 'questionType']}
                          rules={[{ required: true, message: 'Select type' }]}
                          style={{ marginBottom: 0 }}
                        >
                          <Select placeholder="Type" style={{ width: 120 }}>
                            <Select.Option value="TEXT">Text</Select.Option>
                            <Select.Option value="RATING">Rating</Select.Option>
                            <Select.Option value="CHOICE">Choice</Select.Option>
                          </Select>
                        </Form.Item>
                        <Button
                          size="small"
                          danger
                          icon={<MinusCircleOutlined />}
                          onClick={() => remove(field.name)}
                        >
                          Remove
                        </Button>
                      </Space>
                    </Space>
                  </Card>
                ))}
                <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                  Add Question
                </Button>
              </>
            )}
          </Form.List>
        </Form>
      </Modal>

      {/* Detail Modal */}
      <Modal
        title="Survey Details"
        open={detailModalOpen}
        onCancel={() => {
          setDetailModalOpen(false);
          setSelectedSurvey(null);
        }}
        footer={[
          <Button key="close" onClick={() => setDetailModalOpen(false)}>
            Close
          </Button>,
        ]}
        width={700}
      >
        {loadingDetail ? (
          <div style={{ textAlign: 'center', padding: '20px' }}>Loading...</div>
        ) : (
          selectedSurvey && (
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <Descriptions bordered column={2} size="small">
                <Descriptions.Item label="Brand" span={2}>
                  {selectedSurvey.brandName}
                </Descriptions.Item>
                <Descriptions.Item label="Title" span={2}>
                  {selectedSurvey.title}
                </Descriptions.Item>
                {selectedSurvey.description && (
                  <Descriptions.Item label="Description" span={2}>
                    {selectedSurvey.description}
                  </Descriptions.Item>
                )}
                <Descriptions.Item label="Status">
                  {selectedSurvey.isActive ? (
                    <Tag color="green">Active</Tag>
                  ) : (
                    <Tag color="gray">Closed</Tag>
                  )}
                </Descriptions.Item>
                <Descriptions.Item label="Responses">
                  {selectedSurvey.responseCount}
                </Descriptions.Item>
                <Descriptions.Item label="Created">
                  {new Date(selectedSurvey.createdAt).toLocaleString('en-US')}
                </Descriptions.Item>
                {selectedSurvey.closedAt && (
                  <Descriptions.Item label="Closed">
                    {new Date(selectedSurvey.closedAt).toLocaleString('en-US')}
                  </Descriptions.Item>
                )}
              </Descriptions>

              {selectedSurvey.questions && selectedSurvey.questions.length > 0 && (
                <Card title="Questions" size="small">
                  <List
                    dataSource={selectedSurvey.questions}
                    renderItem={(question, index) => (
                      <List.Item>
                        <List.Item.Meta
                          title={`${index + 1}. ${question.questionText}`}
                          description={
                            <Space>
                              <Tag>{question.questionType}</Tag>
                              {question.options && question.options.length > 0 && (
                                <span>Options: {question.options.join(', ')}</span>
                              )}
                            </Space>
                          }
                        />
                      </List.Item>
                    )}
                  />
                </Card>
              )}
            </Space>
          )
        )}
      </Modal>

      {/* Responses Modal */}
      <Modal
        title={`Responses - ${selectedSurvey?.title}`}
        open={responsesModalOpen}
        onCancel={() => {
          setResponsesModalOpen(false);
          setSelectedSurvey(null);
          setResponses([]);
        }}
        footer={[
          <Button key="close" onClick={() => setResponsesModalOpen(false)}>
            Close
          </Button>,
        ]}
        width={900}
      >
        {loadingResponses ? (
          <div style={{ textAlign: 'center', padding: '20px' }}>Loading responses...</div>
        ) : responses.length === 0 ? (
          <Empty description="No responses yet" />
        ) : (
          <List
            dataSource={responses}
            renderItem={(response) => (
              <List.Item>
                <List.Item.Meta
                  title={`${response.username ?? response.userEmail ?? 'Anonymous'} - ${new Date(
                    response.createdAt
                  ).toLocaleString('en-US')}`}
                  description={
                    <div>
                      {Object.entries(response.answers as Record<string, string>).map(
                        ([questionId, answer]) => (
                          <div key={questionId} style={{ marginBottom: 4 }}>
                            <strong>Q{questionId}:</strong> {answer}
                          </div>
                        )
                      )}
                    </div>
                  }
                />
              </List.Item>
            )}
          />
        )}
      </Modal>
    </div>
  );
}

export default BrandSurveys;
