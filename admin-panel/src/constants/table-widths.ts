/**
 * Standardized table column widths for consistent UI across admin panel
 */
export const TABLE_COLUMN_WIDTHS = {
  // Visual elements
  IMAGE_SMALL: 80, // Thumbnail, avatar
  ICON: 60, // Status icons

  // Text columns
  SHORT_TEXT: 100, // Type, status, rarity
  MEDIUM_TEXT: 140, // Author, username, category
  LONG_TEXT_FIXED: 220, // Email, post title (excerpt)
  LONG_TEXT_FLEXIBLE: 350, // Main title/name columns
  VERY_LONG_TEXT: 450, // Comments, descriptions

  // Dates
  DATE_SHORT: 110, // MM/DD/YYYY
  DATETIME_FULL: 160, // MM/DD/YYYY HH:MM:SS

  // Numbers
  NUMBER_SMALL: 80, // Count < 1000
  NUMBER_MEDIUM: 90, // Count < 100,000

  // Actions
  ACTION_BUTTON: 80, // View button
  ACTION_BUTTONS: 100, // Multiple buttons
} as const;

/**
 * Scroll configuration presets for tables
 */
export const TABLE_SCROLL_CONFIGS = {
  AUTO: { x: 'max-content' as const },
  SMALL: { x: 800 },
  MEDIUM: { x: 1200 },
  LARGE: { x: 1600 },
} as const;
