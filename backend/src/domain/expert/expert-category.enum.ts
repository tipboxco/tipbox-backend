/**
 * Expert Request kategorileri (statik liste)
 */
export enum ExpertCategory {
  TECHNOLOGY = 'TECHNOLOGY',
  ELECTRONICS = 'ELECTRONICS',
  SMARTPHONE = 'SMARTPHONE',
  COMPUTER = 'COMPUTER',
  PHOTOGRAPHY = 'PHOTOGRAPHY',
  AUTOMOTIVE = 'AUTOMOTIVE',
  HOME_APPLIANCES = 'HOME_APPLIANCES',
  FASHION = 'FASHION',
  BEAUTY = 'BEAUTY',
  FITNESS = 'FITNESS',
  FOOD = 'FOOD',
  TRAVEL = 'TRAVEL',
  GAMING = 'GAMING',
  SOFTWARE = 'SOFTWARE',
  FINANCE = 'FINANCE',
  HEALTH = 'HEALTH',
  EDUCATION = 'EDUCATION',
  OTHER = 'OTHER',
}

/**
 * Kategori listesi (frontend için)
 */
export const EXPERT_CATEGORIES = Object.values(ExpertCategory);

/**
 * Kategori display name'leri (Türkçe)
 */
export const EXPERT_CATEGORY_NAMES: Record<ExpertCategory, string> = {
  [ExpertCategory.TECHNOLOGY]: 'Teknoloji',
  [ExpertCategory.ELECTRONICS]: 'Elektronik',
  [ExpertCategory.SMARTPHONE]: 'Akıllı Telefon',
  [ExpertCategory.COMPUTER]: 'Bilgisayar',
  [ExpertCategory.PHOTOGRAPHY]: 'Fotoğrafçılık',
  [ExpertCategory.AUTOMOTIVE]: 'Otomotiv',
  [ExpertCategory.HOME_APPLIANCES]: 'Ev Aletleri',
  [ExpertCategory.FASHION]: 'Moda',
  [ExpertCategory.BEAUTY]: 'Güzellik',
  [ExpertCategory.FITNESS]: 'Fitness',
  [ExpertCategory.FOOD]: 'Yiyecek & İçecek',
  [ExpertCategory.TRAVEL]: 'Seyahat',
  [ExpertCategory.GAMING]: 'Oyun',
  [ExpertCategory.SOFTWARE]: 'Yazılım',
  [ExpertCategory.FINANCE]: 'Finans',
  [ExpertCategory.HEALTH]: 'Sağlık',
  [ExpertCategory.EDUCATION]: 'Eğitim',
  [ExpertCategory.OTHER]: 'Diğer',
};

