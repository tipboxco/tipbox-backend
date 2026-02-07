# Tipbox Admin Panel - Typography & UI Standards

**Version:** 2.0  
**Last Updated:** 2026-02-07

---

## 🎨 Design Philosophy

High-end, professional, data-dense dashboard aesthetic with strict typography hierarchy and consistent spacing.

---

## 📐 Typography Scale (Minor Third)

### Font Sizes
```css
--text-xs: 0.75rem;      /* 12px - Captions, tags, timestamps */
--text-sm: 0.875rem;     /* 14px - Body text, default (data-dense standard) */
--text-base: 1rem;       /* 16px - Sub-headers, large body text */
--text-lg: 1.25rem;      /* 20px - Section headers */
--text-xl: 1.5rem;       /* 24px - Page titles, main headers */
```

### Font Weights (Limited to 3)
```css
--font-regular: 400;     /* Body text, descriptions */
--font-medium: 500;      /* UI elements, labels, navigation */
--font-semibold: 600;    /* Primary headings, titles */
```

**❌ Avoid:** Bold (700+) - Creates "clunky" appearance

---

## 🎨 Color Hierarchy (60-30-10 Rule)

### Text Colors
```css
--text-primary: #FFFFFF;     /* 60% - Main titles, critical data */
--text-secondary: #94A3B8;   /* 30% - Navigation, labels, secondary info */
--text-muted: #64748B;       /* 10% - Timestamps, breadcrumbs, placeholders */
```

**Rule:** No two adjacent text elements should have same color/weight unless part of a list.

### Brand Colors
```css
--accent: #D0F205;           /* Primary accent (lime) */
--success: #22c55e;          /* Success states */
--danger: #ef4444;           /* Error/danger states */
```

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
All spacing must be multiples of 8px:

```css
--spacing-1: 0.5rem;     /* 8px */
--spacing-2: 1rem;       /* 16px */
--spacing-3: 1.5rem;     /* 24px - Minimum card padding */
--spacing-4: 2rem;       /* 32px */
--spacing-6: 3rem;       /* 48px */
--spacing-8: 4rem;       /* 64px */
```

### Container Rules
- **Card Padding:** Minimum 24px (`--spacing-3`)
- **Section Gaps:** 16px or 24px
- **Element Gaps:** 8px or 16px

---

## 🎯 Border Radius (Consistent Softness)

```css
--radius-sm: 0.5rem;     /* 8px - Small elements */
--radius-md: 0.75rem;    /* 12px - Standard (cards, buttons) */
--radius-lg: 1rem;       /* 16px - Large containers */
```

**Standard:** Use `--radius-md` (12px) for all cards and primary buttons.

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
<h1>Page Title</h1>          {/* 24px, semibold, primary, tight tracking */}
<h2>Section Header</h2>      {/* 20px, semibold, primary, tight tracking */}
<h3>Subsection</h3>          {/* 16px, semibold, primary */}
<p>Body text</p>             {/* 14px, regular, secondary, relaxed line height */}
<span className="text-muted">Timestamp</span>  {/* 14px, regular, muted */}
```

### Data Display
```tsx
<div className="stats-value tabular-nums">12,458</div>  {/* 24px, semibold, primary */}
<div className="stats-title">Total Users</div>          {/* 14px, regular, muted */}
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
- [ ] Font weight: 400, 500, or 600 only
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
❌ Bold (700+) font weights  
❌ Line height < 1.4  
❌ Spacing values not from 8pt grid  
❌ Inconsistent border radius  
❌ Same color for adjacent different-purpose elements  
❌ Icons same size or larger than text  

---

## 📚 Reference

**Font:** Inter (400, 500, 600)  
**Import:** `@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap');`

**Base:** All CSS variables defined in `src/index.css`

**Components:** See individual component `.css` files for implementation examples.

---

*This document is the single source of truth for typography and UI standards in Tipbox Admin Panel.*
