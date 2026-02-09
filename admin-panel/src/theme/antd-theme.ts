import type { ThemeConfig } from 'antd';

// Tipbox brand color - minimal usage
const tipboxYellow = '#d8ff08';

/**
 * Dark theme configuration
 * Deep blacks with professional blue primary color
 */
export const darkTheme: ThemeConfig = {
  algorithm: undefined, // We'll use darkAlgorithm in ConfigProvider
  token: {
    // Color Palette
    colorPrimary: '#4096ff', // Professional blue for main actions
    colorSuccess: '#52c41a',
    colorWarning: '#faad14',
    colorError: '#ff4d4f',
    colorInfo: '#1890ff',

    // Background Colors
    colorBgBase: '#0a0a0a', // Deep black base
    colorBgContainer: '#1a1a1a', // Elevated surfaces
    colorBgElevated: '#242424', // Cards, modals
    colorBgLayout: '#0a0a0a',

    // Text Colors
    colorText: '#ffffff',
    colorTextSecondary: 'rgba(255, 255, 255, 0.65)',
    colorTextTertiary: 'rgba(255, 255, 255, 0.45)',
    colorTextQuaternary: 'rgba(255, 255, 255, 0.25)',

    // Border Colors
    colorBorder: 'rgba(255, 255, 255, 0.12)',
    colorBorderSecondary: 'rgba(255, 255, 255, 0.08)',

    // Typography
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    fontSize: 14,
    fontSizeHeading1: 32,
    fontSizeHeading2: 24,
    fontSizeHeading3: 20,
    fontSizeHeading4: 16,
    fontSizeHeading5: 14,
    fontWeightStrong: 600,

    // Spacing (8px base unit)
    marginXS: 8,
    marginSM: 12,
    margin: 16,
    marginMD: 20,
    marginLG: 24,
    marginXL: 32,
    marginXXL: 48,

    paddingXS: 8,
    paddingSM: 12,
    padding: 16,
    paddingMD: 20,
    paddingLG: 24,
    paddingXL: 32,

    // Border Radius
    borderRadius: 6,
    borderRadiusLG: 8,
    borderRadiusSM: 4,

    // Shadows
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.45)',
    boxShadowSecondary: '0 4px 16px rgba(0, 0, 0, 0.35)',

    // Line Height
    lineHeight: 1.5715,
    lineHeightHeading1: 1.2,
    lineHeightHeading2: 1.3,

    // Control Heights
    controlHeight: 32,
    controlHeightLG: 40,
    controlHeightSM: 24,
  },
  components: {
    Layout: {
      headerBg: '#1a1a1a',
      bodyBg: '#0a0a0a',
      siderBg: '#1a1a1a',
      footerBg: '#1a1a1a',
    },
    Menu: {
      itemBg: 'transparent',
      itemSelectedBg: 'rgba(64, 150, 255, 0.15)',
      itemSelectedColor: '#4096ff',
      itemHoverBg: 'rgba(255, 255, 255, 0.08)',
      itemHoverColor: '#ffffff',
      itemColor: 'rgba(255, 255, 255, 0.65)',
      iconSize: 16,
    },
    Card: {
      headerBg: 'transparent',
      colorBgContainer: '#1a1a1a',
      colorBorderSecondary: 'rgba(255, 255, 255, 0.12)',
    },
    Table: {
      headerBg: '#1a1a1a',
      headerColor: '#ffffff',
      rowHoverBg: 'rgba(255, 255, 255, 0.04)',
      borderColor: 'rgba(255, 255, 255, 0.12)',
    },
    Button: {
      primaryShadow: 'none',
      dangerShadow: 'none',
    },
    Input: {
      activeBorderColor: '#4096ff',
      hoverBorderColor: 'rgba(255, 255, 255, 0.2)',
    },
    Select: {
      optionSelectedBg: 'rgba(64, 150, 255, 0.15)',
    },
    Modal: {
      contentBg: '#242424',
      headerBg: '#242424',
    },
  },
};

/**
 * Light theme configuration
 * Clean whites with professional blue primary color
 */
export const lightTheme: ThemeConfig = {
  algorithm: undefined, // We'll use defaultAlgorithm in ConfigProvider
  token: {
    // Color Palette
    colorPrimary: '#1890ff', // Professional blue
    colorSuccess: '#52c41a',
    colorWarning: '#faad14',
    colorError: '#ff4d4f',
    colorInfo: '#1890ff',

    // Background Colors
    colorBgBase: '#ffffff', // Pure white base
    colorBgContainer: '#fafafa', // Elevated surfaces
    colorBgElevated: '#f5f5f5', // Cards, modals
    colorBgLayout: '#ffffff',

    // Text Colors
    colorText: '#000000',
    colorTextSecondary: 'rgba(0, 0, 0, 0.65)',
    colorTextTertiary: 'rgba(0, 0, 0, 0.45)',
    colorTextQuaternary: 'rgba(0, 0, 0, 0.25)',

    // Border Colors
    colorBorder: '#d9d9d9',
    colorBorderSecondary: '#f0f0f0',

    // Typography
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    fontSize: 14,
    fontSizeHeading1: 32,
    fontSizeHeading2: 24,
    fontSizeHeading3: 20,
    fontSizeHeading4: 16,
    fontSizeHeading5: 14,
    fontWeightStrong: 600,

    // Spacing (8px base unit)
    marginXS: 8,
    marginSM: 12,
    margin: 16,
    marginMD: 20,
    marginLG: 24,
    marginXL: 32,
    marginXXL: 48,

    paddingXS: 8,
    paddingSM: 12,
    padding: 16,
    paddingMD: 20,
    paddingLG: 24,
    paddingXL: 32,

    // Border Radius
    borderRadius: 6,
    borderRadiusLG: 8,
    borderRadiusSM: 4,

    // Shadows
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
    boxShadowSecondary: '0 4px 16px rgba(0, 0, 0, 0.05)',

    // Line Height
    lineHeight: 1.5715,
    lineHeightHeading1: 1.2,
    lineHeightHeading2: 1.3,

    // Control Heights
    controlHeight: 32,
    controlHeightLG: 40,
    controlHeightSM: 24,
  },
  components: {
    Layout: {
      headerBg: '#fafafa',
      bodyBg: '#ffffff',
      siderBg: '#fafafa',
      footerBg: '#fafafa',
    },
    Menu: {
      itemBg: 'transparent',
      itemSelectedBg: 'rgba(24, 144, 255, 0.1)',
      itemSelectedColor: '#1890ff',
      itemHoverBg: 'rgba(0, 0, 0, 0.04)',
      itemHoverColor: '#000000',
      itemColor: 'rgba(0, 0, 0, 0.65)',
      iconSize: 16,
    },
    Card: {
      headerBg: 'transparent',
      colorBgContainer: '#ffffff',
      colorBorderSecondary: '#f0f0f0',
    },
    Table: {
      headerBg: '#fafafa',
      headerColor: '#000000',
      rowHoverBg: 'rgba(0, 0, 0, 0.02)',
      borderColor: '#f0f0f0',
    },
    Button: {
      primaryShadow: 'none',
      dangerShadow: 'none',
    },
    Input: {
      activeBorderColor: '#1890ff',
      hoverBorderColor: '#bfbfbf',
    },
    Select: {
      optionSelectedBg: 'rgba(24, 144, 255, 0.1)',
    },
    Modal: {
      contentBg: '#ffffff',
      headerBg: '#ffffff',
    },
  },
};

// Export Tipbox accent color for minimal usage
export const tipboxAccent = tipboxYellow;
