ALTER TABLE "payments"
  DROP CONSTRAINT IF EXISTS "payments_issue_handled_fields_chk",
  ADD CONSTRAINT "payments_issue_handled_fields_chk"
  CHECK (
    (
      "issue_handled_at" IS NULL
      AND "issue_handled_note" IS NULL
      AND "issue_handled_by_user_id" IS NULL
    )
    OR (
      "issue_kind" IS NOT NULL
      AND "issue_handled_at" IS NOT NULL
      AND "issue_handled_note" IS NOT NULL
      AND length(trim("issue_handled_note")) >= 1
      AND "issue_handled_by_user_id" IS NOT NULL
    )
  );
