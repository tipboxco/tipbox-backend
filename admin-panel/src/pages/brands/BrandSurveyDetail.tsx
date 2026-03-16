import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  Card,
  Descriptions,
  Space,
  Alert,
  Button,
  Modal,
  Form,
  Input,
  Select,
  Tag,
  Table,
  Empty,
  Spin,
  List,
  message,
  Popconfirm,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  FormOutlined,
  PlusOutlined,
  DeleteOutlined,
  QuestionCircleOutlined,
  MessageOutlined,
} from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';
import { type StatItemData } from '../../components/StatItem';
import {
  fetchBrandSurvey,
  fetchBrandSurveyResponses,
  addSurveyQuestion,
  deleteSurveyQuestion,
  closeBrandSurvey,
} from '../../api/admin-brands';
import type {
  AdminBrandSurveyDetailResponse,
  AdminBrandSurveyResponsesResponse,
} from '../../api/admin-brands';
import { TABLE_COLUMN_WIDTHS, TABLE_SCROLL_CONFIGS } from '../../constants/table-widths';

type SurveyQuestion = AdminBrandSurveyDetailResponse['questions'][number];

function BrandSurveyDetail() {
  const { id } = useParams<{ id: string }>();
  const [survey, setSurvey] = useState<AdminBrandSurveyDetailResponse | null>(null);
  const [responses, setResponses] = useState<AdminBrandSurveyResponsesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingResponses, setLoadingResponses] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addQuestionOpen, setAddQuestionOpen] = useState(false);
  const [form] = Form.useForm();
  const [questionType, setQuestionType] = useState<string>('TEXT');
  const [options, setOptions] = useState<Array<{ id: string; text: string }>>([]);

  const loadSurvey = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await fetchBrandSurvey(id);
      if (res.data) setSurvey(res.data);
      else setError('Survey not found');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load survey');
    } finally {
      setLoading(false);
    }
  }, [id]);

  const loadResponses = useCallback(async () => {
    if (!id) return;
    setLoadingResponses(true);
    try {
      const res = await fetchBrandSurveyResponses(id, { limit: 100, offset: 0 });
      if (res.data) setResponses(res.data);
    } catch (e) {
      console.error('Failed to load responses:', e);
    } finally {
      setLoadingResponses(false);
    }
  }, [id]);

  useEffect(() => {
    loadSurvey();
  }, [loadSurvey]);

  useEffect(() => {
    if (survey) loadResponses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [survey?.id]);

  const handleAddQuestion = async (values: { questionText: string; type: string }) => {
    if (!id) return;
    try {
      const questionData = {
        questionText: values.questionText,
        type: values.type,
        options:
          (values.type === 'SINGLE_CHOICE' || values.type === 'MULTIPLE_CHOICE') &&
          options.length > 0
            ? options
            : null,
      };
      await addSurveyQuestion(id, questionData);
      message.success('Question added successfully');
      setAddQuestionOpen(false);
      form.resetFields();
      setOptions([]);
      setQuestionType('TEXT');
      loadSurvey();
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Failed to add question');
    }
  };

  const handleDeleteQuestion = async (questionId: string) => {
    if (!id) return;
    try {
      await deleteSurveyQuestion(id, questionId);
      message.success('Question deleted successfully');
      loadSurvey();
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Failed to delete question');
    }
  };

  const handleClose = () => {
    if (!id || !survey) return;
    Modal.confirm({
      title: 'Close Survey',
      content: `Are you sure you want to close "${survey.title}"? Users will no longer be able to respond.`,
      okText: 'Close Survey',
      okType: 'danger',
      onOk: async () => {
        try {
          await closeBrandSurvey(id);
          message.success('Survey closed successfully');
          loadSurvey();
        } catch (e) {
          message.error(e instanceof Error ? e.message : 'Failed to close survey');
        }
      },
    });
  };

  const addOption = () => {
    const newId = `opt_${Date.now()}`;
    setOptions((prev) => [...prev, { id: newId, text: '' }]);
  };

  const removeOption = (optionId: string) => {
    setOptions((prev) => prev.filter((o) => o.id !== optionId));
  };

  const updateOptionText = (optionId: string, text: string) => {
    setOptions((prev) => prev.map((o) => (o.id === optionId ? { ...o, text } : o)));
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

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (error || !survey) {
    return (
      <div>
        <PageHeader
          title="Survey Details"
          icon={<FormOutlined />}
          backTo="/brands/surveys"
        />
        <Alert
          message="Error"
          description={error ?? 'Survey not found'}
          type="error"
          showIcon
        />
      </div>
    );
  }

  const statsData: StatItemData[] = [
    {
      label: 'Questions',
      value: survey.questionCount,
      icon: <QuestionCircleOutlined />,
    },
    {
      label: 'Responses',
      value: survey.responseCount,
      icon: <MessageOutlined />,
    },
  ];

  const questionColumns: ColumnsType<SurveyQuestion> = [
    {
      title: '#',
      key: 'index',
      width: 50,
      render: (_, __, index) => index + 1,
    },
    {
      title: 'Question',
      dataIndex: 'questionText',
      key: 'questionText',
      width: TABLE_COLUMN_WIDTHS.VERY_LONG_TEXT,
      ellipsis: true,
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      width: TABLE_COLUMN_WIDTHS.MEDIUM_TEXT,
      render: (type: string) => {
        const colorMap: Record<string, string> = {
          TEXT: 'blue',
          SINGLE_CHOICE: 'green',
          MULTIPLE_CHOICE: 'orange',
        };
        return <Tag color={colorMap[type] ?? 'default'}>{type}</Tag>;
      },
    },
    {
      title: 'Options',
      key: 'options',
      width: TABLE_COLUMN_WIDTHS.VERY_LONG_TEXT,
      render: (_, record) => {
        if (!record.options || record.options.length === 0) return '—';
        return (
          <Space size={[0, 4]} wrap>
            {record.options.map((opt) => (
              <Tag key={opt.id}>{opt.text}</Tag>
            ))}
          </Space>
        );
      },
    },
    {
      title: 'Answers',
      dataIndex: 'answerCount',
      key: 'answerCount',
      width: TABLE_COLUMN_WIDTHS.NUMBER_SMALL,
      align: 'right',
    },
    {
      title: '',
      key: 'action',
      width: TABLE_COLUMN_WIDTHS.ACTION_BUTTON,
      render: (_, record) => (
        <Popconfirm
          title="Delete question?"
          description={
            record.answerCount > 0
              ? 'This question has answers and cannot be deleted.'
              : 'This action cannot be undone.'
          }
          onConfirm={() => handleDeleteQuestion(record.id)}
          okButtonProps={{ disabled: record.answerCount > 0 }}
          okText="Delete"
          cancelText="Cancel"
        >
          <Button
            size="small"
            type="text"
            danger
            icon={<DeleteOutlined />}
            disabled={record.answerCount > 0}
          />
        </Popconfirm>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title={survey.title}
        description={survey.brandName}
        icon={<FormOutlined />}
        backTo="/brands/surveys"
        stats={statsData}
        actions={
          <Space>
            {survey.status === 'ACTIVE' && (
              <Button danger onClick={handleClose}>
                Close Survey
              </Button>
            )}
          </Space>
        }
      />

      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* Survey Information */}
        <Card title="Survey Information">
          <Descriptions column={{ xs: 1, sm: 2, md: 2, lg: 2 }} bordered size="small">
            <Descriptions.Item label="Status">
              {getStatusTag(survey.status)}
            </Descriptions.Item>
            <Descriptions.Item label="Brand">{survey.brandName}</Descriptions.Item>
            <Descriptions.Item label="Starts At">
              {new Date(survey.startsAt).toLocaleString('en-US')}
            </Descriptions.Item>
            <Descriptions.Item label="Ends At">
              {new Date(survey.endsAt).toLocaleString('en-US')}
            </Descriptions.Item>
            {survey.description && (
              <Descriptions.Item label="Description" span={2}>
                {survey.description}
              </Descriptions.Item>
            )}
            <Descriptions.Item label="Created">
              {new Date(survey.createdAt).toLocaleString('en-US')}
            </Descriptions.Item>
            <Descriptions.Item label="Updated">
              {new Date(survey.updatedAt).toLocaleString('en-US')}
            </Descriptions.Item>
          </Descriptions>
        </Card>

        {/* Questions */}
        <Card
          title="Questions"
          extra={
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setAddQuestionOpen(true)}
            >
              Add Question
            </Button>
          }
        >
          {survey.questions.length === 0 ? (
            <Empty description="No questions yet" />
          ) : (
            <Table
              columns={questionColumns}
              dataSource={survey.questions}
              rowKey="id"
              pagination={false}
              scroll={TABLE_SCROLL_CONFIGS.AUTO}
            />
          )}
        </Card>

        {/* Responses */}
        <Card title={`Responses (${survey.responseCount})`}>
          {loadingResponses ? (
            <div style={{ textAlign: 'center', padding: '20px' }}>
              <Spin />
            </div>
          ) : !responses || responses.questions.length === 0 ? (
            <Empty description="No responses yet" />
          ) : (
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              {responses.questions.map((question) => (
                <Card
                  key={question.id}
                  size="small"
                  title={question.questionText}
                  extra={<Tag>{question.type}</Tag>}
                >
                  {question.answers.length === 0 ? (
                    <Empty description="No answers" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                  ) : (
                    <List
                      size="small"
                      dataSource={question.answers}
                      renderItem={(answer) => (
                        <List.Item>
                          <List.Item.Meta
                            title={answer.username ?? 'Anonymous'}
                            description={answer.answerText}
                          />
                          <span style={{ color: 'var(--ant-color-text-secondary)', fontSize: 12 }}>
                            {new Date(answer.createdAt).toLocaleString('en-US')}
                          </span>
                        </List.Item>
                      )}
                    />
                  )}
                </Card>
              ))}
            </Space>
          )}
        </Card>
      </Space>

      {/* Add Question Modal */}
      <Modal
        title="Add Question"
        open={addQuestionOpen}
        onCancel={() => {
          setAddQuestionOpen(false);
          form.resetFields();
          setOptions([]);
          setQuestionType('TEXT');
        }}
        onOk={() => form.submit()}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleAddQuestion}>
          <Form.Item
            name="questionText"
            label="Question Text"
            rules={[{ required: true, message: 'Please enter question text' }]}
          >
            <Input.TextArea rows={2} placeholder="Enter your question..." />
          </Form.Item>
          <Form.Item
            name="type"
            label="Question Type"
            rules={[{ required: true, message: 'Please select question type' }]}
            initialValue="TEXT"
          >
            <Select
              onChange={(value: string) => setQuestionType(value)}
              options={[
                { label: 'Text', value: 'TEXT' },
                { label: 'Single Choice', value: 'SINGLE_CHOICE' },
                { label: 'Multiple Choice', value: 'MULTIPLE_CHOICE' },
              ]}
            />
          </Form.Item>

          {(questionType === 'SINGLE_CHOICE' || questionType === 'MULTIPLE_CHOICE') && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ marginBottom: 8, fontWeight: 500 }}>Options</div>
              {options.map((option, index) => (
                <Space
                  key={option.id}
                  style={{ display: 'flex', marginBottom: 8 }}
                  align="center"
                >
                  <Input
                    placeholder={`Option ${index + 1}`}
                    value={option.text}
                    onChange={(e) => updateOptionText(option.id, e.target.value)}
                    style={{ width: 400 }}
                  />
                  <Button
                    size="small"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => removeOption(option.id)}
                  />
                </Space>
              ))}
              <Button type="dashed" onClick={addOption} block icon={<PlusOutlined />}>
                Add Option
              </Button>
            </div>
          )}
        </Form>
      </Modal>
    </div>
  );
}

export default BrandSurveyDetail;
