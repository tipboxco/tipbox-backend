import { Navigate, useSearchParams } from 'react-router-dom';

/**
 * Yasaklı kullanıcılar — Kullanıcı listesine status=BANNED filtresi ile yönlendirir.
 * Böylece tek bir liste ekranı üzerinden yönetim sağlanır.
 */
function BannedUsers() {
  const [searchParams] = useSearchParams();
  const existing = searchParams.toString();
  const query = existing ? `${existing}&status=BANNED` : 'status=BANNED';
  return <Navigate to={`/users?${query}`} replace />;
}

export default BannedUsers;
