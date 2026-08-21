import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { hash } from 'bcryptjs';
import { PrismaClient } from '../src/generated/prisma/client.js';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is required');
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});
const ids = {
  policy: '10000000-0000-4000-8000-000000000001',
  catMetabolic: '20000000-0000-4000-8000-000000000001',
  catFood: '20000000-0000-4000-8000-000000000002',
  catRisk: '20000000-0000-4000-8000-000000000003',
  typeMetabolic: '30000000-0000-4000-8000-000000000001',
  typeFood: '30000000-0000-4000-8000-000000000002',
  typeRisk: '30000000-0000-4000-8000-000000000003',
  customer: '40000000-0000-4000-8000-000000000001',
  proxy: '40000000-0000-4000-8000-000000000002',
  advisor1: '40000000-0000-4000-8000-000000000003',
  advisor2: '40000000-0000-4000-8000-000000000004',
  operator: '40000000-0000-4000-8000-000000000005',
  delegator: '40000000-0000-4000-8000-000000000006',
  examinee: '50000000-0000-4000-8000-000000000001',
  proxyExaminee: '50000000-0000-4000-8000-000000000002',
  externalExaminee: '50000000-0000-4000-8000-000000000003',
  resultSelf: '60000000-0000-4000-8000-000000000001',
  resultProxy: '60000000-0000-4000-8000-000000000002',
  resultExternal: '60000000-0000-4000-8000-000000000003',
  advisorProfile1: '70000000-0000-4000-8000-000000000001',
  advisorProfile2: '70000000-0000-4000-8000-000000000002',
  delegation: '80000000-0000-4000-8000-000000000001',
  externalDelegation: '80000000-0000-4000-8000-000000000002',
};

async function main() {
  const passwordHash = await hash('DemoPass123!', 12);
  const active = await prisma.schedulingPolicy.findFirst({
    where: { active: true },
  });
  const policyData = {
    consultationDurationMinutes: 30,
    slotIntervalMinutes: 30,
    minimumBookingLeadTimeMinutes: 60,
    cancellationCutoffMinutes: 60,
    bookingWindowDays: 30,
    active: true,
  };
  if (active)
    await prisma.schedulingPolicy.update({
      where: { id: active.id },
      data: policyData,
    });
  else
    await prisma.schedulingPolicy.upsert({
      where: { id: ids.policy },
      update: policyData,
      create: { id: ids.policy, ...policyData },
    });

  for (const category of [
    { id: ids.catMetabolic, code: 'METABOLIC', name: 'Metabolic health' },
    { id: ids.catFood, code: 'FOOD', name: 'Food response' },
    { id: ids.catRisk, code: 'HEALTH_RISK', name: 'Nutrition and health risk' },
  ])
    await prisma.testCategory.upsert({
      where: { code: category.code },
      update: { name: category.name },
      create: category,
    });
  for (const type of [
    {
      id: ids.typeMetabolic,
      categoryId: ids.catMetabolic,
      code: 'COMPREHENSIVE_METABOLIC',
      name: 'Comprehensive metabolic analysis',
    },
    {
      id: ids.typeFood,
      categoryId: ids.catFood,
      code: 'FOOD_INTOLERANCE',
      name: 'Food intolerance analysis',
    },
    {
      id: ids.typeRisk,
      categoryId: ids.catRisk,
      code: 'NUTRITION_HEAVY_METAL',
      name: 'Nutrition/heavy-metal health risk analysis',
    },
  ])
    await prisma.testType.upsert({
      where: { code: type.code },
      update: { categoryId: type.categoryId, name: type.name },
      create: type,
    });

  // Demo personas. The customer-side accounts share the 박 surname so the
  // family-delegation scenario reads at a glance; the role each one plays is
  // carried by its email, not by its name.
  const users = [
    {
      id: ids.customer,
      email: 'customer@demo.local',
      name: '박서연',
      role: 'CUSTOMER' as const,
    },
    {
      id: ids.proxy,
      email: 'proxy@demo.local',
      name: '박준호',
      role: 'CUSTOMER' as const,
    },
    {
      id: ids.advisor1,
      email: 'advisor1@demo.local',
      name: '김지훈',
      role: 'ADVISOR' as const,
    },
    {
      id: ids.advisor2,
      email: 'advisor2@demo.local',
      name: '이수진',
      role: 'ADVISOR' as const,
    },
    {
      id: ids.operator,
      email: 'operator@demo.local',
      name: '최민석',
      role: 'OPERATOR' as const,
    },
    {
      id: ids.delegator,
      email: 'delegator@demo.local',
      name: '박민지',
      role: 'CUSTOMER' as const,
    },
  ];
  for (const user of users)
    await prisma.user.upsert({
      where: { email: user.email },
      update: { name: user.name, role: user.role, passwordHash },
      create: { ...user, passwordHash },
    });

  // An examinee is the person a specimen belongs to, so these names mirror
  // the account that owns them.
  for (const examinee of [
    {
      id: ids.examinee,
      userId: ids.customer,
      name: '박서연',
      birthDate: new Date('1990-05-12'),
    },
    {
      id: ids.proxyExaminee,
      userId: ids.proxy,
      name: '박준호',
      birthDate: new Date('1988-11-03'),
    },
  ])
    await prisma.examinee.upsert({
      where: { userId: examinee.userId },
      update: { name: examinee.name, birthDate: examinee.birthDate },
      create: examinee,
    });
  // An examinee with no account of their own: an elderly parent whose result
  // can only be reached through operator-verified external consent.
  await prisma.examinee.upsert({
    where: { id: ids.externalExaminee },
    update: { name: '박정숙' },
    create: {
      id: ids.externalExaminee,
      name: '박정숙',
      birthDate: new Date('1955-01-18'),
    },
  });

  // Summaries are shown verbatim in the customer and advisor portals, so they
  // are written in Korean and matched to each result's test type.
  for (const result of [
    {
      id: ids.resultSelf,
      examineeId: ids.examinee,
      testTypeId: ids.typeMetabolic,
      summary: '공복 혈당과 중성지방이 경계 범위로 확인되었습니다.',
    },
    {
      id: ids.resultProxy,
      examineeId: ids.examinee,
      testTypeId: ids.typeFood,
      summary: '유제품과 밀 항목에서 중등도 반응이 확인되었습니다.',
    },
    {
      id: ids.resultExternal,
      examineeId: ids.externalExaminee,
      testTypeId: ids.typeRisk,
      summary: '비타민 D 부족과 중금속 수치 상승이 확인되었습니다.',
    },
  ])
    await prisma.testResult.upsert({
      where: { id: result.id },
      update: { summary: result.summary },
      create: { ...result, testedAt: new Date('2026-07-15T00:00:00Z') },
    });

  const advisorIntroduction1 = '대사 건강과 음식 반응 분야를 상담합니다.';
  const advisorIntroduction2 = '영양과 건강 위험도 분야를 상담합니다.';
  await prisma.advisorProfile.upsert({
    where: { userId: ids.advisor1 },
    update: { active: true, introduction: advisorIntroduction1 },
    create: {
      id: ids.advisorProfile1,
      userId: ids.advisor1,
      active: true,
      introduction: advisorIntroduction1,
    },
  });
  await prisma.advisorProfile.upsert({
    where: { userId: ids.advisor2 },
    update: { active: true, introduction: advisorIntroduction2 },
    create: {
      id: ids.advisorProfile2,
      userId: ids.advisor2,
      active: true,
      introduction: advisorIntroduction2,
    },
  });
  await prisma.advisorTestType.createMany({
    data: [
      { advisorId: ids.advisorProfile1, testTypeId: ids.typeMetabolic },
      { advisorId: ids.advisorProfile1, testTypeId: ids.typeFood },
      { advisorId: ids.advisorProfile2, testTypeId: ids.typeMetabolic },
      { advisorId: ids.advisorProfile2, testTypeId: ids.typeRisk },
    ],
    skipDuplicates: true,
  });

  const tomorrowKst = new Date(Date.now() + 86400000 + 9 * 3600000),
    y = tomorrowKst.getUTCFullYear(),
    m = tomorrowKst.getUTCMonth(),
    d = tomorrowKst.getUTCDate();
  const atKst = (hour: number) => new Date(Date.UTC(y, m, d, hour - 9));
  await prisma.advisorAvailability.deleteMany({
    where: { advisorId: { in: [ids.advisorProfile1, ids.advisorProfile2] } },
  });
  for (const range of [
    {
      id: '90000000-0000-4000-8000-000000000001',
      advisorId: ids.advisorProfile1,
      startsAt: atKst(13),
      endsAt: atKst(18),
    },
    {
      id: '90000000-0000-4000-8000-000000000002',
      advisorId: ids.advisorProfile2,
      startsAt: atKst(13),
      endsAt: atKst(18),
    },
  ])
    await prisma.advisorAvailability.upsert({
      where: { id: range.id },
      update: { startsAt: range.startsAt, endsAt: range.endsAt },
      create: range,
    });

  await prisma.consultationDelegation.upsert({
    where: { id: ids.delegation },
    update: { status: 'APPROVED' },
    create: {
      id: ids.delegation,
      testResultId: ids.resultProxy,
      delegateUserId: ids.proxy,
      status: 'APPROVED',
      consentMethod: 'SELF_SERVICE',
      consentedByUserId: ids.customer,
      consentedAt: new Date(),
    },
  });
  await prisma.consultationDelegation.upsert({
    where: { id: ids.externalDelegation },
    update: {},
    create: {
      id: ids.externalDelegation,
      testResultId: ids.resultExternal,
      delegateUserId: ids.proxy,
      status: 'PENDING',
    },
  });
  for (const product of [
    { code: 'OMEGA3', name: 'Omega-3 supplement', category: 'Supplement' },
    { code: 'PROBIOTIC', name: 'Probiotic blend', category: 'Supplement' },
    { code: 'MAGNESIUM', name: 'Magnesium complex', category: 'Supplement' },
    { code: 'MEAL_GUIDE', name: 'Nutrition meal guide', category: 'Program' },
  ])
    await prisma.product.upsert({
      where: { code: product.code },
      update: product,
      create: product,
    });

  console.info('Seed complete. Demo password: DemoPass123!');
  console.info(
    users.map(({ email, role, name }) => `${role}: ${email} (${name})`).join('\n'),
  );
}

main().finally(() => prisma.$disconnect());
