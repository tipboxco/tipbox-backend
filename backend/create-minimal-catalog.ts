import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function createMinimalCatalog() {
  console.log('Creating minimal catalog data for testing...');

  // Create a test category
  const category = await prisma.category.upsert({
    where: { externalId: 'test-category-1' },
    update: {},
    create: {
      externalId: 'test-category-1',
      name: 'Test Category',
      description: 'Test category for badge system testing',
      handle: 'test-category',
      isActive: true,
      isInternal: true,
    },
  });
  console.log('✓ Category created:', category.name);

  // Create a test product
  const product = await prisma.product.upsert({
    where: { externalId: 'test-product-1' },
    update: {},
    create: {
      externalId: 'test-product-1',
      title: 'Test Product',
      description: 'Test product for badge system testing',
      handle: 'test-product',
      status: 'published' as any,
      isGiftcard: false,
      thumbnail: null,
      categories: {
        connect: { id: category.id },
      },
    },
  });
  console.log('✓ Product created:', product.title);

  // Create a test brand
  const brand = await prisma.brand.upsert({
    where: { externalId: 'test-brand-1' },
    update: {},
    create: {
      externalId: 'test-brand-1',
      name: 'Test Brand',
      description: 'Test brand for badge system testing',
      logoUrl: null,
      imageUrl: null,
      bannerUrl: null,
      category: category.name,
      categoryId: category.id,
    },
  });
  console.log('✓ Brand created:', brand.name);

  console.log('\n✅ Minimal catalog data created successfully!');

  await prisma.$disconnect();
}

createMinimalCatalog().catch(async (error) => {
  console.error('❌ Error creating minimal catalog:', error);
  await prisma.$disconnect();
  process.exit(1);
});
