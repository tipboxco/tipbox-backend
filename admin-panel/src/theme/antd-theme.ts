import type { ThemeConfig } from 'antd';

// Tipbox Official Brand Colors
// Yellow/Lime Palette
const buttonFillYellow = '#DAF94D'; // Button fill with black text
const strokeYellow = '#C3D534'; // Stroke color
const badgeFillYellow = '#8B9D2D'; // Main badge fill with white text

// Pink/Red Palette
const strokePink = '#E5507E'; // Badge stroke
const fillPink = '#D8365D'; // Badge fill

// Purple/Blue Palette
const strokePurple = '#806CFF'; // Badge stroke
const fillPurple = '#4F1FE3'; // Badge fill

/** Tipbox palette for use in components (Tag, custom styles, etc.) */
export const tipboxPalette = {
  buttonFillYellow,
  strokeYellow,
  badgeFillYellow,
  strokePink,
  fillPink,
  strokePurple,
  fillPurple,
};

/**
 * Dark theme configuration
 * Deep blacks with Tipbox brand colors
 */
export const darkTheme: ThemeConfig = {
  algorithm: undefined, // We'll use darkAlgorithm in ConfigProvider
  token: {
    // Color Palette - Tipbox Brand Colors
    colorPrimary: buttonFillYellow,
    colorSuccess: badgeFillYellow,
    colorWarning: strokePink,
    colorError: fillPink,
    colorInfo: buttonFillYellow,
    // Sarı/açık primary arka planda okunabilirlik: buton yazısı siyah
    colorTextLightSolid: '#000000',

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
    fontFamily: 'Blinker, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    fontSize: 16,
    fontSizeHeading1: 37,
    fontSizeHeading2: 28,
    fontSizeHeading3: 23,
    fontSizeHeading4: 18,
    fontSizeHeading5: 16,
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
      itemSelectedBg: 'rgba(218, 249, 77, 0.15)',
      itemSelectedColor: buttonFillYellow,
      itemHoverBg: 'rgba(255, 255, 255, 0.08)',
      itemHoverColor: '#ffffff',
      itemColor: 'rgba(255, 255, 255, 0.88)',
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
      colorBgContainer: 'transparent',
      activeBorderColor: buttonFillYellow,
      hoverBorderColor: 'rgba(255, 255, 255, 0.2)',
    },
    Select: {
      optionSelectedBg: 'rgba(218, 249, 77, 0.15)',
    },
    Modal: {
      contentBg: '#242424',
      headerBg: '#242424',
    },
  },
};

/**
 * Light theme configuration
 * Clean whites with Tipbox yellow primary color
 */
export const lightTheme: ThemeConfig = {
  algorithm: undefined, // We'll use defaultAlgorithm in ConfigProvider
  token: {
    // Color Palette - Tipbox Brand (same as dark)
    colorPrimary: buttonFillYellow,
    colorSuccess: badgeFillYellow,
    colorWarning: strokePink,
    colorError: fillPink,
    colorInfo: buttonFillYellow,
    // Sarı/açık primary arka planda okunabilirlik: buton yazısı siyah
    colorTextLightSolid: '#000000',

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
    fontFamily: 'Blinker, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    fontSize: 16,
    fontSizeHeading1: 37,
    fontSizeHeading2: 28,
    fontSizeHeading3: 23,
    fontSizeHeading4: 18,
    fontSizeHeading5: 16,
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
      itemSelectedBg: 'rgba(218, 249, 77, 0.15)',
      itemSelectedColor: buttonFillYellow,
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
      colorBgContainer: 'transparent',
      activeBorderColor: buttonFillYellow,
      hoverBorderColor: '#bfbfbf',
    },
    Select: {
      optionSelectedBg: 'rgba(218, 249, 77, 0.15)',
    },
    Modal: {
      contentBg: '#ffffff',
      headerBg: '#ffffff',
    },
  },
};

// Export Tipbox accent color for minimal usage
export const tipboxAccent = buttonFillYellow;
