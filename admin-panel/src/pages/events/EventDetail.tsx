import { useState, useEffect, useCallback } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  Tabs,
  Button,
  Input,
  Select,
  InputNumber,
  Form,
  Space,
  Spin,
  Empty,
  Modal,
  Alert,
  Row,
  Col,
  Typography,
  Table,
  Tag,
  Image,
  Statistic,
  Descriptions,
  Checkbox,
  message as antdMessage,
} from 'antd';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import {
  ArrowLeftOutlined,
  EditOutlined,
  DeleteOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import {
  fetchEvent,
  updateEvent,
  deleteEvent,
  fetchEventParticipants,
  fetchEventAnalytics,
  fetchEventBadges,
  addEventBadge,
  updateEventBadge,
  removeEventBadge,
  fetchEventRewards,
} from '../../api/admin-events';
import type {
  AdminEventDetailResponse,
  AdminEventParticipantListItem,
  AdminEventAnalyticsResponse,
  AdminEventBadgeListItem,
  AdminEventRewardListItem,
} from '../../types/admin';
import { FORM_LAYOUT_VERTICAL } from '../../constants/form-layout';
import { BADGE_COLOR_PRIMARY, BADGE_COLOR_SECONDARY } from '../../constants/badge-colors';

const { TextArea } = Input;
const { Title, Text } = Typography;

function EventDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [event, setEvent] = useState<AdminEventDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadEvent = useCallback(async () => {
    if (!id) return;
    try {
      const res = await fetchEvent(id);
      if (res.data) setEvent(res.data);
      else setError('Event not found');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadEvent();
  }, [loadEvent]);

  if (!id) {
    return (
      <div>
        <Link to="/events">
          <Button icon={<ArrowLeftOutlined />}>Back to list</Button>
        </Link>
        <Text>Invalid event ID</Text>
      </div>
    );
  }

  if (loading || !event) {
    return (
      <div>
        <Link to="/events">
          <Button icon={<ArrowLeftOutlined />} style={{ marginBottom: 16 }}>
            Back to list
          </Button>
        </Link>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 48 }}>
            <Spin size="large" />
          </div>
        ) : (
          <Text type="danger">{error}</Text>
        )}
      </div>
    );
  }

  const tabItems = [
    {
      key: 'summary',
      label: 'Summary',
      children: <EventSummaryTab event={event} onUpdated={loadEvent} onDeleted={() => navigate('/events')} />,
    },
    {
      key: 'badges',
      label: 'Badges',
      children: <EventBadgesTab eventId={id} eventTitle={event.title} />,
    },
    {
      key: 'participants',
      label: 'Participants',
      children: <EventParticipantsTab eventId={id} />,
    },
    {
      key: 'analytics',
      label: 'Analytics',
      children: <EventAnalyticsTab eventId={id} />,
    },
    {
      key: 'rewards',
      label: 'Rewards',
      children: <EventRewardsTab eventId={id} />,
    },
  ];

  return (
    <div>
      <Link to="/events">
        <Button icon={<ArrowLeftOutlined />} style={{ marginBottom: 16 }}>
          Back to list
        </Button>
      </Link>

      <Card bordered style={{ marginBottom: 16 }}>
        {event.imageUrl && (
          <Image
            src={event.imageUrl}
            alt={event.title}
            style={{ width: '100%', maxHeight: 300, objectFit: 'cover', borderRadius: 8, marginBottom: 16 }}
          />
        )}
        <Space direction="vertical" style={{ width: '100%' }}>
          <Title level={2} style={{ marginBottom: 0 }}>
            {event.title}
          </Title>
          <Space wrap>
            <Text type="secondary">ID: {event.id}</Text>
            <Tag
              color={
                event.status === 'DRAFT'
                  ? 'default'
                  : event.status === 'PUBLISHED'
                    ? BADGE_COLOR_PRIMARY
                    : BADGE_COLOR_SECONDARY
              }
            >
              {event.status}
            </Tag>
            <Tag color={BADGE_COLOR_PRIMARY}>{event.feedType}</Tag>
          </Space>
        </Space>
      </Card>

      <Tabs items={tabItems} />
    </div>
  );
}

function EventSummaryTab({
  event,
  onUpdated,
  onDeleted,
}: {
  event: AdminEventDetailResponse;
  onUpdated: () => void;
  onDeleted: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: event.title,
    description: event.description ?? '',
    startDate: event.startDate.slice(0, 16),
    endDate: event.endDate.slice(0, 16),
    status: event.status,
    feedType: event.feedType,
    imageUrl: event.imageUrl ?? '',
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateEvent(event.id, {
        title: form.title,
        description: form.description || null,
        startDate: new Date(form.startDate).toISOString(),
        endDate: new Date(form.endDate).toISOString(),
        status: form.status,
        feedType: form.feedType,
        imageUrl: form.imageUrl || null,
      });
      setEditing(false);
      antdMessage.success('Event updated');
      onUpdated();
    } catch (e) {
      antdMessage.error(e instanceof Error ? e.message : 'Failed to update');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    Modal.confirm({
      title: 'Delete Event',
      content: 'This event will be deleted. Are you sure?',
      okText: 'Yes, delete',
      cancelText: 'Cancel',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await deleteEvent(event.id);
          antdMessage.success('Event deleted');
          onDeleted();
        } catch (e) {
          antdMessage.error(e instanceof Error ? e.message : 'Failed to delete');
        }
      },
    });
  };

  return (
    <Card bordered>
      {!editing ? (
        <>
          <Descriptions title="Event details" bordered column={1}>
            <Descriptions.Item label="Title">{event.title}</Descriptions.Item>
            <Descriptions.Item label="Description">{event.description || '—'}</Descriptions.Item>
            <Descriptions.Item label="Status">
              <Tag
                color={
                  event.status === 'DRAFT'
                    ? 'default'
                    : event.status === 'PUBLISHED'
                      ? BADGE_COLOR_PRIMARY
                      : BADGE_COLOR_SECONDARY
                }
              >
                {event.status}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Feed type">{event.feedType}</Descriptions.Item>
            <Descriptions.Item label="Start">
              {new Date(event.startDate).toLocaleString()}
            </Descriptions.Item>
            <Descriptions.Item label="End">{new Date(event.endDate).toLocaleString()}</Descriptions.Item>
            <Descriptions.Item label="Image">
              {event.imageUrl ? (
                <a href={event.imageUrl} target="_blank" rel="noreferrer">
                  View
                </a>
              ) : (
                '—'
              )}
            </Descriptions.Item>
            {event.product && (
              <Descriptions.Item label="Product">{event.product.name ?? event.productId}</Descriptions.Item>
            )}
            {event.brand && (
              <Descriptions.Item label="Brand">{event.brand.name ?? event.brandId}</Descriptions.Item>
            )}
          </Descriptions>

          <Space style={{ marginTop: 24 }}>
            <Button type="primary" icon={<EditOutlined />} onClick={() => setEditing(true)}>
              Edit
            </Button>
            <Button danger icon={<DeleteOutlined />} onClick={handleDelete}>
              Delete
            </Button>
          </Space>
        </>
      ) : (
        <>
          <Form {...FORM_LAYOUT_VERTICAL} style={{ width: '100%' }}>
            <Form.Item label="Title">
              <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
            </Form.Item>
            <Form.Item label="Description">
              <TextArea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={3}
              />
            </Form.Item>
            <Form.Item label="Start">
              <Input
                type="datetime-local"
                value={form.startDate}
                onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
              />
            </Form.Item>
            <Form.Item label="End">
              <Input
                type="datetime-local"
                value={form.endDate}
                onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
              />
            </Form.Item>
            <Form.Item label="Status">
              <Select value={form.status} onChange={(value) => setForm((f) => ({ ...f, status: value }))}>
                <Select.Option value="DRAFT">DRAFT</Select.Option>
                <Select.Option value="PUBLISHED">PUBLISHED</Select.Option>
                <Select.Option value="CLOSED">CLOSED</Select.Option>
              </Select>
            </Form.Item>
            <Form.Item label="Feed type">
              <Select value={form.feedType} onChange={(value) => setForm((f) => ({ ...f, feedType: value }))}>
                <Select.Option value="PICKS">PICKS</Select.Option>
                <Select.Option value="ROASTS">ROASTS</Select.Option>
              </Select>
            </Form.Item>
            <Form.Item label="Image URL">
              <Input
                value={form.imageUrl}
                onChange={(e) => setForm((f) => ({ ...f, imageUrl: e.target.value }))}
                placeholder="https://..."
              />
            </Form.Item>

            <Space style={{ marginTop: 24 }}>
              <Button type="primary" onClick={handleSave} loading={saving}>
                {saving ? 'Saving...' : 'Save'}
              </Button>
              <Button onClick={() => setEditing(false)}>Cancel</Button>
            </Space>
          </Form>
        </>
      )}
    </Card>
  );
}

function EventBadgesTab({ eventId, eventTitle }: { eventId: string; eventTitle: string }) {
  const [list, setList] = useState<AdminEventBadgeListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [addBadgeId, setAddBadgeId] = useState('');
  const [addRank, setAddRank] = useState(0);
  const [addDisplayOrder, setAddDisplayOrder] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRank, setEditRank] = useState(0);
  const [editDisplayOrder, setEditDisplayOrder] = useState<number | null>(null);
  const [editEnabled, setEditEnabled] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetchEventBadges(eventId);
      setList(res.data ?? []);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleAdd = async () => {
    if (!addBadgeId.trim()) return;
    setSubmitting(true);
    try {
      await addEventBadge(eventId, {
        badgeId: addBadgeId.trim(),
        rank: addRank,
        displayOrder: addDisplayOrder ?? undefined,
      });
      setAddBadgeId('');
      setAddRank(list.length);
      setAddDisplayOrder(null);
      setShowAdd(false);
      antdMessage.success('Badge added');
      load();
    } catch (e) {
      antdMessage.error(e instanceof Error ? e.message : 'Failed to add');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async (eventBadgeId: string) => {
    setSubmitting(true);
    try {
      await updateEventBadge(eventId, eventBadgeId, {
        rank: editRank,
        displayOrder: editDisplayOrder,
        enabled: editEnabled,
      });
      setEditingId(null);
      antdMessage.success('Badge updated');
      load();
    } catch (e) {
      antdMessage.error(e instanceof Error ? e.message : 'Failed to update');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemove = async (eventBadgeId: string) => {
    Modal.confirm({
      title: 'Remove Badge',
      content: "This badge will be removed from the event. Are you sure?",
      okText: 'Yes, remove',
      cancelText: 'Cancel',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await removeEventBadge(eventId, eventBadgeId);
          antdMessage.success('Badge removed');
          load();
        } catch (e) {
          antdMessage.error(e instanceof Error ? e.message : 'Failed to remove');
        }
      },
    });
  };

  const columns: ColumnsType<AdminEventBadgeListItem> = [
    {
      title: 'Badge',
      key: 'badge',
      render: (_, record) => (
        <Space>
          {record.badgeImageUrl && (
            <Image src={record.badgeImageUrl} width={32} height={32} style={{ borderRadius: 4 }} preview={false} />
          )}
          <div>
            <div>{record.badgeName}</div>
            <Text type="secondary" style={{ fontSize: 11 }}>
              {record.badgeId.slice(0, 8)}...
            </Text>
          </div>
        </Space>
      ),
    },
    {
      title: 'Rank',
      dataIndex: 'rank',
      key: 'rank',
      width: 100,
      render: (rank, record) =>
        editingId === record.id ? (
          <InputNumber
            min={0}
            value={editRank}
            onChange={(value) => setEditRank(value || 0)}
            style={{ width: '100%' }}
          />
        ) : (
          rank
        ),
    },
    {
      title: 'Display order',
      dataIndex: 'displayOrder',
      key: 'displayOrder',
      width: 120,
      render: (order, record) =>
        editingId === record.id ? (
          <InputNumber
            value={editDisplayOrder}
            onChange={(value) => setEditDisplayOrder(value)}
            style={{ width: '100%' }}
            placeholder="—"
          />
        ) : (
          order ?? '—'
        ),
    },
    {
      title: 'Enabled',
      dataIndex: 'enabled',
      key: 'enabled',
      width: 100,
      render: (enabled, record) =>
        editingId === record.id ? (
          <Checkbox checked={editEnabled} onChange={(e) => setEditEnabled(e.target.checked)} />
        ) : enabled ? (
          'Yes'
        ) : (
          'No'
        ),
    },
    {
      title: 'Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 130,
      render: (date) => new Date(date).toLocaleDateString(),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 150,
      render: (_, record) =>
        editingId === record.id ? (
          <Space>
            <Button type="primary" size="small" loading={submitting} onClick={() => handleUpdate(record.id)}>
              Save
            </Button>
            <Button size="small" onClick={() => setEditingId(null)}>
              Cancel
            </Button>
          </Space>
        ) : (
          <Space>
            <Button
              type="link"
              size="small"
              icon={<EditOutlined />}
              onClick={() => {
                setEditingId(record.id);
                setEditRank(record.rank);
                setEditDisplayOrder(record.displayOrder ?? null);
                setEditEnabled(record.enabled);
              }}
            >
              Edit
            </Button>
            <Button
              type="link"
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleRemove(record.id)}
            >
              Remove
            </Button>
          </Space>
        ),
    },
  ];

  return (
    <div>
      <Card bordered title={`Event Badges: ${eventTitle}`} style={{ marginBottom: 16 }}>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setShowAdd(!showAdd)}
          style={{ marginBottom: 16 }}
        >
          {showAdd ? 'Cancel' : 'Add badge to event'}
        </Button>

        {showAdd && (
          <Card bordered style={{ marginBottom: 16, background: '#fafafa' }}>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item label="Badge ID (UUID)">
                  <Input
                    value={addBadgeId}
                    onChange={(e) => setAddBadgeId(e.target.value)}
                    placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  />
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item label="Rank">
                  <InputNumber
                    min={0}
                    value={addRank}
                    onChange={(value) => setAddRank(value || 0)}
                    style={{ width: '100%' }}
                  />
                </Form.Item>
              </Col>
              <Col span={6}>
                <Form.Item label="Display order">
                  <InputNumber
                    value={addDisplayOrder}
                    onChange={(value) => setAddDisplayOrder(value)}
                    style={{ width: '100%' }}
                    placeholder="Opsiyonel"
                  />
                </Form.Item>
              </Col>
            </Row>
            <Button type="primary" loading={submitting} onClick={handleAdd}>
              Add
            </Button>
          </Card>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: 48 }}>
            <Spin size="large" />
          </div>
        ) : (
          <Table
            columns={columns}
            dataSource={list}
            rowKey="id"
            pagination={false}
            locale={{
              emptyText: (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description="No badges added to this event yet."
                />
              ),
            }}
          />
        )}
      </Card>
    </div>
  );
}

function EventParticipantsTab({ eventId }: { eventId: string }) {
  const [list, setList] = useState<AdminEventParticipantListItem[]>([]);
  const [pagination, setPagination] = useState({ total: 0, limit: 20, offset: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const res = await fetchEventParticipants(eventId, {
          limit: 20,
          offset: pagination.offset,
          sort: 'eventPostsCount',
          order: 'desc',
        });
        if (!cancelled) {
          setList(res.data ?? []);
          if (res.pagination) setPagination(res.pagination);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [eventId, pagination.offset]);

  const columns: ColumnsType<AdminEventParticipantListItem> = [
    {
      title: 'User',
      key: 'user',
      render: (_, record) => (
        <Link
          to={`/users/${record.userId}`}
          style={{ color: 'var(--tipbox-badge-outline)', textDecoration: 'underline' }}
        >
          {record.userDisplayName ?? record.userId.slice(0, 8) + '...'}
        </Link>
      ),
    },
    {
      title: 'Email',
      dataIndex: 'userEmail',
      key: 'email',
      render: (email) => email ?? '—',
    },
    {
      title: 'Post',
      dataIndex: 'eventPostsCount',
      key: 'posts',
      width: 80,
      align: 'right',
    },
    {
      title: 'Likes',
      dataIndex: 'eventLikesReceived',
      key: 'likes',
      width: 80,
      align: 'right',
    },
    {
      title: 'Participation',
      dataIndex: 'totalParticipated',
      key: 'participated',
      width: 80,
      align: 'right',
    },
    {
      title: 'Comments',
      dataIndex: 'totalComments',
      key: 'comments',
      width: 80,
      align: 'right',
    },
  ];

  const handleTableChange = (pag: TablePaginationConfig) => {
    const newOffset = ((pag.current ?? 1) - 1) * 20;
    setPagination((prev) => ({ ...prev, offset: newOffset }));
  };

  const currentPage = Math.floor(pagination.offset / pagination.limit) + 1;

  return (
    <Card bordered title="Participants">
      <Table
        columns={columns}
        dataSource={list}
        rowKey="id"
        loading={loading}
        pagination={{
          current: currentPage,
          pageSize: 20,
          total: pagination.total,
          showSizeChanger: false,
          showTotal: (total) => `Total ${total} records`,
        }}
        onChange={handleTableChange}
        locale={{
          emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No participants yet." />,
        }}
      />
    </Card>
  );
}

function EventAnalyticsTab({ eventId }: { eventId: string }) {
  const [data, setData] = useState<AdminEventAnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchEventAnalytics(eventId);
        if (!cancelled) setData(res.data ?? null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 48 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!data) {
    return (
      <Alert message="Error" description="Failed to load analytics." type="error" />
    );
  }

  return (
    <Card bordered title="Analytics summary">
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card bordered>
            <Statistic title="Participant count" value={data.participantCount} valueStyle={{ fontWeight: 700 }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card bordered>
            <Statistic title="Total posts" value={data.totalPosts} valueStyle={{ fontWeight: 600 }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card bordered>
            <Statistic title="Rewards granted" value={data.totalRewardsGranted} valueStyle={{ fontWeight: 600 }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card bordered>
            <Statistic title="Badge count" value={data.badgesCount} valueStyle={{ fontWeight: 600 }} />
          </Card>
        </Col>
      </Row>
    </Card>
  );
}

function EventRewardsTab({ eventId }: { eventId: string }) {
  const [list, setList] = useState<AdminEventRewardListItem[]>([]);
  const [pagination, setPagination] = useState({ total: 0, limit: 20, offset: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const res = await fetchEventRewards(eventId, {
          limit: 20,
          offset: pagination.offset,
          sort: 'awardedAt',
          order: 'desc',
        });
        if (!cancelled) {
          setList(res.data ?? []);
          if (res.pagination) setPagination(res.pagination);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [eventId, pagination.offset]);

  const columns: ColumnsType<AdminEventRewardListItem> = [
    {
      title: 'User',
      key: 'user',
      render: (_, record) => record.userDisplayName ?? record.userId.slice(0, 8) + '...',
    },
    {
      title: 'Email',
      dataIndex: 'userEmail',
      key: 'email',
      render: (email) => email ?? '—',
    },
    {
      title: 'Type',
      dataIndex: 'rewardType',
      key: 'type',
      width: 120,
    },
    {
      title: 'Reward ID',
      dataIndex: 'rewardId',
      key: 'rewardId',
      width: 150,
      render: (id) => (
        <Text style={{ fontSize: 12 }} type="secondary">
          {id}
        </Text>
      ),
    },
    {
      title: 'Amount',
      dataIndex: 'amount',
      key: 'amount',
      width: 100,
      align: 'right',
      render: (amount) => amount ?? '—',
    },
    {
      title: 'Awarded at',
      dataIndex: 'awardedAt',
      key: 'awardedAt',
      width: 150,
      render: (date) => new Date(date).toLocaleString(),
    },
  ];

  const handleTableChange = (pag: TablePaginationConfig) => {
    const newOffset = ((pag.current ?? 1) - 1) * 20;
    setPagination((prev) => ({ ...prev, offset: newOffset }));
  };

  const currentPage = Math.floor(pagination.offset / pagination.limit) + 1;

  return (
    <Card bordered title="Rewards">
      <Table
        columns={columns}
        dataSource={list}
        rowKey="id"
        loading={loading}
        pagination={{
          current: currentPage,
          pageSize: 20,
          total: pagination.total,
          showSizeChanger: false,
          showTotal: (total) => `Total ${total} records`,
        }}
        onChange={handleTableChange}
        locale={{
          emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No reward records yet." />,
        }}
      />
    </Card>
  );
}

export default EventDetail;
