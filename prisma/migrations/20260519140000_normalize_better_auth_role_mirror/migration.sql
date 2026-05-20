UPDATE "user"
SET "role" = CASE WHEN "app_role" = 'admin' THEN 'admin' ELSE 'user' END
WHERE "role" IS DISTINCT FROM CASE
  WHEN "app_role" = 'admin' THEN 'admin'
  ELSE 'user'
END;
