import { useState } from 'react';
import {
  Modal,
  Form,
  Input,
  Select,
  Radio,
  Switch,
  Typography,
  Button,
  message,
  Drawer,
} from 'antd';
import { PlusOutlined, MinusCircleOutlined } from '@ant-design/icons';
import UserSearchSelect from '../UserSearchSelect';
import ProductSearchSelect from '../ProductSearchSelect';
import CategorySearchSelect from '../CategorySearchSelect';
import EventSearchSelect from '../EventSearchSelect';
import PostSearchSelect from '../PostSearchSelect';
import ExperiencePostWizard, { type ExperiencePostData } from './ExperiencePostWizard';
import ImageUploadList from './ImageUploadList';
import {
  createContentPost,
  type AdminCreatePostBody,
} from '../../api/admin-content';

const { TextArea } = Input;
const { Text } = Typography;

type PostType = 'FREE' | 'TIPS' | 'QUESTION' | 'COMPARE' | 'EXPERIENCE' | 'UPDATE';
type ContextType = 'PRODUCT' | 'PRODUCT_GROUP' | 'SUB_CATEGORY';

interface CreatePostModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

function CreatePostModal({ open, onClose, onSuccess }: CreatePostModalProps) {
  const [form] = Form.useForm();
  const [postType, setPostType] = useState<PostType | null>(null);
  const [contextType, setContextType] = useState<ContextType>('PRODUCT');
  const [loading, setLoading] = useState(false);
  const [experienceDrawerOpen, setExperienceDrawerOpen] = useState(false);

  // COMPARE: multiple products
  const [compareProducts, setCompareProducts] = useState<{ productId: string; isSelected: boolean }[]>([
    { productId: '', isSelected: true },
    { productId: '', isSelected: true },
  ]);

  // Images
  const [images, setImages] = useState<string[]>([]);

  const handleTypeChange = (type: PostType) => {
    setPostType(type);
    if (type === 'EXPERIENCE') {
      setExperienceDrawerOpen(true);
    }
  };

  const handleClose = () => {
    form.resetFields();
    setPostType(null);
    setContextType('PRODUCT');
    setCompareProducts([
      { productId: '', isSelected: true },
      { productId: '', isSelected: true },
    ]);
    setImages([]);
    setExperienceDrawerOpen(false);
    onClose();
  };

  const handleExperienceFinish = async (data: ExperiencePostData) => {
    setLoading(true);
    try {
      const body: AdminCreatePostBody = {
        type: 'EXPERIENCE',
        ...data,
        images: data.images.filter(Boolean),
      };
      await createContentPost(body);
      message.success('Experience post created successfully');
      setExperienceDrawerOpen(false);
      handleClose();
      onSuccess();
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Failed to create post');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!postType || postType === 'EXPERIENCE') return;

    try {
      const values = await form.validateFields();
      setLoading(true);

      const filteredImages = images.filter(Boolean);

      let body: AdminCreatePostBody;

      switch (postType) {
        case 'FREE':
          body = {
            type: 'FREE',
            userId: values.userId,
            contextType,
            contextId: values.contextId,
            description: values.description,
            images: filteredImages.length > 0 ? filteredImages : undefined,
            eventId: values.eventId || null,
          };
          break;

        case 'TIPS':
          body = {
            type: 'TIPS',
            userId: values.userId,
            contextType,
            contextId: values.contextId,
            description: values.description,
            benefitCategory: values.benefitCategory,
            images: filteredImages.length > 0 ? filteredImages : undefined,
            eventId: values.eventId || null,
          };
          break;

        case 'QUESTION':
          body = {
            type: 'QUESTION',
            userId: values.userId,
            contextType,
            contextId: values.contextId,
            description: values.description,
            boostEnabled: values.boostEnabled ?? false,
            images: filteredImages.length > 0 ? filteredImages : undefined,
            eventId: values.eventId || null,
          };
          break;

        case 'COMPARE':
          body = {
            type: 'COMPARE',
            userId: values.userId,
            contextType: 'PRODUCT',
            contextId: compareProducts[0]?.productId || values.contextId,
            products: compareProducts.filter((p) => p.productId),
            description: values.description,
            images: filteredImages.length > 0 ? filteredImages : undefined,
            eventId: values.eventId || null,
          };
          break;

        case 'UPDATE':
          body = {
            type: 'UPDATE',
            userId: values.userId,
            experiencePostId: values.experiencePostId,
            content: values.description,
            contextId: values.contextId || undefined,
            images: filteredImages.length > 0 ? filteredImages : undefined,
            eventId: values.eventId || null,
          };
          break;

        default:
          return;
      }

      await createContentPost(body);
      message.success('Post created successfully');
      handleClose();
      onSuccess();
    } catch (err) {
      if (err instanceof Error) {
        message.error(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const addCompareProduct = () => {
    setCompareProducts([...compareProducts, { productId: '', isSelected: true }]);
  };

  const removeCompareProduct = (index: number) => {
    if (compareProducts.length <= 2) return;
    setCompareProducts(compareProducts.filter((_, i) => i !== index));
  };

  const updateCompareProduct = (index: number, productId: string) => {
    const newProducts = [...compareProducts];
    newProducts[index] = { productId, isSelected: true };
    setCompareProducts(newProducts);
  };

  const showContextFields = postType && ['FREE', 'TIPS', 'QUESTION'].includes(postType);
  const showCompareFields = postType === 'COMPARE';
  const showUpdateFields = postType === 'UPDATE';

  return (
    <>
      <Modal
        title="Create Content Post"
        open={open && !experienceDrawerOpen}
        onCancel={handleClose}
        onOk={handleSubmit}
        width={800}
        okText="Create"
        confirmLoading={loading}
        okButtonProps={{ disabled: !postType || postType === 'EXPERIENCE' }}
      >
        <Form form={form} layout="vertical">
          {/* User */}
          <Form.Item
            name="userId"
            label="User"
            rules={[{ required: true, message: 'Please select a user' }]}
          >
            <UserSearchSelect style={{ width: '100%' }} />
          </Form.Item>

          {/* Post Type */}
          <Form.Item label="Post Type" required>
            <Select
              value={postType}
              onChange={handleTypeChange}
              placeholder="Select post type"
            >
              <Select.Option value="FREE">FREE - Serbest</Select.Option>
              <Select.Option value="TIPS">TIPS - Ipucu</Select.Option>
              <Select.Option value="QUESTION">QUESTION - Soru</Select.Option>
              <Select.Option value="COMPARE">COMPARE - Karsilastirma</Select.Option>
              <Select.Option value="EXPERIENCE">EXPERIENCE - Deneyim (Wizard)</Select.Option>
              <Select.Option value="UPDATE">UPDATE - Guncelleme</Select.Option>
            </Select>
          </Form.Item>

          {/* Context Type & ID (FREE, TIPS, QUESTION) */}
          {showContextFields && (
            <>
              <Form.Item label="Context Type" required>
                <Radio.Group value={contextType} onChange={(e) => setContextType(e.target.value)}>
                  <Radio.Button value="PRODUCT">Product</Radio.Button>
                  <Radio.Button value="PRODUCT_GROUP">Product Group</Radio.Button>
                  <Radio.Button value="SUB_CATEGORY">Sub Category</Radio.Button>
                </Radio.Group>
              </Form.Item>

              <Form.Item
                name="contextId"
                label={contextType === 'SUB_CATEGORY' ? 'Sub Category' : 'Product'}
                rules={[{ required: true, message: 'Please select context' }]}
              >
                {contextType === 'SUB_CATEGORY' ? (
                  <CategorySearchSelect style={{ width: '100%' }} />
                ) : (
                  <ProductSearchSelect style={{ width: '100%' }} />
                )}
              </Form.Item>
            </>
          )}

          {/* TIPS: Benefit Category */}
          {postType === 'TIPS' && (
            <Form.Item
              name="benefitCategory"
              label="Benefit Category"
              rules={[{ required: true, message: 'Please select benefit category' }]}
            >
              <Select placeholder="Select benefit category">
                <Select.Option value="time_saving">Time Saving</Select.Option>
                <Select.Option value="energy_efficiency">Energy Efficiency</Select.Option>
                <Select.Option value="durability">Durability</Select.Option>
                <Select.Option value="better_result">Better Result</Select.Option>
              </Select>
            </Form.Item>
          )}

          {/* QUESTION: Boost */}
          {postType === 'QUESTION' && (
            <Form.Item name="boostEnabled" label="Boost (Free for admin)" valuePropName="checked">
              <Switch />
            </Form.Item>
          )}

          {/* COMPARE: Multiple Products */}
          {showCompareFields && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <Text strong>Products to Compare (min 2)</Text>
                <Button size="small" icon={<PlusOutlined />} onClick={addCompareProduct}>
                  Add Product
                </Button>
              </div>
              {compareProducts.map((cp, idx) => (
                <div key={idx} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  <ProductSearchSelect
                    value={cp.productId}
                    onChange={(v) => updateCompareProduct(idx, v)}
                    style={{ flex: 1 }}
                    placeholder={`Product ${idx + 1}`}
                  />
                  {compareProducts.length > 2 && (
                    <Button
                      icon={<MinusCircleOutlined />}
                      onClick={() => removeCompareProduct(idx)}
                      danger
                      size="small"
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          {/* UPDATE: Experience Post selector */}
          {showUpdateFields && (
            <Form.Item
              name="experiencePostId"
              label="Parent Experience Post"
              rules={[{ required: true, message: 'Please select an experience post' }]}
            >
              <PostSearchSelect style={{ width: '100%' }} placeholder="Search experience post..." />
            </Form.Item>
          )}

          {/* Description / Content */}
          {postType && postType !== 'EXPERIENCE' && (
            <Form.Item
              name="description"
              label={postType === 'UPDATE' ? 'Update Content' : 'Content'}
              rules={[{ required: true, message: 'Please enter content' }]}
            >
              <TextArea rows={6} placeholder="Post content..." maxLength={10000} showCount />
            </Form.Item>
          )}

          {/* Event (all types except EXPERIENCE which handles it in wizard) */}
          {postType && postType !== 'EXPERIENCE' && (
            <Form.Item name="eventId" label="Event (Optional)">
              <EventSearchSelect style={{ width: '100%' }} />
            </Form.Item>
          )}

          {/* Images */}
          {postType && postType !== 'EXPERIENCE' && (
            <ImageUploadList images={images} onChange={setImages} />
          )}
        </Form>
      </Modal>

      {/* Experience Post Wizard (Drawer) */}
      <Drawer
        title="Create Experience Post"
        open={experienceDrawerOpen}
        onClose={() => {
          setExperienceDrawerOpen(false);
          setPostType(null);
        }}
        width={720}
        destroyOnClose
      >
        <ExperiencePostWizard
          onFinish={handleExperienceFinish}
          onCancel={() => {
            setExperienceDrawerOpen(false);
            setPostType(null);
          }}
          loading={loading}
        />
      </Drawer>
    </>
  );
}

export default CreatePostModal;
