import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Row,
  Col,
  Card,
  Statistic,
  List,
  Button,
  Space,
  Typography,
  Badge,
  Spin,
  Alert,
} from 'antd';
import {
  UserOutlined,
  FileTextOutlined,
  UserDeleteOutlined,
  ClockCircleOutlined,
  CalendarOutlined,
  BarChartOutlined,
  SettingOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import { fetchAdminStats } from '../api/admin-stats';
import type { AdminStatsResponse } from '../types/admin';

const { Title, Text, Paragraph } = Typography;

const recentActivity = [
  {
    id: 1,
    type: 'user',
    message: 'New user registered: johndoe@example.com',
    time: '2m',
    icon: <UserOutlined />,
  },
  {
    id: 2,
    type: 'event',
    message: 'Event "Tech Summit 2024" published',
    time: '15m',
    icon: <CalendarOutlined />,
  },
  {
    id: 3,
    type: 'payment',
    message: 'Payment received: ₺1,250',
    time: '1h',
    icon: <CheckCircleOutlined />,
  },
  {
    id: 4,
    type: 'brand',
    message: 'Brand "TechCorp" verified',
    time: '2h',
    icon: <CheckCircleOutlined />,
  },
  {
    id: 5,
    type: 'content',
    message: 'New content by @expert_user',
    time: '3h',
    icon: <FileTextOutlined />,
  },
  {
    id: 6,
    type: 'report',
    message: 'Report #442 resolved',
    time: '4h',
    icon: <CheckCircleOutlined />,
  },
];

const systemStatus = [
  { name: 'API Server', status: 'online', uptime: '99.9%', latency: '12ms' },
  { name: 'Database', status: 'online', uptime: '100%', latency: '3ms' },
  { name: 'Cache', status: 'online', uptime: '98.5%', latency: '1ms' },
  { name: 'Payments', status: 'online', uptime: '99.2%', latency: '—' },
];

function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<AdminStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchAdminStats();
        if (!cancelled && res.data) setStats(res.data);
      } catch (e) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : 'İstatistikler yüklenemedi');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const quickActions = [
    {
      title: 'Create Event',
      icon: <CalendarOutlined />,
      path: '/events',
      type: 'primary' as const,
    },
    {
      title: 'Users',
      icon: <UserOutlined />,
      path: '/users',
      type: 'default' as const,
    },
    {
      title: 'Reports',
      icon: <BarChartOutlined />,
      path: '/users/reports',
      type: 'default' as const,
    },
    {
      title: 'Settings',
      icon: <SettingOutlined />,
      path: '/system/settings',
      type: 'default' as const,
    },
  ];

  return (
    <div>
      {/* Welcome Header */}
      <div style={{ marginBottom: 32 }}>
        <Space direction="vertical" size={8} style={{ width: '100%' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <Title level={2} style={{ margin: 0, fontWeight: 700 }}>
                Welcome to Tipbox Admin
              </Title>
              <Paragraph type="secondary" style={{ margin: 0 }}>
                Monitor and manage your platform from this central hub
              </Paragraph>
            </div>
            <Space align="center">
              <CalendarOutlined />
              <Text type="secondary">
                {new Date().toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </Text>
            </Space>
          </div>
        </Space>
      </div>

      {error && (
        <Alert
          message="Error"
          description={error}
          type="error"
          closable
          style={{ marginBottom: 24 }}
        />
      )}

      {/* Stats Grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 48 }}>
          <Spin size="large" />
        </div>
      ) : (
        stats && (
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col xs={24} sm={12} lg={6}>
              <Card bordered>
                <Statistic
                  title="Kullanıcılar"
                  value={stats.users}
                  prefix={<UserOutlined />}
                  valueStyle={{ fontWeight: 700 }}
                  suffix={<Text type="secondary">Toplam kayıtlı</Text>}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card bordered>
                <Statistic
                  title="Gönderiler"
                  value={stats.posts}
                  prefix={<FileTextOutlined />}
                  valueStyle={{ fontWeight: 700 }}
                  suffix={
                    stats.users ? (
                      <Text type="secondary">
                        ~{(stats.posts / Math.max(stats.users, 1)).toFixed(1)} / kullanıcı
                      </Text>
                    ) : undefined
                  }
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card bordered>
                <Statistic
                  title="Yasaklı"
                  value={stats.bannedUsers}
                  prefix={<UserDeleteOutlined />}
                  valueStyle={{ fontWeight: 700, color: '#ff4d4f' }}
                  suffix={
                    stats.users ? (
                      <Text type="secondary">
                        %{((stats.bannedUsers / stats.users) * 100).toFixed(1)} kullanıcı
                      </Text>
                    ) : undefined
                  }
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card bordered>
                <Statistic
                  title="Admin Log"
                  value={stats.adminLogs}
                  prefix={<ClockCircleOutlined />}
                  valueStyle={{ fontWeight: 700 }}
                  suffix={<Text type="secondary">Kayıt sayısı</Text>}
                />
              </Card>
            </Col>
          </Row>
        )
      )}

      {/* Main Content Grid */}
      <Row gutter={[16, 16]}>
        {/* Recent Activity */}
        <Col xs={24} lg={12}>
          <Card
            bordered
            title="Recent Activity"
            extra={
              <Button
                type="default"
                size="small"
                onClick={() => navigate('/system/logs')}
              >
                Admin Loglar
              </Button>
            }
            style={{ height: '100%' }}
          >
            <List
              dataSource={recentActivity}
              renderItem={(activity) => (
                <List.Item>
                  <List.Item.Meta
                    avatar={activity.icon}
                    title={activity.message}
                    description={activity.time}
                  />
                </List.Item>
              )}
            />
          </Card>
        </Col>

        {/* Quick Actions */}
        <Col xs={24} lg={12}>
          <Card bordered title="Quick Actions" style={{ marginBottom: 16 }}>
            <Space size={[8, 8]} wrap>
              {quickActions.map((action) => (
                <Button
                  key={action.title}
                  type={action.type}
                  icon={action.icon}
                  onClick={() => action.path && navigate(action.path)}
                >
                  {action.title}
                </Button>
              ))}
            </Space>
          </Card>

          {/* System Status */}
          <Card
            bordered
            title="System Status"
            extra={
              <Space align="center">
                <Badge status="success" />
                <Text type="secondary">All Systems Operational</Text>
              </Space>
            }
          >
            <List
              dataSource={systemStatus}
              renderItem={(system) => (
                <List.Item
                  extra={
                    <Badge
                      status={system.status === 'online' ? 'success' : 'error'}
                      text={system.status}
                    />
                  }
                >
                  <List.Item.Meta
                    title={system.name}
                    description={`${system.uptime} · ${system.latency}`}
                  />
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
}

export default Dashboard;
