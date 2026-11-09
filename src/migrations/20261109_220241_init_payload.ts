import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  CREATE SCHEMA IF NOT EXISTS "payload";
  CREATE TYPE "payload"."enum_users_app_role" AS ENUM('user', 'volunteer', 'volunteer_instructor', 'dock_staff', 'dock_master', 'admin');
  CREATE TYPE "payload"."enum_pages_status" AS ENUM('draft', 'published');
  CREATE TYPE "payload"."enum__pages_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "payload"."enum_menus_items_link_type" AS ENUM('page', 'boat', 'class', 'url');
  CREATE TYPE "payload"."enum_menus_items_system_key" AS ENUM('classes', 'fleet', 'instagram', 'facebook');
  CREATE TYPE "payload"."enum_menus_location" AS ENUM('header', 'mobile_utility', 'footer', 'legal', 'social');
  CREATE TYPE "payload"."enum_redirects_to_type" AS ENUM('reference', 'custom');
  CREATE TABLE "payload"."users" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"better_auth_user_id" varchar NOT NULL,
  	"name" varchar NOT NULL,
  	"app_role" "payload"."enum_users_app_role" DEFAULT 'user' NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."media" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"alt" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"url" varchar,
  	"thumbnail_u_r_l" varchar,
  	"filename" varchar,
  	"mime_type" varchar,
  	"filesize" numeric,
  	"width" numeric,
  	"height" numeric,
  	"focal_x" numeric,
  	"focal_y" numeric,
  	"sizes_thumbnail_url" varchar,
  	"sizes_thumbnail_width" numeric,
  	"sizes_thumbnail_height" numeric,
  	"sizes_thumbnail_mime_type" varchar,
  	"sizes_thumbnail_filesize" numeric,
  	"sizes_thumbnail_filename" varchar
  );
  
  CREATE TABLE "payload"."pages" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"slug" varchar,
  	"body" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"deleted_at" timestamp(3) with time zone,
  	"_status" "payload"."enum_pages_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "payload"."_pages_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_title" varchar,
  	"version_slug" varchar,
  	"version_body" jsonb,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version_deleted_at" timestamp(3) with time zone,
  	"version__status" "payload"."enum__pages_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean,
  	"autosave" boolean
  );
  
  CREATE TABLE "payload"."menus_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar NOT NULL,
  	"link_type" "payload"."enum_menus_items_link_type" DEFAULT 'url' NOT NULL,
  	"page_id" integer,
  	"boat_id" integer,
  	"class_id" integer,
  	"url" varchar,
  	"parent" varchar,
  	"system_key" "payload"."enum_menus_items_system_key"
  );
  
  CREATE TABLE "payload"."menus" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"location" "payload"."enum_menus_location" NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."class_categories" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"is_visible" boolean DEFAULT true NOT NULL,
  	"display_order" numeric DEFAULT 0 NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."classes" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"level" varchar NOT NULL,
  	"description" jsonb NOT NULL,
  	"is_visible" boolean DEFAULT true NOT NULL,
  	"display_order" numeric DEFAULT 0 NOT NULL,
  	"category_id" integer NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."classes_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"media_id" integer,
  	"classes_id" integer,
  	"boats_id" integer
  );
  
  CREATE TABLE "payload"."boats" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"type" varchar NOT NULL,
  	"capacity" numeric NOT NULL,
  	"description" jsonb NOT NULL,
  	"is_visible" boolean DEFAULT true NOT NULL,
  	"display_order" numeric DEFAULT 0 NOT NULL,
  	"required_class_id" integer NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."boats_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"media_id" integer
  );
  
  CREATE TABLE "payload"."staff" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"role" varchar NOT NULL,
  	"bio" varchar,
  	"photo_id" integer,
  	"display_order" numeric DEFAULT 0 NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."mitna_meetings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"date" timestamp(3) with time zone NOT NULL,
  	"link" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."redirects" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"from" varchar NOT NULL,
  	"to_type" "payload"."enum_redirects_to_type" DEFAULT 'reference',
  	"to_url" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."redirects_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"pages_id" integer
  );
  
  CREATE TABLE "payload"."payload_kv" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"data" jsonb NOT NULL
  );
  
  CREATE TABLE "payload"."payload_locked_documents" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"global_slug" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."payload_locked_documents_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer,
  	"media_id" integer,
  	"pages_id" integer,
  	"menus_id" integer,
  	"class_categories_id" integer,
  	"classes_id" integer,
  	"boats_id" integer,
  	"staff_id" integer,
  	"mitna_meetings_id" integer,
  	"redirects_id" integer
  );
  
  CREATE TABLE "payload"."payload_preferences" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar,
  	"value" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."payload_preferences_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer
  );
  
  CREATE TABLE "payload"."payload_migrations" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"batch" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload"."about_mission_paragraphs" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"text" varchar NOT NULL
  );
  
  CREATE TABLE "payload"."about_mission_pillars" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"body" varchar NOT NULL,
  	"cta_label" varchar,
  	"cta_href" varchar
  );
  
  CREATE TABLE "payload"."about_membership_options" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"body" varchar NOT NULL
  );
  
  CREATE TABLE "payload"."about_history_entries" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"year" varchar,
  	"text" varchar NOT NULL
  );
  
  CREATE TABLE "payload"."about_volunteer_sections_bullets" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"text" varchar NOT NULL
  );
  
  CREATE TABLE "payload"."about_volunteer_sections" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"body" varchar NOT NULL,
  	"footnote" varchar
  );
  
  CREATE TABLE "payload"."about_volunteer_links" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar NOT NULL,
  	"href" varchar NOT NULL
  );
  
  CREATE TABLE "payload"."about" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"intro_title" varchar NOT NULL,
  	"intro_body" varchar NOT NULL,
  	"mission_title" varchar NOT NULL,
  	"mission_subtitle" varchar NOT NULL,
  	"mission_pillars_heading" varchar NOT NULL,
  	"membership_title" varchar NOT NULL,
  	"membership_body" varchar NOT NULL,
  	"membership_cta_label" varchar NOT NULL,
  	"membership_cta_href" varchar NOT NULL,
  	"history_title" varchar NOT NULL,
  	"history_subtitle" varchar NOT NULL,
  	"history_support_text" varchar NOT NULL,
  	"history_support_label" varchar NOT NULL,
  	"history_support_href" varchar NOT NULL,
  	"staff_section_title" varchar NOT NULL,
  	"staff_section_subtitle" varchar NOT NULL,
  	"volunteer_title" varchar NOT NULL,
  	"volunteer_intro" varchar NOT NULL,
  	"dock_hours_title" varchar NOT NULL,
  	"dock_hours_subtitle" varchar NOT NULL,
  	"dock_hours_lead" varchar NOT NULL,
  	"dock_hours_disclaimer" varchar NOT NULL,
  	"dock_hours_helmsman" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "payload"."home_overview_schedule" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"day" varchar NOT NULL,
  	"hours" varchar NOT NULL
  );
  
  CREATE TABLE "payload"."home_overview_steps" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"description" varchar NOT NULL
  );
  
  CREATE TABLE "payload"."home_overview" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"subtitle" varchar,
  	"hours_note" varchar,
  	"steps_title" varchar NOT NULL,
  	"events_title" varchar NOT NULL,
  	"event_count" numeric DEFAULT 4 NOT NULL,
  	"events_empty_text" varchar NOT NULL,
  	"events_cta_label" varchar NOT NULL,
  	"events_cta_url" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  ALTER TABLE "payload"."_pages_v" ADD CONSTRAINT "_pages_v_parent_id_pages_id_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."pages"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."menus_items" ADD CONSTRAINT "menus_items_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "payload"."pages"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."menus_items" ADD CONSTRAINT "menus_items_boat_id_boats_id_fk" FOREIGN KEY ("boat_id") REFERENCES "payload"."boats"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."menus_items" ADD CONSTRAINT "menus_items_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "payload"."classes"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."menus_items" ADD CONSTRAINT "menus_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."menus"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."classes" ADD CONSTRAINT "classes_category_id_class_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "payload"."class_categories"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."classes_rels" ADD CONSTRAINT "classes_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."classes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."classes_rels" ADD CONSTRAINT "classes_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "payload"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."classes_rels" ADD CONSTRAINT "classes_rels_classes_fk" FOREIGN KEY ("classes_id") REFERENCES "payload"."classes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."classes_rels" ADD CONSTRAINT "classes_rels_boats_fk" FOREIGN KEY ("boats_id") REFERENCES "payload"."boats"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."boats" ADD CONSTRAINT "boats_required_class_id_classes_id_fk" FOREIGN KEY ("required_class_id") REFERENCES "payload"."classes"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."boats_rels" ADD CONSTRAINT "boats_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."boats"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."boats_rels" ADD CONSTRAINT "boats_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "payload"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."staff" ADD CONSTRAINT "staff_photo_id_media_id_fk" FOREIGN KEY ("photo_id") REFERENCES "payload"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload"."redirects_rels" ADD CONSTRAINT "redirects_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."redirects"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."redirects_rels" ADD CONSTRAINT "redirects_rels_pages_fk" FOREIGN KEY ("pages_id") REFERENCES "payload"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."payload_locked_documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "payload"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "payload"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_pages_fk" FOREIGN KEY ("pages_id") REFERENCES "payload"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_menus_fk" FOREIGN KEY ("menus_id") REFERENCES "payload"."menus"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_class_categories_fk" FOREIGN KEY ("class_categories_id") REFERENCES "payload"."class_categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_classes_fk" FOREIGN KEY ("classes_id") REFERENCES "payload"."classes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_boats_fk" FOREIGN KEY ("boats_id") REFERENCES "payload"."boats"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_staff_fk" FOREIGN KEY ("staff_id") REFERENCES "payload"."staff"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_mitna_meetings_fk" FOREIGN KEY ("mitna_meetings_id") REFERENCES "payload"."mitna_meetings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_redirects_fk" FOREIGN KEY ("redirects_id") REFERENCES "payload"."redirects"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "payload"."payload_preferences"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "payload"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."about_mission_paragraphs" ADD CONSTRAINT "about_mission_paragraphs_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."about"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."about_mission_pillars" ADD CONSTRAINT "about_mission_pillars_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."about"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."about_membership_options" ADD CONSTRAINT "about_membership_options_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."about"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."about_history_entries" ADD CONSTRAINT "about_history_entries_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."about"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."about_volunteer_sections_bullets" ADD CONSTRAINT "about_volunteer_sections_bullets_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."about_volunteer_sections"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."about_volunteer_sections" ADD CONSTRAINT "about_volunteer_sections_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."about"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."about_volunteer_links" ADD CONSTRAINT "about_volunteer_links_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."about"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."home_overview_schedule" ADD CONSTRAINT "home_overview_schedule_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."home_overview"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload"."home_overview_steps" ADD CONSTRAINT "home_overview_steps_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload"."home_overview"("id") ON DELETE cascade ON UPDATE no action;
  CREATE UNIQUE INDEX "users_better_auth_user_id_idx" ON "payload"."users" USING btree ("better_auth_user_id");
  CREATE INDEX "users_updated_at_idx" ON "payload"."users" USING btree ("updated_at");
  CREATE INDEX "users_created_at_idx" ON "payload"."users" USING btree ("created_at");
  CREATE INDEX "media_updated_at_idx" ON "payload"."media" USING btree ("updated_at");
  CREATE INDEX "media_created_at_idx" ON "payload"."media" USING btree ("created_at");
  CREATE UNIQUE INDEX "media_filename_idx" ON "payload"."media" USING btree ("filename");
  CREATE INDEX "media_sizes_thumbnail_sizes_thumbnail_filename_idx" ON "payload"."media" USING btree ("sizes_thumbnail_filename");
  CREATE UNIQUE INDEX "pages_slug_idx" ON "payload"."pages" USING btree ("slug");
  CREATE INDEX "pages_updated_at_idx" ON "payload"."pages" USING btree ("updated_at");
  CREATE INDEX "pages_created_at_idx" ON "payload"."pages" USING btree ("created_at");
  CREATE INDEX "pages_deleted_at_idx" ON "payload"."pages" USING btree ("deleted_at");
  CREATE INDEX "pages__status_idx" ON "payload"."pages" USING btree ("_status");
  CREATE INDEX "_pages_v_parent_idx" ON "payload"."_pages_v" USING btree ("parent_id");
  CREATE INDEX "_pages_v_version_version_slug_idx" ON "payload"."_pages_v" USING btree ("version_slug");
  CREATE INDEX "_pages_v_version_version_updated_at_idx" ON "payload"."_pages_v" USING btree ("version_updated_at");
  CREATE INDEX "_pages_v_version_version_created_at_idx" ON "payload"."_pages_v" USING btree ("version_created_at");
  CREATE INDEX "_pages_v_version_version_deleted_at_idx" ON "payload"."_pages_v" USING btree ("version_deleted_at");
  CREATE INDEX "_pages_v_version_version__status_idx" ON "payload"."_pages_v" USING btree ("version__status");
  CREATE INDEX "_pages_v_created_at_idx" ON "payload"."_pages_v" USING btree ("created_at");
  CREATE INDEX "_pages_v_updated_at_idx" ON "payload"."_pages_v" USING btree ("updated_at");
  CREATE INDEX "_pages_v_latest_idx" ON "payload"."_pages_v" USING btree ("latest");
  CREATE INDEX "_pages_v_autosave_idx" ON "payload"."_pages_v" USING btree ("autosave");
  CREATE INDEX "menus_items_order_idx" ON "payload"."menus_items" USING btree ("_order");
  CREATE INDEX "menus_items_parent_id_idx" ON "payload"."menus_items" USING btree ("_parent_id");
  CREATE INDEX "menus_items_page_idx" ON "payload"."menus_items" USING btree ("page_id");
  CREATE INDEX "menus_items_boat_idx" ON "payload"."menus_items" USING btree ("boat_id");
  CREATE INDEX "menus_items_class_idx" ON "payload"."menus_items" USING btree ("class_id");
  CREATE UNIQUE INDEX "menus_location_idx" ON "payload"."menus" USING btree ("location");
  CREATE INDEX "menus_updated_at_idx" ON "payload"."menus" USING btree ("updated_at");
  CREATE INDEX "menus_created_at_idx" ON "payload"."menus" USING btree ("created_at");
  CREATE UNIQUE INDEX "class_categories_slug_idx" ON "payload"."class_categories" USING btree ("slug");
  CREATE INDEX "class_categories_updated_at_idx" ON "payload"."class_categories" USING btree ("updated_at");
  CREATE INDEX "class_categories_created_at_idx" ON "payload"."class_categories" USING btree ("created_at");
  CREATE UNIQUE INDEX "classes_slug_idx" ON "payload"."classes" USING btree ("slug");
  CREATE INDEX "classes_category_idx" ON "payload"."classes" USING btree ("category_id");
  CREATE INDEX "classes_updated_at_idx" ON "payload"."classes" USING btree ("updated_at");
  CREATE INDEX "classes_created_at_idx" ON "payload"."classes" USING btree ("created_at");
  CREATE INDEX "classes_rels_order_idx" ON "payload"."classes_rels" USING btree ("order");
  CREATE INDEX "classes_rels_parent_idx" ON "payload"."classes_rels" USING btree ("parent_id");
  CREATE INDEX "classes_rels_path_idx" ON "payload"."classes_rels" USING btree ("path");
  CREATE INDEX "classes_rels_media_id_idx" ON "payload"."classes_rels" USING btree ("media_id");
  CREATE INDEX "classes_rels_classes_id_idx" ON "payload"."classes_rels" USING btree ("classes_id");
  CREATE INDEX "classes_rels_boats_id_idx" ON "payload"."classes_rels" USING btree ("boats_id");
  CREATE UNIQUE INDEX "boats_slug_idx" ON "payload"."boats" USING btree ("slug");
  CREATE INDEX "boats_required_class_idx" ON "payload"."boats" USING btree ("required_class_id");
  CREATE INDEX "boats_updated_at_idx" ON "payload"."boats" USING btree ("updated_at");
  CREATE INDEX "boats_created_at_idx" ON "payload"."boats" USING btree ("created_at");
  CREATE INDEX "boats_rels_order_idx" ON "payload"."boats_rels" USING btree ("order");
  CREATE INDEX "boats_rels_parent_idx" ON "payload"."boats_rels" USING btree ("parent_id");
  CREATE INDEX "boats_rels_path_idx" ON "payload"."boats_rels" USING btree ("path");
  CREATE INDEX "boats_rels_media_id_idx" ON "payload"."boats_rels" USING btree ("media_id");
  CREATE UNIQUE INDEX "staff_slug_idx" ON "payload"."staff" USING btree ("slug");
  CREATE INDEX "staff_photo_idx" ON "payload"."staff" USING btree ("photo_id");
  CREATE INDEX "staff_updated_at_idx" ON "payload"."staff" USING btree ("updated_at");
  CREATE INDEX "staff_created_at_idx" ON "payload"."staff" USING btree ("created_at");
  CREATE INDEX "mitna_meetings_updated_at_idx" ON "payload"."mitna_meetings" USING btree ("updated_at");
  CREATE INDEX "mitna_meetings_created_at_idx" ON "payload"."mitna_meetings" USING btree ("created_at");
  CREATE UNIQUE INDEX "redirects_from_idx" ON "payload"."redirects" USING btree ("from");
  CREATE INDEX "redirects_updated_at_idx" ON "payload"."redirects" USING btree ("updated_at");
  CREATE INDEX "redirects_created_at_idx" ON "payload"."redirects" USING btree ("created_at");
  CREATE INDEX "redirects_rels_order_idx" ON "payload"."redirects_rels" USING btree ("order");
  CREATE INDEX "redirects_rels_parent_idx" ON "payload"."redirects_rels" USING btree ("parent_id");
  CREATE INDEX "redirects_rels_path_idx" ON "payload"."redirects_rels" USING btree ("path");
  CREATE INDEX "redirects_rels_pages_id_idx" ON "payload"."redirects_rels" USING btree ("pages_id");
  CREATE UNIQUE INDEX "payload_kv_key_idx" ON "payload"."payload_kv" USING btree ("key");
  CREATE INDEX "payload_locked_documents_global_slug_idx" ON "payload"."payload_locked_documents" USING btree ("global_slug");
  CREATE INDEX "payload_locked_documents_updated_at_idx" ON "payload"."payload_locked_documents" USING btree ("updated_at");
  CREATE INDEX "payload_locked_documents_created_at_idx" ON "payload"."payload_locked_documents" USING btree ("created_at");
  CREATE INDEX "payload_locked_documents_rels_order_idx" ON "payload"."payload_locked_documents_rels" USING btree ("order");
  CREATE INDEX "payload_locked_documents_rels_parent_idx" ON "payload"."payload_locked_documents_rels" USING btree ("parent_id");
  CREATE INDEX "payload_locked_documents_rels_path_idx" ON "payload"."payload_locked_documents_rels" USING btree ("path");
  CREATE INDEX "payload_locked_documents_rels_users_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("users_id");
  CREATE INDEX "payload_locked_documents_rels_media_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("media_id");
  CREATE INDEX "payload_locked_documents_rels_pages_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("pages_id");
  CREATE INDEX "payload_locked_documents_rels_menus_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("menus_id");
  CREATE INDEX "payload_locked_documents_rels_class_categories_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("class_categories_id");
  CREATE INDEX "payload_locked_documents_rels_classes_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("classes_id");
  CREATE INDEX "payload_locked_documents_rels_boats_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("boats_id");
  CREATE INDEX "payload_locked_documents_rels_staff_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("staff_id");
  CREATE INDEX "payload_locked_documents_rels_mitna_meetings_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("mitna_meetings_id");
  CREATE INDEX "payload_locked_documents_rels_redirects_id_idx" ON "payload"."payload_locked_documents_rels" USING btree ("redirects_id");
  CREATE INDEX "payload_preferences_key_idx" ON "payload"."payload_preferences" USING btree ("key");
  CREATE INDEX "payload_preferences_updated_at_idx" ON "payload"."payload_preferences" USING btree ("updated_at");
  CREATE INDEX "payload_preferences_created_at_idx" ON "payload"."payload_preferences" USING btree ("created_at");
  CREATE INDEX "payload_preferences_rels_order_idx" ON "payload"."payload_preferences_rels" USING btree ("order");
  CREATE INDEX "payload_preferences_rels_parent_idx" ON "payload"."payload_preferences_rels" USING btree ("parent_id");
  CREATE INDEX "payload_preferences_rels_path_idx" ON "payload"."payload_preferences_rels" USING btree ("path");
  CREATE INDEX "payload_preferences_rels_users_id_idx" ON "payload"."payload_preferences_rels" USING btree ("users_id");
  CREATE INDEX "payload_migrations_updated_at_idx" ON "payload"."payload_migrations" USING btree ("updated_at");
  CREATE INDEX "payload_migrations_created_at_idx" ON "payload"."payload_migrations" USING btree ("created_at");
  CREATE INDEX "about_mission_paragraphs_order_idx" ON "payload"."about_mission_paragraphs" USING btree ("_order");
  CREATE INDEX "about_mission_paragraphs_parent_id_idx" ON "payload"."about_mission_paragraphs" USING btree ("_parent_id");
  CREATE INDEX "about_mission_pillars_order_idx" ON "payload"."about_mission_pillars" USING btree ("_order");
  CREATE INDEX "about_mission_pillars_parent_id_idx" ON "payload"."about_mission_pillars" USING btree ("_parent_id");
  CREATE INDEX "about_membership_options_order_idx" ON "payload"."about_membership_options" USING btree ("_order");
  CREATE INDEX "about_membership_options_parent_id_idx" ON "payload"."about_membership_options" USING btree ("_parent_id");
  CREATE INDEX "about_history_entries_order_idx" ON "payload"."about_history_entries" USING btree ("_order");
  CREATE INDEX "about_history_entries_parent_id_idx" ON "payload"."about_history_entries" USING btree ("_parent_id");
  CREATE INDEX "about_volunteer_sections_bullets_order_idx" ON "payload"."about_volunteer_sections_bullets" USING btree ("_order");
  CREATE INDEX "about_volunteer_sections_bullets_parent_id_idx" ON "payload"."about_volunteer_sections_bullets" USING btree ("_parent_id");
  CREATE INDEX "about_volunteer_sections_order_idx" ON "payload"."about_volunteer_sections" USING btree ("_order");
  CREATE INDEX "about_volunteer_sections_parent_id_idx" ON "payload"."about_volunteer_sections" USING btree ("_parent_id");
  CREATE INDEX "about_volunteer_links_order_idx" ON "payload"."about_volunteer_links" USING btree ("_order");
  CREATE INDEX "about_volunteer_links_parent_id_idx" ON "payload"."about_volunteer_links" USING btree ("_parent_id");
  CREATE INDEX "home_overview_schedule_order_idx" ON "payload"."home_overview_schedule" USING btree ("_order");
  CREATE INDEX "home_overview_schedule_parent_id_idx" ON "payload"."home_overview_schedule" USING btree ("_parent_id");
  CREATE INDEX "home_overview_steps_order_idx" ON "payload"."home_overview_steps" USING btree ("_order");
  CREATE INDEX "home_overview_steps_parent_id_idx" ON "payload"."home_overview_steps" USING btree ("_parent_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "payload"."users" CASCADE;
  DROP TABLE "payload"."media" CASCADE;
  DROP TABLE "payload"."pages" CASCADE;
  DROP TABLE "payload"."_pages_v" CASCADE;
  DROP TABLE "payload"."menus_items" CASCADE;
  DROP TABLE "payload"."menus" CASCADE;
  DROP TABLE "payload"."class_categories" CASCADE;
  DROP TABLE "payload"."classes" CASCADE;
  DROP TABLE "payload"."classes_rels" CASCADE;
  DROP TABLE "payload"."boats" CASCADE;
  DROP TABLE "payload"."boats_rels" CASCADE;
  DROP TABLE "payload"."staff" CASCADE;
  DROP TABLE "payload"."mitna_meetings" CASCADE;
  DROP TABLE "payload"."redirects" CASCADE;
  DROP TABLE "payload"."redirects_rels" CASCADE;
  DROP TABLE "payload"."payload_kv" CASCADE;
  DROP TABLE "payload"."payload_locked_documents" CASCADE;
  DROP TABLE "payload"."payload_locked_documents_rels" CASCADE;
  DROP TABLE "payload"."payload_preferences" CASCADE;
  DROP TABLE "payload"."payload_preferences_rels" CASCADE;
  DROP TABLE "payload"."payload_migrations" CASCADE;
  DROP TABLE "payload"."about_mission_paragraphs" CASCADE;
  DROP TABLE "payload"."about_mission_pillars" CASCADE;
  DROP TABLE "payload"."about_membership_options" CASCADE;
  DROP TABLE "payload"."about_history_entries" CASCADE;
  DROP TABLE "payload"."about_volunteer_sections_bullets" CASCADE;
  DROP TABLE "payload"."about_volunteer_sections" CASCADE;
  DROP TABLE "payload"."about_volunteer_links" CASCADE;
  DROP TABLE "payload"."about" CASCADE;
  DROP TABLE "payload"."home_overview_schedule" CASCADE;
  DROP TABLE "payload"."home_overview_steps" CASCADE;
  DROP TABLE "payload"."home_overview" CASCADE;
  DROP TYPE "payload"."enum_users_app_role";
  DROP TYPE "payload"."enum_pages_status";
  DROP TYPE "payload"."enum__pages_v_version_status";
  DROP TYPE "payload"."enum_menus_items_link_type";
  DROP TYPE "payload"."enum_menus_items_system_key";
  DROP TYPE "payload"."enum_menus_location";
  DROP TYPE "payload"."enum_redirects_to_type";`)
}
