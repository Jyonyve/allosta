import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { hash } from 'bcryptjs';
import { Pool } from 'pg';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';

const ids = {
  category: '20000000-0000-4000-8000-000000000001',
  testType: '30000000-0000-4000-8000-000000000001',
  customer: '40000000-0000-4000-8000-000000000001',
  customer2: '40000000-0000-4000-8000-000000000002',
  advisorUser1: '40000000-0000-4000-8000-000000000003',
  advisorUser2: '40000000-0000-4000-8000-000000000004',
  examinee1: '50000000-0000-4000-8000-000000000001',
  examinee2: '50000000-0000-4000-8000-000000000002',
  result1: '60000000-0000-4000-8000-000000000001',
  result2: '60000000-0000-4000-8000-000000000002',
  result3: '60000000-0000-4000-8000-000000000003',
  advisor1: '70000000-0000-4000-8000-000000000001',
  advisor2: '70000000-0000-4000-8000-000000000002',
  availability1: '90000000-0000-4000-8000-000000000001',
  availability2: '90000000-0000-4000-8000-000000000002',
  overlappingAvailability: '90000000-0000-4000-8000-000000000003',
  adjacentAvailability: '90000000-0000-4000-8000-000000000004',
  policy: '10000000-0000-4000-8000-000000000001',
  consultation1: 'a0000000-0000-4000-8000-000000000001',
  consultation2: 'a0000000-0000-4000-8000-000000000002',
  delegation: 'b0000000-0000-4000-8000-000000000001',
  record: 'c0000000-0000-4000-8000-000000000001',
  product: 'd0000000-0000-4000-8000-000000000001',
};

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl)
  throw new Error('Integration database URL was not configured');
const pool = new Pool({ connectionString: databaseUrl, max: 4 });

function futureSlot() {
  const value = new Date(Date.now() + 3 * 86_400_000);
  value.setUTCMinutes(0, 0, 0);
  return value;
}

async function resetDatabase() {
  await pool.query(`
    TRUNCATE TABLE
      consultation_interested_products,
      consultation_records,
      consultations,
      consultation_delegations,
      advisor_availabilities,
      advisor_test_types,
      advisor_profiles,
      test_results,
      test_types,
      test_categories,
      examinees,
      scheduling_policies,
      products,
      users
    CASCADE
  `);
}

async function seedFixture() {
  const passwordHash = await hash('IntegrationPass123!', 4);
  const slot = futureSlot();
  const availabilityStart = new Date(slot.getTime() - 3_600_000);
  const availabilityEnd = new Date(slot.getTime() + 7_200_000);

  await pool.query(
    `INSERT INTO users (id, email, password_hash, name, role, "updatedAt")
     VALUES
       ($1, 'customer1@integration.local', $5, 'Customer One', 'CUSTOMER', now()),
       ($2, 'customer2@integration.local', $5, 'Customer Two', 'CUSTOMER', now()),
       ($3, 'advisor1@integration.local', $5, 'Advisor One', 'ADVISOR', now()),
       ($4, 'advisor2@integration.local', $5, 'Advisor Two', 'ADVISOR', now())`,
    [
      ids.customer,
      ids.customer2,
      ids.advisorUser1,
      ids.advisorUser2,
      passwordHash,
    ],
  );
  await pool.query(
    `INSERT INTO examinees (id, user_id, name, birth_date, updated_at)
     VALUES
       ($1, $3, 'Customer One', DATE '1990-01-01', now()),
       ($2, $4, 'Customer Two', DATE '1991-01-01', now())`,
    [ids.examinee1, ids.examinee2, ids.customer, ids.customer2],
  );
  await pool.query(
    `INSERT INTO test_categories (id, code, name)
     VALUES ($1, 'INTEGRATION', 'Integration category')`,
    [ids.category],
  );
  await pool.query(
    `INSERT INTO test_types (id, category_id, code, name)
     VALUES ($1, $2, 'INTEGRATION_TYPE', 'Integration test type')`,
    [ids.testType, ids.category],
  );
  await pool.query(
    `INSERT INTO test_results (id, examinee_id, test_type_id, tested_at, summary)
     VALUES
       ($1, $4, $6, now(), 'First owned result'),
       ($2, $5, $6, now(), 'Second customer result'),
       ($3, $4, $6, now(), 'Second owned result')`,
    [
      ids.result1,
      ids.result2,
      ids.result3,
      ids.examinee1,
      ids.examinee2,
      ids.testType,
    ],
  );
  await pool.query(
    `INSERT INTO advisor_profiles (id, user_id, active, updated_at)
     VALUES ($1, $3, true, now()), ($2, $4, true, now())`,
    [ids.advisor1, ids.advisor2, ids.advisorUser1, ids.advisorUser2],
  );
  await pool.query(
    `INSERT INTO advisor_test_types (advisor_id, test_type_id)
     VALUES ($1, $3), ($2, $3)`,
    [ids.advisor1, ids.advisor2, ids.testType],
  );
  await pool.query(
    `INSERT INTO advisor_availabilities
       (id, advisor_id, starts_at, ends_at, updated_at)
     VALUES
       ($1, $3, $5, $6, now()),
       ($2, $4, $5, $6, now())`,
    [
      ids.availability1,
      ids.availability2,
      ids.advisor1,
      ids.advisor2,
      availabilityStart,
      availabilityEnd,
    ],
  );
  await pool.query(
    `INSERT INTO scheduling_policies
       (id, consultation_duration_minutes, slot_interval_minutes,
        minimum_booking_lead_time_minutes, cancellation_cutoff_minutes,
        booking_window_days, active, updated_at)
     VALUES ($1, 30, 30, 60, 60, 30, true, now())`,
    [ids.policy],
  );
  await pool.query(
    `INSERT INTO products (id, code, name, category, active)
     VALUES ($1, 'INTEGRATION_PRODUCT', 'Integration product', 'Supplement', true)`,
    [ids.product],
  );

  return { slot, availabilityStart, availabilityEnd };
}

async function insertConsultation(input: {
  id: string;
  requesterId: string;
  resultId: string;
  advisorId: string;
  start: Date;
  status?: 'RESERVED' | 'DOCUMENTING' | 'CANCELLED';
}) {
  await pool.query(
    `INSERT INTO consultations
       (id, requester_user_id, test_result_id, advisor_id, status,
        scheduled_start_at, scheduled_end_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, now())`,
    [
      input.id,
      input.requesterId,
      input.resultId,
      input.advisorId,
      input.status ?? 'RESERVED',
      input.start,
      new Date(input.start.getTime() + 1_800_000),
    ],
  );
}

async function login(app: INestApplication, email: string) {
  const response = await request(app.getHttpServer())
    .post('/auth/login')
    .send({ email, password: 'IntegrationPass123!' })
    .expect(201);
  return response.body.accessToken as string;
}

describe('consultation PostgreSQL integration', () => {
  let app: INestApplication;

  beforeAll(async () => {
    await pool.query('SELECT 1');
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await app.close();
    await pool.end();
  });

  it('rejects overlapping advisor availability while allowing adjacency', async () => {
    const { availabilityStart, availabilityEnd } = await seedFixture();

    await expect(
      pool.query(
        `INSERT INTO advisor_availabilities
           (id, advisor_id, starts_at, ends_at, updated_at)
         VALUES ($1, $2, $3, $4, now())`,
        [
          ids.overlappingAvailability,
          ids.advisor1,
          new Date(availabilityStart.getTime() + 1_800_000),
          availabilityEnd,
        ],
      ),
    ).rejects.toMatchObject({ code: '23P01' });

    await expect(
      pool.query(
        `INSERT INTO advisor_availabilities
           (id, advisor_id, starts_at, ends_at, updated_at)
         VALUES ($1, $2, $3, $4, now())`,
        [
          ids.adjacentAvailability,
          ids.advisor1,
          availabilityEnd,
          new Date(availabilityEnd.getTime() + 3_600_000),
        ],
      ),
    ).resolves.toMatchObject({ rowCount: 1 });
  });

  it('enforces active advisor capacity and releases it after cancellation', async () => {
    const { slot } = await seedFixture();
    await insertConsultation({
      id: ids.consultation1,
      requesterId: ids.customer,
      resultId: ids.result1,
      advisorId: ids.advisor1,
      start: slot,
    });

    await expect(
      insertConsultation({
        id: ids.consultation2,
        requesterId: ids.customer2,
        resultId: ids.result2,
        advisorId: ids.advisor1,
        start: slot,
      }),
    ).rejects.toMatchObject({ code: '23505' });

    await pool.query(
      `UPDATE consultations SET status = 'CANCELLED' WHERE id = $1`,
      [ids.consultation1],
    );
    await expect(
      insertConsultation({
        id: ids.consultation2,
        requesterId: ids.customer2,
        resultId: ids.result2,
        advisorId: ids.advisor1,
        start: slot,
      }),
    ).resolves.toBeUndefined();
  });

  it('enforces active requester and test-result uniqueness', async () => {
    const { slot } = await seedFixture();
    await insertConsultation({
      id: ids.consultation1,
      requesterId: ids.customer,
      resultId: ids.result1,
      advisorId: ids.advisor1,
      start: slot,
    });

    await expect(
      insertConsultation({
        id: ids.consultation2,
        requesterId: ids.customer,
        resultId: ids.result2,
        advisorId: ids.advisor2,
        start: slot,
      }),
    ).rejects.toMatchObject({ code: '23505' });
    await expect(
      insertConsultation({
        id: ids.consultation2,
        requesterId: ids.customer2,
        resultId: ids.result1,
        advisorId: ids.advisor2,
        start: new Date(slot.getTime() + 1_800_000),
      }),
    ).rejects.toMatchObject({ code: '23505' });
  });

  it('enforces consultation record finalization consistency', async () => {
    const { slot } = await seedFixture();
    await insertConsultation({
      id: ids.consultation1,
      requesterId: ids.customer,
      resultId: ids.result1,
      advisorId: ids.advisor1,
      start: slot,
    });

    await expect(
      pool.query(
        `INSERT INTO consultation_records
           (id, consultation_id, status, finalized_at, updated_at)
         VALUES ($1, $2, 'FINAL', NULL, now())`,
        [ids.record, ids.consultation1],
      ),
    ).rejects.toMatchObject({ code: '23514' });
  });

  it('allows only one winner for concurrent reservation attempts', async () => {
    const { slot } = await seedFixture();
    const token = await login(app, 'customer1@integration.local');

    const responses = await Promise.all([
      request(app.getHttpServer())
        .post('/consultations')
        .set('Authorization', `Bearer ${token}`)
        .send({
          testResultId: ids.result1,
          scheduledStartAt: slot.toISOString(),
        }),
      request(app.getHttpServer())
        .post('/consultations')
        .set('Authorization', `Bearer ${token}`)
        .send({
          testResultId: ids.result1,
          scheduledStartAt: slot.toISOString(),
        }),
    ]);

    expect(responses.map(({ status }) => status).sort()).toEqual([201, 409]);
    const count = await pool.query(
      `SELECT count(*)::int AS count FROM consultations
       WHERE test_result_id = $1 AND status IN ('RESERVED', 'DOCUMENTING')`,
      [ids.result1],
    );
    expect(count.rows[0].count).toBe(1);
  });

  it('enforces delegation scope to one specific test result', async () => {
    await seedFixture();
    const token = await login(app, 'customer2@integration.local');
    await pool.query(
      `INSERT INTO consultation_delegations
         (id, test_result_id, delegate_user_id, status, consent_method,
          consented_by_user_id, consented_at, updated_at)
       VALUES ($1, $2, $3, 'APPROVED', 'SELF_SERVICE', $4, now(), now())`,
      [ids.delegation, ids.result1, ids.customer2, ids.customer],
    );

    await request(app.getHttpServer())
      .get('/consultations/available-slots')
      .set('Authorization', `Bearer ${token}`)
      .query({ testResultId: ids.result1 })
      .expect(200);
    await request(app.getHttpServer())
      .get('/consultations/available-slots')
      .set('Authorization', `Bearer ${token}`)
      .query({ testResultId: ids.result3 })
      .expect(403);
  });

  it('returns only the customer accessible test results', async () => {
    await seedFixture();
    const token = await login(app, 'customer1@integration.local');

    const response = await request(app.getHttpServer())
      .get('/test-results')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body).toHaveLength(2);
    expect(response.body.map(({ id }: { id: string }) => id).sort()).toEqual(
      [ids.result1, ids.result3].sort(),
    );
    expect(response.body[0]).toEqual(
      expect.objectContaining({
        testType: expect.objectContaining({
          category: expect.objectContaining({ code: 'INTEGRATION' }),
        }),
        examinee: expect.objectContaining({ name: 'Customer One' }),
      }),
    );
  });

  it('serves the advisor profile, schedule, products, and availability CRUD', async () => {
    const { slot, availabilityEnd } = await seedFixture();
    await insertConsultation({
      id: ids.consultation1,
      requesterId: ids.customer,
      resultId: ids.result1,
      advisorId: ids.advisor1,
      start: slot,
    });
    const token = await login(app, 'advisor1@integration.local');
    const auth = { Authorization: `Bearer ${token}` };

    const profile = await request(app.getHttpServer())
      .get('/advisor/profile')
      .set(auth)
      .expect(200);
    expect(profile.body).toEqual(
      expect.objectContaining({
        id: ids.advisor1,
        active: true,
        user: expect.objectContaining({ name: 'Advisor One' }),
      }),
    );
    expect(profile.body.testTypes[0].testType.name).toBe(
      'Integration test type',
    );

    const schedule = await request(app.getHttpServer())
      .get('/consultations/advisor/mine')
      .set(auth)
      .expect(200);
    expect(schedule.body).toHaveLength(1);
    expect(schedule.body[0]).toEqual(
      expect.objectContaining({
        id: ids.consultation1,
        requester: expect.objectContaining({ name: 'Customer One' }),
        testResult: expect.objectContaining({
          examinee: expect.objectContaining({ name: 'Customer One' }),
        }),
      }),
    );

    const products = await request(app.getHttpServer())
      .get('/products')
      .set(auth)
      .expect(200);
    expect(products.body).toEqual([
      expect.objectContaining({ id: ids.product, active: true }),
    ]);

    await request(app.getHttpServer())
      .post('/advisor/availability')
      .set(auth)
      .send({
        startsAt: availabilityEnd.toISOString(),
        endsAt: new Date(availabilityEnd.getTime() + 3_600_000).toISOString(),
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/advisor/availability')
      .set(auth)
      .send({
        startsAt: new Date(availabilityEnd.getTime() - 1_800_000).toISOString(),
        endsAt: new Date(availabilityEnd.getTime() + 1_800_000).toISOString(),
      })
      .expect(409);

    const availability = await request(app.getHttpServer())
      .get('/advisor/availability')
      .set(auth)
      .expect(200);
    const created = availability.body.find(
      ({ id }: { id: string }) => id !== ids.availability1,
    );
    expect(created).toBeTruthy();

    const updatedEnd = new Date(availabilityEnd.getTime() + 5_400_000);
    await request(app.getHttpServer())
      .patch(`/advisor/availability/${created.id}`)
      .set(auth)
      .send({
        startsAt: availabilityEnd.toISOString(),
        endsAt: updatedEnd.toISOString(),
      })
      .expect(200)
      .expect(({ body }) => expect(body.endsAt).toBe(updatedEnd.toISOString()));

    await request(app.getHttpServer())
      .delete(`/advisor/availability/${created.id}`)
      .set(auth)
      .expect(200);
  });

  it('persists DRAFT then atomically finalizes the record and consultation', async () => {
    const { slot } = await seedFixture();
    const customerToken = await login(app, 'customer1@integration.local');
    const reservation = await request(app.getHttpServer())
      .post('/consultations')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ testResultId: ids.result1, scheduledStartAt: slot.toISOString() })
      .expect(201);
    expect(reservation.body.advisorId).toBe(ids.advisor1);

    const advisorToken = await login(app, 'advisor1@integration.local');
    const draft = await request(app.getHttpServer())
      .patch(`/consultations/${reservation.body.id}/record`)
      .set('Authorization', `Bearer ${advisorToken}`)
      .send({ summary: 'Persisted draft', productIds: [ids.product] })
      .expect(200);
    expect(draft.body.status).toBe('DRAFT');
    expect(draft.body.interestedProducts[0].product.id).toBe(ids.product);

    const documenting = await pool.query(
      `SELECT status FROM consultations WHERE id = $1`,
      [reservation.body.id],
    );
    expect(documenting.rows[0].status).toBe('DOCUMENTING');

    const finalized = await request(app.getHttpServer())
      .post(`/consultations/${reservation.body.id}/record/finalize`)
      .set('Authorization', `Bearer ${advisorToken}`)
      .send({ summary: 'Final summary', followUpRequired: true })
      .expect(201);
    expect(finalized.body.status).toBe('FINAL');
    expect(finalized.body.finalizedAt).toBeTruthy();

    const completed = await pool.query(
      `SELECT status, completed_at FROM consultations WHERE id = $1`,
      [reservation.body.id],
    );
    expect(completed.rows[0].status).toBe('COMPLETED');
    expect(completed.rows[0].completed_at).toBeTruthy();

    await request(app.getHttpServer())
      .patch(`/consultations/${reservation.body.id}/record`)
      .set('Authorization', `Bearer ${advisorToken}`)
      .send({ summary: 'Forbidden edit' })
      .expect(409);
  });
});
