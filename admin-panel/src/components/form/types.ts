import { ReactNode } from 'react';

/**
 * Configuration for a single field in an editable form section
 */
export interface FieldConfig {
  /** Field name/key in the data object */
  name: string;
  /** Display label for the field */
  label: string;
  /** Input type to render */
  type: 'text' | 'textarea' | 'select' | 'date' | 'image' | 'number' | 'upload' | 'nested-select';
  /** Whether field is required */
  required?: boolean;
  /** Maximum character length for text/textarea */
  maxLength?: number;
  /** Number of rows for textarea */
  rows?: number;
  /** Options for select dropdown */
  options?: Array<{ label: string; value: string }>;
  /** Whether this field can be edited (false = read-only) */
  editable?: boolean;
  /** Custom render function for view mode */
  render?: (value: unknown) => ReactNode;
  /** Placeholder text for input */
  placeholder?: string;
  /** Column span for Descriptions layout (1-3) - full width if span equals total columns */
  span?: number;
  /** Additional validation rules */
  rules?: Array<{
    required?: boolean;
    message?: string;
    max?: number;
    min?: number;
    pattern?: RegExp;
    validator?: (rule: unknown, value: unknown) => Promise<void>;
  }>;
  /** Conditional visibility based on form values (for creation forms) */
  conditional?: (formValues: Record<string, unknown>) => boolean;
  /** Transform value before submission (for creation forms) */
  transform?: (value: unknown) => unknown;
  /** Upload configuration (for 'upload' type fields) */
  uploadConfig?: {
    accept?: string;
    maxSize?: number;
    onUpload?: (file: File) => Promise<string>;
  };
  /** Nested options for hierarchical selects (for 'nested-select' type) */
  nestedOptions?: Array<{
    label: string;
    value: string;
    children?: Array<{ label: string; value: string }>;
  }>;
}

/**
 * Props for EditableFormSection component
 */
export interface EditableFormSectionProps {
  /** Section title */
  title?: string;
  /** Data object containing field values */
  data: Record<string, unknown>;
  /** Field configurations */
  fields: FieldConfig[];
  /** Callback when form is saved */
  onSave: (values: Record<string, unknown>) => Promise<void>;
  /** Whether the section is editable */
  editable?: boolean;
  /** Whether to show borders */
  bordered?: boolean;
  /** Number of columns (1 or 2) */
  columns?: 1 | 2;
  /** Loading state */
  loading?: boolean;
}

/**
 * Props for EditableDrawer component
 */
export interface EditableDrawerProps {
  /** Whether drawer is visible */
  open: boolean;
  /** Drawer title */
  title: string;
  /** Field configurations */
  fields: FieldConfig[];
  /** Initial data values */
  initialData: Record<string, unknown>;
  /** Callback when form is saved */
  onSave: (values: Record<string, unknown>) => Promise<void>;
  /** Callback to close drawer */
  onClose: () => void;
  /** Loading state */
  loading?: boolean;
}

/**
 * Configuration for a step in a multi-step creation form
 */
export interface StepConfig {
  /** Step title */
  title: string;
  /** Optional icon for the step */
  icon?: ReactNode;
  /** Field names that belong to this step */
  fields: string[];
}

/**
 * Props for CreatableFormDrawer component
 */
export interface CreatableFormDrawerProps {
  /** Whether drawer is visible */
  open: boolean;
  /** Drawer title */
  title: string;
  /** Field configurations */
  fields: FieldConfig[];
  /** Callback when form is submitted */
  onSubmit: (values: Record<string, unknown>) => Promise<void>;
  /** Callback to close drawer */
  onClose: () => void;
  /** Loading state */
  loading?: boolean;
  /** Steps configuration for multi-step flows */
  steps?: StepConfig[];
  /** Initial values for the form */
  initialValues?: Record<string, unknown>;
  /** Drawer width */
  width?: number | string;
}

/**
 * Props for CreatableFormModal component
 */
export interface CreatableFormModalProps {
  /** Whether modal is visible */
  open: boolean;
  /** Modal title */
  title: string;
  /** Field configurations */
  fields: FieldConfig[];
  /** Callback when form is submitted */
  onSubmit: (values: Record<string, unknown>) => Promise<void>;
  /** Callback to close modal */
  onClose: () => void;
  /** Loading state */
  loading?: boolean;
  /** Initial values for the form */
  initialValues?: Record<string, unknown>;
  /** Modal width */
  width?: number | string;
}
