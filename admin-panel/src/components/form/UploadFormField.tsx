import { useState, useEffect } from 'react';
import { Upload, Button, Input, Space, message as antdMessage } from 'antd';
import { CloudUploadOutlined } from '@ant-design/icons';
import type { FormInstance } from 'antd';
import type { FieldConfig } from './types';

interface UploadFormFieldProps {
  field: FieldConfig;
  form: FormInstance;
}

export default function UploadFormField({ field, form }: UploadFormFieldProps) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string>('');

  useEffect(() => {
    const val = form.getFieldValue(field.name);
    if (val) setPreview(String(val));
  }, [form, field.name]);

  const handleUpload = async (file: File) => {
    if (!field.uploadConfig?.onUpload) return false;

    if (field.uploadConfig.maxSize && file.size > field.uploadConfig.maxSize) {
      const maxMB = (field.uploadConfig.maxSize / 1024 / 1024).toFixed(0);
      antdMessage.error(`File size exceeds ${maxMB}MB limit`);
      return false;
    }

    setUploading(true);
    try {
      const url = await field.uploadConfig.onUpload(file);
      setPreview(url);
      form.setFieldValue(field.name, url);
      antdMessage.success('Image uploaded');
    } catch (err) {
      antdMessage.error(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
    return false;
  };

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="small">
      <Upload
        beforeUpload={handleUpload}
        showUploadList={false}
        accept={field.uploadConfig?.accept ?? 'image/jpeg,image/png,image/gif,image/webp'}
        disabled={uploading}
      >
        <Button icon={<CloudUploadOutlined />} loading={uploading} size="small">
          {uploading ? 'Uploading...' : 'Upload Image'}
        </Button>
      </Upload>
      {preview && (
        <div>
          <img
            src={preview}
            alt={field.label}
            style={{ maxWidth: '100%', maxHeight: 150, borderRadius: 4 }}
          />
          <Button
            size="small"
            danger
            onClick={() => {
              setPreview('');
              form.setFieldValue(field.name, null);
            }}
            style={{ marginTop: 4 }}
          >
            Remove
          </Button>
        </div>
      )}
      <Input
        value={preview}
        onChange={(e) => {
          setPreview(e.target.value);
          form.setFieldValue(field.name, e.target.value || null);
        }}
        placeholder="or paste image URL"
        size="small"
      />
    </Space>
  );
}
