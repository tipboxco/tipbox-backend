import type { PrismaClient } from '@prisma/client'
import {
  SubscriptionPlanPeriod,
  SubscriptionStatus,
  InvoiceStatus,
} from '@prisma/client'

const DEFAULT_TEST_USER_EMAIL = 'omer@tipbox.co'
const PLAN_MONTHLY_ID = '00000000-0000-0000-0000-000000000001'
const PLAN_YEARLY_ID = '00000000-0000-0000-0000-000000000002'
const SUBSCRIPTION_ID = '00000000-0000-0000-0000-000000000010'

/**
 * Seeds SubscriptionPlan, PaymentMethod, UserSubscription, Invoice.
 * Aligned with scripts/seed-payment-subscription-data.ts format.
 */
export async function seedPayment(
  prisma: PrismaClient,
  options?: { testUserEmail?: string }
): Promise<void> {
  const testUserEmail = options?.testUserEmail ?? DEFAULT_TEST_USER_EMAIL
  console.log('\n   Seeding SubscriptionPlan, PaymentMethod, UserSubscription, Invoice...')

  // 1. SubscriptionPlan (upsert)
  await prisma.subscriptionPlan.upsert({
    where: { id: PLAN_MONTHLY_ID },
    create: {
      id: PLAN_MONTHLY_ID,
      name: 'Premium Monthly',
      price: 99.99,
      currency: 'USD',
      period: SubscriptionPlanPeriod.MONTHLY,
      benefits: ['Exclusive Badge', 'Convert badges to NFT', 'Unlimited TIPS sending'],
      isActive: true,
      displayOrder: 1,
    },
    update: {
      name: 'Premium Monthly',
      price: 99.99,
      currency: 'USD',
      period: SubscriptionPlanPeriod.MONTHLY,
      isActive: true,
      benefits: ['Exclusive Badge', 'Convert badges to NFT', 'Unlimited TIPS sending'],
    },
  })
  await prisma.subscriptionPlan.upsert({
    where: { id: PLAN_YEARLY_ID },
    create: {
      id: PLAN_YEARLY_ID,
      name: 'Premium Yearly',
      price: 999.99,
      currency: 'USD',
      period: SubscriptionPlanPeriod.YEARLY,
      benefits: ['Exclusive Badge', 'Convert badges to NFT', 'Unlimited TIPS sending', '2 months free'],
      isActive: true,
      displayOrder: 2,
    },
    update: {
      name: 'Premium Yearly',
      price: 999.99,
      currency: 'USD',
      period: SubscriptionPlanPeriod.YEARLY,
      isActive: true,
      benefits: ['Exclusive Badge', 'Convert badges to NFT', 'Unlimited TIPS sending', '2 months free'],
    },
  })

  const user = await prisma.user.findUnique({
    where: { email: testUserEmail },
    select: { id: true },
  })
  if (!user) {
    console.warn(`   User not found: ${testUserEmail}, skipping PaymentMethod/Subscription/Invoice`)
    return
  }

  // 2. PaymentMethod (one test card if none)
  let card = await prisma.paymentMethod.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
  })
  if (!card) {
    card = await prisma.paymentMethod.create({
      data: {
        userId: user.id,
        cardAlias: 'Seed Test Card',
        brand: 'VISA',
        last4: '4242',
        expiryMonth: 12,
        expiryYear: 2030,
        isDefault: true,
      },
    })
    console.log('   Created 1 PaymentMethod (test card)')
  }

  const periodStart = new Date()
  periodStart.setDate(1)
  periodStart.setHours(0, 0, 0, 0)
  const periodEnd = new Date(periodStart)
  periodEnd.setMonth(periodEnd.getMonth() + 1)

  // 3. UserSubscription (upsert)
  await prisma.userSubscription.upsert({
    where: { id: SUBSCRIPTION_ID },
    create: {
      id: SUBSCRIPTION_ID,
      userId: user.id,
      planId: PLAN_MONTHLY_ID,
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
  })

  // 4. Invoice (3 records, upsert)
  const invoicesData = [
    { monthsAgo: 2, amount: 99.99, description: 'Premium Monthly - November 2025' },
    { monthsAgo: 1, amount: 99.99, description: 'Premium Monthly - December 2025' },
    { monthsAgo: 0, amount: 99.99, description: 'Premium Monthly - January 2026' },
  ]
  for (let i = 0; i < invoicesData.length; i++) {
    const { monthsAgo, amount, description } = invoicesData[i]
    const invoiceDate = new Date()
    invoiceDate.setMonth(invoiceDate.getMonth() - monthsAgo)
    invoiceDate.setDate(1)
    invoiceDate.setHours(0, 0, 0, 0)
    const paidAt = new Date(invoiceDate)
    paidAt.setDate(paidAt.getDate() + 1)
    const invoiceId = `00000000-0000-0000-0000-00000000010${i}`

    await prisma.invoice.upsert({
      where: { id: invoiceId },
      create: {
        id: invoiceId,
        userId: user.id,
        subscriptionId: SUBSCRIPTION_ID,
        planId: PLAN_MONTHLY_ID,
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
    })
  }

  console.log('   SubscriptionPlan (2), PaymentMethod (1), UserSubscription (1), Invoice (3) done')
}
