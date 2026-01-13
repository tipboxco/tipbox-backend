/**
 * Media field configuration
 */
export type MediaFieldConfig = {
  /** Unique key for the field (used in metadata) */
  key: string
  /** Display label */
  label: string
  /** Preview image height (default: 32 = h-32) */
  previewHeight?: number
  /** Whether this field is required */
  required?: boolean
}

/**
 * Media widget configuration
 */
export type MediaWidgetConfig = {
  /** Entity type (e.g., 'category', 'product') */
  entityType: string
  /** Entity ID */
  entityId: string
  /** Metadata object from entity */
  metadata?: Record<string, any>
  /** API endpoint for updating metadata (e.g., '/admin/categories/:id/metadata') */
  updateEndpoint: string
  /** Media fields configuration */
  fields: MediaFieldConfig[]
  /** Success message */
  successMessage?: string
  /** Error message prefix */
  errorMessagePrefix?: string
}

/**
 * Image validation result
 */
export type ImageValidationResult = {
  valid: boolean
  error?: string
}

