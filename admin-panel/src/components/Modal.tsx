import { Modal as AntModal } from 'antd';
import type { ModalProps } from 'antd';

// Temporary wrapper for backward compatibility
// TODO: Migrate remaining files to use Ant Design Modal directly

interface LegacyModalProps {
  isOpen?: boolean;
  onClose?: () => void;
  title?: string;
  children?: React.ReactNode;
  size?: string;
  className?: string;
}

function Modal({ isOpen, onClose, title, children, size, className, ...rest }: LegacyModalProps) {
  return (
    <AntModal
      open={isOpen}
      onCancel={onClose}
      title={title}
      footer={null}
      width={size === 'lg' ? 800 : size === 'md' ? 600 : 520}
      className={className}
      {...(rest as ModalProps)}
    >
      {children}
    </AntModal>
  );
}

export default Modal;
