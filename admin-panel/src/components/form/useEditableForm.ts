import { useState, useCallback } from 'react';
import { Form } from 'antd';

/**
 * Custom hook to manage editable form state and transitions
 * @template T - Type of form data
 */
export function useEditableForm<T extends Record<string, unknown>>(initialData: T) {
  const [form] = Form.useForm();
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Enter edit mode and populate form with current data
   */
  const startEdit = useCallback(() => {
    form.setFieldsValue(initialData);
    setIsEditing(true);
    setError(null);
  }, [form, initialData]);

  /**
   * Cancel editing and revert to view mode
   */
  const cancelEdit = useCallback(() => {
    form.resetFields();
    setIsEditing(false);
    setError(null);
  }, [form]);

  /**
   * Submit form and call onSave callback
   */
  const submitForm = useCallback(
    async (onSave: (data: T) => Promise<void>) => {
      try {
        setError(null);
        setLoading(true);

        // Validate form
        const values = await form.validateFields();

        // Call save callback
        await onSave(values as T);

        // Success - exit edit mode
        setIsEditing(false);
        form.resetFields();
      } catch (err) {
        // Validation error or save error
        if (err instanceof Error) {
          setError(err.message);
        } else {
          console.error('Form validation failed:', err);
        }
      } finally {
        setLoading(false);
      }
    },
    [form]
  );

  return {
    form,
    isEditing,
    loading,
    error,
    startEdit,
    cancelEdit,
    submitForm,
    setError,
  };
}
