import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Button from '../components/Button';
import './Login.css';

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname ?? '/';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email.trim(), password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Giriş yapılamadı');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-header">
          <img
            src="https://tipbox.co/images/tipbox-logo-yellow.png"
            alt="Tipbox"
            className="login-logo"
          />
          <h1 className="login-title">Admin Panel</h1>
          <p className="login-subtitle">Yönetim paneline giriş yapın</p>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          {error && (
            <div className="login-error" role="alert">
              {error}
            </div>
          )}
          <label className="login-label" htmlFor="login-email">
            E-posta
          </label>
          <input
            id="login-email"
            type="email"
            className="login-input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@tipbox.co"
            autoComplete="email"
            required
            disabled={loading}
          />
          <label className="login-label" htmlFor="login-password">
            Şifre
          </label>
          <input
            id="login-password"
            type="password"
            className="login-input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
            required
            disabled={loading}
          />
          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="login-submit"
            disabled={loading}
          >
            {loading ? 'Giriş yapılıyor...' : 'Giriş yap'}
          </Button>
        </form>
      </div>
    </div>
  );
}

export default Login;
