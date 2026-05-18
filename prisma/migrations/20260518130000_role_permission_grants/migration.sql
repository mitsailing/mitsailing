-- Add user-level manual gym verification timestamp.
ALTER TABLE "user"
ADD COLUMN "gym_membership_verified_at" TIMESTAMP(3);

-- Store admin-editable grants from code-defined roles to code-defined permissions.
CREATE TABLE "role_permission_grants" (
    "id" TEXT NOT NULL,
    "role_key" TEXT NOT NULL,
    "permission_key" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "role_permission_grants_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "role_permission_grants_role_key_check" CHECK (
        "role_key" IN (
            'volunteer',
            'volunteer_instructor',
            'dock_staff',
            'dock_master'
        )
    ),
    CONSTRAINT "role_permission_grants_permission_key_check" CHECK (
        "permission_key" IN (
            'admin.view',
            'users.view',
            'users.edit',
            'users.delete',
            'events.create',
            'events.manage',
            'pavilionReservations.manage',
            'newsletter.manage',
            'donationFunds.manage',
            'eventCategories.manage',
            'classCategories.manage',
            'fleet.manage',
            'sailingClasses.manage',
            'sailingRatings.manage',
            'sailingRatingRules.manage',
            'siteAlerts.manage',
            'cms.view',
            'cms.edit',
            'cms.delete',
            'ratings.assign',
            'cards.review',
            'cards.approve',
            'cards.assignNumber',
            'cards.print',
            'cards.expire',
            'payments.view',
            'payments.override',
            'warehouse.view',
            'warehouse.sync',
            'roles.assign',
            'roles.managePermissions',
            'eligibility.verifyGymMembership'
        )
    )
);

CREATE UNIQUE INDEX "role_permission_grants_role_key_permission_key_key"
ON "role_permission_grants"("role_key", "permission_key");

CREATE INDEX "role_permission_grants_permission_key_idx"
ON "role_permission_grants"("permission_key");
