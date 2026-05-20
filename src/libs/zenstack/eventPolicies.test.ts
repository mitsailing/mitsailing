import { randomUUID } from 'node:crypto';
import { ZenStackClient } from '@zenstackhq/orm';
import type { ClientContract } from '@zenstackhq/orm';
import { PostgresDialect } from '@zenstackhq/orm/dialects/postgres';
import { PolicyPlugin } from '@zenstackhq/plugin-policy';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AuthContext } from '../../../zenstack/models';
import type { SchemaType } from '../../../zenstack/schema';
import { schema } from '../../../zenstack/schema';

const shouldRunPolicyDatabaseTest =
  process.env.RUN_DATABASE_TESTS === '1' &&
  Boolean(process.env.TEST_DATABASE_URL);

type EventPolicyDb = ClientContract<SchemaType>;

const ids = {
  answer: `event_policy_${randomUUID()}_answer`,
  assignedAdmin: `event_policy_${randomUUID()}_assigned_admin`,
  assignedEvent: `event_policy_${randomUUID()}_assigned_event`,
  category: `event_policy_${randomUUID()}_category`,
  comment: `event_policy_${randomUUID()}_comment`,
  date: `event_policy_${randomUUID()}_date`,
  fee: `event_policy_${randomUUID()}_fee`,
  hiddenCategory: `event_policy_${randomUUID()}_hidden_category`,
  matchingAnswer: `event_policy_${randomUUID()}_matching_answer`,
  managedCategory: `event_policy_${randomUUID()}_managed_category`,
  otherEvent: `event_policy_${randomUUID()}_other_event`,
  otherParentComment: `event_policy_${randomUUID()}_other_parent_comment`,
  otherQuestion: `event_policy_${randomUUID()}_other_question`,
  otherRegistration: `event_policy_${randomUUID()}_other_registration`,
  otherUser: `event_policy_${randomUUID()}_other_user`,
  owner: `event_policy_${randomUUID()}_owner`,
  question: `event_policy_${randomUUID()}_question`,
  registration: `event_policy_${randomUUID()}_registration`,
  staff: `event_policy_${randomUUID()}_staff`,
  unassignedAdmin: `event_policy_${randomUUID()}_unassigned_admin`,
  unpublishedEvent: `event_policy_${randomUUID()}_unpublished_event`,
  writableCategory: `event_policy_${randomUUID()}_writable_category`,
};

async function columnExists(options: {
  columnName: string;
  pool: Pool;
  tableName: string;
}): Promise<boolean> {
  const result = await options.pool.query<{ exists: boolean }>(
    `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = $1
          AND column_name = $2
      ) AS exists
    `,
    [options.tableName, options.columnName]
  );
  return result.rows[0]?.exists === true;
}

async function insertUser(pool: Pool, id: string, appRole: string) {
  const hasAppRole = await columnExists({
    columnName: 'app_role',
    pool,
    tableName: 'user',
  });
  const email = `${id}@example.test`;
  if (hasAppRole) {
    await pool.query(
      `
        INSERT INTO "user" (
          "id", "name", "email", "email_verified", "app_role", "updated_at"
        )
        VALUES ($1, $2, $3, true, $4, NOW())
      `,
      [id, id, email, appRole]
    );
    return;
  }

  await pool.query(
    `
      INSERT INTO "user" ("id", "name", "email", "email_verified", "updated_at")
      VALUES ($1, $2, $3, true, NOW())
    `,
    [id, id, email]
  );
}

async function insertEvent(
  pool: Pool,
  options: { id: string; published: boolean }
) {
  const hasCreatedBy = await columnExists({
    columnName: 'created_by',
    pool,
    tableName: 'events',
  });
  if (hasCreatedBy) {
    await pool.query(
      `
        INSERT INTO "events" (
          "id", "name", "short_name", "event_category_id", "description",
          "slug", "is_special", "max_participants", "requires_approval",
          "registration_start", "registration_end", "created_by", "created_at",
          "detail_page_kind", "external_detail_url", "is_published"
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, false, 12, false,
          NULL, NULL, $7, NOW(), 'standard', NULL, $8
        )
      `,
      [
        options.id,
        `Event ${options.id}`,
        `Short ${options.id}`,
        ids.category,
        `Description ${options.id}`,
        options.id,
        ids.staff,
        options.published,
      ]
    );
    return;
  }

  await pool.query(
    `
      INSERT INTO "events" (
        "id", "name", "short_name", "event_category_id", "description",
        "slug", "is_special", "max_participants", "requires_approval",
        "registration_start", "registration_end", "created_at",
        "detail_page_kind", "external_detail_url", "is_published"
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, false, 12, false,
        NULL, NULL, NOW(), 'standard', NULL, $7
      )
    `,
    [
      options.id,
      `Event ${options.id}`,
      `Short ${options.id}`,
      ids.category,
      `Description ${options.id}`,
      options.id,
      options.published,
    ]
  );
}

async function deleteFixtures(pool: Pool) {
  const eventIds = [ids.assignedEvent, ids.otherEvent, ids.unpublishedEvent];
  await pool.query(
    'DELETE FROM "event_registration_answers" WHERE "id" = ANY($1)',
    [[ids.answer, ids.matchingAnswer]]
  );
  await pool.query('DELETE FROM "event_comments" WHERE "event_id" = ANY($1)', [
    eventIds,
  ]);
  await pool.query('DELETE FROM "event_registrations" WHERE "id" = ANY($1)', [
    [ids.registration, ids.otherRegistration],
  ]);
  await pool.query('DELETE FROM "event_entry_fees" WHERE "id" = $1', [ids.fee]);
  await pool.query(
    'DELETE FROM "event_registration_questions" WHERE "id" = ANY($1)',
    [[ids.question, ids.otherQuestion]]
  );
  await pool.query('DELETE FROM "event_admins" WHERE "event_id" = ANY($1)', [
    eventIds,
  ]);
  await pool.query('DELETE FROM "event_dates" WHERE "id" = $1', [ids.date]);
  await pool.query('DELETE FROM "events" WHERE "id" = ANY($1)', [eventIds]);
  await pool.query('DELETE FROM "event_categories" WHERE "id" = ANY($1)', [
    [
      ids.category,
      ids.hiddenCategory,
      ids.managedCategory,
      ids.writableCategory,
    ],
  ]);
  await pool.query('DELETE FROM "user" WHERE "id" = ANY($1)', [
    [
      ids.assignedAdmin,
      ids.owner,
      ids.otherUser,
      ids.staff,
      ids.unassignedAdmin,
    ],
  ]);
}

async function insertFixtures(pool: Pool) {
  await deleteFixtures(pool);
  await insertUser(pool, ids.staff, 'dock_staff');
  await insertUser(pool, ids.assignedAdmin, 'volunteer_instructor');
  await insertUser(pool, ids.unassignedAdmin, 'volunteer_instructor');
  await insertUser(pool, ids.owner, 'user');
  await insertUser(pool, ids.otherUser, 'user');
  await pool.query(
    `
      INSERT INTO "event_categories" (
        "id", "name", "display_order", "is_visible", "created_at"
      )
      VALUES
        ($1, 'Policy category', 1, true, NOW()),
        ($2, 'Hidden policy category', 2, false, NOW()),
        ($3, 'Managed policy category', 3, true, NOW())
    `,
    [ids.category, ids.hiddenCategory, ids.managedCategory]
  );
  await insertEvent(pool, { id: ids.assignedEvent, published: true });
  await insertEvent(pool, { id: ids.otherEvent, published: true });
  await insertEvent(pool, { id: ids.unpublishedEvent, published: false });
  await pool.query(
    `
      INSERT INTO "event_admins" ("id", "event_id", "admin_user_id")
      VALUES
        ($1, $2, $3),
        ($4, $5, $6)
    `,
    [
      `event_policy_${randomUUID()}_event_admin`,
      ids.assignedEvent,
      ids.assignedAdmin,
      `event_policy_${randomUUID()}_other_event_admin`,
      ids.otherEvent,
      ids.otherUser,
    ]
  );
  await pool.query(
    `
      INSERT INTO "event_dates" (
        "id", "event_id", "start_datetime", "end_datetime"
      )
      VALUES ($1, $2, NOW(), NOW() + INTERVAL '1 hour')
    `,
    [ids.date, ids.assignedEvent]
  );
  await pool.query(
    `
      INSERT INTO "event_registration_questions" (
        "id", "event_id", "question_text", "answer_type", "options",
        "required", "display_order"
      )
      VALUES
        ($1, $2, 'Question', 'text', NULL, true, 1),
        ($3, $4, 'Other question', 'text', NULL, true, 1)
    `,
    [ids.question, ids.assignedEvent, ids.otherQuestion, ids.otherEvent]
  );
  await pool.query(
    `
      INSERT INTO "event_entry_fees" (
        "id", "event_id", "description", "amount_cents", "is_deposit"
      )
      VALUES ($1, $2, 'Fee', 1200, false)
    `,
    [ids.fee, ids.assignedEvent]
  );
  await pool.query(
    `
      INSERT INTO "event_registrations" (
        "id", "event_id", "user_id", "status", "created_at",
        "swim_agreement_accepted_at"
      )
      VALUES
        ($1, $2, $3, 'pending', NOW(), NOW()),
        ($4, $2, $5, 'pending', NOW(), NOW())
    `,
    [
      ids.registration,
      ids.assignedEvent,
      ids.owner,
      ids.otherRegistration,
      ids.otherUser,
    ]
  );
  await pool.query(
    `
      INSERT INTO "event_registration_answers" (
        "id", "registration_id", "question_id", "value"
      )
      VALUES ($1, $2, $3, 'Aye')
    `,
    [ids.answer, ids.registration, ids.question]
  );
  await pool.query(
    `
      INSERT INTO "event_comments" (
        "id", "event_id", "parent_id", "user_id", "body", "created_at"
      )
      VALUES
        ($1, $2, NULL, $3, 'Owned comment', NOW()),
        ($4, $5, NULL, $6, 'Other parent comment', NOW())
    `,
    [
      ids.comment,
      ids.assignedEvent,
      ids.owner,
      ids.otherParentComment,
      ids.otherEvent,
      ids.otherUser,
    ]
  );
}

async function updateWasAllowed(options: {
  reset: () => Promise<unknown>;
  run: () => Promise<unknown>;
}) {
  const allowed = await options.run().then(
    () => true,
    () => false
  );
  await options.reset();
  return allowed;
}

async function resetAnswer(pool: Pool) {
  await pool.query(
    `
      UPDATE "event_registration_answers"
      SET "registration_id" = $2, "question_id" = $3, "value" = 'Aye'
      WHERE "id" = $1
    `,
    [ids.answer, ids.registration, ids.question]
  );
}

async function resetComment(pool: Pool) {
  await pool.query(
    `
      UPDATE "event_comments"
      SET
        "event_id" = $2,
        "parent_id" = NULL,
        "user_id" = $3,
        "body" = 'Owned comment'
      WHERE "id" = $1
    `,
    [ids.comment, ids.assignedEvent, ids.owner]
  );
}

describe.skipIf(!shouldRunPolicyDatabaseTest)('event policies', () => {
  let pool: Pool;
  let db: EventPolicyDb;

  function authDb(options: AuthContext) {
    return db.$setAuth(options);
  }

  beforeAll(async () => {
    pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
    db = new ZenStackClient(schema, {
      dialect: new PostgresDialect({ pool }),
    }).$use(new PolicyPlugin());
    await insertFixtures(pool);
  });

  afterAll(async () => {
    await deleteFixtures(pool);
    await pool.end();
  });

  it('keeps public event reads to published content without admin assignments', async () => {
    const event = await db.event.findFirst({
      where: { id: ids.assignedEvent },
      include: {
        admins: true,
        dates: true,
        entryFees: true,
        registrationQuestions: true,
      },
    });

    expect(event?.dates).toHaveLength(1);
    expect(event?.entryFees).toHaveLength(1);
    expect(event?.registrationQuestions).toHaveLength(1);
    expect(event?.admins).toEqual([]);
    await expect(
      db.event.findFirst({ where: { id: ids.unpublishedEvent } })
    ).resolves.toBeNull();
    await expect(
      db.eventAdmin.findMany({ where: { eventId: ids.assignedEvent } })
    ).resolves.toEqual([]);
  });

  it('limits event category reads and writes by role', async () => {
    await expect(
      db.eventCategory.findMany({
        orderBy: { displayOrder: 'asc' },
        select: { id: true },
        where: {
          id: { in: [ids.category, ids.hiddenCategory, ids.managedCategory] },
        },
      })
    ).resolves.toEqual([{ id: ids.category }, { id: ids.managedCategory }]);

    await expect(
      authDb({ appRole: 'admin', id: ids.staff }).eventCategory.create({
        data: {
          createdAt: new Date(),
          displayOrder: 4,
          id: ids.writableCategory,
          isVisible: true,
          name: 'Writable policy category',
        },
      })
    ).resolves.toMatchObject({ id: ids.writableCategory });

    await expect(
      authDb({ appRole: 'admin', id: ids.staff }).eventCategory.update({
        data: { name: 'Updated policy category' },
        where: { id: ids.writableCategory },
      })
    ).resolves.toMatchObject({ name: 'Updated policy category' });

    await expect(
      authDb({ appRole: 'user', id: ids.owner }).eventCategory.create({
        data: {
          createdAt: new Date(),
          displayOrder: 5,
          id: `event_policy_${randomUUID()}_blocked_category`,
          isVisible: true,
          name: 'Blocked policy category',
        },
      })
    ).rejects.toThrow();

    await expect(
      authDb({ appRole: 'dock_staff', id: ids.staff }).eventCategory.update({
        data: { name: 'Blocked update' },
        where: { id: ids.writableCategory },
      })
    ).rejects.toThrow();

    await expect(
      authDb({ appRole: 'user', id: ids.owner }).eventCategory.delete({
        where: { id: ids.writableCategory },
      })
    ).rejects.toThrow();

    await expect(
      authDb({ appRole: 'admin', id: ids.staff }).eventCategory.delete({
        where: { id: ids.writableCategory },
      })
    ).resolves.toMatchObject({ id: ids.writableCategory });
  });

  it('keeps event admin assignment writes staff-only', async () => {
    const createdId = `event_policy_${randomUUID()}_blocked_event_admin`;
    let assignmentId: string | undefined;
    await expect(
      authDb({
        appRole: 'volunteer_instructor',
        id: ids.assignedAdmin,
      }).eventAdmin.findMany({ where: { eventId: ids.assignedEvent } })
    ).resolves.toEqual([
      expect.objectContaining({
        adminUserId: ids.assignedAdmin,
        eventId: ids.assignedEvent,
      }),
    ]);

    try {
      const assignments = await authDb({
        appRole: 'volunteer_instructor',
        id: ids.assignedAdmin,
      }).eventAdmin.findMany({ where: { eventId: ids.assignedEvent } });
      assignmentId = assignments[0]?.id;
      expect(assignmentId).toBeDefined();
      if (!assignmentId) {
        throw new Error('expected an assigned event admin fixture');
      }

      await expect(
        authDb({
          appRole: 'volunteer_instructor',
          id: ids.assignedAdmin,
        }).eventAdmin.create({
          data: {
            adminUserId: ids.unassignedAdmin,
            eventId: ids.assignedEvent,
            id: createdId,
          },
        })
      ).rejects.toThrow();
      await expect(
        authDb({
          appRole: 'volunteer_instructor',
          id: ids.assignedAdmin,
        }).eventAdmin.update({
          where: { id: assignmentId },
          data: { adminUserId: ids.unassignedAdmin },
        })
      ).rejects.toThrow();
      await expect(
        authDb({
          appRole: 'volunteer_instructor',
          id: ids.assignedAdmin,
        }).eventAdmin.delete({ where: { id: assignmentId } })
      ).rejects.toThrow();
    } finally {
      await pool.query('DELETE FROM "event_admins" WHERE "id" = $1', [
        createdId,
      ]);
      if (assignmentId) {
        await pool.query(
          `
            INSERT INTO "event_admins" ("id", "event_id", "admin_user_id")
            VALUES ($1, $2, $3)
            ON CONFLICT ("id") DO UPDATE SET
              "event_id" = EXCLUDED."event_id",
              "admin_user_id" = EXCLUDED."admin_user_id"
          `,
          [assignmentId, ids.assignedEvent, ids.assignedAdmin]
        );
      }
    }
  });

  it('enforces one admin assignment per event and user', async () => {
    const duplicateId = `event_policy_${randomUUID()}_duplicate_event_admin`;
    try {
      await expect(
        authDb({ appRole: 'dock_staff', id: ids.staff }).eventAdmin.create({
          data: {
            adminUserId: ids.assignedAdmin,
            eventId: ids.assignedEvent,
            id: duplicateId,
          },
        })
      ).rejects.toThrow();
    } finally {
      await pool.query('DELETE FROM "event_admins" WHERE "id" = $1', [
        duplicateId,
      ]);
    }
  });

  it('allows assigned event admins and rejects unassigned event admins', async () => {
    await expect(
      authDb({
        appRole: 'volunteer_instructor',
        id: ids.assignedAdmin,
      }).event.update({
        where: { id: ids.assignedEvent },
        data: { shortName: 'Assigned' },
      })
    ).resolves.toMatchObject({ id: ids.assignedEvent });

    await expect(
      authDb({
        appRole: 'volunteer_instructor',
        id: ids.unassignedAdmin,
      }).event.update({
        where: { id: ids.assignedEvent },
        data: { shortName: 'Blocked' },
      })
    ).rejects.toThrow();
  });

  it('allows dock staff and site admins to manage events globally', async () => {
    await expect(
      authDb({ appRole: 'dock_staff', id: ids.staff }).event.update({
        where: { id: ids.otherEvent },
        data: { shortName: 'Staff' },
      })
    ).resolves.toMatchObject({ id: ids.otherEvent });

    await expect(
      authDb({ appRole: 'admin', id: ids.staff }).event.update({
        where: { id: ids.unpublishedEvent },
        data: { shortName: 'Admin' },
      })
    ).resolves.toMatchObject({ id: ids.unpublishedEvent });
  });

  it('allows owners to read but not directly update registrations', async () => {
    await expect(
      authDb({ appRole: 'user', id: ids.owner }).eventRegistration.findFirst({
        where: { id: ids.registration },
      })
    ).resolves.toMatchObject({ id: ids.registration });

    await expect(
      authDb({ appRole: 'user', id: ids.owner }).eventRegistration.update({
        where: { id: ids.registration },
        data: { status: 'approved' },
      })
    ).rejects.toThrow();

    await expect(
      authDb({ appRole: 'user', id: ids.owner }).eventRegistration.update({
        where: { id: ids.otherRegistration },
        data: { status: 'cancelled' },
      })
    ).rejects.toThrow();

    await expect(
      authDb({
        appRole: 'volunteer_instructor',
        id: ids.assignedAdmin,
      }).eventRegistration.update({
        where: { id: ids.otherRegistration },
        data: { status: 'approved' },
      })
    ).resolves.toMatchObject({ id: ids.otherRegistration });
  });

  it('requires answers to match the registration event questions', async () => {
    await expect(
      authDb({ appRole: 'user', id: ids.owner }).eventRegistrationAnswer.create(
        {
          data: {
            id: ids.matchingAnswer,
            questionId: ids.question,
            registrationId: ids.registration,
            value: 'Match',
          },
        }
      )
    ).resolves.toMatchObject({ id: ids.matchingAnswer });

    await expect(
      authDb({ appRole: 'user', id: ids.owner }).eventRegistrationAnswer.create(
        {
          data: {
            id: `event_policy_${randomUUID()}_mismatch_answer`,
            questionId: ids.otherQuestion,
            registrationId: ids.registration,
            value: 'Mismatch',
          },
        }
      )
    ).rejects.toThrow();
  });

  it('keeps answer registration and question relations immutable', async () => {
    const allowedFields: string[] = [];
    const answers = authDb({
      appRole: 'user',
      id: ids.owner,
    }).eventRegistrationAnswer;

    if (
      await updateWasAllowed({
        reset: async () => {
          await resetAnswer(pool);
        },
        run: async () => {
          await answers.update({
            where: { id: ids.answer },
            data: { registrationId: ids.otherRegistration },
          });
        },
      })
    ) {
      allowedFields.push('registrationId');
    }

    if (
      await updateWasAllowed({
        reset: async () => {
          await resetAnswer(pool);
        },
        run: async () => {
          await answers.update({
            where: { id: ids.answer },
            data: { questionId: ids.otherQuestion },
          });
        },
      })
    ) {
      allowedFields.push('questionId');
    }

    expect(allowedFields).toEqual([]);
  });

  it('keeps comment event, author, and parent relations immutable', async () => {
    const allowedFields: string[] = [];
    const comments = authDb({
      appRole: 'user',
      id: ids.owner,
    }).eventComment;

    if (
      await updateWasAllowed({
        reset: async () => {
          await resetComment(pool);
        },
        run: async () => {
          await comments.update({
            where: { id: ids.comment },
            data: { eventId: ids.otherEvent },
          });
        },
      })
    ) {
      allowedFields.push('eventId');
    }

    if (
      await updateWasAllowed({
        reset: async () => {
          await resetComment(pool);
        },
        run: async () => {
          await comments.update({
            where: { id: ids.comment },
            data: { userId: ids.otherUser },
          });
        },
      })
    ) {
      allowedFields.push('userId');
    }

    if (
      await updateWasAllowed({
        reset: async () => {
          await resetComment(pool);
        },
        run: async () => {
          await comments.update({
            where: { id: ids.comment },
            data: { parentId: ids.otherParentComment },
          });
        },
      })
    ) {
      allowedFields.push('parentId');
    }

    expect(allowedFields).toEqual([]);
  });

  it('blocks comments whose parent belongs to a different event', async () => {
    await expect(
      authDb({ appRole: 'user', id: ids.owner }).eventComment.create({
        data: {
          body: 'Mismatched parent',
          createdAt: new Date(),
          event: { connect: { id: ids.assignedEvent } },
          id: `event_policy_${randomUUID()}_mismatch_comment`,
          parent: { connect: { id: ids.otherParentComment } },
          user: { connect: { id: ids.owner } },
        },
      })
    ).rejects.toThrow();
  });

  it('allows event managers to include child registration models', async () => {
    const event = await authDb({
      appRole: 'volunteer_instructor',
      id: ids.assignedAdmin,
    }).event.findFirst({
      where: { id: ids.assignedEvent },
      include: {
        admins: true,
        dates: true,
        entryFees: true,
        registrations: {
          include: {
            registrationAnswers: {
              include: { question: true },
            },
          },
        },
        registrationQuestions: true,
      },
    });

    expect(event?.admins).toHaveLength(1);
    expect(event?.dates).toHaveLength(1);
    expect(event?.entryFees).toHaveLength(1);
    expect(event?.registrationQuestions).toHaveLength(1);
    expect(event?.registrations).toHaveLength(2);
    expect(
      event?.registrations.flatMap((registration) =>
        registration.registrationAnswers.map((answer) => answer.question.id)
      )
    ).toContain(ids.question);
  });
});
