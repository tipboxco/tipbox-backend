import { useState, useCallback } from 'react';
import { Form } from 'antd';

/**
 * Custom hook to manage creatable form state and multi-step navigation
 * @template T - Type of form data
 */
export function useCreatableForm<T extends Record<string, unknown>>() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(0);

  /**
   * Validate and move to next step
   * @param fieldNames - Fields to validate before proceeding
   */
  const nextStep = useCallback(
    async (fieldNames?: string[]) => {
      try {
        // Validate only the specified fields (or all if not specified)
        if (fieldNames) {
          await form.validateFields(fieldNames);
        }
        setCurrentStep((prev) => prev + 1);
        setError(null);
      } catch (err) {
        // Validation error - stay on current step
        console.error('Step validation failed:', err);
        throw err;
      }
    },
    [form]
  );

  /**
   * Move to previous step
   */
  const prevStep = useCallback(() => {
    setCurrentStep((prev) => Math.max(0, prev - 1));
    setError(null);
  }, []);

  /**
   * Reset to first step
   */
  const resetSteps = useCallback(() => {
    setCurrentStep(0);
    setError(null);
  }, []);

  /**
   * Submit form and call onSubmit callback
   */
  const submitForm = useCallback(
    async (onSubmit: (data: T) => Promise<void>) => {
      try {
        setError(null);
        setLoading(true);

        // Validate all form fields
        const values = await form.validateFields();

        // Call submit callback
        await onSubmit(values as T);

        // Success - reset form
        form.resetFields();
        resetSteps();
      } catch (err) {
        // Validation error or submission error
        if (err instanceof Error) {
          setError(err.message);
        } else {
          console.error('Form submission failed:', err);
        }
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [form, resetSteps]
  );

  /**
   * Reset form to initial state
   */
  const resetForm = useCallback(() => {
    form.resetFields();
    resetSteps();
    setError(null);
  }, [form, resetSteps]);

  return {
    form,
    loading,
    error,
    currentStep,
    nextStep,
    prevStep,
    resetSteps,
    submitForm,
    resetForm,
    setError,
    setLoading,
  };
}
