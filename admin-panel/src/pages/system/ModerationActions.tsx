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
} from 'antd';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import {
  SafetyOutlined,
  SearchOutlined,
  EyeOutlined,
  UserOutlined,
} from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';
import { type StatItemData } from '../../components/StatItem';
import ViewActionButton from '../../components/ViewActionButton';
import {
  fetchModerationActionStats,
  fetchModerationActions,
  fetchModerationAction,
} from '../../api/admin-system';
import type {
  AdminModerationActionStatsResponse,
  AdminModerationActionListItem,
  AdminModerationActionDetailResponse,
} from '../../api/admin-system';
import { TABLE_COLUMN_WIDTHS, TABLE_SCROLL_CONFIGS } from '../../constants/table-widths';

const PAGE_SIZE = 20;

function ModerationActions() {
  const [stats, setStats] = useState<AdminModerationActionStatsResponse | null>(null);
  const [actions, setActions] = useState<AdminModerationActionListItem[]>([]);
  const [pagination, setPagination] = useState({
    total: 0,
    limit: PAGE_SIZE,
    offset: 0,
  });
  const [loading, setLoading] = useState(true);
  const [loadingList, setLoadingList] = useState(true);
  const [search, setSearch] = useState('');
  const [actionTypeFilter, setActionTypeFilter] = useState<string | undefined>(undefined);
  const [contentTypeFilter, setContentTypeFilter] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedAction, setSelectedAction] = useState<AdminModerationActionDetailResponse | null>(
    null
  );
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchModerationActionStats();
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

  const loadActions = async () => {
    setLoadingList(true);
    try {
      const res = await fetchModerationActions({
        limit: PAGE_SIZE,
        offset: pagination.offset,
        actionType: actionTypeFilter,
        contentType: contentTypeFilter,
      });
      setActions(res.data ?? []);
      // Note: This endpoint doesn't return pagination, so we'll use the current offset
      setPagination((prev) => ({ ...prev, total: res.data?.length ?? 0 }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load moderation actions');
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    loadActions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.offset, actionTypeFilter, contentTypeFilter]);

  const openDetailModal = async (id: string) => {
    setLoadingDetail(true);
    setDetailModalOpen(true);
    try {
      const res = await fetchModerationAction(id);
      setSelectedAction(res.data);
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Failed to load action details');
    } finally {
      setLoadingDetail(false);
    }
  };

  const getActionTypeColor = (actionType: string) => {
    switch (actionType.toUpperCase()) {
      case 'WARN':
        return 'orange';
      case 'BAN':
      case 'PERMANENT_BAN':
        return 'red';
      case 'MUTE':
        return 'purple';
      case 'DELETE':
      case 'REMOVE':
        return 'volcano';
      case 'UNBAN':
      case 'UNMUTE':
        return 'green';
      default:
        return 'blue';
    }
  };

  const columns: ColumnsType<AdminModerationActionListItem> = [
    {
      title: 'Moderator',
      dataIndex: 'moderatorEmail',
      key: 'moderatorEmail',
      width: TABLE_COLUMN_WIDTHS.MEDIUM_TEXT,
      ellipsis: true,
      render: (text) => text ?? '—',
    },
    {
      title: 'Target User',
      dataIndex: 'targetUsername',
      key: 'targetUsername',
      width: TABLE_COLUMN_WIDTHS.MEDIUM_TEXT,
      ellipsis: true,
      render: (text, record) => text ?? record.targetUserEmail ?? '—',
    },
    {
      title: 'Action Type',
      dataIndex: 'actionType',
      key: 'actionType',
      width: TABLE_COLUMN_WIDTHS.SHORT_TEXT,
      render: (type) => <Tag color={getActionTypeColor(type)}>{type}</Tag>,
    },
    {
      title: 'Reason',
      dataIndex: 'reason',
      key: 'reason',
      width: TABLE_COLUMN_WIDTHS.LONG_TEXT,
      ellipsis: true,
    },
    {
      title: 'Content Type',
      dataIndex: 'contentType',
      key: 'contentType',
      width: TABLE_COLUMN_WIDTHS.SHORT_TEXT,
      render: (text) => (text ? <Tag>{text}</Tag> : '—'),
    },
    {
      title: 'Content ID',
      dataIndex: 'contentId',
      key: 'contentId',
      width: TABLE_COLUMN_WIDTHS.SHORT_TEXT,
      align: 'right',
      render: (id) => id ?? '—',
    },
    {
      title: 'Date',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: TABLE_COLUMN_WIDTHS.DATE_SHORT,
      ellipsis: true,
      render: (date) => (date ? new Date(date).toLocaleDateString('en-US') : '—'),
    },
    {
      title: '',
      key: 'action',
      width: TABLE_COLUMN_WIDTHS.ACTION_BUTTON_DOUBLE,
      render: (_, record) => (
        <Space size="small">
          <ViewActionButton to={`/users/${record.targetUserId}`} />
          <Button
            size="small"
            type="text"
            icon={<EyeOutlined />}
            onClick={() => openDetailModal(record.id)}
          />
        </Space>
      ),
    },
  ];

  const handleTableChange = (pag: TablePaginationConfig) => {
    const newOffset = ((pag.current ?? 1) - 1) * PAGE_SIZE;
    setPagination((prev) => ({ ...prev, offset: newOffset }));
  };

  const currentPage = Math.floor(pagination.offset / pagination.limit) + 1;

  const actionTypes = stats?.byType ? Object.keys(stats.byType) : [];
  const contentTypes = Array.from(
    new Set(actions.map((a) => a.contentType).filter(Boolean))
  ) as string[];

  const statsData: StatItemData[] | undefined = stats
    ? [
        {
          label: 'Total Actions',
          value: stats.total,
          icon: <SafetyOutlined />,
        },
        {
          label: 'This Week',
          value: stats.thisWeek,
          icon: <SafetyOutlined />,
        },
        {
          label: 'Top Moderator',
          value:
            stats.byModerator[0]?.moderatorEmail?.split('@')[0] ?? '—',
          icon: <UserOutlined />,
        },
        {
          label: 'Actions by Top',
          value: stats.byModerator[0]?.actionCount ?? 0,
          icon: <UserOutlined />,
        },
      ]
    : undefined;

  return (
    <div>
      <PageHeader
        title="Moderation Actions"
        description="Review moderation history and actions"
        icon={<SafetyOutlined />}
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

      <Card>
        <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
          <Row justify="space-between" align="middle">
            <Space wrap>
              <Select
                placeholder="Action Type"
                value={actionTypeFilter}
                onChange={setActionTypeFilter}
                style={{ width: 180 }}
                allowClear
              >
                {actionTypes.map((type) => (
                  <Select.Option key={type} value={type}>
                    {type}
                  </Select.Option>
                ))}
              </Select>
              <Select
                placeholder="Content Type"
                value={contentTypeFilter}
                onChange={setContentTypeFilter}
                style={{ width: 180 }}
                allowClear
              >
                {contentTypes.map((type) => (
                  <Select.Option key={type} value={type}>
                    {type}
                  </Select.Option>
                ))}
              </Select>
            </Space>
          </Row>

          <Table
            columns={columns}
            dataSource={actions}
            loading={loadingList}
            rowKey="id"
            pagination={{
              current: currentPage,
              pageSize: PAGE_SIZE,
              total: actions.length,
              showSizeChanger: false,
              showTotal: (total) => `Total ${total} actions`,
            }}
            onChange={handleTableChange}
            scroll={TABLE_SCROLL_CONFIGS.DEFAULT}
            locale={{
              emptyText: <Empty description="No moderation actions found" />,
            }}
          />
        </Space>
      </Card>

      {/* Detail Modal */}
      <Modal
        title="Moderation Action Details"
        open={detailModalOpen}
        onCancel={() => {
          setDetailModalOpen(false);
          setSelectedAction(null);
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
          selectedAction && (
            <Descriptions bordered column={2} size="small">
              <Descriptions.Item label="Moderator">
                {selectedAction.moderatorEmail ?? '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Target User">
                {selectedAction.targetUsername ?? selectedAction.targetUserEmail ?? '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Action Type">
                <Tag color={getActionTypeColor(selectedAction.actionType)}>
                  {selectedAction.actionType}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Content Type">
                {selectedAction.contentType ? <Tag>{selectedAction.contentType}</Tag> : '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Content ID">
                {selectedAction.contentId ?? '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Date">
                {new Date(selectedAction.createdAt).toLocaleString('en-US')}
              </Descriptions.Item>
              <Descriptions.Item label="Reason" span={2}>
                {selectedAction.reason}
              </Descriptions.Item>
              {selectedAction.metadata && Object.keys(selectedAction.metadata).length > 0 && (
                <Descriptions.Item label="Metadata" span={2}>
                  <pre style={{ margin: 0, fontSize: '12px' }}>
                    {JSON.stringify(selectedAction.metadata, null, 2)}
                  </pre>
                </Descriptions.Item>
              )}
            </Descriptions>
          )
        )}
      </Modal>
    </div>
  );
}

export default ModerationActions;
