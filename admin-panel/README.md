# Tipbox Admin Panel

Modern, responsive admin panel for Tipbox backend platform built with React, TypeScript, and Vite.

## ✨ Features

- **🎨 Distinctive Design**: Glassmorphism aesthetic with lime accent (#D0F205)
- **📱 Fully Responsive**: Mobile-friendly collapsible sidebar
- **🗂️ Hierarchical Navigation**: 12 main categories with 47 organized sub-pages
- **⚡ Fast**: Built with Vite for instant HMR
- **🎯 Type-Safe**: Full TypeScript support
- **🎭 Smooth Animations**: Polished micro-interactions and transitions
- **🧩 Modular**: Reusable component library
- **🏗️ Domain-Driven**: Navigation structure mirrors backend domain architecture

## 🎨 Design System

Following `DASHBOARD_STYLE_GUIDE.md`:

- **Colors**: Dark background (#272727), lime accent (#D0F205), glassmorphic cards
- **Typography**: Jura font family (300-700 weights)
- **Components**: Glass cards, smooth transitions, Font Awesome 6.4.0 icons
- **Responsive**: Mobile-first with breakpoints at 640px, 768px, 1024px, 1400px

## 📦 Structure

```
admin-panel/
├── src/
│   ├── components/              # Reusable UI components
│   │   ├── Layout.tsx          # Main layout wrapper
│   │   ├── Sidebar.tsx         # Hierarchical navigation sidebar
│   │   ├── PageHeader.tsx      # Page title and actions
│   │   ├── StatsCard.tsx       # Statistics display card
│   │   ├── DataCard.tsx        # Generic data container
│   │   ├── EmptyState.tsx      # Placeholder for empty data
│   │   ├── Button.tsx          # Styled button component
│   │   └── LoadingSpinner.tsx  # Loading indicator
│   │
│   ├── pages/                  # Route pages (47 total)
│   │   ├── Dashboard.tsx       # Main dashboard with stats
│   │   ├── Analytics.tsx       # Platform analytics
│   │   ├── users/              # User management (5 pages)
│   │   ├── content/            # Content management (6 pages)
│   │   ├── products/           # Product management (6 pages)
│   │   ├── brands/             # Brand partnerships (5 pages)
│   │   ├── gamification/       # Badges & achievements (5 pages)
│   │   ├── events/             # Event management (4 pages)
│   │   ├── commerce/           # Transactions & payments (4 pages)
│   │   ├── crypto/             # Blockchain & NFTs (5 pages)
│   │   ├── communication/      # Messaging & notifications (4 pages)
│   │   └── system/             # System administration (3 pages)
│   │
│   ├── App.tsx                 # Root component with routing
│   ├── main.tsx                # Application entry point
│   └── index.css               # Global styles and CSS variables
│
├── index.html                  # HTML template
├── README.md                   # This file
├── NAVIGATION.md               # Detailed navigation structure
├── COMPONENTS.md               # Component library reference
└── SETUP.md                    # Integration guide
```

## 🚀 Getting Started

### Development

```bash
# Install dependencies
npm install

# Start dev server (http://localhost:5173)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### Integration with Backend

The admin panel is designed to be served by the backend at `/admin` route. Make sure the backend serves the built files from `admin-panel/dist/`.

## 🧩 Components

### Layout Components

- **Layout**: Main wrapper with sidebar and content area
- **Sidebar**: Hierarchical navigation with 12 main categories and 47 sub-pages
- **PageHeader**: Consistent page titles with icons and action buttons

### UI Components

- **StatsCard**: Display metrics with icons, values, and trend indicators
- **DataCard**: Generic container for tabular or list data
- **EmptyState**: Placeholder for pages without content
- **Button**: Styled button with variants (primary, secondary, danger, success)

### Usage Example

```tsx
import PageHeader from '../components/PageHeader';
import StatsCard from '../components/StatsCard';
import Button from '../components/Button';

function MyPage() {
  return (
    <div>
      <PageHeader
        title="My Page"
        description="Page description"
        icon="fa-star"
        actions={<Button icon="fa-plus">Add New</Button>}
      />

      <StatsCard
        title="Total Users"
        value="1,234"
        icon="fa-users"
        trend={{ value: 12.5, isPositive: true }}
        color="accent"
      />
    </div>
  );
}
```

## 🗂️ Navigation Structure

The admin panel features a comprehensive hierarchical navigation system:

- **📊 Dashboard**: Main overview
- **👥 Users**: User management (5 sub-pages)
- **📝 Content**: Content moderation (6 sub-pages)
- **🏪 Products**: Product catalog (6 sub-pages)
- **🏢 Brands**: Brand partnerships (5 sub-pages)
- **🎮 Gamification**: Badges & achievements (5 sub-pages)
- **🎯 Events**: Event management (4 sub-pages)
- **💰 Commerce**: Transactions & payments (4 sub-pages)
- **💎 Crypto**: Blockchain & NFTs (5 sub-pages)
- **💬 Communication**: Messaging & notifications (4 sub-pages)
- **📈 Analytics**: Platform analytics
- **⚙️ System**: Administration (3 sub-pages)

See [NAVIGATION.md](NAVIGATION.md) for detailed breakdown of all 47 pages.

## 🎯 Current State

### ✅ Completed

- Full responsive layout with collapsible sidebar
- Hierarchical navigation with expandable submenus
- Dashboard with stats cards, activity feed, quick actions, and system status
- 47 pages organized across 12 main categories
- Domain-aligned structure matching backend architecture
- Reusable component library
- TypeScript setup
- Build system (Vite)

### 🚧 Next Steps

- Backend API integration
- Data tables with sorting, filtering, pagination
- Form components for CRUD operations
- Authentication and authorization
- Real-time updates (WebSocket/SSE)
- Advanced analytics charts
- Search functionality
- Bulk actions
- Export capabilities

## 🎨 Customization

### CSS Variables

All design tokens are defined in `src/index.css`:

```css
:root {
  --bg-primary: #272727;
  --accent: #D0F205;
  --text-primary: #FAFAFA;
  /* ... more variables */
}
```

Modify these to customize the theme.

### Adding New Pages

#### Adding a top-level page:
1. Create page component: `src/pages/MyPage.tsx`
2. Add route in `src/App.tsx`: `<Route path="my-page" element={<MyPage />} />`
3. Add to `Sidebar.tsx` menuItems: `{ path: '/my-page', label: 'My Page', icon: 'fa-star' }`

#### Adding a sub-page:
1. Create page in subdirectory: `src/pages/users/MySubPage.tsx`
2. Add route in `src/App.tsx`: `<Route path="users/my-sub" element={<MySubPage />} />`
3. Add to parent's subItems in `Sidebar.tsx`: `{ path: '/users/my-sub', label: 'My Sub Page' }`

## 📱 Responsive Design

- **Desktop (1400px+)**: Full sidebar, 4-column stats grid
- **Tablet (768px-1024px)**: Collapsible sidebar, 2-3 column grids
- **Mobile (<768px)**: Hidden sidebar with overlay, single column layout

## 🛠 Tech Stack

- **React 18**: UI library
- **TypeScript**: Type safety
- **React Router 6**: Client-side routing
- **Vite**: Build tool and dev server
- **CSS3**: Styling with custom properties
- **Font Awesome 6**: Icon library

## 📄 License

Part of Tipbox backend platform.
