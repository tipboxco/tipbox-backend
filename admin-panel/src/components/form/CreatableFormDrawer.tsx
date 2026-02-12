import { useEffect, useState } from 'react';
import {
  Drawer,
  Form,
  Input,
  Select,
  DatePicker,
  Button,
  Space,
  Alert,
  Row,
  Col,
  Steps,
  Upload,
  Cascader,
  message,
} from 'antd';
import {
  SaveOutlined,
  CloseOutlined,
  ArrowLeftOutlined,
  ArrowRightOutlined,
  InboxOutlined,
} from '@ant-design/icons';
import type { UploadFile, UploadProps } from 'antd';
import { useCreatableForm } from './useCreatableForm';
import { FORM_LAYOUT_VERTICAL } from '../../constants/form-layout';
import type { CreatableFormDrawerProps, FieldConfig } from './types';

const { TextArea } = Input;
const { Dragger } = Upload;

/**
 * Drawer component for creating new records with multi-step support
 * Provides a side panel with better UX for complex creation forms
 */
export default function CreatableFormDrawer({
  open,
  title,
  fields,
  onSubmit,
  onClose,
  loading: externalLoading,
  steps,
  initialValues = {},
  width = 600,
  onFieldChange,
  formRef,
}: CreatableFormDrawerProps) {
  const { form, loading, error, currentStep, nextStep, prevStep, submitForm, resetForm, setError } =
    useCreatableForm();

  // Expose form instance via ref
  useEffect(() => {
    if (formRef && formRef.current !== form) {
      (formRef as React.MutableRefObject<FormInstance>).current = form;
    }
  }, [form, formRef]);
  const [fileList, setFileList] = useState<Record<string, UploadFile[]>>({});

  const hasSteps = steps && steps.length > 0;
  const isLastStep = hasSteps ? currentStep === steps.length - 1 : true;

  // Reset form when drawer opens
  useEffect(() => {
    if (open) {
      form.setFieldsValue(initialValues);
      setFileList({});
    } else {
      resetForm();
      setFileList({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  /**
   * Get fields for current step (or all fields if no steps)
   */
  const getCurrentStepFields = (): FieldConfig[] => {
    if (!hasSteps) {
      return fields;
    }

    const currentStepConfig = steps[currentStep];
    return fields.filter((field) => currentStepConfig.fields.includes(field.name));
  };

  /**
   * Check if field should be visible based on conditional logic
   */
  const isFieldVisible = (field: FieldConfig): boolean => {
    if (!field.conditional) {
      return true;
    }
    return field.conditional(form.getFieldsValue());
  };

  /**
   * Transform values before submission (convert empty strings to null, apply custom transforms)
   */
  const transformValues = (values: Record<string, unknown>): Record<string, unknown> => {
    const transformed: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(values)) {
      const field = fields.find((f) => f.name === key);
      let transformedValue = value;

      // Apply custom transform if defined
      if (field?.transform) {
        transformedValue = field.transform(value);
      } else {
        // Default: convert empty strings and undefined to null, trim strings
        if (value === '' || value === undefined) {
          transformedValue = null;
        } else if (typeof value === 'string') {
          transformedValue = value.trim() || null;
        }
      }

      transformed[key] = transformedValue;
    }

    return transformed;
  };

  /**
   * Handle form submission
   */
  const handleSubmit = async () => {
    try {
      // Validate all fields (including hidden ones from previous steps)
      const values = await form.validateFields();
      const transformedValues = transformValues(values);
      await submitForm(() => onSubmit(transformedValues));
      handleClose();
    } catch (err) {
      // Validation failed
      if (err && typeof err === 'object' && 'errorFields' in err) {
        // Check which step has errors
        const errorFields = (err as { errorFields: { name: string[] }[] }).errorFields;
        if (errorFields.length > 0 && hasSteps) {
          const errorFieldName = errorFields[0].name[0];
          // Find which step contains this field
          const errorStepIndex = steps.findIndex((step) =>
            step.fields.includes(errorFieldName)
          );
          if (errorStepIndex !== -1 && errorStepIndex !== currentStep) {
            message.error(`Please check ${steps[errorStepIndex].title} for errors`);
          }
        }
      }
      console.error('Form submission failed:', err);
    }
  };

  /**
   * Handle next step navigation
   */
  const handleNext = async () => {
    if (!hasSteps) return;

    const currentStepConfig = steps[currentStep];
    const currentStepFieldNames = currentStepConfig.fields;

    // Filter to only visible fields
    const visibleFields = fields.filter(
      (f) => currentStepFieldNames.includes(f.name) && isFieldVisible(f)
    );
    const visibleFieldNames = visibleFields.map((f) => f.name);

    try {
      await nextStep(visibleFieldNames);
    } catch (err) {
      // Validation failed - stay on current step
      console.error('Step validation failed:', err);
    }
  };

  /**
   * Handle drawer close
   */
  const handleClose = () => {
    resetForm();
    setFileList({});
    onClose();
  };

  /**
   * Handle file upload
   */
  const handleUpload = async (
    field: FieldConfig,
    file: File
  ): Promise<string> => {
    if (!field.uploadConfig?.onUpload) {
      throw new Error('Upload handler not configured');
    }

    try {
      const url = await field.uploadConfig.onUpload(file);
      return url;
    } catch (err) {
      message.error(`Upload failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
      throw err;
    }
  };

  /**
   * Render file upload field
   */
  const renderUploadField = (field: FieldConfig) => {
    const uploadProps: UploadProps = {
      accept: field.uploadConfig?.accept,
      maxCount: 1,
      fileList: fileList[field.name] ?? [],
      beforeUpload: (file) => {
        // Validate file size
        if (field.uploadConfig?.maxSize && file.size > field.uploadConfig.maxSize) {
          const maxSizeMB = (field.uploadConfig.maxSize / 1024 / 1024).toFixed(2);
          message.error(`File size exceeds ${maxSizeMB}MB limit`);
          return Upload.LIST_IGNORE;
        }
        return false; // Prevent auto upload
      },
      onChange: async (info) => {
        setFileList((prev) => ({ ...prev, [field.name]: info.fileList }));

        // Handle upload when file is added
        if (info.fileList.length > 0 && info.fileList[0].originFileObj) {
          try {
            const url = await handleUpload(field, info.fileList[0].originFileObj);
            form.setFieldValue(field.name, url);
            message.success('File uploaded successfully');
          } catch (err) {
            // Error already handled in handleUpload
            setFileList((prev) => ({ ...prev, [field.name]: [] }));
          }
        } else if (info.fileList.length === 0) {
          form.setFieldValue(field.name, null);
        }
      },
      onRemove: () => {
        form.setFieldValue(field.name, null);
        setFileList((prev) => ({ ...prev, [field.name]: [] }));
      },
    };

    return (
      <Dragger {...uploadProps}>
        <p className="ant-upload-drag-icon">
          <InboxOutlined />
        </p>
        <p className="ant-upload-text">Click or drag file to upload</p>
        <p className="ant-upload-hint">
          {field.uploadConfig?.accept && `Accepted formats: ${field.uploadConfig.accept}`}
        </p>
      </Dragger>
    );
  };

  /**
   * Render nested select field (Cascader for hierarchical options)
   */
  const renderNestedSelectField = (field: FieldConfig) => {
    const cascaderOptions = field.nestedOptions?.map((option) => ({
      label: option.label,
      value: option.value,
      children: option.children?.map((child) => ({
        label: child.label,
        value: child.value,
      })),
    }));

    return (
      <Cascader
        options={cascaderOptions}
        placeholder={field.placeholder ?? `Select ${field.label.toLowerCase()}`}
        changeOnSelect
        allowClear
        style={{ width: '100%' }}
        onChange={(value) => {
          // Get the last value in the cascade (most specific selection)
          const selectedValue = value && value.length > 0 ? value[value.length - 1] : null;
          form.setFieldValue(field.name, selectedValue);
        }}
      />
    );
  };

  /**
   * Render appropriate input based on field type
   */
  const renderField = (field: FieldConfig) => {
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
            allowClear
            onChange={(value) => {
              if (onFieldChange) {
                onFieldChange(field.name, value);
              }
            }}
          />
        );

      case 'date':
        return <DatePicker style={{ width: '100%' }} />;

      case 'number':
        return (
          <Input
            type="number"
            placeholder={field.placeholder ?? `Enter ${field.label.toLowerCase()}`}
          />
        );

      case 'upload':
        return renderUploadField(field);

      case 'nested-select':
        return renderNestedSelectField(field);

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

    if (field.required && isFieldVisible(field)) {
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

  /**
   * Render footer buttons based on step
   */
  const renderFooter = () => {
    return (
      <Space style={{ float: 'right' }}>
        <Button icon={<CloseOutlined />} onClick={handleClose}>
          Cancel
        </Button>

        {hasSteps && currentStep > 0 && (
          <Button icon={<ArrowLeftOutlined />} onClick={prevStep}>
            Back
          </Button>
        )}

        {hasSteps && !isLastStep ? (
          <Button type="primary" icon={<ArrowRightOutlined />} onClick={handleNext}>
            Next
          </Button>
        ) : (
          <Button
            type="primary"
            icon={<SaveOutlined />}
            onClick={handleSubmit}
            loading={loading || externalLoading}
          >
            Create
          </Button>
        )}
      </Space>
    );
  };

  return (
    <Drawer
      title={title}
      open={open}
      onClose={handleClose}
      width={width}
      footer={renderFooter()}
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

      {hasSteps && (
        <Steps
          current={currentStep}
          items={steps.map((step) => ({
            title: step.title,
            icon: step.icon,
          }))}
          style={{ marginBottom: 24 }}
        />
      )}

      <Form form={form} {...FORM_LAYOUT_VERTICAL} onFinish={handleSubmit}>
        <Row gutter={16}>
          {fields.map((field) => {
            // Only show fields for current step, but keep all fields in DOM (hidden)
            const isCurrentStepField = hasSteps
              ? steps[currentStep].fields.includes(field.name)
              : true;
            const shouldShow = isCurrentStepField && isFieldVisible(field);

            return (
              <Col span={24} key={field.name} style={{ display: shouldShow ? 'block' : 'none' }}>
                <Form.Item name={field.name} label={field.label} rules={getFieldRules(field)}>
                  {renderField(field)}
                </Form.Item>
              </Col>
            );
          })}
        </Row>
      </Form>
    </Drawer>
  );
}
