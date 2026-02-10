import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Form, Input, Button, Card, Typography, Space, Alert, theme } from 'antd';
import { MailOutlined, LockOutlined } from '@ant-design/icons';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { FORM_LAYOUT_VERTICAL } from '../constants/form-layout';

const { Title, Text } = Typography;
const { useToken } = theme;

function Login() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const { theme: currentTheme } = useTheme();
  const { token } = useToken();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname ?? '/';

  const handleSubmit = async (values: { email: string; password: string }) => {
    setError(null);
    setLoading(true);
    try {
      await login(values.email.trim(), values.password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        backgroundColor: token.colorBgLayout,
        transition: 'background-color 0.3s',
      }}
    >
      <Card
        style={{
          width: '100%',
          maxWidth: 420,
          boxShadow: currentTheme === 'dark'
            ? '0 4px 16px rgba(0, 0, 0, 0.5)'
            : '0 4px 16px rgba(0, 0, 0, 0.1)',
        }}
      >
        <Space direction="vertical" size={24} style={{ width: '100%' }}>
          {/* Logo and Header */}
          <div style={{ textAlign: 'center' }}>
            <img
              src="https://tipbox.co/images/tipbox-logo-yellow.png"
              alt="Tipbox"
              style={{
                height: 48,
                marginBottom: 16,
              }}
            />
            <Title level={2} style={{ margin: 0, fontWeight: 700 }}>
              Admin Panel
            </Title>
            <Text type="secondary">Sign in to the admin panel</Text>
          </div>

          {/* Error Alert */}
          {error && (
            <Alert
              message="Login Error"
              description={error}
              type="error"
              closable
              onClose={() => setError(null)}
            />
          )}

          {/* Login Form */}
          <Form
            name="login"
            onFinish={handleSubmit}
            {...FORM_LAYOUT_VERTICAL}
            requiredMark={false}
            autoComplete="off"
          >
            <Form.Item
              label="Email"
              name="email"
              rules={[
                {
                  required: true,
                  message: 'Please enter your email address',
                },
                {
                  type: 'email',
                  message: 'Enter a valid email address',
                },
              ]}
            >
              <Input
                prefix={<MailOutlined />}
                placeholder="admin@tipbox.co"
                size="large"
                autoComplete="email"
                disabled={loading}
              />
            </Form.Item>

            <Form.Item
              label="Password"
              name="password"
              rules={[
                {
                  required: true,
                  message: 'Please enter your password',
                },
              ]}
            >
              <Input.Password
                prefix={<LockOutlined />}
                placeholder="••••••••"
                size="large"
                autoComplete="current-password"
                disabled={loading}
              />
            </Form.Item>

            <Form.Item style={{ marginBottom: 0 }}>
              <Button
                type="primary"
                htmlType="submit"
                size="large"
                loading={loading}
                block
              >
                {loading ? 'Signing in...' : 'Sign in'}
              </Button>
            </Form.Item>
          </Form>
        </Space>
      </Card>
    </div>
  );
}

export default Login;
