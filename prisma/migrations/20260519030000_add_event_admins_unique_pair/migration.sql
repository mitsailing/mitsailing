-- CreateIndex
CREATE UNIQUE INDEX "event_admins_event_id_admin_user_id_key" ON "event_admins"("event_id", "admin_user_id");
