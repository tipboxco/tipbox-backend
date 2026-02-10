import { Navigate, useSearchParams } from 'react-router-dom';

/**
 * Banned users — Redirects to user list with status=BANNED filter.
 * This allows management through a single list screen.
 */
function BannedUsers() {
  const [searchParams] = useSearchParams();
  const existing = searchParams.toString();
  const query = existing ? `${existing}&status=BANNED` : 'status=BANNED';
  return <Navigate to={`/users?${query}`} replace />;
}

export default BannedUsers;
