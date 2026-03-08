import { useState, useEffect, useCallback } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  Tabs,
  Button,
  Input,
  InputNumber,
  Space,
  Spin,
  Empty,
  Modal,
  Row,
  Col,
  Typography,
  Table,
  Tag,
  Image,
  Statistic,
  Descriptions,
  Checkbox,
  Alert,
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
  deleteEvent,
  fetchEventParticipants,
  addEventParticipant,
  removeEventParticipant,
  fetchEventAnalytics,
  fetchEventBadges,
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
import { BADGE_COLOR_PRIMARY, BADGE_COLOR_SECONDARY } from '../../constants/badge-colors';
import EditEventModal from './modals/EditEventModal';
import AddBadgeToEventModal from './modals/AddBadgeToEventModal';
import IdDisplay from '../../components/IdDisplay';

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
        <Space orientation="vertical" style={{ width: '100%' }}>
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
  const [editModalOpen, setEditModalOpen] = useState(false);

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
            <Image
              src={event.imageUrl}
              width={60}
              height={40}
              style={{ objectFit: 'cover', borderRadius: 4 }}
            />
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
        <Button type="primary" icon={<EditOutlined />} onClick={() => setEditModalOpen(true)}>
          Edit
        </Button>
        <Button danger icon={<DeleteOutlined />} onClick={handleDelete}>
          Delete
        </Button>
      </Space>

      {editModalOpen && (
        <EditEventModal
          open={editModalOpen}
          eventId={event.id}
          onClose={() => setEditModalOpen(false)}
          onSuccess={() => {
            onUpdated();
            setEditModalOpen(false);
          }}
        />
      )}
    </Card>
  );
}

function EventBadgesTab({ eventId, eventTitle }: { eventId: string; eventTitle: string }) {
  const [list, setList] = useState<AdminEventBadgeListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [addModalOpen, setAddModalOpen] = useState(false);
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
            <IdDisplay id={record.badgeId} variant="compact" />
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
          onClick={() => setAddModalOpen(true)}
          style={{ marginBottom: 16 }}
        >
          Add Badge to Event
        </Button>

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

      {addModalOpen && (
        <AddBadgeToEventModal
          open={addModalOpen}
          eventId={eventId}
          onClose={() => setAddModalOpen(false)}
          onSuccess={() => {
            load();
            setAddModalOpen(false);
          }}
        />
      )}
    </div>
  );
}

function EventParticipantsTab({ eventId }: { eventId: string }) {
  const [list, setList] = useState<AdminEventParticipantListItem[]>([]);
  const [pagination, setPagination] = useState({ total: 0, limit: 20, offset: 0 });
  const [loading, setLoading] = useState(true);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addUserId, setAddUserId] = useState('');
  const [addLoading, setAddLoading] = useState(false);

  const load = async (offset = pagination.offset) => {
    setLoading(true);
    try {
      const res = await fetchEventParticipants(eventId, {
        limit: 20,
        offset,
        sort: 'eventPostsCount',
        order: 'desc',
      });
      setList(res.data ?? []);
      if (res.pagination) setPagination(res.pagination);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  const handleRemoveParticipant = (participantId: string, displayName: string) => {
    Modal.confirm({
      title: 'Remove Participant',
      content: `Are you sure you want to remove "${displayName}" from this event? Their event rewards will also be removed.`,
      okText: 'Remove',
      okType: 'danger',
      onOk: async () => {
        try {
          await removeEventParticipant(eventId, participantId);
          antdMessage.success('Participant removed');
          load();
        } catch (e) {
          antdMessage.error(e instanceof Error ? e.message : 'Failed to remove participant');
        }
      },
    });
  };

  const handleAddParticipant = async () => {
    if (!addUserId.trim()) {
      antdMessage.warning('Please enter a user ID');
      return;
    }
    setAddLoading(true);
    try {
      await addEventParticipant(eventId, { userId: addUserId.trim() });
      antdMessage.success('Participant added');
      setAddModalOpen(false);
      setAddUserId('');
      load();
    } catch (e) {
      antdMessage.error(e instanceof Error ? e.message : 'Failed to add participant');
    } finally {
      setAddLoading(false);
    }
  };

  const columns: ColumnsType<AdminEventParticipantListItem> = [
    {
      title: 'User',
      key: 'user',
      render: (_, record) => (
        <Link
          to={`/users/${record.userId}`}
          style={{ color: 'var(--tipbox-badge-outline)', textDecoration: 'underline' }}
        >
          {record.userDisplayName ?? <IdDisplay id={record.userId} variant="compact" copyable={false} />}
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
    {
      title: '',
      key: 'action',
      width: 80,
      render: (_, record) => (
        <Button
          size="small"
          type="text"
          danger
          icon={<DeleteOutlined />}
          onClick={() => handleRemoveParticipant(record.id, record.userDisplayName ?? record.userId)}
        />
      ),
    },
  ];

  const handleTableChange = (pag: TablePaginationConfig) => {
    const newOffset = ((pag.current ?? 1) - 1) * 20;
    setPagination((prev) => ({ ...prev, offset: newOffset }));
    load(newOffset);
  };

  const currentPage = Math.floor(pagination.offset / pagination.limit) + 1;

  return (
    <Card
      bordered
      title="Participants"
      extra={
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setAddModalOpen(true)}>
          Add Participant
        </Button>
      }
    >
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

      <Modal
        title="Add Participant"
        open={addModalOpen}
        onCancel={() => {
          setAddModalOpen(false);
          setAddUserId('');
        }}
        onOk={handleAddParticipant}
        confirmLoading={addLoading}
        okText="Add"
      >
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <div>
            <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>User ID</label>
            <Input
              placeholder="Enter user UUID"
              value={addUserId}
              onChange={(e) => setAddUserId(e.target.value)}
            />
          </div>
        </Space>
      </Modal>
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
      render: (_, record) => record.userDisplayName ?? <IdDisplay id={record.userId} variant="compact" />,
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
        <Text style={{ fontSize: 14 }} type="secondary">
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
