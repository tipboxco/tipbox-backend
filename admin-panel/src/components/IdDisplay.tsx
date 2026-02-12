import React, { useState } from 'react';
import { Typography, Button, message, theme } from 'antd';
import { CopyOutlined, CheckOutlined } from '@ant-design/icons';

const { Text } = Typography;

interface IdDisplayProps {
  id: string | null | undefined;
  variant?: 'default' | 'compact' | 'inline' | 'large';
  visibleChars?: number;
  separator?: string;
  label?: string;
  copyable?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Format ID with truncation pattern: start****end
 * @param id - Full ID string
 * @param startChars - Number of characters to show at start
 * @param endChars - Number of characters to show at end
 * @param separator - Separator between start and end (default: '****')
 * @returns Formatted ID string
 */
function formatId(
  id: string,
  startChars: number,
  endChars: number,
  separator: string = '****',
): string {
  if (!id) return '—';
  if (id.length <= startChars + endChars) return id; // Too short to truncate

  const start = id.slice(0, startChars);
  const end = id.slice(-endChars);
  return `${start}${separator}${end}`;
}

/**
 * Standardized ID display component with copy functionality
 * Formats IDs as start****end with configurable variants
 */
const IdDisplay: React.FC<IdDisplayProps> = ({
  id,
  variant = 'default',
  visibleChars,
  separator = '****',
  label,
  copyable = true,
  className,
  style,
}) => {
  const { token } = theme.useToken();
  const [copied, setCopied] = useState(false);

  // Handle null/undefined IDs
  if (!id) {
    return (
      <Text
        type="secondary"
        style={{ fontFamily: 'monospace', fontSize: 14, ...style }}
        className={className}
      >
        —
      </Text>
    );
  }

  // Determine character counts based on variant
  let startChars: number;
  let endChars: number;
  let fontSize: number;
  let codeStyle: boolean;
  let buttonSize: 'small' | 'middle' = 'small';

  switch (variant) {
    case 'compact':
      startChars = visibleChars ?? 3;
      endChars = visibleChars ?? 3;
      fontSize = 12;
      codeStyle = false;
      buttonSize = 'small';
      break;
    case 'inline':
      startChars = visibleChars ?? 6;
      endChars = visibleChars ?? 4;
      fontSize = 14;
      codeStyle = false;
      buttonSize = 'small';
      break;
    case 'large':
      startChars = visibleChars ?? 8;
      endChars = visibleChars ?? 8;
      fontSize = 14;
      codeStyle = true;
      buttonSize = 'middle';
      break;
    case 'default':
    default:
      startChars = visibleChars ?? 4;
      endChars = visibleChars ?? 4;
      fontSize = 12;
      codeStyle = true;
      buttonSize = 'small';
      break;
  }

  const formattedId = formatId(id, startChars, endChars, separator);

  const handleCopy = async () => {
    try {
      // Modern clipboard API
      await navigator.clipboard.writeText(id);
      message.success('ID copied to clipboard');
      setCopied(true);
      setTimeout(() => setCopied(false), 1000);
    } catch (err) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = id;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        message.success('ID copied to clipboard');
        setCopied(true);
        setTimeout(() => setCopied(false), 1000);
      } catch (fallbackErr) {
        message.error('Failed to copy ID');
      }
      document.body.removeChild(textArea);
    }
  };

  const textStyle: React.CSSProperties = {
    fontFamily: 'monospace',
    fontSize,
    ...(codeStyle && {
      backgroundColor: token.colorFillSecondary,
      padding: '2px 6px',
      borderRadius: 4,
      border: `1px solid ${token.colorBorder}`,
    }),
    ...style,
  };

  return (
    <span
      className={className}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
    >
      {label && (
        <Text
          style={{
            fontSize,
            marginRight: 4,
          }}
        >
          {label}
        </Text>
      )}
      <Text
        title={id}
        style={textStyle}
        aria-label={`ID: ${id}`}
      >
        {formattedId}
      </Text>
      {copyable && (
        <Button
          type="text"
          size={buttonSize}
          icon={copied ? <CheckOutlined /> : <CopyOutlined />}
          onClick={handleCopy}
          style={{
            padding: '0 4px',
            height: 'auto',
            color: copied ? token.colorSuccess : token.colorTextSecondary,
          }}
          aria-label="Copy full ID"
        />
      )}
    </span>
  );
};

export default IdDisplay;
