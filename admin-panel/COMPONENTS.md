# Component Library Reference

## 🎨 Design Tokens

Tokens are defined in `src/index.css`. **Light/Dark** themes via `data-theme="light"` | `data-theme="dark"` on `<html>` (see `ThemeContext`).

- **Colors:** Theme-dependent (`--bg-page`, `--bg-card`, `--text-primary`, `--text-secondary`, `--text-muted`, `--accent`, `--border`, `--bg-hover`, etc.).
- **Spacing (8pt grid):** `--spacing-1` (8px) … `--spacing-8` (64px), `--container-max` (1280px).
- **Radius:** `--radius-sm` (6px), `--radius-md` (8px), `--radius-lg` (12px), `--radius-xl` (16px).
- **Motion:** `--transition-fast`, `--transition-base`, `--transition-slow`, `--ease-out-expo`.

See [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) and [TYPOGRAPHY_STANDARDS.md](TYPOGRAPHY_STANDARDS.md) for full reference.

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

### Modal

Shared modal shell: overlay, box, header (title + close), body (children).

**Props:**
- `title`: string - Modal title
- `onClose`: () => void - Close handler
- `children`: ReactNode - Body content (form, etc.)
- `size`: 'default' | 'wizard' - Optional; 'wizard' uses wider max-width

**Example:**
```tsx
<Modal title="Edit Item" onClose={onClose}>
  <form onSubmit={handleSubmit}>
    {/* form fields */}
    <div className="modal-actions">
      <Button type="submit" variant="primary">Save</Button>
      <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
    </div>
  </form>
</Modal>
```

## 🎯 Layout Components

### Sidebar

Collapsible navigation sidebar with all module links.

**Features:**
- Pre-configured module routes
- Collapse/expand functionality
- Active route highlighting (accent pill)
- **Theme toggle** (light/dark) in footer via `useTheme()`
- Mobile-responsive with overlay

### Layout

Main layout wrapper: Sidebar + main content area. Content is wrapped in `.main-content-inner` with `max-width: var(--container-max)` and centered padding from spacing scale.

**Usage:**
Automatically applied via React Router. All pages are wrapped in Layout.

### ThemeContext

Provides theme (light/dark) and toggle. App is wrapped in `ThemeProvider`; use `useTheme()` for `theme`, `setTheme`, `toggleTheme`. Persists to `localStorage`; initial value from `localStorage` or `prefers-color-scheme`.

## 🎨 Design Patterns

### Glassmorphism Cards

```css
background: var(--bg-glass);
backdrop-filter: blur(10px);
border: 1px solid var(--border);
border-radius: var(--radius-md);
```

### Hover Effects

Prefer subtle hover (no heavy glow/transform):

```css
transition: all var(--transition-base);
/* Optional: light border or background change */
background: var(--bg-glass-hover);
border-color: var(--border);
box-shadow: var(--shadow-card-hover);
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

- **Mobile**: < 640px (single column, reduced padding)
- **Tablet**: 640px - 1024px (2 columns for stats, collapsible sidebar overlay)
- **Desktop**: ≥ 1024px (full layout; main content max-width `--container-max` 1280px)

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
