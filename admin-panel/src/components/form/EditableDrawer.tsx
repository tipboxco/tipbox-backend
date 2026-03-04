import { useEffect } from 'react';
import { Drawer, Form, Input, Select, DatePicker, Button, Space, Alert, Row, Col } from 'antd';
import { SaveOutlined, CloseOutlined } from '@ant-design/icons';
import { useEditableForm } from './useEditableForm';
import { FORM_LAYOUT_VERTICAL } from '../../constants/form-layout';
import type { EditableDrawerProps, FieldConfig } from './types';

const { TextArea } = Input;

/**
 * Drawer component for editing forms with 8+ fields
 * Provides a side panel with better UX for complex forms
 */
export default function EditableDrawer({
  open,
  title,
  fields,
  initialData,
  onSave,
  onClose,
  loading: externalLoading,
}: EditableDrawerProps) {
  const { form, loading, error, submitForm, setError } = useEditableForm(initialData);

  // Reset form when drawer opens with new data
  useEffect(() => {
    if (open) {
      form.setFieldsValue(initialData);
    }
  }, [open, initialData, form]);

  const handleSubmit = async () => {
    await submitForm(onSave);
  };

  const handleClose = () => {
    form.resetFields();
    setError(null);
    onClose();
  };

  /**
   * Render appropriate input based on field type
   */
  const renderField = (field: FieldConfig) => {
    if (!field.editable && field.editable !== undefined) {
      // Read-only field
      const value = initialData[field.name];
      const displayValue = field.render ? field.render(value) : String(value ?? '—');
      return <div style={{ padding: '4px 0', color: 'rgba(255, 255, 255, 0.65)' }}>{displayValue}</div>;
    }

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

  return (
    <Drawer
      title={title}
      open={open}
      onClose={handleClose}
      width={720}
      footer={
        <Space style={{ float: 'right' }}>
          <Button icon={<CloseOutlined />} onClick={handleClose}>
            Cancel
          </Button>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            onClick={handleSubmit}
            loading={loading || externalLoading}
          >
            Save Changes
          </Button>
        </Space>
      }
    >
      {error && (
        <Alert
          title="Error"
          description={error}
          type="error"
          closable
          onClose={() => setError(null)}
          style={{ marginBottom: 16 }}
        />
      )}

      <Form form={form} {...FORM_LAYOUT_VERTICAL} onFinish={handleSubmit}>
        <Row gutter={16}>
          {fields.map((field) => (
            <Col span={24} key={field.name}>
              <Form.Item
                name={field.name}
                label={field.label}
                rules={getFieldRules(field)}
              >
                {renderField(field)}
              </Form.Item>
            </Col>
          ))}
        </Row>
      </Form>
    </Drawer>
  );
}
