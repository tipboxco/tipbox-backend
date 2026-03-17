import { useState, useEffect } from 'react';
import {
  Modal,
  Form,
  Input,
  Switch,
  DatePicker,
  Space,
  Typography,
  Button,
  message,
  Divider,
} from 'antd';
import { SwapOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import UserSearchSelect from '../UserSearchSelect';
import ProductSearchSelect from '../ProductSearchSelect';
import CategorySearchSelect from '../CategorySearchSelect';
import EventSearchSelect from '../EventSearchSelect';
import {
  updateContentPost,
  transferPostOwner,
} from '../../api/admin-content';
import type { AdminContentPostDetailResponse } from '../../types/admin';

const { TextArea } = Input;
const { Text } = Typography;

interface EditPostModalProps {
  open: boolean;
  post: AdminContentPostDetailResponse;
  onClose: () => void;
  onSuccess: () => void;
}

function EditPostModal({ open, post, onClose, onSuccess }: EditPostModalProps) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [transferUserId, setTransferUserId] = useState<string | null>(null);
  const [transferConfirmOpen, setTransferConfirmOpen] = useState(false);

  useEffect(() => {
    if (open && post) {
      form.setFieldsValue({
        title: post.title || '',
        body: post.body || '',
        isBoosted: post.isBoosted ?? false,
        boostedUntil: post.boostedUntil ? dayjs(post.boostedUntil) : null,
        productId: post.productId || undefined,
        subCategoryId: post.subCategoryId || undefined,
        eventId: post.eventId || undefined,
      });
      setTransferUserId(null);
    }
  }, [open, post, form]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      // Build update payload - only send changed fields
      const updates: Record<string, unknown> = {};

      if (values.title !== (post.title || '')) {
        updates.title = values.title || null;
      }
      if (values.body !== (post.body || '')) {
        updates.body = values.body || null;
      }
      if (values.isBoosted !== (post.isBoosted ?? false)) {
        updates.isBoosted = values.isBoosted;
      }

      const newBoostedUntil = values.boostedUntil ? values.boostedUntil.toISOString() : null;
      if (newBoostedUntil !== (post.boostedUntil || null)) {
        updates.boostedUntil = newBoostedUntil;
      }

      const newProductId = values.productId || null;
      if (newProductId !== (post.productId || null)) {
        updates.productId = newProductId;
      }

      const newSubCategoryId = values.subCategoryId || null;
      if (newSubCategoryId !== (post.subCategoryId || null)) {
        updates.subCategoryId = newSubCategoryId;
      }

      const newEventId = values.eventId || null;
      if (newEventId !== (post.eventId || null)) {
        updates.eventId = newEventId;
      }

      // Update post fields if anything changed
      if (Object.keys(updates).length > 0) {
        await updateContentPost(post.id, updates);
      }

      // Handle owner transfer
      if (transferUserId && transferUserId !== post.userId) {
        setTransferConfirmOpen(true);
        setLoading(false);
        return;
      }

      message.success('Post updated successfully');
      onClose();
      onSuccess();
    } catch (err) {
      if (err instanceof Error) {
        message.error(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleTransferConfirm = async () => {
    if (!transferUserId) return;
    setLoading(true);
    try {
      // First save any other changes
      const values = await form.validateFields();
      const updates: Record<string, unknown> = {};

      if (values.title !== (post.title || '')) updates.title = values.title || null;
      if (values.body !== (post.body || '')) updates.body = values.body || null;
      if (values.isBoosted !== (post.isBoosted ?? false)) updates.isBoosted = values.isBoosted;
      const newBoostedUntil = values.boostedUntil ? values.boostedUntil.toISOString() : null;
      if (newBoostedUntil !== (post.boostedUntil || null)) updates.boostedUntil = newBoostedUntil;
      const newProductId = values.productId || null;
      if (newProductId !== (post.productId || null)) updates.productId = newProductId;
      const newSubCategoryId = values.subCategoryId || null;
      if (newSubCategoryId !== (post.subCategoryId || null)) updates.subCategoryId = newSubCategoryId;
      const newEventId = values.eventId || null;
      if (newEventId !== (post.eventId || null)) updates.eventId = newEventId;

      if (Object.keys(updates).length > 0) {
        await updateContentPost(post.id, updates);
      }

      await transferPostOwner(post.id, transferUserId);
      message.success('Post updated and owner transferred successfully');
      setTransferConfirmOpen(false);
      onClose();
      onSuccess();
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Failed to transfer owner');
    } finally {
      setLoading(false);
    }
  };

  const isBoosted = Form.useWatch('isBoosted', form);

  return (
    <>
      <Modal
        title="Edit Post"
        open={open && !transferConfirmOpen}
        onCancel={onClose}
        onOk={handleSubmit}
        width={700}
        okText="Save"
        confirmLoading={loading}
      >
        <Form form={form} layout="vertical">
          {/* Title */}
          <Form.Item name="title" label="Title">
            <Input placeholder="Post title" maxLength={1000} />
          </Form.Item>

          {/* Body */}
          <Form.Item name="body" label="Body">
            <TextArea rows={6} placeholder="Post content" maxLength={100000} showCount />
          </Form.Item>

          <Divider />

          {/* Boost */}
          <Space size={24} align="start">
            <Form.Item name="isBoosted" label="Boosted" valuePropName="checked">
              <Switch />
            </Form.Item>

            {isBoosted && (
              <Form.Item name="boostedUntil" label="Boosted Until">
                <DatePicker showTime />
              </Form.Item>
            )}
          </Space>

          <Divider />

          {/* Product */}
          <Form.Item name="productId" label="Product">
            <ProductSearchSelect style={{ width: '100%' }} />
          </Form.Item>

          {/* Sub Category */}
          <Form.Item name="subCategoryId" label="Sub Category">
            <CategorySearchSelect style={{ width: '100%' }} />
          </Form.Item>

          {/* Event */}
          <Form.Item name="eventId" label="Event">
            <EventSearchSelect style={{ width: '100%' }} />
          </Form.Item>

          <Divider />

          {/* Owner Transfer */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ marginBottom: 8 }}>
              <Text strong>
                <SwapOutlined style={{ marginRight: 6 }} />
                Transfer Owner
              </Text>
            </div>
            <Text type="secondary" style={{ display: 'block', marginBottom: 8, fontSize: 12 }}>
              Current owner: {post.userDisplayName || post.userName || post.userId}
              {post.type === 'EXPERIENCE' && (
                <span style={{ color: '#faad14' }}>
                  {' '}— Experience post: inventory will also be transferred
                </span>
              )}
            </Text>
            <UserSearchSelect
              value={transferUserId || undefined}
              onChange={(userId) => setTransferUserId(userId || null)}
              placeholder="Select new owner (leave empty to keep current)"
              style={{ width: '100%' }}
            />
          </div>
        </Form>
      </Modal>

      {/* Transfer Confirmation */}
      <Modal
        title="Confirm Owner Transfer"
        open={transferConfirmOpen}
        onCancel={() => setTransferConfirmOpen(false)}
        onOk={handleTransferConfirm}
        okText="Transfer"
        okButtonProps={{ danger: true }}
        confirmLoading={loading}
      >
        <Space direction="vertical" size={12}>
          <Text>
            You are about to transfer this post to a different user.
          </Text>
          {post.type === 'EXPERIENCE' && (
            <Text type="warning" strong>
              This is an EXPERIENCE post. The product inventory will also be transferred
              from the old owner to the new owner.
            </Text>
          )}
          <Text type="secondary">
            This action will be logged in the admin audit trail.
          </Text>
          <Button type="link" onClick={() => setTransferConfirmOpen(false)} style={{ padding: 0 }}>
            Cancel and go back
          </Button>
        </Space>
      </Modal>
    </>
  );
}

export default EditPostModal;
