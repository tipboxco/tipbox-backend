# Tipbox Admin Panel — Design System

**Version:** 3.0  
**Last Updated:** 2026-02-09

---

## Overview

Minimal, professional admin UI (Gitbook-style): black/white/grey with **minimal Tipbox primary (accent)**. Supports **Light** and **Dark** themes.

- **Single source of truth:** `src/index.css` (tokens), `TYPOGRAPHY_STANDARDS.md` (typography), `COMPONENTS.md` (components).
- **Themes:** `data-theme="light"` | `data-theme="dark"` on `<html>`. Applied via `ThemeContext`; persisted in `localStorage`; optional system preference on first load.
- **Spacing:** 8pt grid only (`--spacing-1` … `--spacing-8`). No `--gap-8` / `--gap-10`; use `--spacing-4` / `--spacing-5`.
- **Container:** Main content max-width `--container-max` (1280px); padding from spacing scale.

---

## Token Summary

| Category   | Where              | Notes |
|-----------|---------------------|-------|
| Colors    | `index.css`         | `:root` + `[data-theme="dark"]` (default), `[data-theme="light"]`. Includes `--bg-page`, `--bg-hover`, `--neutral-rgb`, `--border-subtle`. |
| Typography| `index.css` :root   | `--text-xs` … `--text-3xl`, `--font-regular` … `--font-bold`, `--leading-*`, `--tracking-*`. |
| Spacing   | `index.css` :root   | `--spacing-1` (8px) … `--spacing-8` (64px). |
| Radius    | `index.css` :root   | `--radius-sm` (6px), `--radius-md` (8px), `--radius-lg` (12px), `--radius-xl` (16px). |
| Motion    | `index.css` :root   | `--transition-fast`, `--transition-base`, `--transition-slow`, `--ease-out-expo`. |
| Shadows   | Theme blocks        | `--shadow-card`, `--shadow-card-hover`; accent glow only for primary CTA. |

---

## Accent Usage

Use `--accent` only for:

- Primary button (`.btn-primary`)
- Active sidebar item
- Page header icon (optional)
- Key links / focus ring

Cards, tables, borders, and secondary UI use grey tokens (`--border`, `--text-secondary`, `--bg-card`).

---

## Form Controls

- **Always use a `<Form>` wrapper** — never use `Form.Item` alone; without a parent Form, label widths vary and inputs do not align.
- **Default layout: vertical** — label above input, controls full width so all inputs start at the same horizontal position. Use the shared constant from `src/constants/form-layout.ts`:
  - `FORM_LAYOUT_VERTICAL` for standard forms (modals and pages).
  - If you need horizontal layout, use `FORM_LAYOUT_HORIZONTAL` so label column is fixed and inputs align.
- **Shared classes** in `index.css` (when not using Ant Design Form): `.form-label`, `.form-input`, `.form-select`, `.form-textarea` — themed border, focus ring (`--accent`, `--accent-dim`).

---

## Responsive

- **Breakpoints:** 640px, 768px, 1024px, 1280px (no CSS variables; consistent values).
- **Layout:** Sidebar collapses to overlay on &lt; 1024px; main content padding scales with spacing.
- **Grids:** Stats 4 → 2 → 1 columns; content 2 → 1 where applicable.

---

## References

- **Typography & weights:** [TYPOGRAPHY_STANDARDS.md](TYPOGRAPHY_STANDARDS.md)
- **Components & examples:** [COMPONENTS.md](COMPONENTS.md)
- **Tokens implementation:** [src/index.css](src/index.css)
