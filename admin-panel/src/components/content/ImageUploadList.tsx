import { useState } from 'react';
import { Upload, Button, Input, Space, Typography, message, Image } from 'antd';
import { CloudUploadOutlined, PlusOutlined, MinusCircleOutlined } from '@ant-design/icons';
import { uploadContentPostImage } from '../../api/admin-content';

const { Text } = Typography;

interface ImageUploadListProps {
  images: string[];
  onChange: (images: string[]) => void;
}

function ImageUploadList({ images, onChange }: ImageUploadListProps) {
  const [uploading, setUploading] = useState<number | null>(null);

  const addImage = () => onChange([...images, '']);
  const removeImage = (index: number) => onChange(images.filter((_, i) => i !== index));
  const updateImage = (index: number, val: string) => {
    const next = [...images];
    next[index] = val;
    onChange(next);
  };

  const handleUpload = async (file: File, index: number) => {
    if (file.size > 5 * 1024 * 1024) {
      message.error('File size exceeds 5MB limit');
      return false;
    }
    setUploading(index);
    try {
      const res = await uploadContentPostImage(file);
      if (res.data?.url) {
        updateImage(index, res.data.url);
        message.success('Image uploaded');
      }
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(null);
    }
    return false;
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <Text strong>Images (Optional)</Text>
        <Button size="small" icon={<PlusOutlined />} onClick={addImage}>
          Add Image
        </Button>
      </div>
      {images.map((img, idx) => (
        <div key={idx} style={{ marginBottom: 12, padding: 8, border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6 }}>
          <Space style={{ width: '100%', marginBottom: 4 }} align="start">
            <Upload
              beforeUpload={(file) => handleUpload(file, idx)}
              showUploadList={false}
              accept="image/jpeg,image/png,image/gif,image/webp"
              disabled={uploading === idx}
            >
              <Button
                icon={<CloudUploadOutlined />}
                loading={uploading === idx}
                size="small"
              >
                {uploading === idx ? 'Uploading...' : 'Upload'}
              </Button>
            </Upload>
            <Input
              value={img}
              onChange={(e) => updateImage(idx, e.target.value)}
              placeholder="or paste image URL"
              size="small"
              style={{ flex: 1, minWidth: 250 }}
            />
            <Button
              icon={<MinusCircleOutlined />}
              onClick={() => removeImage(idx)}
              danger
              size="small"
            />
          </Space>
          {img && (
            <Image
              src={img}
              alt={`Image ${idx + 1}`}
              style={{ maxHeight: 80, borderRadius: 4, marginTop: 4 }}
              preview={{ mask: 'Preview' }}
              fallback="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAiIGhlaWdodD0iODAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjgwIiBoZWlnaHQ9IjgwIiBmaWxsPSIjZjBmMGYwIi8+PHRleHQgeD0iNDAiIHk9IjQwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSIgZmlsbD0iIzk5OSIgZm9udC1zaXplPSIxMiI+TG9hZCBlcnJvcjwvdGV4dD48L3N2Zz4="
            />
          )}
        </div>
      ))}
    </div>
  );
}

export default ImageUploadList;
