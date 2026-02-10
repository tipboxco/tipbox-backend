import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Card,
  Tabs,
  Button,
  Input,
  Select,
  Checkbox,
  Spin,
  Alert,
  Table,
  Tag,
  Space,
  Typography,
  Image,
  Descriptions,
  Modal,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { UserOutlined, ExclamationCircleOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import PageHeader from '../../components/PageHeader';
import ViewActionButton from '../../components/ViewActionButton';
import {
  fetchUser,
  fetchUserModerationHistory,
  fetchUserLoginAttempts,
  fetchUserAvatar,
  updateUserAvatar,
  createUserAvatar,
  fetchUserEvents,
  fetchUserBadges,
  grantUserBadge,
  revokeUserBadge,
  fetchUserWallet,
  fetchUserTipsSummary,
  fetchUserTipsTransactions,
  updateUser,
  updateUserRoles,
  banUser,
  unbanUser,
} from '../../api/admin-users';
import { fetchUserPosts } from '../../api/admin-content';
import { BADGE_COLOR_PRIMARY, BADGE_COLOR_SECONDARY } from '../../constants/badge-colors';
import type {
  AdminUserDetailResponse,
  AdminModerationHistoryItem,
  AdminLoginAttemptListItem,
  AdminAvatarResponse,
  AdminUserEventListItem,
  AdminUserBadgeListItem,
  AdminWalletSummaryItem,
  AdminTipsSummaryResponse,
  AdminTipsTransactionListItem,
  PaginationMeta,
  AdminContentPostListItem,
} from '../../types/admin';

const { Text } = Typography;

type TabId = 'overview' | 'profile' | 'roles' | 'events' | 'badges' | 'posts' | 'wallet' | 'moderation' | 'login';

function UserDetail() {
  const { id } = useParams<{ id: string }>();
  const [user, setUser] = useState<AdminUserDetailResponse | null>(null);
  const [moderation, setModeration] = useState<AdminModerationHistoryItem[]>([]);
  const [loginAttempts, setLoginAttempts] = useState<AdminLoginAttemptListItem[]>([]);
  const [avatar, setAvatar] = useState<AdminAvatarResponse | null | undefined>(undefined);
  const [userEvents, setUserEvents] = useState<AdminUserEventListItem[]>([]);
  const [userBadges, setUserBadges] = useState<AdminUserBadgeListItem[]>([]);
  const [userPosts, setUserPosts] = useState<AdminContentPostListItem[]>([]);
  const [wallet, setWallet] = useState<AdminWalletSummaryItem[]>([]);
  const [tipsSummary, setTipsSummary] = useState<AdminTipsSummaryResponse | null>(null);
  const [tipsTransactions, setTipsTransactions] = useState<AdminTipsTransactionListItem[]>([]);
  const [eventsPagination, setEventsPagination] = useState<PaginationMeta | undefined>(undefined);
  const [badgesPagination, setBadgesPagination] = useState<PaginationMeta | undefined>(undefined);
  const [postsPagination, setPostsPagination] = useState<PaginationMeta | undefined>(undefined);
  const [tipsPagination, setTipsPagination] = useState<PaginationMeta | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [loadingTab, setLoadingTab] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [error, setError] = useState<string | null>(null);
  const [editEmail, setEditEmail] = useState('');
  const [editStatus, setEditStatus] = useState<string>('');
  const [editEmailVerified, setEditEmailVerified] = useState(false);
  const [editRoles, setEditRoles] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [avatarImageUrl, setAvatarImageUrl] = useState('');
  const [avatarActiveId, setAvatarActiveId] = useState<string | null>(null);
  const [grantBadgeId, setGrantBadgeId] = useState('');

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const res = await fetchUser(id);
        if (!cancelled && res.data) {
          setUser(res.data);
          setEditEmail(res.data.email ?? '');
          setEditStatus(res.data.status ?? '');
          setEditEmailVerified(res.data.emailVerified ?? false);
          setEditRoles((res.data.roles ?? []).join(', '));
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load user');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  useEffect(() => {
    if (!id || activeTab !== 'moderation') return;
    let cancelled = false;
    setLoadingTab(true);
    (async () => {
      try {
        const res = await fetchUserModerationHistory(id, { limit: 50, offset: 0 });
        if (!cancelled) setModeration(res.data ?? []);
      } finally {
        if (!cancelled) setLoadingTab(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id, activeTab]);

  useEffect(() => {
    if (!id || activeTab !== 'login') return;
    let cancelled = false;
    setLoadingTab(true);
    (async () => {
      try {
        const res = await fetchUserLoginAttempts(id, { limit: 50, offset: 0 });
        if (!cancelled) setLoginAttempts(res.data ?? []);
      } finally {
        if (!cancelled) setLoadingTab(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id, activeTab]);

  useEffect(() => {
    if (!id || activeTab !== 'profile') return;
    let cancelled = false;
    setLoadingTab(true);
    setAvatar(undefined);
    (async () => {
      try {
        const res = await fetchUserAvatar(id);
        if (!cancelled) {
          setAvatar(res.data ?? null);
          if (res.data) {
            setAvatarImageUrl(res.data.imageUrl);
            if (res.data.isActive) setAvatarActiveId(res.data.id);
          } else {
            setAvatarImageUrl('');
            setAvatarActiveId(null);
          }
        }
      } catch {
        if (!cancelled) setAvatar(null);
      } finally {
        if (!cancelled) setLoadingTab(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id, activeTab]);

  useEffect(() => {
    if (!id || activeTab !== 'events') return;
    let cancelled = false;
    setLoadingTab(true);
    (async () => {
      try {
        const res = await fetchUserEvents(id, { limit: 20, offset: 0 });
        if (!cancelled) {
          setUserEvents(res.data ?? []);
          setEventsPagination(res.pagination);
        }
      } finally {
        if (!cancelled) setLoadingTab(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id, activeTab]);

  useEffect(() => {
    if (!id || activeTab !== 'badges') return;
    let cancelled = false;
    setLoadingTab(true);
    (async () => {
      try {
        const res = await fetchUserBadges(id, { limit: 50, offset: 0 });
        if (!cancelled) {
          setUserBadges(res.data ?? []);
          setBadgesPagination(res.pagination);
        }
      } finally {
        if (!cancelled) setLoadingTab(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id, activeTab]);

  useEffect(() => {
    if (!id || activeTab !== 'posts') return;
    let cancelled = false;
    setLoadingTab(true);
    (async () => {
      try {
        const res = await fetchUserPosts(id, { limit: 20, offset: 0 });
        if (!cancelled) {
          setUserPosts(res.data ?? []);
          setPostsPagination(res.pagination);
        }
      } finally {
        if (!cancelled) setLoadingTab(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id, activeTab]);

  useEffect(() => {
    if (!id || activeTab !== 'wallet') return;
    let cancelled = false;
    setLoadingTab(true);
    (async () => {
      try {
        const [walletRes, summaryRes, txRes] = await Promise.all([
          fetchUserWallet(id),
          fetchUserTipsSummary(id),
          fetchUserTipsTransactions(id, { limit: 20, offset: 0 }),
        ]);
        if (!cancelled) {
          setWallet(Array.isArray(walletRes.data) ? walletRes.data : []);
          setTipsSummary(summaryRes.data ?? null);
          setTipsTransactions(Array.isArray(txRes.data) ? txRes.data : []);
          setTipsPagination(txRes.pagination);
        }
      } finally {
        if (!cancelled) setLoadingTab(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id, activeTab]);

  const handleSaveUser = async () => {
    if (!id || !user) return;
    setSaving(true);
    setMessage(null);
    try {
      await updateUser(id, {
        email: editEmail || undefined,
        status: editStatus || null,
        emailVerified: editEmailVerified,
      });
      const res = await fetchUser(id);
      if (res.data) setUser(res.data);
      setMessage('User updated');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveRoles = async () => {
    if (!id) return;
    const roles = editRoles
      .split(',')
      .map((r) => r.trim())
      .filter(Boolean);
    setSaving(true);
    setMessage(null);
    try {
      await updateUserRoles(id, roles);
      const res = await fetchUser(id);
      if (res.data) setUser(res.data);
      setEditRoles(res.data?.roles?.join(', ') ?? '');
      setMessage('Roles updated');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  const handleBan = async () => {
    if (!id) return;
    Modal.confirm({
      title: 'Ban user',
      icon: <ExclamationCircleOutlined />,
      content: 'Are you sure you want to ban this user?',
      onOk: async () => {
        setSaving(true);
        setMessage(null);
        try {
          await banUser(id);
          const res = await fetchUser(id);
          if (res.data) setUser(res.data);
          setEditStatus('BANNED');
          setMessage('User banned');
        } catch (e) {
          setMessage(e instanceof Error ? e.message : 'Operation failed');
        } finally {
          setSaving(false);
        }
      },
    });
  };

  const handleUnban = async () => {
    if (!id) return;
    Modal.confirm({
      title: 'Unban user',
      icon: <ExclamationCircleOutlined />,
      content: 'Are you sure you want to unban this user?',
      onOk: async () => {
        setSaving(true);
        setMessage(null);
        try {
          await unbanUser(id);
          const res = await fetchUser(id);
          if (res.data) setUser(res.data);
          setEditStatus('');
          setMessage('Ban removed');
        } catch (e) {
          setMessage(e instanceof Error ? e.message : 'Operation failed');
        } finally {
          setSaving(false);
        }
      },
    });
  };

  const handleUpdateAvatar = async () => {
    if (!id) return;
    setSaving(true);
    setMessage(null);
    try {
      const body: { imageUrl?: string; avatarId?: string; isActive?: boolean } = {};
      if (avatarImageUrl.trim()) body.imageUrl = avatarImageUrl.trim();
      if (avatarActiveId) body.avatarId = avatarActiveId;
      await updateUserAvatar(id, body);
      const res = await fetchUserAvatar(id);
      setAvatar(res.data ?? null);
      if (res.data) {
        setAvatarImageUrl(res.data.imageUrl);
        setAvatarActiveId(res.data.isActive ? res.data.id : null);
      }
      setMessage('Avatar updated');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateAvatar = async () => {
    if (!id || !avatarImageUrl.trim()) return;
    setSaving(true);
    setMessage(null);
    try {
      await createUserAvatar(id, { imageUrl: avatarImageUrl.trim() });
      const res = await fetchUserAvatar(id);
      setAvatar(res.data ?? null);
      if (res.data) {
        setAvatarImageUrl(res.data.imageUrl);
        setAvatarActiveId(res.data.isActive ? res.data.id : null);
      }
      setMessage('Avatar added');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Add failed');
    } finally {
      setSaving(false);
    }
  };

  const handleGrantBadge = async () => {
    if (!id || !grantBadgeId.trim()) return;
    setSaving(true);
    setMessage(null);
    try {
      await grantUserBadge(id, { badgeId: grantBadgeId.trim() });
      const res = await fetchUserBadges(id, { limit: 50, offset: 0 });
      setUserBadges(res.data ?? []);
      setGrantBadgeId('');
      setMessage('Badge granted');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Failed to grant badge');
    } finally {
      setSaving(false);
    }
  };

  const handleRevokeBadge = async (userBadgeId: string) => {
    if (!id) return;
    Modal.confirm({
      title: 'Revoke badge',
      icon: <ExclamationCircleOutlined />,
      content: 'Are you sure you want to revoke this badge from the user?',
      onOk: async () => {
        setSaving(true);
        setMessage(null);
        try {
          await revokeUserBadge(id, userBadgeId);
          const res = await fetchUserBadges(id, { limit: 50, offset: 0 });
          setUserBadges(res.data ?? []);
          setMessage('Badge revoked');
        } catch (e) {
          setMessage(e instanceof Error ? e.message : 'Operation failed');
        } finally {
          setSaving(false);
        }
      },
    });
  };

  if (!id) {
    return <div><Alert message="Invalid user" type="error" showIcon /></div>;
  }

  if (loading || !user) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <PageHeader
          title="Error"
          description={error}
          icon={<UserOutlined />}
          backTo="/users"
          backLabel="Back to list"
        />
      </div>
    );
  }

  // Define table columns for each tab
  const eventsColumns: ColumnsType<AdminUserEventListItem> = [
    {
      title: 'Event ID',
      dataIndex: 'eventId',
      key: 'eventId',
      ellipsis: true,
      width: 100,
      render: (id: string) => <Text code style={{ fontSize: 12 }} copyable>{id}</Text>,
    },
    {
      title: 'Event',
      key: 'title',
      render: (_, record) => (
        <Link to={`/events?highlight=${record.eventId}`}>{record.eventTitle ?? record.eventId}</Link>
      ),
    },
    { title: 'Status', dataIndex: 'eventStatus', key: 'status', width: 100 },
    {
      title: 'Start',
      dataIndex: 'eventStartDate',
      key: 'start',
      width: 120,
      render: (date: string) => date ? new Date(date).toLocaleDateString('en-US') : '—',
    },
    {
      title: 'End',
      dataIndex: 'eventEndDate',
      key: 'end',
      width: 120,
      render: (date: string) => date ? new Date(date).toLocaleDateString('en-US') : '—',
    },
    { title: 'Posts', dataIndex: 'eventPostsCount', key: 'posts', width: 80 },
    { title: 'Likes', dataIndex: 'eventLikesReceived', key: 'likes', width: 80 },
    { title: 'Participation', dataIndex: 'totalParticipated', key: 'participated', width: 80 },
  ];

  const postsColumns: ColumnsType<AdminContentPostListItem> = [
    {
      title: 'Title',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
      render: (title: string) => title,
    },
    { title: 'Type', dataIndex: 'type', key: 'type', width: 100 },
    { title: 'Likes', dataIndex: 'likesCount', key: 'likes', width: 80 },
    { title: 'Comments', dataIndex: 'commentsCount', key: 'comments', width: 80 },
    {
      title: 'Created',
      dataIndex: 'createdAt',
      key: 'created',
      width: 120,
      render: (date: string) => date ? new Date(date).toLocaleDateString('en-US') : '—',
    },
    {
      title: '',
      key: 'action',
      width: 100,
      render: (_, record) => <ViewActionButton to={`/content/posts/${record.id}`} />,
    },
  ];

  const badgesColumns: ColumnsType<AdminUserBadgeListItem> = [
    {
      title: 'UserBadge ID',
      dataIndex: 'id',
      key: 'id',
      width: 100,
      ellipsis: true,
      render: (id: string) => <Text code style={{ fontSize: 12 }} copyable>{id}</Text>,
    },
    {
      title: 'Badge ID',
      dataIndex: 'badgeId',
      key: 'badgeId',
      width: 100,
      ellipsis: true,
      render: (id: string) => <Text code style={{ fontSize: 12 }} copyable>{id}</Text>,
    },
    {
      title: 'Badge',
      key: 'badge',
      render: (_, record) => (
        <Space>
          {record.badgeImageUrl && (
            <Image src={record.badgeImageUrl} width={24} height={24} preview={false} />
          )}
          <span>{record.badgeName}</span>
        </Space>
      ),
    },
    { title: 'Category', dataIndex: 'badgeCategoryName', key: 'category', width: 120 },
    {
      title: 'Visible',
      dataIndex: 'isVisible',
      key: 'visible',
      width: 80,
      render: (visible: boolean) => <Tag color={visible ? BADGE_COLOR_PRIMARY : 'default'}>{visible ? 'Yes' : 'No'}</Tag>,
    },
    {
      title: 'Claimed',
      key: 'claimed',
      width: 120,
      render: (_, record) => record.claimed ? new Date(record.claimedAt!).toLocaleDateString('en-US') : '—',
    },
    {
      title: 'Date',
      dataIndex: 'createdAt',
      key: 'created',
      width: 120,
      render: (date: string) => new Date(date).toLocaleDateString('en-US'),
    },
    {
      title: '',
      key: 'action',
      width: 80,
      render: (_, record) => (
        <Button size="small" danger onClick={() => handleRevokeBadge(record.id)} disabled={saving}>
          Revoke
        </Button>
      ),
    },
  ];

  const walletColumns: ColumnsType<AdminWalletSummaryItem> = [
    {
      title: 'Wallet ID',
      dataIndex: 'id',
      key: 'id',
      width: 100,
      ellipsis: true,
      render: (id: string) => <Text code style={{ fontSize: 12 }} copyable>{id}</Text>,
    },
    {
      title: 'User ID',
      dataIndex: 'userId',
      key: 'userId',
      width: 100,
      ellipsis: true,
      render: (id: string) => <Text code style={{ fontSize: 12 }} copyable>{id}</Text>,
    },
    { title: 'Provider', dataIndex: 'provider', key: 'provider', width: 100 },
    {
      title: 'Address',
      dataIndex: 'publicAddress',
      key: 'address',
      ellipsis: true,
    },
    { title: 'Balance', dataIndex: 'balance', key: 'balance', width: 100 },
    { title: 'Locked', dataIndex: 'lockedBalance', key: 'locked', width: 100 },
    {
      title: 'Connected',
      dataIndex: 'isConnected',
      key: 'connected',
      width: 80,
      render: (connected: boolean) => <Tag color={connected ? BADGE_COLOR_PRIMARY : 'default'}>{connected ? 'Yes' : 'No'}</Tag>,
    },
    {
      title: 'Created',
      dataIndex: 'createdAt',
      key: 'created',
      width: 150,
      render: (date: string) => date ? new Date(date).toLocaleString('en-US') : '—',
    },
  ];

  const tipsColumns: ColumnsType<AdminTipsTransactionListItem> = [
    {
      title: 'Transaction ID',
      dataIndex: 'id',
      key: 'id',
      width: 100,
      ellipsis: true,
      render: (id: string) => <Text code style={{ fontSize: 12 }} copyable>{id}</Text>,
    },
    {
      title: 'Date',
      dataIndex: 'createdAt',
      key: 'created',
      width: 150,
      render: (date: string) => new Date(date).toLocaleString('en-US'),
    },
    {
      title: 'From',
      key: 'from',
      render: (_, record) => record.fromUserDisplayName ?? record.fromUserEmail ?? record.fromUserId,
    },
    {
      title: 'To',
      key: 'to',
      render: (_, record) => record.toUserDisplayName ?? record.toUserEmail ?? record.toUserId,
    },
    { title: 'Amount', dataIndex: 'amount', key: 'amount', width: 100 },
    { title: 'Reason', dataIndex: 'reason', key: 'reason', render: (r) => r ?? '—' },
  ];

  const moderationColumns: ColumnsType<AdminModerationHistoryItem> = [
    {
      title: 'Record ID',
      dataIndex: 'id',
      key: 'id',
      width: 100,
      ellipsis: true,
      render: (id: string) => <Text code style={{ fontSize: 12 }} copyable>{id}</Text>,
    },
    {
      title: 'Date',
      dataIndex: 'createdAt',
      key: 'created',
      width: 150,
      render: (date: string) => new Date(date).toLocaleString('en-US'),
    },
    { title: 'Type', dataIndex: 'actionType', key: 'type', width: 100 },
    {
      title: 'Moderator ID',
      dataIndex: 'moderatorId',
      key: 'modId',
      width: 100,
      ellipsis: true,
      render: (id: string) => <Text code style={{ fontSize: 12 }} copyable>{id}</Text>,
    },
    { title: 'Moderator', dataIndex: 'moderatorEmail', key: 'moderator', render: (e) => e ?? '—' },
    { title: 'Reason', dataIndex: 'reason', key: 'reason', render: (r) => r ?? '—' },
  ];

  const loginColumns: ColumnsType<AdminLoginAttemptListItem> = [
    {
      title: 'Record ID',
      dataIndex: 'id',
      key: 'id',
      width: 100,
      ellipsis: true,
      render: (id: string) => <Text code style={{ fontSize: 12 }} copyable>{id}</Text>,
    },
    {
      title: 'Date',
      dataIndex: 'attemptedAt',
      key: 'attempted',
      width: 150,
      render: (date: string) => new Date(date).toLocaleString('en-US'),
    },
    { title: 'IP', dataIndex: 'ipAddress', key: 'ip', width: 120 },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => (
        <Tag color={status === 'SUCCESS' ? BADGE_COLOR_PRIMARY : 'default'}>{status}</Tag>
      ),
    },
    {
      title: 'User-Agent',
      dataIndex: 'userAgent',
      key: 'ua',
      ellipsis: true,
    },
  ];

  const tabItems = [
    {
      key: 'overview',
      label: 'Overview',
      children: (
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Card bordered title="Account">
            <Descriptions column={2} bordered size="small">
              <Descriptions.Item label="User ID" span={2}>
                <Text code copyable style={{ fontSize: 12 }}>{user.id}</Text>
              </Descriptions.Item>
              {user.auth0Id && (
                <Descriptions.Item label="Auth0 ID" span={2}>
                  <Text code copyable style={{ fontSize: 12 }}>{user.auth0Id}</Text>
                </Descriptions.Item>
              )}
              <Descriptions.Item label="Email">{user.email ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="Status">
                <Tag color={user.status === 'BANNED' ? BADGE_COLOR_SECONDARY : 'default'}>{user.status ?? '—'}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Email Verified">
                {user.emailVerified ? (
                  <CheckCircleOutlined style={{ color: 'var(--ant-color-success)', fontSize: 18 }} />
                ) : (
                  <CloseCircleOutlined style={{ color: 'var(--ant-color-text-tertiary)', fontSize: 18 }} />
                )}
              </Descriptions.Item>
              <Descriptions.Item label="Roles">
                {(user.roles ?? []).join(', ') || '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Created" span={2}>
                {user.createdAt ? new Date(user.createdAt).toLocaleString('en-US') : '—'}
              </Descriptions.Item>
            </Descriptions>
          </Card>

          {user.lastBan && (
            <Card bordered title="Last ban">
              <Descriptions column={2} bordered size="small">
                <Descriptions.Item label="Record ID" span={2}>
                  <Text code copyable style={{ fontSize: 12 }}>{user.lastBan.id}</Text>
                </Descriptions.Item>
                <Descriptions.Item label="Moderator ID" span={2}>
                  <Text code copyable style={{ fontSize: 12 }}>{user.lastBan.moderatorId}</Text>
                </Descriptions.Item>
                <Descriptions.Item label="Date">
                  {new Date(user.lastBan.createdAt).toLocaleString('en-US')}
                </Descriptions.Item>
                <Descriptions.Item label="Moderator">
                  {user.lastBan.moderatorEmail ?? '—'}
                </Descriptions.Item>
                <Descriptions.Item label="Reason" span={2}>
                  {user.lastBan.reason ?? '—'}
                </Descriptions.Item>
              </Descriptions>
            </Card>
          )}

          <Card bordered title="Edit account">
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <div>
                <div style={{ marginBottom: 4, fontWeight: 500 }}>Email</div>
                <Input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                />
              </div>
              <div>
                <div style={{ marginBottom: 4, fontWeight: 500 }}>Status</div>
                <Select
                  style={{ width: '100%' }}
                  value={editStatus}
                  onChange={setEditStatus}
                  options={[
                    { value: '', label: '—' },
                    { value: 'ACTIVE', label: 'ACTIVE' },
                    { value: 'BANNED', label: 'BANNED' },
                  ]}
                />
              </div>
              <Checkbox
                checked={editEmailVerified}
                onChange={(e) => setEditEmailVerified(e.target.checked)}
              >
                Email Verified
              </Checkbox>
              <Button type="primary" onClick={handleSaveUser} loading={saving}>
                Save
              </Button>
            </Space>
          </Card>
        </Space>
      ),
    },
    {
      key: 'profile',
      label: 'Profile',
      children: (
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Card bordered title="Profile details">
            {user.profile ? (
              <Descriptions column={2} bordered size="small">
                <Descriptions.Item label="Profile ID" span={2}>
                  <Text code copyable style={{ fontSize: 12 }}>{user.profile.id}</Text>
                </Descriptions.Item>
                <Descriptions.Item label="User ID" span={2}>
                  <Text code copyable style={{ fontSize: 12 }}>{user.profile.userId}</Text>
                </Descriptions.Item>
                <Descriptions.Item label="Display name">
                  {user.profile.displayName ?? '—'}
                </Descriptions.Item>
                <Descriptions.Item label="Username">
                  {user.profile.userName ?? '—'}
                </Descriptions.Item>
                <Descriptions.Item label="Country">{user.profile.country ?? '—'}</Descriptions.Item>
                <Descriptions.Item label="Birth date">
                  {user.profile.birthDate ?? '—'}
                </Descriptions.Item>
                <Descriptions.Item label="Bio" span={2}>
                  {user.profile.bio ?? '—'}
                </Descriptions.Item>
                <Descriptions.Item label="Posts count">
                  {user.profile.postsCount}
                </Descriptions.Item>
                <Descriptions.Item label="Trust counts">
                  {user.profile.trustCount} / {user.profile.trusterCount}
                </Descriptions.Item>
              </Descriptions>
            ) : (
              <Text type="secondary">No profile record.</Text>
            )}
          </Card>

          <Card bordered title="Avatar" loading={loadingTab}>
            {avatar === undefined ? (
              <Text type="secondary">Loading…</Text>
            ) : avatar ? (
              <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                <div style={{ textAlign: 'center' }}>
                  <Image src={avatar.imageUrl} alt="Avatar" width={120} />
                </div>
                <Descriptions column={1} bordered size="small">
                  <Descriptions.Item label="Avatar ID">
                    <Text code copyable style={{ fontSize: 12 }}>{avatar.id}</Text>
                  </Descriptions.Item>
                  <Descriptions.Item label="Active">
                    {avatar.isActive ? 'Yes' : 'No'}
                  </Descriptions.Item>
                </Descriptions>
                <div>
                  <div style={{ marginBottom: 4, fontWeight: 500 }}>Image URL</div>
                  <Input
                    type="url"
                    value={avatarImageUrl}
                    onChange={(e) => setAvatarImageUrl(e.target.value)}
                    placeholder="https://…"
                  />
                </div>
                <div>
                  <div style={{ marginBottom: 4, fontWeight: 500 }}>Avatar ID to activate</div>
                  <Input
                    value={avatarActiveId ?? ''}
                    onChange={(e) => setAvatarActiveId(e.target.value || null)}
                    placeholder="Optional"
                  />
                </div>
                <Button type="primary" onClick={handleUpdateAvatar} loading={saving}>
                  Update
                </Button>
              </Space>
            ) : (
              <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                <Text type="secondary">No avatar.</Text>
                <div>
                  <div style={{ marginBottom: 4, fontWeight: 500 }}>Image URL</div>
                  <Input
                    type="url"
                    value={avatarImageUrl}
                    onChange={(e) => setAvatarImageUrl(e.target.value)}
                    placeholder="https://…"
                  />
                </div>
                <Button
                  type="primary"
                  onClick={handleCreateAvatar}
                  loading={saving}
                  disabled={!avatarImageUrl.trim()}
                >
                  Add
                </Button>
              </Space>
            )}
          </Card>
        </Space>
      ),
    },
    {
      key: 'roles',
      label: 'Roles',
      children: (
        <Card bordered title="Edit roles">
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <div>
              <div style={{ marginBottom: 4, fontWeight: 500 }}>Roles (comma separated)</div>
              <Input
                value={editRoles}
                onChange={(e) => setEditRoles(e.target.value)}
                placeholder="ADMIN, USER, MODERATOR"
              />
            </div>
            <Button type="primary" onClick={handleSaveRoles} loading={saving}>
              Update roles
            </Button>
          </Space>
        </Card>
      ),
    },
    {
      key: 'events',
      label: 'Events',
      children: (
        <Card
          bordered
          title="Participated events"
          extra={<Link to="/events">All events</Link>}
          loading={loadingTab}
        >
          <Table
            columns={eventsColumns}
            dataSource={userEvents}
            rowKey="id"
            pagination={false}
            size="small"
          />
          {eventsPagination && eventsPagination.total > eventsPagination.limit && (
            <Text type="secondary" style={{ marginTop: 8, display: 'block' }}>
              Total {eventsPagination.total} records (showing: {userEvents.length})
            </Text>
          )}
        </Card>
      ),
    },
    {
      key: 'badges',
      label: 'Badges',
      children: (
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Card bordered title="Grant new badge">
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <div>
                <div style={{ marginBottom: 4, fontWeight: 500 }}>Badge ID</div>
                <Input
                  value={grantBadgeId}
                  onChange={(e) => setGrantBadgeId(e.target.value)}
                  placeholder="UUID"
                />
              </div>
              <Button
                type="primary"
                onClick={handleGrantBadge}
                loading={saving}
                disabled={!grantBadgeId.trim()}
              >
                Grant badge
              </Button>
            </Space>
          </Card>

          <Card bordered title="User badges" loading={loadingTab}>
            <Table
              columns={badgesColumns}
              dataSource={userBadges}
              rowKey="id"
              pagination={false}
              size="small"
            />
            {badgesPagination && badgesPagination.total > badgesPagination.limit && (
              <Text type="secondary" style={{ marginTop: 8, display: 'block' }}>
                Total {badgesPagination.total} records
              </Text>
            )}
          </Card>
        </Space>
      ),
    },
    {
      key: 'posts',
      label: 'Posts',
      children: (
        <Card
          bordered
          title="User posts"
          extra={<Link to="/content/posts">All posts</Link>}
          loading={loadingTab}
        >
          <Table
            columns={postsColumns}
            dataSource={userPosts}
            rowKey="id"
            pagination={false}
            size="small"
          />
          {postsPagination && postsPagination.total > postsPagination.limit && (
            <Text type="secondary" style={{ marginTop: 8, display: 'block' }}>
              Total {postsPagination.total} records (showing: {userPosts.length})
            </Text>
          )}
        </Card>
      ),
    },
    {
      key: 'wallet',
      label: 'Wallet & Tips',
      children: (
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          {!loadingTab && wallet.length > 0 && (
            <Card bordered title="Wallet summary">
              <Descriptions column={3} bordered size="small">
                <Descriptions.Item label="Wallet count">{wallet.length}</Descriptions.Item>
                <Descriptions.Item label="Total balance">
                  {wallet.reduce((s, w) => s + (w.balance ?? 0), 0)}
                </Descriptions.Item>
                <Descriptions.Item label="Total locked">
                  {wallet.reduce((s, w) => s + (w.lockedBalance ?? 0), 0)}
                </Descriptions.Item>
              </Descriptions>
            </Card>
          )}

          <Card
            bordered
            title="Wallets"
            extra={<Link to="/crypto/wallets">All wallets</Link>}
            loading={loadingTab}
          >
            <Table
              columns={walletColumns}
              dataSource={wallet}
              rowKey="id"
              pagination={false}
              size="small"
              scroll={{ x: true }}
            />
          </Card>

          <Card bordered title="Tips summary" loading={loadingTab}>
            {tipsSummary ? (
              <Descriptions column={2} bordered size="small">
                <Descriptions.Item label="Total sent">
                  {tipsSummary.totalSent}
                </Descriptions.Item>
                <Descriptions.Item label="Total received">
                  {tipsSummary.totalReceived}
                </Descriptions.Item>
                <Descriptions.Item label="Sent count">
                  {tipsSummary.sentCount}
                </Descriptions.Item>
                <Descriptions.Item label="Received count">
                  {tipsSummary.receivedCount}
                </Descriptions.Item>
              </Descriptions>
            ) : (
              <Text type="secondary">No data</Text>
            )}
          </Card>

          <Card bordered title="Tips transactions" loading={loadingTab}>
            <Table
              columns={tipsColumns}
              dataSource={tipsTransactions}
              rowKey="id"
              pagination={false}
              size="small"
              scroll={{ x: true }}
            />
            {tipsPagination && tipsPagination.total > tipsPagination.limit && (
              <Text type="secondary" style={{ marginTop: 8, display: 'block' }}>
                Total {tipsPagination.total} records (showing: {tipsTransactions.length})
              </Text>
            )}
          </Card>
        </Space>
      ),
    },
    {
      key: 'moderation',
      label: 'Moderation history',
      children: (
        <Card bordered title="Moderation history" loading={loadingTab}>
          <Table
            columns={moderationColumns}
            dataSource={moderation}
            rowKey="id"
            pagination={false}
            size="small"
          />
        </Card>
      ),
    },
    {
      key: 'login',
      label: 'Login attempts',
      children: (
        <Card bordered title="Login attempts" loading={loadingTab}>
          <Table
            columns={loginColumns}
            dataSource={loginAttempts}
            rowKey="id"
            pagination={false}
            size="small"
            scroll={{ x: true }}
          />
        </Card>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title={user.displayName || user.userName || user.email || user.id}
        description={user.email ?? undefined}
        icon={<UserOutlined />}
        backTo="/users"
        backLabel="Back to list"
        actions={
          user.status === 'BANNED' ? (
            <Button onClick={handleUnban} loading={saving}>
              Unban
            </Button>
          ) : (
            <Button danger onClick={handleBan} loading={saving}>
              Ban
            </Button>
          )
        }
      />

      {message && (
        <Alert
          message={message}
          type={message.includes('success') || message.includes('updated') || message.includes('granted') || message.includes('removed') || message.includes('revoked') || message.includes('added') || message.includes('banned') ? 'success' : 'error'}
          showIcon
          closable
          onClose={() => setMessage(null)}
          style={{ marginBottom: 16 }}
        />
      )}

      <Tabs activeKey={activeTab} onChange={(key) => setActiveTab(key as TabId)} items={tabItems} />
    </div>
  );
}

export default UserDetail;
