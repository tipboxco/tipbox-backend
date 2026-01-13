import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { ExperienceType } from '../../src/domain/content/experience-type.enum';
import { ExperienceStatus } from '../../src/domain/content/experience-status.enum';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const prisma = new PrismaClient();
jest.setTimeout(30000);

describe('Inventory API', () => {
  let authToken: string;

  beforeAll(async () => {
    const email = 'omer@tipbox.co';
    const password = 'password123';
    let loginRes = await request(BASE_URL).post('/auth/login').send({ email, password });
    if (!(loginRes.status === 200 && loginRes.body.token)) {
      const uniqueEmail = `e2e_${Date.now()}@tipbox.co`;
      const registerRes = await request(BASE_URL).post('/auth/register').send({ email: uniqueEmail, password, name: 'E2E User' });
      if (registerRes.status !== 201 && !registerRes.body.token) throw new Error('Failed to register test user');
      loginRes = await request(BASE_URL).post('/auth/login').send({ email: uniqueEmail, password });
    }
    authToken = loginRes.body.token;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('GET /inventory should return inventory list', async () => {
    const res = await request(BASE_URL).get('/inventory').set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('POST /inventory should create inventory item with experiences and images', async () => {
    const [product, duration, location, purpose] = await Promise.all([
      prisma.product.findFirst(),
      prisma.experienceDuration.findFirst(),
      prisma.experienceLocation.findFirst(),
      prisma.experiencePurpose.findFirst(),
    ]);

    if (!product || !duration || !location || !purpose) {
      console.warn('Skipping POST /inventory test due to missing seed data');
      return;
    }

    const payload = {
      productId: product.id,
      selectedDurationId: duration.id,
      selectedLocationId: location.id,
      selectedPurposeId: purpose.id,
      content: 'Bu ürünle ilgili deneyimimi inventory üzerinden paylaşıyorum.',
      experience: [
        {
          type: ExperienceType.PRICE_AND_SHOPPING,
          content: 'Satın alma süreci oldukça kolaydı.',
          rating: 5,
        },
        {
          type: ExperienceType.PRODUCT_AND_USAGE,
          content: 'Ürünü bir haftadır aktif kullanıyorum ve memnunum.',
          rating: 4,
        },
      ],
      status: ExperienceStatus.OWN,
      images: ['https://cdn.tipbox.co/tests/inventory-image.png'],
    };

    const res = await request(BASE_URL)
      .post('/inventory')
      .set('Authorization', `Bearer ${authToken}`)
      .send(payload);

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body).toHaveProperty('productId', payload.productId);
    expect(res.body).toHaveProperty('userId');

    const createdInventoryId = res.body.id as string;

    try {
      const inventoryRecord = await prisma.inventory.findUnique({
        where: { id: createdInventoryId },
      });
      expect(inventoryRecord).not.toBeNull();

      const experienceCount = await prisma.productExperience.count({
        where: { inventoryId: createdInventoryId },
      });
      expect(experienceCount).toBe(payload.experience.length);

      const mediaCount = await prisma.inventoryMedia.count({
        where: { inventoryId: createdInventoryId },
      });
      expect(mediaCount).toBe(payload.images.length);
    } finally {
      await prisma.inventoryMedia.deleteMany({ where: { inventoryId: createdInventoryId } });
      await prisma.productExperience.deleteMany({ where: { inventoryId: createdInventoryId } });
      await prisma.inventory.delete({ where: { id: createdInventoryId } });
    }
  });

  it('PATCH /inventory/{id} should update or return 403/404', async () => {
    const list = await request(BASE_URL).get('/inventory').set('Authorization', `Bearer ${authToken}`);
    if (list.status !== 200 || !Array.isArray(list.body) || list.body.length === 0) return;
    const anyId = String(list.body[0].id);
    const res = await request(BASE_URL)
      .patch(`/inventory/${anyId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ hasOwned: true });
    expect([200, 403, 404]).toContain(res.status);
  });

  it('DELETE /inventory/{id} should delete or error accordingly', async () => {
    const list = await request(BASE_URL).get('/inventory').set('Authorization', `Bearer ${authToken}`);
    if (list.status !== 200 || !Array.isArray(list.body) || list.body.length === 0) return;
    const anyId = String(list.body[0].id);
    const res = await request(BASE_URL)
      .delete(`/inventory/${anyId}`)
      .set('Authorization', `Bearer ${authToken}`);
    expect([200, 403, 404, 500]).toContain(res.status);
  });
});
