import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type TopItem = {
  rank: number;
  id: string;
  name: string;
  productsCount: number;
};

async function main() {
  const topCategoryCounts = await prisma.product.groupBy({
    by: ['categoryId'],
    where: { categoryId: { not: null } },
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
    take: 15,
  });

  const categoryIds = topCategoryCounts
    .map((x) => x.categoryId)
    .filter((id): id is string => typeof id === 'string' && id.length > 0);

  const categories = await prisma.category.findMany({
    where: { id: { in: categoryIds } },
    select: { id: true, name: true },
  });

  const categoryById = new Map(categories.map((c) => [c.id, c]));

  const topCategories: TopItem[] = topCategoryCounts
    .map((row, i) => {
      const categoryId = row.categoryId;
      if (!categoryId) return null;
      const category = categoryById.get(categoryId);
      return {
        rank: i + 1,
        id: categoryId,
        name: category?.name ?? '(missing category)',
        productsCount: row._count?.id ?? 0,
      };
    })
    .filter((x): x is TopItem => x !== null);

  const topBrandCounts = await prisma.product.groupBy({
    by: ['brandId'],
    where: { brandId: { not: null } },
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
    take: 15,
  });

  const brandExternalIds = topBrandCounts
    .map((x) => x.brandId)
    .filter((id): id is string => typeof id === 'string' && id.length > 0);

  const brands = await prisma.brand.findMany({
    where: { externalId: { in: brandExternalIds } },
    select: { externalId: true, name: true },
  });

  const brandByExternalId = new Map(
    brands
      .filter((b): b is { externalId: string; name: string } => !!b.externalId)
      .map((b) => [b.externalId, b]),
  );

  const topBrands: TopItem[] = topBrandCounts
    .map((row, i) => {
      const externalId = row.brandId;
      if (!externalId) return null;
      const brand = brandByExternalId.get(externalId);
      return {
        rank: i + 1,
        id: externalId,
        name: brand?.name ?? '(missing brand)',
        productsCount: row._count?.id ?? 0,
      };
    })
    .filter((x): x is TopItem => x !== null);

  console.log('');
  console.log('Top 15 Categories by Product Count');
  console.log('=================================');
  topCategories.forEach((x) => {
    console.log(`${x.rank}. ${x.name} | categoryId=${x.id} | products=${x.productsCount}`);
  });

  console.log('');
  console.log('Top 15 Brands by Product Count');
  console.log('==============================');
  topBrands.forEach((x) => {
    console.log(`${x.rank}. ${x.name} | brandExternalId=${x.id} | products=${x.productsCount}`);
  });

  console.log('');
}

main()
  .catch((error) => {
    console.error('❌ Script error:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

