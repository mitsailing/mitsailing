import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  EventPaymentStatus,
  EventRegistrationStatus,
} from "@/generated/prisma/enums";
import { Role } from "@/libs/auth/roles";

const mocks = vi.hoisted(() => ({
  eventFindFirst: vi.fn(),
  eventFindUnique: vi.fn(),
  eventRegistrationAnswerCreateMany: vi.fn(),
  eventRegistrationBoatMemberCreateMany: vi.fn(),
  eventRegistrationBoatMemberDeleteMany: vi.fn(),
  eventRegistrationCount: vi.fn(),
  eventRegistrationCreate: vi.fn(),
  eventRegistrationFindFirst: vi.fn(),
  eventRegistrationTeamUpsert: vi.fn(),
  eventRegistrationTeamDeleteMany: vi.fn(),
  eventRegistrationUpdate: vi.fn(),
  eventRegistrationUpdateMany: vi.fn(),
  eventPaymentUpsert: vi.fn(),
  queryRaw: vi.fn(),
  userFindUnique: vi.fn(),
  userUpdate: vi.fn(),
  redirect: vi.fn((href: string) => {
    throw new Error(`NEXT_REDIRECT:${href}`);
  }),
  appAuthContextFromSession: vi.fn(),
  requireCurrentUser: vi.fn(),
  revalidatePath: vi.fn(),
  transaction: vi.fn(),
  verifySession: vi.fn(),
  zenstackForAuthContext: vi.fn(),
}));

vi.mock("server-only", () => ({}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
  unstable_rethrow: vi.fn(),
}));

vi.mock("@/libs/auth/dal", () => ({
  requireCurrentUser: mocks.requireCurrentUser,
  verifySession: mocks.verifySession,
}));

vi.mock("@/libs/zenstack/authContext", () => ({
  appAuthContextFromSession: mocks.appAuthContextFromSession,
}));

vi.mock("@/libs/zenstack/auth", () => ({
  zenstackForAuthContext: mocks.zenstackForAuthContext,
}));

vi.mock("@/libs/DB", () => ({
  prisma: {
    $transaction: mocks.transaction,
    event: {
      findFirst: mocks.eventFindFirst,
    },
    eventRegistration: {
      updateMany: mocks.eventRegistrationUpdateMany,
    },
  },
}));

vi.mock("@/libs/Logger", () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock("@/utils/Helpers", () => ({
  getI18nPath: (path: string) => path,
}));

function registrationFormData(): FormData {
  const formData = new FormData();
  formData.set("phone", "617-555-0100");
  formData.set("swimAgreementAccepted", "true");
  return formData;
}

function registrationFormDataWithoutPhone(): FormData {
  const formData = new FormData();
  formData.set("swimAgreementAccepted", "true");
  return formData;
}

function teamRegistrationFormData(): FormData {
  const formData = registrationFormData();
  formData.set("teamName", "  Tech Dinghies  ");
  formData.set("teamBoatMember_0_name", "Ada Lovelace");
  formData.set("teamBoatMember_0_email", "ada@example.test");
  formData.set("teamBoatMember_1_name", "Grace Hopper");
  formData.set("teamBoatMember_1_email", "grace@example.test");
  return formData;
}

function twoBoatTeamRegistrationFormData(): FormData {
  const formData = registrationFormData();
  formData.set("teamName", "  Tech Dinghies  ");
  formData.set("teamBoatMember_1_0_name", "Ada Lovelace");
  formData.set("teamBoatMember_1_0_email", "ada@example.test");
  formData.set("teamBoatMember_1_1_name", "Grace Hopper");
  formData.set("teamBoatMember_1_1_email", "grace@example.test");
  formData.set("teamBoatMember_2_0_name", "Katherine Johnson");
  formData.set("teamBoatMember_2_0_email", "katherine@example.test");
  formData.set("teamBoatMember_2_1_name", "Mary Jackson");
  formData.set("teamBoatMember_2_1_email", "mary@example.test");
  return formData;
}

function mockTeamRegistrationEvent(): void {
  mocks.eventFindFirst.mockResolvedValue({
    allowRepeatTeamCaptain: true,
    boatsPerTeam: 1,
    entryFees: [],
    id: "event-1",
    personsPerBoat: 2,
    registrationEnd: null,
    registrationQuestions: [],
    registrationStart: null,
    requiresPhone: false,
    usesTeamRegistration: true,
  });
  mocks.eventFindUnique.mockResolvedValue({
    allowRepeatTeamCaptain: true,
    boatsPerTeam: 1,
    entryFees: [],
    id: "event-1",
    isPublished: true,
    maxParticipants: null,
    paymentDeadlineAt: null,
    paymentsEnabled: false,
    personsPerBoat: 2,
    registrationEnd: null,
    registrationStart: null,
    requiresApproval: true,
    requiresPhone: false,
    usesTeamRegistration: true,
  });
}

beforeEach(() => {
  mocks.eventFindFirst.mockReset();
  mocks.eventFindUnique.mockReset();
  mocks.eventRegistrationAnswerCreateMany.mockReset();
  mocks.eventRegistrationBoatMemberCreateMany.mockReset();
  mocks.eventRegistrationBoatMemberDeleteMany.mockReset();
  mocks.eventRegistrationCount.mockReset();
  mocks.eventRegistrationCreate.mockReset();
  mocks.eventRegistrationFindFirst.mockReset();
  mocks.eventRegistrationTeamUpsert.mockReset();
  mocks.eventRegistrationTeamDeleteMany.mockReset();
  mocks.eventRegistrationUpdate.mockReset();
  mocks.eventRegistrationUpdateMany.mockReset();
  mocks.eventPaymentUpsert.mockReset();
  mocks.queryRaw.mockReset();
  mocks.userFindUnique.mockReset();
  mocks.userUpdate.mockReset();
  mocks.redirect.mockClear();
  mocks.appAuthContextFromSession.mockReset();
  mocks.requireCurrentUser.mockReset();
  mocks.revalidatePath.mockClear();
  mocks.transaction.mockReset();
  mocks.verifySession.mockReset();
  mocks.zenstackForAuthContext.mockReset();

  const session = {
    session: { impersonatedBy: null },
    user: {
      appRole: Role.USER,
      banned: false,
      emailVerified: true,
      email: "user@example.test",
      id: "user-1",
      name: "User One",
      role: Role.USER,
      unconfirmedEmail: null,
    },
  };
  mocks.verifySession.mockResolvedValue(session);
  mocks.appAuthContextFromSession.mockReturnValue({
    appRole: Role.USER,
    id: "user-1",
  });
  mocks.requireCurrentUser.mockResolvedValue({
    email: "user@example.test",
    id: "user-1",
    name: "User One",
    role: Role.USER,
    unconfirmedEmail: null,
  });
  mocks.eventFindFirst.mockResolvedValue({
    entryFees: [],
    id: "event-1",
    requiresPhone: false,
    registrationEnd: null,
    registrationQuestions: [],
    registrationStart: null,
    usesTeamRegistration: false,
    boatsPerTeam: 1,
    personsPerBoat: 1,
    allowRepeatTeamCaptain: false,
  });
  mocks.eventFindUnique.mockResolvedValue({
    entryFees: [],
    id: "event-1",
    isPublished: true,
    maxParticipants: null,
    paymentDeadlineAt: null,
    paymentsEnabled: false,
    registrationEnd: null,
    registrationStart: null,
    requiresApproval: true,
    requiresPhone: false,
    usesTeamRegistration: false,
    boatsPerTeam: 1,
    personsPerBoat: 1,
    allowRepeatTeamCaptain: false,
  });
  mocks.eventRegistrationFindFirst.mockResolvedValue({
    id: "registration-1",
  });
  mocks.eventRegistrationUpdate.mockResolvedValue({
    id: "registration-1",
  });
  mocks.eventRegistrationUpdateMany.mockResolvedValue({ count: 1 });
  mocks.userFindUnique.mockResolvedValue({ phone: null });
  mocks.zenstackForAuthContext.mockReturnValue({
    event: {
      findFirst: mocks.eventFindFirst,
    },
    eventRegistration: {
      findFirst: mocks.eventRegistrationFindFirst,
    },
  });
  mocks.transaction.mockImplementation(
    async (
      transactionOperation: (client: {
        $queryRaw: typeof mocks.queryRaw;
        event: {
          findUnique: typeof mocks.eventFindUnique;
        };
        eventRegistration: {
          count: typeof mocks.eventRegistrationCount;
          create: typeof mocks.eventRegistrationCreate;
          findFirst: typeof mocks.eventRegistrationFindFirst;
          update: typeof mocks.eventRegistrationUpdate;
        };
        eventRegistrationAnswer: {
          createMany: typeof mocks.eventRegistrationAnswerCreateMany;
        };
        eventRegistrationBoatMember: {
          createMany: typeof mocks.eventRegistrationBoatMemberCreateMany;
          deleteMany: typeof mocks.eventRegistrationBoatMemberDeleteMany;
        };
        eventRegistrationTeam: {
          upsert: typeof mocks.eventRegistrationTeamUpsert;
          deleteMany: typeof mocks.eventRegistrationTeamDeleteMany;
        };
        eventPayment: {
          upsert: typeof mocks.eventPaymentUpsert;
        };
        user: {
          findUnique: typeof mocks.userFindUnique;
          update: typeof mocks.userUpdate;
        };
      }) => Promise<unknown>,
    ) => {
      const result = await transactionOperation({
        $queryRaw: mocks.queryRaw,
        event: {
          findUnique: mocks.eventFindUnique,
        },
        eventRegistration: {
          count: mocks.eventRegistrationCount,
          create: mocks.eventRegistrationCreate,
          findFirst: mocks.eventRegistrationFindFirst,
          update: mocks.eventRegistrationUpdate,
        },
        eventRegistrationAnswer: {
          createMany: mocks.eventRegistrationAnswerCreateMany,
        },
        eventRegistrationBoatMember: {
          createMany: mocks.eventRegistrationBoatMemberCreateMany,
          deleteMany: mocks.eventRegistrationBoatMemberDeleteMany,
        },
        eventRegistrationTeam: {
          upsert: mocks.eventRegistrationTeamUpsert,
          deleteMany: mocks.eventRegistrationTeamDeleteMany,
        },
        eventPayment: {
          upsert: mocks.eventPaymentUpsert,
        },
        user: {
          findUnique: mocks.userFindUnique,
          update: mocks.userUpdate,
        },
      });
      return result;
    },
  );
});

describe("createPublicEventRegistrationAction", () => {
  it("loads the viewer registration after locking the event", async () => {
    const { createPublicEventRegistrationAction } =
      await import("@/libs/mit-sailing/eventRegistrationActions");

    await expect(
      createPublicEventRegistrationAction(
        "en",
        "intro-sail",
        {
          code: null,
          fieldErrors: {},
          status: "idle",
          values: {},
        },
        registrationFormData(),
      ),
    ).rejects.toThrow("NEXT_REDIRECT:/events/intro-sail");

    expect(mocks.eventRegistrationFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { eventId: "event-1", userId: "user-1" },
      }),
    );
    expect(mocks.queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.eventRegistrationFindFirst.mock.invocationCallOrder[0] ?? 0,
    );
  });

  it("uses a user-scoped ZenStack context for admins on public registration", async () => {
    mocks.verifySession.mockResolvedValue({
      session: { impersonatedBy: null },
      user: {
        appRole: Role.ADMIN,
        banned: false,
        emailVerified: true,
        email: "admin@example.test",
        id: "admin-1",
        name: "Admin One",
        role: Role.ADMIN,
        unconfirmedEmail: null,
      },
    });
    mocks.appAuthContextFromSession.mockReturnValue({
      appRole: Role.ADMIN,
      id: "admin-1",
    });
    const { createPublicEventRegistrationAction } =
      await import("@/libs/mit-sailing/eventRegistrationActions");

    await expect(
      createPublicEventRegistrationAction(
        "en",
        "intro-sail",
        {
          code: null,
          fieldErrors: {},
          status: "idle",
          values: {},
        },
        registrationFormData(),
      ),
    ).rejects.toThrow("NEXT_REDIRECT:/events/intro-sail");

    expect(mocks.zenstackForAuthContext).toHaveBeenCalledWith({
      appRole: Role.USER,
      id: "admin-1",
    });
  });

  it("fails closed before loading events for banned or unverified users", async () => {
    mocks.appAuthContextFromSession.mockReturnValue(null);
    const { createPublicEventRegistrationAction } =
      await import("@/libs/mit-sailing/eventRegistrationActions");

    await expect(
      createPublicEventRegistrationAction(
        "en",
        "intro-sail",
        {
          code: null,
          fieldErrors: {},
          status: "idle",
          values: {},
        },
        registrationFormData(),
      ),
    ).rejects.toThrow(
      "NEXT_REDIRECT:/events/intro-sail/register?registration=not_found",
    );

    expect(mocks.eventFindFirst).not.toHaveBeenCalled();
  });

  it("creates pending registration for approval-required event at accepted capacity", async () => {
    mocks.eventFindUnique.mockResolvedValue({
      entryFees: [],
      id: "event-1",
      isPublished: true,
      maxParticipants: 2,
      registrationEnd: null,
      registrationStart: null,
      requiresApproval: true,
      requiresPhone: false,
    });
    mocks.eventRegistrationFindFirst.mockResolvedValue(null);
    mocks.eventRegistrationCreate.mockResolvedValue({
      id: "registration-2",
    });
    const { createPublicEventRegistrationAction } =
      await import("@/libs/mit-sailing/eventRegistrationActions");

    await expect(
      createPublicEventRegistrationAction(
        "en",
        "intro-sail",
        {
          code: null,
          fieldErrors: {},
          status: "idle",
          values: {},
        },
        registrationFormData(),
      ),
    ).rejects.toThrow("NEXT_REDIRECT:/events/intro-sail");

    expect(mocks.eventRegistrationCount).not.toHaveBeenCalled();
    expect(mocks.eventRegistrationCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventId: "event-1",
        status: EventRegistrationStatus.pending,
        userId: "user-1",
      }),
    });
  });

  it("rejects auto-approved registration at accepted capacity", async () => {
    mocks.eventFindUnique.mockResolvedValue({
      entryFees: [],
      id: "event-1",
      isPublished: true,
      maxParticipants: 2,
      registrationEnd: null,
      registrationStart: null,
      requiresApproval: false,
      requiresPhone: false,
    });
    mocks.eventRegistrationCount.mockResolvedValue(2);
    mocks.eventRegistrationFindFirst.mockResolvedValue(null);
    const { createPublicEventRegistrationAction } =
      await import("@/libs/mit-sailing/eventRegistrationActions");

    await expect(
      createPublicEventRegistrationAction(
        "en",
        "intro-sail",
        {
          code: null,
          fieldErrors: {},
          status: "idle",
          values: {},
        },
        registrationFormData(),
      ),
    ).rejects.toThrow(
      "NEXT_REDIRECT:/events/intro-sail/register?registration=full",
    );

    expect(mocks.eventRegistrationCount).toHaveBeenCalledWith({
      where: {
        eventId: "event-1",
        status: EventRegistrationStatus.approved,
      },
    });
    expect(mocks.eventRegistrationCreate).not.toHaveBeenCalled();
    expect(mocks.eventRegistrationUpdate).not.toHaveBeenCalled();
  });

  it("creates payment snapshot and redirects auto-approved paid registrations to checkout", async () => {
    mocks.eventFindUnique.mockResolvedValue({
      allowRepeatTeamCaptain: false,
      boatsPerTeam: 1,
      entryFees: [
        {
          amountCents: 15_000,
          description: "Adult entry",
          id: "fee-1",
        },
      ],
      id: "event-1",
      isPublished: true,
      maxParticipants: null,
      paymentDeadlineAt: new Date("2026-06-01T13:00:00.000Z"),
      paymentsEnabled: true,
      personsPerBoat: 1,
      registrationEnd: null,
      registrationStart: null,
      requiresApproval: false,
      requiresPhone: false,
      usesTeamRegistration: false,
    });
    const { createPublicEventRegistrationAction } =
      await import("@/libs/mit-sailing/eventRegistrationActions");

    await expect(
      createPublicEventRegistrationAction(
        "en",
        "intro-sail",
        {
          code: null,
          fieldErrors: {},
          status: "idle",
          values: {},
        },
        registrationFormData(),
      ),
    ).rejects.toThrow("NEXT_REDIRECT:/events/intro-sail/checkout");

    expect(mocks.eventPaymentUpsert).toHaveBeenCalledWith({
      create: expect.objectContaining({
        amountCents: 15_000,
        currency: "usd",
        eventId: "event-1",
        registrationId: "registration-1",
        selectedFeeDescription: "Adult entry",
        selectedFeeId: "fee-1",
        status: EventPaymentStatus.pending,
        userId: "user-1",
      }),
      update: {},
      where: { registrationId: "registration-1" },
    });
  });

  it("returns validation state when required phone is blank", async () => {
    mocks.eventFindFirst.mockResolvedValue({
      entryFees: [],
      id: "event-1",
      requiresPhone: true,
      registrationEnd: null,
      registrationQuestions: [],
      registrationStart: null,
    });
    const formData = registrationFormData();
    formData.set("phone", "   ");
    const { createPublicEventRegistrationAction } =
      await import("@/libs/mit-sailing/eventRegistrationActions");

    const result = await createPublicEventRegistrationAction(
      "en",
      "intro-sail",
      {
        code: null,
        fieldErrors: {},
        status: "idle",
        values: {},
      },
      formData,
    );

    expect(result).toEqual({
      code: "questions_required",
      fieldErrors: { phone: "questions_required" },
      status: "error",
      values: {
        phone: ["   "],
        swimAgreementAccepted: ["true"],
      },
    });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("creates required-phone registrations with trimmed phone", async () => {
    mocks.eventFindFirst.mockResolvedValue({
      entryFees: [],
      id: "event-1",
      requiresPhone: true,
      registrationEnd: null,
      registrationQuestions: [],
      registrationStart: null,
    });
    mocks.eventFindUnique.mockResolvedValue({
      entryFees: [],
      id: "event-1",
      isPublished: true,
      maxParticipants: null,
      registrationEnd: null,
      registrationStart: null,
      requiresApproval: true,
      requiresPhone: true,
    });
    mocks.eventRegistrationFindFirst.mockResolvedValue(null);
    mocks.eventRegistrationCreate.mockResolvedValue({
      id: "registration-2",
    });
    const formData = registrationFormData();
    formData.set("phone", "  617-555-0100  ");
    const { createPublicEventRegistrationAction } =
      await import("@/libs/mit-sailing/eventRegistrationActions");

    await expect(
      createPublicEventRegistrationAction(
        "en",
        "intro-sail",
        {
          code: null,
          fieldErrors: {},
          status: "idle",
          values: {},
        },
        formData,
      ),
    ).rejects.toThrow("NEXT_REDIRECT:/events/intro-sail");

    expect(mocks.eventRegistrationCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        phone: "+16175550100",
      }),
    });
    expect(mocks.userUpdate).toHaveBeenCalledWith({
      data: { phone: "+16175550100" },
      where: { id: "user-1" },
    });
  });

  it("updates required-phone registrations with trimmed phone", async () => {
    mocks.eventFindFirst.mockResolvedValue({
      entryFees: [],
      id: "event-1",
      requiresPhone: true,
      registrationEnd: null,
      registrationQuestions: [],
      registrationStart: null,
    });
    mocks.eventFindUnique.mockResolvedValue({
      entryFees: [],
      id: "event-1",
      isPublished: true,
      maxParticipants: null,
      registrationEnd: null,
      registrationStart: null,
      requiresApproval: true,
      requiresPhone: true,
    });
    const formData = registrationFormData();
    formData.set("phone", "  617-555-0111  ");
    const { createPublicEventRegistrationAction } =
      await import("@/libs/mit-sailing/eventRegistrationActions");

    await expect(
      createPublicEventRegistrationAction(
        "en",
        "intro-sail",
        {
          code: null,
          fieldErrors: {},
          status: "idle",
          values: {},
        },
        formData,
      ),
    ).rejects.toThrow("NEXT_REDIRECT:/events/intro-sail");

    expect(mocks.eventRegistrationUpdate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        phone: "+16175550111",
      }),
      where: { id: "registration-1" },
    });
    expect(mocks.userUpdate).toHaveBeenCalledWith({
      data: { phone: "+16175550111" },
      where: { id: "user-1" },
    });
  });

  it("does not update profile phone when submitted phone is unchanged", async () => {
    mocks.userFindUnique.mockResolvedValue({ phone: "+16175550100" });
    const formData = registrationFormData();
    const { createPublicEventRegistrationAction } =
      await import("@/libs/mit-sailing/eventRegistrationActions");

    await expect(
      createPublicEventRegistrationAction(
        "en",
        "intro-sail",
        {
          code: null,
          fieldErrors: {},
          status: "idle",
          values: {},
        },
        formData,
      ),
    ).rejects.toThrow("NEXT_REDIRECT:/events/intro-sail");

    expect(mocks.userUpdate).not.toHaveBeenCalled();
  });

  it("returns validation state when phone is omitted", async () => {
    mocks.eventRegistrationFindFirst.mockResolvedValue(null);
    mocks.eventRegistrationCreate.mockResolvedValue({
      id: "registration-2",
    });
    const { createPublicEventRegistrationAction } =
      await import("@/libs/mit-sailing/eventRegistrationActions");

    const result = await createPublicEventRegistrationAction(
      "en",
      "intro-sail",
      {
        code: null,
        fieldErrors: {},
        status: "idle",
        values: {},
      },
      registrationFormDataWithoutPhone(),
    );

    expect(result).toEqual({
      code: "questions_required",
      fieldErrors: { phone: "questions_required" },
      status: "error",
      values: {
        swimAgreementAccepted: ["true"],
      },
    });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("returns validation state when team registration is missing a team name", async () => {
    mockTeamRegistrationEvent();
    const formData = teamRegistrationFormData();
    formData.set("teamName", "   ");
    const { createPublicEventRegistrationAction } =
      await import("@/libs/mit-sailing/eventRegistrationActions");

    const result = await createPublicEventRegistrationAction(
      "en",
      "intro-sail",
      {
        code: null,
        fieldErrors: {},
        status: "idle",
        values: {},
      },
      formData,
    );

    expect(result).toEqual({
      code: "questions_required",
      fieldErrors: { teamName: "questions_required" },
      status: "error",
      values: {
        phone: ["617-555-0100"],
        swimAgreementAccepted: ["true"],
        teamBoatMember_0_email: ["ada@example.test"],
        teamBoatMember_0_name: ["Ada Lovelace"],
        teamBoatMember_1_email: ["grace@example.test"],
        teamBoatMember_1_name: ["Grace Hopper"],
        teamName: ["   "],
      },
    });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("returns validation state when team registration has no boat members", async () => {
    mockTeamRegistrationEvent();
    const formData = registrationFormData();
    formData.set("teamName", "Tech Dinghies");
    const { createPublicEventRegistrationAction } =
      await import("@/libs/mit-sailing/eventRegistrationActions");

    const result = await createPublicEventRegistrationAction(
      "en",
      "intro-sail",
      {
        code: null,
        fieldErrors: {},
        status: "idle",
        values: {},
      },
      formData,
    );

    expect(result).toEqual({
      code: "questions_required",
      fieldErrors: {
        teamBoatMember_0_name: "questions_required",
      },
      status: "error",
      values: {
        phone: ["617-555-0100"],
        swimAgreementAccepted: ["true"],
        teamName: ["Tech Dinghies"],
      },
    });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("returns validation state when a boat member is partial or invalid", async () => {
    mockTeamRegistrationEvent();
    const formData = teamRegistrationFormData();
    formData.set("teamBoatMember_1_email", "invalid-email");
    const { createPublicEventRegistrationAction } =
      await import("@/libs/mit-sailing/eventRegistrationActions");

    const result = await createPublicEventRegistrationAction(
      "en",
      "intro-sail",
      {
        code: null,
        fieldErrors: {},
        status: "idle",
        values: {},
      },
      formData,
    );

    expect(result).toEqual({
      code: "answers_invalid",
      fieldErrors: {
        teamBoatMember_1_email: "answers_invalid",
      },
      status: "error",
      values: {
        phone: ["617-555-0100"],
        swimAgreementAccepted: ["true"],
        teamBoatMember_0_email: ["ada@example.test"],
        teamBoatMember_0_name: ["Ada Lovelace"],
        teamBoatMember_1_email: ["invalid-email"],
        teamBoatMember_1_name: ["Grace Hopper"],
        teamName: ["  Tech Dinghies  "],
      },
    });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("persists team boat members with a valid team registration", async () => {
    mockTeamRegistrationEvent();
    mocks.eventRegistrationFindFirst.mockResolvedValue(null);
    mocks.eventRegistrationCreate.mockResolvedValue({
      id: "registration-2",
    });
    const { createPublicEventRegistrationAction } =
      await import("@/libs/mit-sailing/eventRegistrationActions");

    await expect(
      createPublicEventRegistrationAction(
        "en",
        "intro-sail",
        {
          code: null,
          fieldErrors: {},
          status: "idle",
          values: {},
        },
        teamRegistrationFormData(),
      ),
    ).rejects.toThrow("NEXT_REDIRECT:/events/intro-sail");

    expect(mocks.eventRegistrationTeamUpsert).toHaveBeenCalledWith({
      create: expect.objectContaining({
        allowRepeatCaptain: true,
        registrationId: expect.any(String),
        teamName: "Tech Dinghies",
      }),
      update: {
        allowRepeatCaptain: true,
        teamName: "Tech Dinghies",
      },
      where: { registrationId: expect.any(String) },
    });
    expect(mocks.eventRegistrationBoatMemberDeleteMany).toHaveBeenCalledWith({
      where: { registrationId: expect.any(String) },
    });
    const [deleteCallOrder] =
      mocks.eventRegistrationBoatMemberDeleteMany.mock.invocationCallOrder;
    const [createCallOrder] =
      mocks.eventRegistrationBoatMemberCreateMany.mock.invocationCallOrder;
    if (deleteCallOrder === undefined || createCallOrder === undefined) {
      throw new Error("Missing team boat member persistence call order.");
    }
    expect(deleteCallOrder).toBeLessThan(createCallOrder);
    expect(mocks.eventRegistrationBoatMemberCreateMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          boatNumber: 1,
          email: "ada@example.test",
          fullName: "Ada Lovelace",
          position: 0,
          registrationId: expect.any(String),
        }),
        expect.objectContaining({
          boatNumber: 1,
          email: "grace@example.test",
          fullName: "Grace Hopper",
          position: 1,
          registrationId: expect.any(String),
        }),
      ],
    });
  });

  it("clears stale team data when team registration is disabled", async () => {
    const { createPublicEventRegistrationAction } =
      await import("@/libs/mit-sailing/eventRegistrationActions");

    await expect(
      createPublicEventRegistrationAction(
        "en",
        "intro-sail",
        {
          code: null,
          fieldErrors: {},
          status: "idle",
          values: {},
        },
        registrationFormData(),
      ),
    ).rejects.toThrow("NEXT_REDIRECT:/events/intro-sail");

    expect(mocks.eventRegistrationBoatMemberDeleteMany).toHaveBeenCalledWith({
      where: { registrationId: "registration-1" },
    });
    expect(mocks.eventRegistrationTeamDeleteMany).toHaveBeenCalledWith({
      where: { registrationId: "registration-1" },
    });
    const [boatMemberDeleteCallOrder] =
      mocks.eventRegistrationBoatMemberDeleteMany.mock.invocationCallOrder;
    const [teamDeleteCallOrder] =
      mocks.eventRegistrationTeamDeleteMany.mock.invocationCallOrder;
    if (
      boatMemberDeleteCallOrder === undefined ||
      teamDeleteCallOrder === undefined
    ) {
      throw new Error("Missing stale team cleanup call order.");
    }
    expect(boatMemberDeleteCallOrder).toBeLessThan(teamDeleteCallOrder);
    expect(mocks.eventRegistrationTeamUpsert).not.toHaveBeenCalled();
    expect(mocks.eventRegistrationBoatMemberCreateMany).not.toHaveBeenCalled();
  });

  it("persists team boat members with their submitted boat numbers", async () => {
    mockTeamRegistrationEvent();
    mocks.eventFindFirst.mockResolvedValue({
      allowRepeatTeamCaptain: true,
      boatsPerTeam: 2,
      entryFees: [],
      id: "event-1",
      personsPerBoat: 2,
      registrationEnd: null,
      registrationQuestions: [],
      registrationStart: null,
      requiresPhone: false,
      usesTeamRegistration: true,
    });
    mocks.eventFindUnique.mockResolvedValue({
      allowRepeatTeamCaptain: true,
      boatsPerTeam: 2,
      entryFees: [],
      id: "event-1",
      isPublished: true,
      maxParticipants: null,
      personsPerBoat: 2,
      registrationEnd: null,
      registrationStart: null,
      requiresApproval: true,
      requiresPhone: false,
      usesTeamRegistration: true,
    });
    mocks.eventRegistrationFindFirst.mockResolvedValue(null);
    mocks.eventRegistrationCreate.mockResolvedValue({
      id: "registration-2",
    });
    const { createPublicEventRegistrationAction } =
      await import("@/libs/mit-sailing/eventRegistrationActions");

    await expect(
      createPublicEventRegistrationAction(
        "en",
        "intro-sail",
        {
          code: null,
          fieldErrors: {},
          status: "idle",
          values: {},
        },
        twoBoatTeamRegistrationFormData(),
      ),
    ).rejects.toThrow("NEXT_REDIRECT:/events/intro-sail");

    expect(mocks.eventRegistrationBoatMemberCreateMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          boatNumber: 1,
          email: "ada@example.test",
          fullName: "Ada Lovelace",
          position: 0,
          registrationId: expect.any(String),
        }),
        expect.objectContaining({
          boatNumber: 1,
          email: "grace@example.test",
          fullName: "Grace Hopper",
          position: 1,
          registrationId: expect.any(String),
        }),
        expect.objectContaining({
          boatNumber: 2,
          email: "katherine@example.test",
          fullName: "Katherine Johnson",
          position: 0,
          registrationId: expect.any(String),
        }),
        expect.objectContaining({
          boatNumber: 2,
          email: "mary@example.test",
          fullName: "Mary Jackson",
          position: 1,
          registrationId: expect.any(String),
        }),
      ],
    });
  });

  it("stores the only event fee without requiring user choice", async () => {
    mocks.eventFindFirst.mockResolvedValue({
      entryFees: [{ id: "fee-standard" }],
      id: "event-1",
      requiresPhone: false,
      registrationEnd: null,
      registrationQuestions: [],
      registrationStart: null,
    });
    mocks.eventFindUnique.mockResolvedValue({
      entryFees: [{ id: "fee-standard" }],
      id: "event-1",
      isPublished: true,
      maxParticipants: null,
      registrationEnd: null,
      registrationStart: null,
      requiresApproval: true,
      requiresPhone: false,
    });
    mocks.eventRegistrationFindFirst.mockResolvedValue(null);
    mocks.eventRegistrationCreate.mockResolvedValue({
      id: "registration-2",
    });
    const { createPublicEventRegistrationAction } =
      await import("@/libs/mit-sailing/eventRegistrationActions");

    await expect(
      createPublicEventRegistrationAction(
        "en",
        "intro-sail",
        {
          code: null,
          fieldErrors: {},
          status: "idle",
          values: {},
        },
        registrationFormData(),
      ),
    ).rejects.toThrow("NEXT_REDIRECT:/events/intro-sail");

    expect(mocks.eventRegistrationCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventEntryFeeId: "fee-standard",
      }),
    });
  });

  it("returns validation state when multiple fees have no selected fee", async () => {
    mocks.eventFindFirst.mockResolvedValue({
      entryFees: [{ id: "fee-adult" }, { id: "fee-junior" }],
      id: "event-1",
      requiresPhone: false,
      registrationEnd: null,
      registrationQuestions: [],
      registrationStart: null,
    });
    const { createPublicEventRegistrationAction } =
      await import("@/libs/mit-sailing/eventRegistrationActions");

    const result = await createPublicEventRegistrationAction(
      "en",
      "intro-sail",
      {
        code: null,
        fieldErrors: {},
        status: "idle",
        values: {},
      },
      registrationFormData(),
    );

    expect(result).toEqual({
      code: "questions_required",
      fieldErrors: { eventEntryFeeId: "questions_required" },
      status: "error",
      values: {
        phone: ["617-555-0100"],
        swimAgreementAccepted: ["true"],
      },
    });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("rejects selected fee that does not belong to the event", async () => {
    mocks.eventFindFirst.mockResolvedValue({
      entryFees: [{ id: "fee-adult" }, { id: "fee-junior" }],
      id: "event-1",
      requiresPhone: false,
      registrationEnd: null,
      registrationQuestions: [],
      registrationStart: null,
    });
    const formData = registrationFormData();
    formData.set("eventEntryFeeId", "fee-other-event");
    const { createPublicEventRegistrationAction } =
      await import("@/libs/mit-sailing/eventRegistrationActions");

    const result = await createPublicEventRegistrationAction(
      "en",
      "intro-sail",
      {
        code: null,
        fieldErrors: {},
        status: "idle",
        values: {},
      },
      formData,
    );

    expect(result).toEqual({
      code: "questions_required",
      fieldErrors: { eventEntryFeeId: "questions_required" },
      status: "error",
      values: {
        eventEntryFeeId: ["fee-other-event"],
        phone: ["617-555-0100"],
        swimAgreementAccepted: ["true"],
      },
    });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("updates existing registration with selected event fee", async () => {
    mocks.eventFindFirst.mockResolvedValue({
      entryFees: [{ id: "fee-adult" }, { id: "fee-junior" }],
      id: "event-1",
      requiresPhone: false,
      registrationEnd: null,
      registrationQuestions: [],
      registrationStart: null,
    });
    mocks.eventFindUnique.mockResolvedValue({
      entryFees: [{ id: "fee-adult" }, { id: "fee-junior" }],
      id: "event-1",
      isPublished: true,
      maxParticipants: null,
      registrationEnd: null,
      registrationStart: null,
      requiresApproval: true,
      requiresPhone: false,
    });
    const formData = registrationFormData();
    formData.set("eventEntryFeeId", "fee-junior");
    const { createPublicEventRegistrationAction } =
      await import("@/libs/mit-sailing/eventRegistrationActions");

    await expect(
      createPublicEventRegistrationAction(
        "en",
        "intro-sail",
        {
          code: null,
          fieldErrors: {},
          status: "idle",
          values: {},
        },
        formData,
      ),
    ).rejects.toThrow("NEXT_REDIRECT:/events/intro-sail");

    expect(mocks.eventRegistrationUpdate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventEntryFeeId: "fee-junior",
      }),
      where: { id: "registration-1" },
    });
  });
});

describe("cancelPublicEventRegistrationAction", () => {
  it("cancels viewer registrations with explicit owner scope after ZenStack event access", async () => {
    const { cancelPublicEventRegistrationAction } =
      await import("@/libs/mit-sailing/eventRegistrationActions");

    await expect(
      cancelPublicEventRegistrationAction("en", "intro-sail"),
    ).rejects.toThrow("NEXT_REDIRECT:/events/intro-sail");

    expect(mocks.eventRegistrationUpdateMany).toHaveBeenCalledWith({
      data: { status: EventRegistrationStatus.cancelled },
      where: { eventId: "event-1", userId: "user-1" },
    });
  });

  it("uses viewer ownership for admins when cancelling public registrations", async () => {
    mocks.verifySession.mockResolvedValue({
      session: { impersonatedBy: null },
      user: {
        appRole: Role.ADMIN,
        banned: false,
        emailVerified: true,
        email: "admin@example.test",
        id: "admin-1",
        name: "Admin One",
        role: Role.ADMIN,
        unconfirmedEmail: null,
      },
    });
    mocks.appAuthContextFromSession.mockReturnValue({
      appRole: Role.ADMIN,
      id: "admin-1",
    });
    const { cancelPublicEventRegistrationAction } =
      await import("@/libs/mit-sailing/eventRegistrationActions");

    await expect(
      cancelPublicEventRegistrationAction("en", "intro-sail"),
    ).rejects.toThrow("NEXT_REDIRECT:/events/intro-sail");

    expect(mocks.eventRegistrationUpdateMany).toHaveBeenCalledWith({
      data: { status: EventRegistrationStatus.cancelled },
      where: { eventId: "event-1", userId: "admin-1" },
    });
  });
});
