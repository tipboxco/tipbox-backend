# Component Library Reference

## 🎨 Design Tokens

```css
/* Colors */
--bg-primary: #272727          /* Main background */
--bg-glass: rgba(255,255,255,0.03)  /* Glass cards */
--accent: #D0F205              /* Lime accent */
--text-primary: #FAFAFA        /* Main text */
--text-secondary: #FAFAFA      /* Secondary text */
--success: #22c55e             /* Success state */
--danger: #ef4444              /* Error/danger state */

/* Spacing */
--spacing-xs: 8px
--spacing-sm: 12px
--spacing-md: 16px
--spacing-lg: 24px
--spacing-xl: 32px

/* Border Radius */
--radius-sm: 8px
--radius-md: 12px
--radius-lg: 16px
```

## 📦 Components

### Button

Versatile button component with multiple variants and sizes.

**Props:**
- `variant`: 'primary' | 'secondary' | 'danger' | 'success'
- `size`: 'sm' | 'md' | 'lg'
- `icon`: Font Awesome icon class (e.g., 'fa-plus')
- All standard button HTML attributes

**Example:**
```tsx
<Button variant="primary" icon="fa-plus">Add User</Button>
<Button variant="secondary" size="sm">Cancel</Button>
<Button variant="danger" icon="fa-trash">Delete</Button>
```

### StatsCard

Display key metrics with optional trend indicators.

**Props:**
- `title`: string - Metric name
- `value`: string | number - Metric value
- `icon`: string - Font Awesome icon
- `trend`: { value: number, isPositive: boolean } - Optional trend
- `color`: 'accent' | 'success' | 'danger' | 'neutral'

**Example:**
```tsx
<StatsCard
  title="Total Users"
  value="12,458"
  icon="fa-users"
  trend={{ value: 12.5, isPositive: true }}
  color="accent"
/>
```

### DataCard

Container for data with header and optional actions.

**Props:**
- `title`: string - Card title
- `children`: ReactNode - Card content
- `action`: ReactNode - Optional action buttons
- `className`: string - Additional CSS classes

**Example:**
```tsx
<DataCard
  title="Recent Activity"
  action={<Button size="sm">View All</Button>}
>
  {/* Your content here */}
</DataCard>
```

### PageHeader

Consistent page header with title, description, icon, and actions.

**Props:**
- `title`: string - Page title
- `description`: string - Optional description
- `icon`: string - Font Awesome icon
- `actions`: ReactNode - Optional action buttons

**Example:**
```tsx
<PageHeader
  title="Users"
  description="Manage platform users"
  icon="fa-users"
  actions={<Button icon="fa-plus">Add User</Button>}
/>
```

### EmptyState

Placeholder for empty data states.

**Props:**
- `icon`: string - Font Awesome icon
- `title`: string - Empty state title
- `description`: string - Empty state description
- `action`: ReactNode - Optional call-to-action

**Example:**
```tsx
<EmptyState
  icon="fa-inbox"
  title="No data found"
  description="There's nothing here yet."
  action={<Button>Get Started</Button>}
/>
```

### LoadingSpinner

Animated loading indicator.

**Props:**
- `size`: 'sm' | 'md' | 'lg'
- `fullScreen`: boolean - Show as full-screen overlay

**Example:**
```tsx
<LoadingSpinner size="md" />
<LoadingSpinner fullScreen={true} />
```

## 🎯 Layout Components

### Sidebar

Collapsible navigation sidebar with all module links.

**Features:**
- 14 pre-configured module routes
- Collapse/expand functionality
- Active route highlighting
- Mobile-responsive with overlay
- Smooth animations

### Layout

Main layout wrapper that combines sidebar and content area.

**Usage:**
Automatically applied via React Router. All pages are wrapped in Layout.

## 🎨 Design Patterns

### Glassmorphism Cards

```css
background: var(--bg-glass);
backdrop-filter: blur(10px);
border: 1px solid var(--border);
border-radius: var(--radius-md);
```

### Hover Effects

```css
transition: all var(--transition-base);
transform: translateY(-4px);
box-shadow: 0 8px 24px rgba(var(--accent-rgb), 0.15);
```

### Animations

All components use staggered entry animations:

```tsx
style={{ animationDelay: `${index * 0.1}s` }}
className="fade-in"  // or "slide-in"
```

## 🎭 Icon Usage

Using Font Awesome 6.4.0 Solid icons:

```tsx
<i className="fa-solid fa-users"></i>
<i className="fa-solid fa-calendar-star"></i>
<i className="fa-solid fa-gear"></i>
```

## 📱 Responsive Breakpoints

- **Mobile**: < 640px (single column)
- **Tablet**: 640px - 1024px (2-3 columns, collapsible sidebar)
- **Desktop**: 1024px - 1400px (full layout)
- **Large**: > 1400px (max-width constrained)

## 🎨 Color Usage Guide

| Use Case | Color | Variable |
|----------|-------|----------|
| Primary actions | Lime | `var(--accent)` |
| Success states | Green | `var(--success)` |
| Danger/errors | Red | `var(--danger)` |
| Text headings | White | `var(--text-primary)` |
| Text body | Gray | `var(--text-secondary)` |
| Backgrounds | Dark gray | `var(--bg-primary)` |
| Cards | Glass | `var(--bg-glass)` |

## 🚀 Quick Start Template

```tsx
import PageHeader from '../components/PageHeader';
import DataCard from '../components/DataCard';
import StatsCard from '../components/StatsCard';
import Button from '../components/Button';

function MyPage() {
  return (
    <div>
      <PageHeader
        title="My Module"
        description="Module description"
        icon="fa-star"
        actions={<Button icon="fa-plus">Add New</Button>}
      />

      {/* Stats */}
      <div className="stats-grid">
        <StatsCard
          title="Total Items"
          value="1,234"
          icon="fa-box"
          color="accent"
        />
      </div>

      {/* Main Content */}
      <DataCard title="Items List">
        {/* Your content */}
      </DataCard>
    </div>
  );
}
```
