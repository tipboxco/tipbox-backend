# Tipbox Admin Panel - Typography & UI Standards

**Version:** 3.0  
**Last Updated:** 2026-02-09

---

## 🎨 Design Philosophy

Minimal, professional admin panel (Gitbook-style): strict typography hierarchy, consistent 8pt spacing, black/white/grey with minimal Tipbox accent. Supports **Light** and **Dark** themes via `data-theme="light"` / `data-theme="dark"` on `<html>`.

---

## 📐 Typography Scale

### Font Sizes
```css
--text-xs: 0.75rem;      /* 12px - Captions, tags, timestamps */
--text-sm: 0.875rem;     /* 14px - Body text, default */
--text-base: 1rem;       /* 16px - Sub-headers, large body */
--text-lg: 1.25rem;      /* 20px - Section headers */
--text-xl: 1.5rem;       /* 24px - Page titles */
--text-2xl: 2rem;        /* 32px - Hero titles */
```

### Font Weights
```css
--font-regular: 400;     /* Body text, descriptions */
--font-medium: 500;      /* UI elements, labels, navigation */
--font-semibold: 600;    /* Section headings, card titles */
--font-bold: 700;        /* Page titles, key metrics (use sparingly) */
```

**Rule:** Use **bold (700)** only for page titles (`.page-title`) and primary numeric values (`.stats-value`). Prefer semibold (600) for other headings.

---

## 🎨 Color Hierarchy

### Text Colors (theme-dependent)
- **Dark:** `--text-primary`, `--text-secondary`, `--text-muted` (white/grey scale)
- **Light:** Same names, values from `[data-theme="light"]` (black/grey scale)

**Rule:** No two adjacent text elements should have same color/weight unless part of a list.

### Accent (minimal use)
Use `--accent` only for: primary CTA button, active nav item, page header icon, key links. Cards/tables/borders use grey tokens (`--border`, `--text-secondary`).

---

## 📏 Advanced Typography Rules

### Letter Spacing
```css
--tracking-tight: -0.02em;   /* Headings >18px (premium look) */
--tracking-normal: 0;        /* Default */
--tracking-wide: 0.01em;     /* UI labels, buttons (legibility) */
```

### Line Heights
```css
--leading-tight: 1.25;       /* Headings */
--leading-normal: 1.5;       /* UI elements */
--leading-relaxed: 1.6;      /* Body text, paragraphs */
```

**❌ Never use:** `line-height: normal` or `< 1.4`

### Numerical Data
All numbers must use tabular nums for vertical alignment:
```css
font-variant-numeric: tabular-nums;
```

Applied to: `.tabular-nums`, `table`, `.stats-value`, `.data-value`

---

## 📐 Spacing System (8pt Grid)

### Base Grid
All spacing from a single scale (8px base):

```css
--spacing-1: 0.5rem;     /* 8px */
--spacing-2: 1rem;       /* 16px */
--spacing-3: 1.5rem;     /* 24px */
--spacing-4: 2rem;       /* 32px */
--spacing-5: 2.5rem;     /* 40px */
--spacing-6: 3rem;       /* 48px */
--spacing-7: 3.5rem;     /* 56px */
--spacing-8: 4rem;       /* 64px */
--container-max: 1280px; /* Main content max-width */
```

### Container Rules
- **Card padding:** `--spacing-2` / `--spacing-3`
- **Section gaps:** `--spacing-3` or `--spacing-4`
- **Table cell padding:** `--spacing-2` vertical, `--spacing-3` horizontal

---

## 🎯 Border Radius

```css
--radius-sm: 6px;   /* Small elements */
--radius-md: 8px;   /* Buttons, inputs */
--radius-lg: 12px;  /* Cards, modals */
--radius-xl: 16px;  /* Large containers */
```

**Standard:** Use `--radius-md` for buttons/inputs, `--radius-lg` for cards and modals.

---

## 🎨 Component Standards

### Navigation

#### Active States
- Background: `rgba(var(--accent-rgb), 0.1)`
- Text Color: `var(--accent)`
- Left Border: 3px solid `var(--accent)`

#### Icon-to-Text Ratio
Icons should be **10-15% smaller** than companion text:
```css
.nav-item {
  font-size: var(--text-sm);  /* 14px */
}
.nav-icon {
  font-size: 1.125rem;        /* 18px - 11.5% smaller */
  opacity: 0.9;
}
```

### Buttons

#### Sizing
```css
.btn-sm:  padding: var(--spacing-1) var(--spacing-2);  /* 8px 16px */
.btn-md:  padding: var(--spacing-2) var(--spacing-3);  /* 16px 24px */
.btn-lg:  padding: var(--spacing-2) var(--spacing-4);  /* 16px 32px */
```

#### Typography
- Font Weight: `var(--font-medium)` (500)
- Letter Spacing: `var(--tracking-wide)` (+0.01em)
- Border Radius: `var(--radius-md)` (12px)

### Cards

#### Structure
```css
padding: var(--spacing-3);           /* 24px minimum */
border-radius: var(--radius-md);     /* 12px */
border: 1px solid var(--border);
background: var(--bg-glass);
backdrop-filter: blur(10px);
```

#### Hover State
```css
transform: translateY(-2px);
box-shadow: 0 8px 24px rgba(var(--accent-rgb), 0.15);
```

---

## 🔄 Transitions

```css
--transition-fast: 0.15s cubic-bezier(0.4, 0, 0.2, 1);   /* Quick interactions */
--transition-base: 0.2s cubic-bezier(0.4, 0, 0.2, 1);    /* Standard */
--transition-slow: 0.3s cubic-bezier(0.4, 0, 0.2, 1);    /* Complex animations */
```

---

## 📋 Usage Examples

### Heading Hierarchy
```tsx
<h1>Page Title</h1>          {/* text-2xl, semibold/bold, primary */}
<h2>Section Header</h2>      {/* text-xl, semibold, primary */}
<h3>Subsection</h3>          {/* text-lg, semibold, primary */}
<p>Body text</p>             {/* text-sm, regular, secondary */}
<span className="text-muted">Timestamp</span>  {/* text-sm, regular, muted */}
```

### Data Display
```tsx
<div className="stats-value tabular-nums">12,458</div>  {/* xl, bold, primary */}
<div className="stats-title">Total Users</div>          {/* xs, regular, muted */}
```

### Navigation
```tsx
<nav className="nav-item">                    {/* 14px, medium, secondary */}
  <i className="nav-icon fa-users"></i>       {/* 18px, 90% opacity */}
  <span className="nav-label">Users</span>
</nav>
```

---

## ✅ Checklist for New Components

- [ ] Font size from minor third scale
- [ ] Font weight: 400, 500, 600, or 700 (700 only for page title / key stats)
- [ ] Text color: primary, secondary, or muted
- [ ] Spacing: multiples of 8px
- [ ] Border radius: 8px, 12px, or 16px
- [ ] Line height: 1.25, 1.5, or 1.6
- [ ] Letter spacing applied correctly
- [ ] Numbers use `tabular-nums`
- [ ] Icons 10-15% smaller than text
- [ ] Transitions use CSS variables

---

## 🚫 Common Mistakes to Avoid

❌ Using arbitrary font sizes (e.g., 13px, 15px, 17px)  
❌ Bold (700) except page title and key metrics  
❌ Line height < 1.4  
❌ Spacing values not from 8pt grid  
❌ Inconsistent border radius  
❌ Same color for adjacent different-purpose elements  
❌ Icons same size or larger than text  

---

## 📚 Reference

**Font:** Inter (400, 500, 600, 700)  
**Themes:** Light and Dark via `data-theme` on `<html>`. Token sets in `src/index.css`.

**Base:** All CSS variables in `src/index.css`; theme-agnostic (spacing, typography scale) in `:root`, theme-specific (colors) in `[data-theme="light"]` and `[data-theme="dark"]`.

**Components:** See individual component `.css` files for implementation examples.

---

*This document is the single source of truth for typography and UI standards in Tipbox Admin Panel.*
