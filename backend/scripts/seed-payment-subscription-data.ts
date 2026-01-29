/**
 * Seeds SubscriptionPlan, UserSubscription and Invoice for omer@tipbox.co.
 * One-off run: docker-compose exec backend npx ts-node scripts/seed-payment-subscription-data.ts
 */
import { PrismaClient, SubscriptionPlanPeriod, SubscriptionStatus, InvoiceStatus } from '@prisma/client';

const prisma = new PrismaClient();

const OMER_EMAIL = 'omer@tipbox.co';

async function main() {
  console.log('\n--- SubscriptionPlan (Premium plans) ---\n');

  const plans = await Promise.all([
    prisma.subscriptionPlan.upsert({
      where: { id: '00000000-0000-0000-0000-000000000001' },
      create: {
        id: '00000000-0000-0000-0000-000000000001',
        name: 'Premium Monthly',
        price: 99.99,
        currency: 'USD',
        period: SubscriptionPlanPeriod.MONTHLY,
        benefits: ['Exclusive Badge', 'Convert badges to NFT', 'Unlimited TIPS sending'],
        isActive: true,
        displayOrder: 1,
      },
      update: { name: 'Premium Monthly', price: 99.99, currency: 'USD', period: SubscriptionPlanPeriod.MONTHLY, isActive: true, benefits: ['Exclusive Badge', 'Convert badges to NFT', 'Unlimited TIPS sending'] },
    }),
    prisma.subscriptionPlan.upsert({
      where: { id: '00000000-0000-0000-0000-000000000002' },
      create: {
        id: '00000000-0000-0000-0000-000000000002',
        name: 'Premium Yearly',
        price: 999.99,
        currency: 'USD',
        period: SubscriptionPlanPeriod.YEARLY,
        benefits: ['Exclusive Badge', 'Convert badges to NFT', 'Unlimited TIPS sending', '2 months free'],
        isActive: true,
        displayOrder: 2,
      },
      update: { name: 'Premium Yearly', price: 999.99, currency: 'USD', period: SubscriptionPlanPeriod.YEARLY, isActive: true, benefits: ['Exclusive Badge', 'Convert badges to NFT', 'Unlimited TIPS sending', '2 months free'] },
    }),
  ]);

  console.log('Plans created/updated:', plans.map((p) => p.name).join(', '));

  const user = await prisma.user.findUnique({
    where: { email: OMER_EMAIL },
    select: { id: true },
  });
  if (!user) {
    console.log(`\nUser not found: ${OMER_EMAIL}`);
    process.exit(1);
  }

  const card = await prisma.paymentMethod.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
  });

  const monthlyPlanId = plans[0].id;
  const periodStart = new Date();
  periodStart.setDate(1);
  periodStart.setHours(0, 0, 0, 0);
  const periodEnd = new Date(periodStart);
  periodEnd.setMonth(periodEnd.getMonth() + 1);

  console.log('\n--- UserSubscription (omer@tipbox.co) ---\n');

  const subscription = await prisma.userSubscription.upsert({
    where: { id: '00000000-0000-0000-0000-000000000010' },
    create: {
      id: '00000000-0000-0000-0000-000000000010',
      userId: user.id,
      planId: monthlyPlanId,
      status: SubscriptionStatus.active,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      paymentMethodId: card?.id ?? null,
    },
    update: {
      status: SubscriptionStatus.active,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      paymentMethodId: card?.id ?? undefined,
    },
  });
  console.log('Subscription created/updated:', subscription.id, '| Plan: Premium Monthly | status: active');

  console.log('\n--- Invoice (billing history, omer@tipbox.co) ---\n');

  const invoicesData = [
    { monthsAgo: 2, amount: 99.99, description: 'Premium Monthly - November 2025' },
    { monthsAgo: 1, amount: 99.99, description: 'Premium Monthly - December 2025' },
    { monthsAgo: 0, amount: 99.99, description: 'Premium Monthly - January 2026' },
  ];

  for (let i = 0; i < invoicesData.length; i++) {
    const { monthsAgo, amount, description } = invoicesData[i];
    const invoiceDate = new Date();
    invoiceDate.setMonth(invoiceDate.getMonth() - monthsAgo);
    invoiceDate.setDate(1);
    invoiceDate.setHours(0, 0, 0, 0);
    const paidAt = new Date(invoiceDate);
    paidAt.setDate(paidAt.getDate() + 1);

    await prisma.invoice.upsert({
      where: { id: `00000000-0000-0000-0000-00000000010${i}` },
      create: {
        id: `00000000-0000-0000-0000-00000000010${i}`,
        userId: user.id,
        subscriptionId: subscription.id,
        planId: monthlyPlanId,
        amount,
        currency: 'USD',
        status: InvoiceStatus.Paid,
        description,
        invoiceDate,
        paidAt,
        externalId: `inv_seed_${i}`,
      },
      update: {
        amount,
        currency: 'USD',
        description,
        invoiceDate,
        paidAt,
        status: InvoiceStatus.Paid,
      },
    });
    console.log(`  Invoice: ${description} | ${amount} USD | Paid`);
  }

  console.log('\nSeed completed: plans, 1 subscription, 3 invoices.\n');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
