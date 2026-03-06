import { useMemo } from 'react';
import { Card, Form, Input, Select, DatePicker, Button, Space, Alert, Row, Col, Typography, Grid, Descriptions } from 'antd';
import { EditOutlined, SaveOutlined, CloseOutlined } from '@ant-design/icons';
import { useEditableForm } from './useEditableForm';
import EditableDrawer from './EditableDrawer';
import UploadFormField from './UploadFormField';
import { FORM_LAYOUT_VERTICAL } from '../../constants/form-layout';
import type { EditableFormSectionProps, FieldConfig } from './types';

const { Text } = Typography;
const { TextArea } = Input;
const { useBreakpoint } = Grid;

/**
 * EditableFormSection - Reusable component for inline editing
 *
 * Auto-determines layout strategy based on field count:
 * - 2-5 fields: Inline editing (form replaces view)
 * - 6-8 fields: Collapsible panel editing
 * - 8+ fields: Drawer (side panel) for better UX
 *
 * @example
 * ```tsx
 * <EditableFormSection
 *   title="User Information"
 *   data={{ name: "John", email: "john@example.com" }}
 *   fields={[
 *     { name: 'name', label: 'Name', type: 'text', required: true },
 *     { name: 'email', label: 'Email', type: 'text', required: true },
 *   ]}
 *   onSave={handleSave}
 * />
 * ```
 */
export default function EditableFormSection({
  title,
  data,
  fields,
  onSave,
  editable = true,
  bordered = false,
  columns = 1,
  loading: externalLoading,
}: EditableFormSectionProps) {
  const { form, isEditing, loading, error, startEdit, cancelEdit, submitForm, setError } = useEditableForm(data);
  const screens = useBreakpoint();

  // Filter out non-editable fields for edit mode
  const editableFields = useMemo(() => fields.filter(f => f.editable !== false), [fields]);

  // Determine edit strategy based on field count
  const editStrategy = useMemo(() => {
    const count = editableFields.length;
    if (count >= 8) return 'drawer';
    if (count >= 6) return 'collapsible';
    return 'inline';
  }, [editableFields.length]);

  // Use single column on mobile
  const displayColumns = screens.md ? columns : 1;

  /**
   * Render field value for Descriptions.Item
   */
  const renderFieldValue = (field: FieldConfig) => {
    const value = data[field.name];
    return field.render
      ? field.render(value)
      : (value !== null && value !== undefined ? String(value) : '—');
  };

  /**
   * Render appropriate input based on field type
   */
  const renderEditField = (field: FieldConfig) => {
    switch (field.type) {
      case 'textarea':
        return (
          <TextArea
            rows={field.rows ?? 3}
            placeholder={field.placeholder ?? `Enter ${field.label.toLowerCase()}`}
            maxLength={field.maxLength}
            showCount={!!field.maxLength}
          />
        );

      case 'select':
        return (
          <Select
            placeholder={field.placeholder ?? `Select ${field.label.toLowerCase()}`}
            options={field.options}
            mode={field.mode}
            allowClear
          />
        );

      case 'date':
        return <DatePicker style={{ width: '100%' }} />;

      case 'number':
        return (
          <Input
            type="number"
            placeholder={field.placeholder ?? `Enter ${field.label.toLowerCase()}`}
            maxLength={field.maxLength}
          />
        );

      case 'upload':
        return <UploadFormField field={field} form={form} />;

      case 'text':
      default:
        return (
          <Input
            placeholder={field.placeholder ?? `Enter ${field.label.toLowerCase()}`}
            maxLength={field.maxLength}
            showCount={!!field.maxLength}
          />
        );
    }
  };

  /**
   * Get validation rules for field
   */
  const getFieldRules = (field: FieldConfig) => {
    const rules = field.rules ?? [];

    if (field.required) {
      rules.unshift({
        required: true,
        message: `${field.label} is required`,
      });
    }

    if (field.maxLength) {
      rules.push({
        max: field.maxLength,
        message: `Maximum ${field.maxLength} characters`,
      });
    }

    return rules;
  };

  const handleSubmit = async () => {
    await submitForm(onSave);
  };

  const handleEdit = () => {
    if (editStrategy === 'drawer') {
      // Drawer handles its own edit state
      startEdit();
    } else {
      // Inline/collapsible editing
      startEdit();
    }
  };

  /**
   * Render view mode using Ant Design Descriptions
   * This creates a compact, multi-column layout similar to a table
   */
  const renderViewMode = () => (
    <div className="editable-form-section view-mode">
      <Descriptions
        title={
          title && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text strong style={{ fontSize: '14px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {title}
              </Text>
              {editable && (
                <Button
                  type="text"
                  size="small"
                  icon={<EditOutlined />}
                  onClick={handleEdit}
                  style={{ marginLeft: 'auto' }}
                >
                  Edit
                </Button>
              )}
            </div>
          )
        }
        variant="bordered"
        column={{ xs: 1, sm: 1, md: displayColumns, lg: displayColumns, xl: displayColumns }}
        size="small"
        styles={{
          label: {
            fontWeight: 500,
            width: '140px',
            backgroundColor: 'rgba(255, 255, 255, 0.02)',
          },
          content: {
            backgroundColor: 'rgba(255, 255, 255, 0.01)',
          },
        }}
      >
        {fields.map((field) => (
          <Descriptions.Item
            key={field.name}
            label={field.label}
            span={field.span ?? 1}
          >
            {renderFieldValue(field)}
          </Descriptions.Item>
        ))}
      </Descriptions>
    </div>
  );

  /**
   * Render inline edit mode
   */
  const renderEditMode = () => (
    <div className="editable-form-section edit-mode">
      {error && (
        <Alert
          message="Error"
          description={error}
          type="error"
          closable
          onClose={() => setError(null)}
          style={{ marginBottom: 16 }}
        />
      )}

      <Form form={form} {...FORM_LAYOUT_VERTICAL} onFinish={handleSubmit}>
        <Row gutter={16}>
          {editableFields.map((field) => (
            <Col span={24 / displayColumns} key={field.name}>
              <Form.Item
                name={field.name}
                label={field.label}
                rules={getFieldRules(field)}
              >
                {renderEditField(field)}
              </Form.Item>
            </Col>
          ))}
        </Row>

        <Form.Item style={{ marginBottom: 0, marginTop: 16 }}>
          <Space>
            <Button
              type="primary"
              htmlType="submit"
              icon={<SaveOutlined />}
              loading={loading || externalLoading}
            >
              Save
            </Button>
            <Button
              icon={<CloseOutlined />}
              onClick={cancelEdit}
              disabled={loading || externalLoading}
            >
              Cancel
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </div>
  );

  // Render drawer for 8+ fields
  if (editStrategy === 'drawer') {
    return (
      <>
        <Card variant={bordered ? 'outlined' : undefined}>
          {renderViewMode()}
        </Card>

        <EditableDrawer
          open={isEditing}
          title={title ?? 'Edit'}
          fields={editableFields}
          initialData={data}
          onSave={async (values) => {
            await onSave(values);
            cancelEdit();
          }}
          onClose={cancelEdit}
          loading={externalLoading}
        />
      </>
    );
  }

  // Render inline/collapsible for fewer fields
  return (
    <Card variant={bordered ? 'outlined' : undefined}>
      {isEditing ? renderEditMode() : renderViewMode()}
    </Card>
  );
}
