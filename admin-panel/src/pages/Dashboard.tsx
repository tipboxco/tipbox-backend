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
          setError(e instanceof Error ? e.message : 'Failed to load statistics');
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
              <Card bordered hoverable>
                <Statistic
                  title="Users"
                  value={stats.users}
                  prefix={<UserOutlined />}
                  valueStyle={{ fontWeight: 700 }}
                />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Total registered
                </Text>
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card bordered hoverable>
                <Statistic
                  title="Posts"
                  value={stats.posts}
                  prefix={<FileTextOutlined />}
                  valueStyle={{ fontWeight: 700 }}
                />
                {stats.users > 0 && (
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    ~{(stats.posts / stats.users).toFixed(1)} posts per user
                  </Text>
                )}
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card bordered hoverable>
                <Statistic
                  title="Banned"
                  value={stats.bannedUsers}
                  prefix={<UserDeleteOutlined />}
                  valueStyle={{ fontWeight: 700, color: '#D8365D' }}
                />
                {stats.users > 0 && (
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {((stats.bannedUsers / stats.users) * 100).toFixed(1)}% ratio
                  </Text>
                )}
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card bordered hoverable>
                <Statistic
                  title="Admin Log"
                  value={stats.adminLogs}
                  prefix={<ClockCircleOutlined />}
                  valueStyle={{ fontWeight: 700 }}
                />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Total records
                </Text>
              </Card>
            </Col>
          </Row>
        )
      )}

      {/* Main Content Grid */}
      <Row gutter={[16, 16]}>
        {/* Quick Actions */}
        <Col xs={24}>
          <Card bordered title="Quick Access" hoverable>
            <Space size={[12, 12]} wrap>
              {quickActions.map((action) => (
                <Button
                  key={action.title}
                  type={action.type}
                  icon={action.icon}
                  size="large"
                  onClick={() => action.path && navigate(action.path)}
                >
                  {action.title}
                </Button>
              ))}
            </Space>
          </Card>
        </Col>

        {/* Recent Activity */}
        <Col xs={24} lg={14}>
          <Card
            bordered
            hoverable
            title={
              <Space>
                <ClockCircleOutlined />
                <span>Recent Activities</span>
              </Space>
            }
            extra={
              <Button
                type="link"
                size="small"
                onClick={() => navigate('/system/logs')}
              >
                View All
              </Button>
            }
          >
            <List
              dataSource={recentActivity}
              renderItem={(activity) => (
                <List.Item>
                  <List.Item.Meta
                    avatar={
                      <div
                        style={{
                          fontSize: 18,
                          color: 'var(--ant-color-primary)',
                        }}
                      >
                        {activity.icon}
                      </div>
                    }
                    title={<Text>{activity.message}</Text>}
                    description={
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {activity.time}
                      </Text>
                    }
                  />
                </List.Item>
              )}
            />
          </Card>
        </Col>

        {/* System Status */}
        <Col xs={24} lg={10}>
          <Card
            bordered
            hoverable
            title={
              <Space>
                <SettingOutlined />
                <span>System Status</span>
              </Space>
            }
            extra={
              <Space align="center" size={4}>
                <Badge status="success" />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  All Systems Operational
                </Text>
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
                    title={<Text strong>{system.name}</Text>}
                    description={
                      <Space size={4} split="|">
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          Uptime: {system.uptime}
                        </Text>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          Latency: {system.latency}
                        </Text>
                      </Space>
                    }
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
