/**
 * Lists billing data for omer@tipbox.co from DB:
 * payment methods, invoices, subscriptions, subscription plans.
 * Usage: npx ts-node scripts/show-omer-billing.ts
 *        or: docker-compose exec backend npx ts-node scripts/show-omer-billing.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const OMER_EMAIL = 'omer@tipbox.co';

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: OMER_EMAIL },
    select: { id: true, email: true },
  });

  if (!user) {
    console.log(`\nUser not found: ${OMER_EMAIL}\n`);
    process.exit(1);
  }

  console.log('\n=== omer@tipbox.co – DB summary ===\n');
  console.log('User:', { id: user.id, email: user.email ?? OMER_EMAIL });

  const cards = await prisma.paymentMethod.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
  });
  console.log('\n--- Saved cards (PaymentMethod) ---');
  if (cards.length === 0) {
    console.log('  (no records)');
  } else {
    cards.forEach((c, i) => {
      console.log(`  ${i + 1}. ${c.cardAlias} | ${c.brand} ****${c.last4} | ${c.expiryMonth}/${c.expiryYear} | default: ${c.isDefault} | id: ${c.id}`);
    });
  }

  const plans = await prisma.subscriptionPlan.findMany({
    where: { isActive: true },
    orderBy: { displayOrder: 'asc' },
  });
  console.log('\n--- Premium plans (SubscriptionPlan, active) ---');
  if (plans.length === 0) {
    console.log('  (no records)');
  } else {
    plans.forEach((p, i) => {
      console.log(`  ${i + 1}. ${p.name} | ${p.price} ${p.currency} | ${p.period} | id: ${p.id}`);
    });
  }

  const subscriptions = await prisma.userSubscription.findMany({
    where: { userId: user.id },
    include: { plan: true, paymentMethod: true },
    orderBy: { createdAt: 'desc' },
  });
  console.log('\n--- Subscriptions (UserSubscription) ---');
  if (subscriptions.length === 0) {
    console.log('  (no records)');
  } else {
    subscriptions.forEach((s, i) => {
      console.log(`  ${i + 1}. Plan: ${s.plan.name} | status: ${s.status} | ${s.currentPeriodStart.toISOString().slice(0, 10)} → ${s.currentPeriodEnd.toISOString().slice(0, 10)} | id: ${s.id}`);
      if (s.paymentMethod) console.log(`      Card: ${s.paymentMethod.cardAlias} ****${s.paymentMethod.last4}`);
    });
  }

  const invoices = await prisma.invoice.findMany({
    where: { userId: user.id },
    include: { plan: true },
    orderBy: { invoiceDate: 'desc' },
    take: 20,
  });
  console.log('\n--- Invoices / Billing history (last 20) ---');
  if (invoices.length === 0) {
    console.log('  (no records)');
  } else {
    invoices.forEach((inv, i) => {
      console.log(`  ${i + 1}. ${inv.invoiceDate.toISOString().slice(0, 10)} | ${inv.amount} ${inv.currency} | ${inv.status} | ${inv.description ?? '-'} | id: ${inv.id}`);
      if (inv.plan) console.log(`      Plan: ${inv.plan.name}`);
    });
  }

  console.log('\n=== Done ===\n');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
