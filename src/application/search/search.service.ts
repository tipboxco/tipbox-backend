import { PrismaClient } from '@prisma/client';
import { SearchData, SearchUserData, SearchBrandData, SearchProductData } from '../../interfaces/search/search.dto';
import { buildMediaUrl, getPublicMediaBaseUrl } from '../../infrastructure/config/media.config';

export type SearchTypes = Array<'user' | 'brand' | 'product'>;

export class SearchService {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  async searchAll(keyword: string | undefined, limitPerType: number = 10, types?: SearchTypes): Promise<SearchData> {
    const activeTypes: SearchTypes = types && types.length > 0 ? types : ['user', 'brand', 'product'];
    const trimmed = keyword?.trim() || '';
    const isDefaultMode = !keyword || trimmed.length === 0;
    const defaultLimit = 4; // Default mode'da 4'er adet
    const actualLimit = isDefaultMode ? defaultLimit : limitPerType;

    const tasks: Array<Promise<any>> = [];

    // Users
    if (activeTypes.includes('user')) {
      if (isDefaultMode) {
        // Default mode: En son aktif kullanıcıları getir
        tasks.push(
          this.prisma.user.findMany({
            include: {
              profile: true,
              titles: {
                orderBy: { earnedAt: 'desc' },
                take: 1,
              },
              avatars: {
                where: { isActive: true },
                orderBy: { createdAt: 'desc' },
                take: 1,
              },
            },
            orderBy: [
              { updatedAt: 'desc' },
            ],
            take: actualLimit,
          })
        );
      } else {
        // Search mode: Keyword ile arama yap
        tasks.push(
          this.prisma.user.findMany({
            where: {
              OR: [
                { email: { contains: trimmed, mode: 'insensitive' } },
                { profile: { is: { displayName: { contains: trimmed, mode: 'insensitive' } } } },
                { profile: { is: { userName: { contains: trimmed, mode: 'insensitive' } } } },
              ],
            },
            include: {
              profile: true,
              titles: {
                orderBy: { earnedAt: 'desc' },
                take: 1,
              },
              avatars: {
                where: { isActive: true },
                orderBy: { createdAt: 'desc' },
                take: 1,
              },
            },
            orderBy: [
              { updatedAt: 'desc' },
            ],
            take: actualLimit,
          })
        );
      }
    } else {
      tasks.push(Promise.resolve([]));
    }

    // Brands
    if (activeTypes.includes('brand')) {
      if (isDefaultMode) {
        // Default mode: Logo'ları olan popüler markaları getir (Apple, MSI, ASUS, vb.)
        // Popüler marka isimleri (öncelik sırasına göre) - case-insensitive eşleşme
        const popularBrandNames = ['Apple', 'MSI', 'ASUS', 'Samsung', 'Sony', 'LG', 'HP', 'Dell', 'Lenovo', 'NVIDIA', 'Intel', 'AMD'];
        
        tasks.push(
          this.prisma.brand.findMany({
            where: {
              logoUrl: { not: null }, // Sadece logo'ları olan markalar
            },
            select: {
              id: true,
              name: true,
              category: true,
              logoUrl: true,
              description: true,
            },
            take: actualLimit * 3, // Daha fazla çek ki popüler olanları seçebilelim
          }).then((brands) => {
            // Popüler markaları önceliklendir
            const sortedBrands = brands.sort((a, b) => {
              const aNameLower = a.name.toLowerCase();
              const bNameLower = b.name.toLowerCase();
              
              // Tam eşleşme veya içeriyor mu kontrol et
              const aIndex = popularBrandNames.findIndex(name => {
                const nameLower = name.toLowerCase();
                return aNameLower === nameLower || aNameLower.includes(nameLower) || nameLower.includes(aNameLower);
              });
              const bIndex = popularBrandNames.findIndex(name => {
                const nameLower = name.toLowerCase();
                return bNameLower === nameLower || bNameLower.includes(nameLower) || nameLower.includes(bNameLower);
              });
              
              // Popüler markalar önce gelsin
              if (aIndex !== -1 && bIndex !== -1) {
                return aIndex - bIndex;
              }
              if (aIndex !== -1) return -1;
              if (bIndex !== -1) return 1;
              
              // İkisi de popüler değilse alfabetik sırala
              return a.name.localeCompare(b.name);
            });
            
            // İstenen sayıda döndür
            return sortedBrands.slice(0, actualLimit);
          })
        );
      } else {
        // Search mode: Keyword ile arama yap
        tasks.push(
          this.prisma.brand.findMany({
            where: {
              OR: [
                { name: { contains: trimmed, mode: 'insensitive' } },
                { category: { contains: trimmed, mode: 'insensitive' } },
                { description: { contains: trimmed, mode: 'insensitive' } },
              ],
            },
            select: {
              id: true,
              name: true,
              category: true,
              logoUrl: true,
              description: true,
            },
            orderBy: { name: 'asc' },
            take: actualLimit,
          })
        );
      }
    } else {
      tasks.push(Promise.resolve([]));
    }

    // Products
    if (activeTypes.includes('product')) {
      if (isDefaultMode) {
        // Default mode: Image'ları olan popüler brand'lardan ürünleri getir
        // Popüler brand isimleri (öncelik sırasına göre)
        const popularBrandNames = ['Apple', 'MSI', 'ASUS', 'Samsung', 'Sony', 'LG', 'HP', 'Dell', 'Lenovo', 'NVIDIA', 'Intel', 'AMD'];
        
        tasks.push(
          this.prisma.product.findMany({
            where: {
              imageUrl: { not: null }, // Sadece image'ları olan product'lar
            },
            select: {
              id: true,
              name: true,
              brand: true,
              description: true,
              imageUrl: true,
            },
            take: actualLimit * 3, // Daha fazla çek ki popüler olanları seçebilelim
          }).then((products) => {
            // Popüler brand'lardan gelen product'ları önceliklendir
            const sortedProducts = products.sort((a, b) => {
              const aBrandLower = (a.brand || '').toLowerCase();
              const bBrandLower = (b.brand || '').toLowerCase();
              
              // Tam eşleşme veya içeriyor mu kontrol et
              const aIndex = popularBrandNames.findIndex(name => {
                const nameLower = name.toLowerCase();
                return aBrandLower === nameLower || aBrandLower.includes(nameLower) || nameLower.includes(aBrandLower);
              });
              const bIndex = popularBrandNames.findIndex(name => {
                const nameLower = name.toLowerCase();
                return bBrandLower === nameLower || bBrandLower.includes(nameLower) || nameLower.includes(bBrandLower);
              });
              
              // Popüler brand'lardan gelen product'lar önce gelsin
              if (aIndex !== -1 && bIndex !== -1) {
                return aIndex - bIndex;
              }
              if (aIndex !== -1) return -1;
              if (bIndex !== -1) return 1;
              
              // İkisi de popüler brand'dan değilse alfabetik sırala
              return a.name.localeCompare(b.name);
            });
            
            // İstenen sayıda döndür
            return sortedProducts.slice(0, actualLimit);
          })
        );
      } else {
        // Search mode: Keyword ile arama yap
        tasks.push(
          this.prisma.product.findMany({
            where: {
              OR: [
                { name: { contains: trimmed, mode: 'insensitive' } },
                { description: { contains: trimmed, mode: 'insensitive' } },
                { brand: { contains: trimmed, mode: 'insensitive' } },
              ],
            },
            select: {
              id: true,
              name: true,
              brand: true,
              description: true,
              imageUrl: true,
            },
            orderBy: { name: 'asc' },
            take: actualLimit,
          })
        );
      }
    } else {
      tasks.push(Promise.resolve([]));
    }

    const [users, brands, products] = await Promise.all(tasks);

    // Database'deki URL veya path'i MinIO path formatına çeviren helper fonksiyon
    // URL ise path'e çevirir, path ise olduğu gibi döndürür
    const extractPath = (urlOrPath: string | null): string | null => {
      if (!urlOrPath) return null;
      
      // Eğer URL ise (http:// veya https:// ile başlıyorsa) path'i çıkar
      if (urlOrPath.startsWith('http://') || urlOrPath.startsWith('https://')) {
        try {
          const urlObj = new URL(urlOrPath);
          // pathname'den tipbox-media/ prefix'ini kaldır (varsa)
          // Örnek: /tipbox-media/profile-pictures/... -> profile-pictures/...
          let path = urlObj.pathname.replace(/^\/tipbox-media\//, '').replace(/^\/+/, '');
          // Eğer path boş değilse döndür
          if (path) {
            return path;
          }
          // Path boşsa, pathname'in tamamını al (tipbox-media/ dahil)
          path = urlObj.pathname.replace(/^\/+/, '');
          return path || null;
        } catch {
          // URL parse edilemezse string'den path çıkar
          const match = urlOrPath.match(/\/tipbox-media\/(.+)$/);
          if (match && match[1]) {
            return match[1];
          }
          // Başka bir format varsa direkt pathname'i al
          const pathMatch = urlOrPath.match(/\/[^\/]+\/(.+)$/);
          return pathMatch ? pathMatch[1] : null;
        }
      }
      
      // Zaten path ise, tipbox-media/ prefix'ini kaldır (varsa)
      // buildMediaUrl zaten tipbox-media/ ekleyecek
      return urlOrPath.replace(/^tipbox-media\//, '').replace(/^\/+/, '');
    };

    // Path'i MEDIA_BASE_URL ile birleştirerek tam URL oluştur
    // ASLA localhost döndürmez
    const buildFullUrl = (path: string | null): string | null => {
      if (!path) return null;
      // buildMediaUrl path'e tipbox-media/ ekleyecek ve MEDIA_BASE_URL ile birleştirecek
      const fullUrl = buildMediaUrl(path);
      // Eğer hala localhost içeriyorsa (olmamalı ama güvenlik için), MEDIA_BASE_URL ile değiştir
      if (fullUrl && (fullUrl.includes('localhost') || fullUrl.includes('127.0.0.1'))) {
        const mediaBaseUrl = getPublicMediaBaseUrl();
        const urlObj = new URL(fullUrl);
        return `${mediaBaseUrl}${urlObj.pathname}${urlObj.search}${urlObj.hash}`;
      }
      return fullUrl;
    };

    const userData: SearchUserData[] = (users as any[]).map((u) => {
      const rawAvatarUrl = u?.avatars?.[0]?.imageUrl || null;
      const avatarPath = extractPath(rawAvatarUrl);
      return {
        id: String(u.id),
        name: u?.profile?.displayName || u?.email || 'Anonymous',
        avatar: buildFullUrl(avatarPath),
        cosmetic: u?.titles?.[0]?.title || '', // fallback: last earned title or empty
      };
    });

    const brandData: SearchBrandData[] = (brands as any[]).map((b) => {
      const rawLogoUrl = b.logoUrl || null;
      const logoPath = extractPath(rawLogoUrl);
      return {
        id: String(b.id),
        name: b.name,
        category: b.category || null,
        logo: buildFullUrl(logoPath),
      };
    });

    const productData: SearchProductData[] = (products as any[]).map((p) => {
      const rawImageUrl = p.imageUrl || null;
      const imagePath = extractPath(rawImageUrl);
      return {
        id: String(p.id),
        name: p.name,
        model: p.brand || '',
        specs: p.description || '',
        image: buildFullUrl(imagePath),
      };
    });

    return { userData, brandData, productData };
  }
}


