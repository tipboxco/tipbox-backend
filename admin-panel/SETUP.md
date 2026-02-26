# Admin Panel Setup Guide

## 🚀 Quick Start

### 1. Install Dependencies

```bash
cd admin-panel
npm install
```

### 2. Start Development Server

```bash
npm run dev
```

The admin panel will be available at `http://localhost:5173`

### 3. Build for Production

```bash
npm run build
```

Build output will be in `dist/` directory.

## 🔧 Backend Integration

### Option 1: Serve from Backend (Recommended)

Add to your backend router (e.g., `express`):

```typescript
import express from 'express';
import path from 'path';

const app = express();

// Serve admin panel static files
app.use('/admin', express.static(path.join(__dirname, '../../admin-panel/dist')));

// Fallback for React Router (SPA)
app.get('/admin/*', (req, res) => {
  res.sendFile(path.join(__dirname, '../../admin-panel/dist/index.html'));
});
```

### Option 2: Separate Deployment

Deploy the `dist/` folder to a CDN or static hosting:

```bash
# Build
npm run build

# Deploy dist/ folder
# Examples:
# - Vercel: vercel deploy dist/
# - Netlify: netlify deploy --dir=dist
# - AWS S3: aws s3 sync dist/ s3://your-bucket/
```

## 🔐 Authentication

Currently, the admin panel has no authentication. You should add:

1. Login page
2. Token storage (localStorage/sessionStorage)
3. Protected routes
4. API request interceptors

### Example Protected Route Setup

```typescript
// src/utils/ProtectedRoute.tsx
import { Navigate } from 'react-router-dom';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('admin_token');
  
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
}

// src/App.tsx
<Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
  {/* ... routes */}
</Route>
```

## 🔌 API Integration

### Create API Client

```typescript
// src/utils/api.ts
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';

export async function fetchAPI(endpoint: string, options?: RequestInit) {
  const token = localStorage.getItem('admin_token');
  
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : '',
      ...options?.headers,
    },
  });
  
  if (!response.ok) {
    throw new Error(`API Error: ${response.statusText}`);
  }
  
  return response.json();
}
```

### Environment Variables

Create `.env` file:

```env
VITE_API_BASE_URL=http://localhost:3000/api
VITE_APP_NAME=Tipbox Admin Panel
```

Access in code:

```typescript
const apiUrl = import.meta.env.VITE_API_BASE_URL;
```

## 📊 Data Integration Example

```typescript
// src/pages/Users.tsx
import { useEffect, useState } from 'react';
import { fetchAPI } from '../utils/api';

function Users() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAPI('/admin/users')
      .then(data => {
        setUsers(data);
        setLoading(false);
      })
      .catch(error => {
        console.error('Failed to fetch users:', error);
        setLoading(false);
      });
  }, []);

  if (loading) return <LoadingSpinner fullScreen />;

  return (
    <div>
      <PageHeader title="Users" icon="fa-users" />
      <DataCard title="User List">
        {users.length === 0 ? (
          <EmptyState
            icon="fa-users"
            title="No users found"
            description="No users in the system yet."
          />
        ) : (
          <table>
            {/* Render users */}
          </table>
        )}
      </DataCard>
    </div>
  );
}
```

## 🎨 Customization

### Change Theme Colors

Edit `src/index.css`:

```css
:root {
  --bg-primary: #1a1a1a;     /* Change background */
  --accent: #00ff00;          /* Change accent color */
  --text-primary: #ffffff;    /* Change text color */
}
```

### Add New Module

1. Create page: `src/pages/MyModule.tsx`
2. Add route in `src/App.tsx`:
   ```tsx
   <Route path="my-module" element={<MyModule />} />
   ```
3. Add nav item in `src/components/Sidebar.tsx`:
   ```tsx
   { path: '/my-module', label: 'My Module', icon: 'fa-star' }
   ```

## 🐛 Troubleshooting

### Build Errors

```bash
# Clear cache and rebuild
rm -rf node_modules dist
npm install
npm run build
```

### Port Already in Use

```bash
# Change port in package.json
"dev": "vite --port 5174"
```

### Icons Not Showing

Make sure Font Awesome is loaded in `index.html`:

```html
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />
```

## 📝 Development Checklist

- [ ] Install dependencies
- [ ] Configure API endpoint
- [ ] Add authentication
- [ ] Implement API client
- [ ] Connect pages to backend
- [ ] Add form validation
- [ ] Test responsive design
- [ ] Add error boundaries
- [ ] Setup analytics (optional)
- [ ] Build and deploy

## 🎯 Next Features to Implement

1. **Data Tables**: Add sorting, filtering, pagination
2. **Forms**: Create/edit forms for all modules
3. **Search**: Global search functionality
4. **Notifications**: Toast notifications for actions
5. **Real-time**: WebSocket for live updates
6. **Charts**: Advanced analytics with Chart.js/Recharts
7. **Export**: CSV/PDF export functionality
8. **Permissions**: Role-based access control
9. **Audit Log**: Track admin actions
10. **Dark/Light Toggle**: Theme switcher

## 📚 Resources

- [React Documentation](https://react.dev)
- [React Router](https://reactrouter.com)
- [Font Awesome Icons](https://fontawesome.com/icons)
- [Vite Guide](https://vitejs.dev/guide/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
