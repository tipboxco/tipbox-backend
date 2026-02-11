/**
 * Shared form layout constants for admin panel.
 * Use these so all forms have consistent label/input alignment (labels above, inputs full width).
 * @see DESIGN_SYSTEM.md — Form Controls
 */

export const FORM_LAYOUT_VERTICAL = {
  layout: 'vertical' as const,
} as const;

/** Optional: use when horizontal label+input layout is needed; keeps inputs aligned. */
export const FORM_LAYOUT_HORIZONTAL = {
  layout: 'horizontal' as const,
  labelCol: { span: 6 },
  wrapperCol: { span: 18 },
} as const;

/** For inline editable forms - vertical layout with no colon after labels */
export const EDITABLE_FORM_LAYOUT = {
  layout: 'vertical' as const,
  labelCol: { span: 24 },
  wrapperCol: { span: 24 },
  colon: false,
} as const;
