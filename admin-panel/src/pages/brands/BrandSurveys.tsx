import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
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
  DatePicker,
  message,
} from 'antd';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import {
  FormOutlined,
  SearchOutlined,
  PlusOutlined,
  EyeOutlined,
  CloseCircleOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';
import { type StatItemData } from '../../components/StatItem';
import {
  fetchBrandSurveyStats,
  fetchBrandSurveys,
  createBrandSurvey,
  closeBrandSurvey,
  fetchBrands,
} from '../../api/admin-brands';
import type {
  AdminBrandSurveyStatsResponse,
  AdminBrandSurveyListItem,
  CreateBrandSurveyInput,
} from '../../api/admin-brands';
import { TABLE_COLUMN_WIDTHS, TABLE_SCROLL_CONFIGS } from '../../constants/table-widths';

const PAGE_SIZE = 20;

function BrandSurveys() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<AdminBrandSurveyStatsResponse | null>(null);
  const [surveys, setSurveys] = useState<AdminBrandSurveyListItem[]>([]);
  const [brands, setBrands] = useState<{ id: string; name: string }[]>([]);
  const [brandSearchLoading, setBrandSearchLoading] = useState(false);
  const brandSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
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
  const [form] = Form.useForm();
  const [questionType, setQuestionType] = useState<Record<number, string>>({});
  const [questionOptions, setQuestionOptions] = useState<
    Record<number, Array<{ id: string; text: string }>>
  >({});

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

  const searchBrands = useCallback(async (searchText: string) => {
    setBrandSearchLoading(true);
    try {
      const res = await fetchBrands({ search: searchText || undefined, limit: 50 });
      if (res.data) {
        setBrands(res.data.map((b) => ({ id: b.id, name: b.name })));
      }
    } catch (e) {
      console.error('Failed to load brands:', e);
    } finally {
      setBrandSearchLoading(false);
    }
  }, []);

  const handleBrandSearch = useCallback(
    (value: string) => {
      if (brandSearchTimer.current) clearTimeout(brandSearchTimer.current);
      brandSearchTimer.current = setTimeout(() => {
        searchBrands(value);
      }, 300);
    },
    [searchBrands],
  );

  useEffect(() => {
    searchBrands('');
  }, [searchBrands]);

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

  const handleCreate = async (values: {
    brandId: string;
    title: string;
    description?: string;
    dateRange: [unknown, unknown];
    questions?: Array<{ questionText: string; type: string }>;
  }) => {
    try {
      const questions = (values.questions ?? []).map((q, index) => ({
        questionText: q.questionText,
        type: q.type,
        options: questionOptions[index]?.length ? questionOptions[index] : null,
      }));

      const data: CreateBrandSurveyInput = {
        brandId: values.brandId,
        title: values.title,
        description: values.description,
        startsAt: (values.dateRange[0] as { toISOString: () => string }).toISOString(),
        endsAt: (values.dateRange[1] as { toISOString: () => string }).toISOString(),
        questions,
      };

      await createBrandSurvey(data);
      message.success('Survey created successfully');
      setCreateModalOpen(false);
      form.resetFields();
      setQuestionType({});
      setQuestionOptions({});
      loadSurveys();
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Failed to create survey');
    }
  };

  const handleClose = async (surveyId: string, title: string) => {
    Modal.confirm({
      title: 'Close Survey',
      content: `Are you sure you want to close "${title}"? Users will no longer be able to respond.`,
      okText: 'Close Survey',
      okType: 'danger',
      onOk: async () => {
        try {
          await closeBrandSurvey(surveyId);
          message.success('Survey closed successfully');
          loadSurveys();
        } catch (e) {
          message.error(e instanceof Error ? e.message : 'Failed to close survey');
        }
      },
    });
  };

  const getStatusTag = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return <Tag color="green">Active</Tag>;
      case 'UPCOMING':
        return <Tag color="blue">Upcoming</Tag>;
      case 'ENDED':
        return <Tag color="default">Ended</Tag>;
      default:
        return <Tag>{status}</Tag>;
    }
  };

  const addOptionToQuestion = (fieldIndex: number) => {
    const newId = `opt_${Date.now()}`;
    setQuestionOptions((prev) => ({
      ...prev,
      [fieldIndex]: [...(prev[fieldIndex] ?? []), { id: newId, text: '' }],
    }));
  };

  const removeOptionFromQuestion = (fieldIndex: number, optionId: string) => {
    setQuestionOptions((prev) => ({
      ...prev,
      [fieldIndex]: (prev[fieldIndex] ?? []).filter((o) => o.id !== optionId),
    }));
  };

  const updateQuestionOptionText = (fieldIndex: number, optionId: string, text: string) => {
    setQuestionOptions((prev) => ({
      ...prev,
      [fieldIndex]: (prev[fieldIndex] ?? []).map((o) =>
        o.id === optionId ? { ...o, text } : o,
      ),
    }));
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
      width: TABLE_COLUMN_WIDTHS.LONG_TEXT_FLEXIBLE,
      ellipsis: true,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: TABLE_COLUMN_WIDTHS.SHORT_TEXT,
      align: 'center',
      render: (status: string) => getStatusTag(status),
    },
    {
      title: 'Questions',
      dataIndex: 'questionCount',
      key: 'questionCount',
      width: TABLE_COLUMN_WIDTHS.NUMBER_SMALL,
      align: 'right',
    },
    {
      title: 'Responses',
      dataIndex: 'responseCount',
      key: 'responseCount',
      width: TABLE_COLUMN_WIDTHS.NUMBER_SMALL,
      align: 'right',
    },
    {
      title: 'Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: TABLE_COLUMN_WIDTHS.DATE_SHORT,
      ellipsis: true,
      render: (date: string) => (date ? new Date(date).toLocaleDateString('en-US') : '—'),
    },
    {
      title: '',
      key: 'action',
      width: TABLE_COLUMN_WIDTHS.ACTION_BUTTONS,
      render: (_, record) => (
        <Space size="small">
          <Button
            size="small"
            type="link"
            icon={<EyeOutlined />}
            onClick={() => navigate(`/brands/surveys/${record.id}`)}
          >
            View
          </Button>
          {record.status === 'ACTIVE' && (
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

      <Card>
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
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setCreateModalOpen(true)}
            >
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
            scroll={TABLE_SCROLL_CONFIGS.AUTO}
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
          setQuestionType({});
          setQuestionOptions({});
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
              filterOption={false}
              onSearch={handleBrandSearch}
              loading={brandSearchLoading}
              notFoundContent={brandSearchLoading ? 'Searching...' : 'No brands found'}
              options={brands.map((b) => ({ label: b.name, value: b.id }))}
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
          <Form.Item
            name="dateRange"
            label="Date Range"
            rules={[{ required: true, message: 'Please select date range' }]}
          >
            <DatePicker.RangePicker showTime style={{ width: '100%' }} />
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
                          name={[field.name, 'type']}
                          rules={[{ required: true, message: 'Select type' }]}
                          style={{ marginBottom: 0 }}
                          initialValue="TEXT"
                        >
                          <Select
                            placeholder="Type"
                            style={{ width: 160 }}
                            onChange={(value: string) =>
                              setQuestionType((prev) => ({ ...prev, [index]: value }))
                            }
                            options={[
                              { label: 'Text', value: 'TEXT' },
                              { label: 'Single Choice', value: 'SINGLE_CHOICE' },
                              { label: 'Multiple Choice', value: 'MULTIPLE_CHOICE' },
                            ]}
                          />
                        </Form.Item>
                        <Button
                          size="small"
                          danger
                          icon={<DeleteOutlined />}
                          onClick={() => {
                            remove(field.name);
                            setQuestionType((prev) => {
                              const next = { ...prev };
                              delete next[index];
                              return next;
                            });
                            setQuestionOptions((prev) => {
                              const next = { ...prev };
                              delete next[index];
                              return next;
                            });
                          }}
                        >
                          Remove
                        </Button>
                      </Space>

                      {(questionType[index] === 'SINGLE_CHOICE' ||
                        questionType[index] === 'MULTIPLE_CHOICE') && (
                        <div style={{ marginTop: 8 }}>
                          <div
                            style={{
                              marginBottom: 4,
                              fontSize: 12,
                              color: 'var(--ant-color-text-secondary)',
                            }}
                          >
                            Options
                          </div>
                          {(questionOptions[index] ?? []).map((option, optIndex) => (
                            <Space
                              key={option.id}
                              style={{ display: 'flex', marginBottom: 4 }}
                              align="center"
                            >
                              <Input
                                size="small"
                                placeholder={`Option ${optIndex + 1}`}
                                value={option.text}
                                onChange={(e) =>
                                  updateQuestionOptionText(index, option.id, e.target.value)
                                }
                                style={{ width: 300 }}
                              />
                              <Button
                                size="small"
                                danger
                                icon={<DeleteOutlined />}
                                onClick={() => removeOptionFromQuestion(index, option.id)}
                              />
                            </Space>
                          ))}
                          <Button
                            size="small"
                            type="dashed"
                            onClick={() => addOptionToQuestion(index)}
                            icon={<PlusOutlined />}
                            style={{ marginTop: 4 }}
                          >
                            Add Option
                          </Button>
                        </div>
                      )}
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
    </div>
  );
}

export default BrandSurveys;
