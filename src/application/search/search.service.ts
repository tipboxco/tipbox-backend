import { PrismaClient } from '@prisma/client';
import { SearchData, SearchUserData, SearchBrandData, SearchProductData } from '../../interfaces/search/search.dto';

export type SearchTypes = Array<'user' | 'brand' | 'product'>;

export class SearchService {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  async searchAll(keyword: string, limitPerType: number = 10, types?: SearchTypes): Promise<SearchData> {
    const activeTypes: SearchTypes = types && types.length > 0 ? types : ['user', 'brand', 'product'];
    const trimmed = keyword.trim();

    const tasks: Array<Promise<any>> = [];

    // Users
    if (activeTypes.includes('user')) {
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
          take: limitPerType,
        })
      );
    } else {
      tasks.push(Promise.resolve([]));
    }

    // Brands
    if (activeTypes.includes('brand')) {
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
          take: limitPerType,
        })
      );
    } else {
      tasks.push(Promise.resolve([]));
    }

    // Products
    if (activeTypes.includes('product')) {
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
          },
          orderBy: { name: 'asc' },
          take: limitPerType,
        })
      );
    } else {
      tasks.push(Promise.resolve([]));
    }

    const [users, brands, products] = await Promise.all(tasks);

    const userData: SearchUserData[] = (users as any[]).map((u) => ({
      id: String(u.id),
      name: u?.profile?.displayName || u?.email || 'Anonymous',
      avatar: u?.avatars?.[0]?.imageUrl || null,
      cosmetic: u?.titles?.[0]?.title || '', // fallback: last earned title or empty
    }));

    const brandData: SearchBrandData[] = (brands as any[]).map((b) => ({
      id: String(b.id),
      name: b.name,
      category: b.category || null,
      logo: b.logoUrl || null,
    }));

    const productData: SearchProductData[] = (products as any[]).map((p) => ({
      id: String(p.id),
      name: p.name,
      model: p.brand || '',
      specs: p.description || '',
      image: null,
    }));

    return { userData, brandData, productData };
  }
}


