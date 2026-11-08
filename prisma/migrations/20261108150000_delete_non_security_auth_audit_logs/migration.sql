DELETE FROM "audit_log"
WHERE "action" = 'get-session'
   OR "action" LIKE 'audit-log:%'
   OR "action" LIKE '%has-permission';
