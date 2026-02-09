import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Form, Input, Button, Card, Typography, Space, Alert } from 'antd';
import { MailOutlined, LockOutlined } from '@ant-design/icons';
import { useAuth } from '../contexts/AuthContext';

const { Title, Text } = Typography;

function Login() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
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
      setError(err instanceof Error ? err.message : 'Giriş yapılamadı');
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
      }}
    >
      <Card
        style={{
          width: '100%',
          maxWidth: 420,
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
            <Text type="secondary">Yönetim paneline giriş yapın</Text>
          </div>

          {/* Error Alert */}
          {error && (
            <Alert
              message="Giriş Hatası"
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
            layout="vertical"
            requiredMark={false}
            autoComplete="off"
          >
            <Form.Item
              label="E-posta"
              name="email"
              rules={[
                {
                  required: true,
                  message: 'Lütfen e-posta adresinizi girin',
                },
                {
                  type: 'email',
                  message: 'Geçerli bir e-posta adresi girin',
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
              label="Şifre"
              name="password"
              rules={[
                {
                  required: true,
                  message: 'Lütfen şifrenizi girin',
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
                {loading ? 'Giriş yapılıyor...' : 'Giriş yap'}
              </Button>
            </Form.Item>
          </Form>
        </Space>
      </Card>
    </div>
  );
}

export default Login;
