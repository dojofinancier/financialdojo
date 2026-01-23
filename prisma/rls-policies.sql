-- ============================================================================
-- Financial Dojo - Row Level Security (RLS) Policies (Basic)
-- ============================================================================
-- Purpose: Enable RLS and define baseline policies for all tables.
-- Access patterns:
-- - ADMIN: full access
-- - INSTRUCTOR: access to their cohorts and related data
-- - STUDENT: access to their own data and enrolled courses/cohorts
-- - Public: published catalog content and scheduling windows
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Helper functions
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION get_current_user_id()
RETURNS TEXT AS $$
  SELECT id FROM users WHERE supabase_id = auth.uid()::TEXT LIMIT 1;
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT COALESCE(
    (SELECT role = 'ADMIN'::"UserRole" FROM users WHERE supabase_id = auth.uid()::TEXT),
    false
  );
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION is_instructor()
RETURNS BOOLEAN AS $$
  SELECT COALESCE(
    (SELECT role = 'INSTRUCTOR'::"UserRole" FROM users WHERE supabase_id = auth.uid()::TEXT),
    false
  );
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION is_admin_or_instructor()
RETURNS BOOLEAN AS $$
  SELECT COALESCE(
    (SELECT role IN ('ADMIN'::"UserRole", 'INSTRUCTOR'::"UserRole") FROM users WHERE supabase_id = auth.uid()::TEXT),
    false
  );
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION is_enrolled_in_course(course_id_param TEXT)
RETURNS BOOLEAN AS $$
  SELECT EXISTS(
    SELECT 1 FROM enrollments
    WHERE course_id = course_id_param
      AND user_id = get_current_user_id()
      AND expires_at > NOW()
  );
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION is_enrolled_in_cohort(cohort_id_param TEXT)
RETURNS BOOLEAN AS $$
  SELECT EXISTS(
    SELECT 1 FROM cohort_enrollments
    WHERE cohort_id = cohort_id_param
      AND user_id = get_current_user_id()
      AND expires_at > NOW()
  );
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION is_cohort_instructor(cohort_id_param TEXT)
RETURNS BOOLEAN AS $$
  SELECT EXISTS(
    SELECT 1 FROM cohorts
    WHERE id = cohort_id_param
      AND instructor_id = get_current_user_id()
  );
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- ----------------------------------------------------------------------------
-- Enable RLS on all tables
-- ----------------------------------------------------------------------------

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_studies ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_study_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_study_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_activity_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_banks ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_bank_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_bank_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE flashcards ENABLE ROW LEVEL SECURITY;
ALTER TABLE flashcard_study_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE progress_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointment_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE availability_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE availability_exceptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE seo_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupon_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_ticket_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE error_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE cohorts ENABLE ROW LEVEL SECURITY;
ALTER TABLE cohort_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE cohort_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_coaching_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE cohort_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE cohort_message_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_course_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE module_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE smart_review_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE smart_review_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessment_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE investor_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE investor_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE investor_report_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_plan_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_faqs ENABLE ROW LEVEL SECURITY;
ALTER TABLE cohort_faqs ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- Users
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS admin_select_all_users ON users;
CREATE POLICY admin_select_all_users ON users
  FOR SELECT
  USING (is_admin());

DROP POLICY IF EXISTS users_select_own_profile ON users;
CREATE POLICY users_select_own_profile ON users
  FOR SELECT
  USING (get_current_user_id() = id);

DROP POLICY IF EXISTS users_update_own_profile ON users;
CREATE POLICY users_update_own_profile ON users
  FOR UPDATE
  USING (get_current_user_id() = id)
  WITH CHECK (get_current_user_id() = id);

DROP POLICY IF EXISTS admin_update_all_users ON users;
CREATE POLICY admin_update_all_users ON users
  FOR UPDATE
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS admin_insert_users ON users;
CREATE POLICY admin_insert_users ON users
  FOR INSERT
  WITH CHECK (is_admin());

-- ----------------------------------------------------------------------------
-- Course catalog
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS public_select_course_categories ON course_categories;
CREATE POLICY public_select_course_categories ON course_categories
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS admin_manage_course_categories ON course_categories;
CREATE POLICY admin_manage_course_categories ON course_categories
  FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS public_select_published_courses ON courses;
CREATE POLICY public_select_published_courses ON courses
  FOR SELECT
  USING (published = true);

DROP POLICY IF EXISTS students_select_enrolled_courses ON courses;
CREATE POLICY students_select_enrolled_courses ON courses
  FOR SELECT
  USING (
    EXISTS(
      SELECT 1 FROM enrollments
      WHERE enrollments.course_id = courses.id
        AND enrollments.user_id = get_current_user_id()
        AND enrollments.expires_at > NOW()
    )
  );

DROP POLICY IF EXISTS admin_manage_courses ON courses;
CREATE POLICY admin_manage_courses ON courses
  FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- ----------------------------------------------------------------------------
-- Course content (modules, items, media)
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS public_select_modules_published_courses ON modules;
CREATE POLICY public_select_modules_published_courses ON modules
  FOR SELECT
  USING (
    EXISTS(
      SELECT 1 FROM courses
      WHERE courses.id = modules.course_id
        AND courses.published = true
    )
  );

DROP POLICY IF EXISTS students_select_modules_enrolled_courses ON modules;
CREATE POLICY students_select_modules_enrolled_courses ON modules
  FOR SELECT
  USING (is_enrolled_in_course(course_id));

DROP POLICY IF EXISTS admin_manage_modules ON modules;
CREATE POLICY admin_manage_modules ON modules
  FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS public_select_content_items_published ON content_items;
CREATE POLICY public_select_content_items_published ON content_items
  FOR SELECT
  USING (
    EXISTS(
      SELECT 1 FROM modules
      JOIN courses ON courses.id = modules.course_id
      WHERE modules.id = content_items.module_id
        AND courses.published = true
    )
  );

DROP POLICY IF EXISTS students_select_content_items_enrolled ON content_items;
CREATE POLICY students_select_content_items_enrolled ON content_items
  FOR SELECT
  USING (
    EXISTS(
      SELECT 1 FROM modules
      WHERE modules.id = content_items.module_id
        AND is_enrolled_in_course(modules.course_id)
    )
  );

DROP POLICY IF EXISTS admin_manage_content_items ON content_items;
CREATE POLICY admin_manage_content_items ON content_items
  FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS public_select_videos_published ON videos;
CREATE POLICY public_select_videos_published ON videos
  FOR SELECT
  USING (
    EXISTS(
      SELECT 1 FROM content_items
      JOIN modules ON modules.id = content_items.module_id
      JOIN courses ON courses.id = modules.course_id
      WHERE content_items.id = videos.content_item_id
        AND courses.published = true
    )
  );

DROP POLICY IF EXISTS students_select_videos_enrolled ON videos;
CREATE POLICY students_select_videos_enrolled ON videos
  FOR SELECT
  USING (
    EXISTS(
      SELECT 1 FROM content_items
      JOIN modules ON modules.id = content_items.module_id
      WHERE content_items.id = videos.content_item_id
        AND is_enrolled_in_course(modules.course_id)
    )
  );

DROP POLICY IF EXISTS admin_manage_videos ON videos;
CREATE POLICY admin_manage_videos ON videos
  FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS public_select_quizzes_published ON quizzes;
CREATE POLICY public_select_quizzes_published ON quizzes
  FOR SELECT
  USING (
    EXISTS(
      SELECT 1 FROM content_items
      JOIN modules ON modules.id = content_items.module_id
      JOIN courses ON courses.id = modules.course_id
      WHERE content_items.id = quizzes.content_item_id
        AND courses.published = true
    )
  );

DROP POLICY IF EXISTS students_select_quizzes_enrolled ON quizzes;
CREATE POLICY students_select_quizzes_enrolled ON quizzes
  FOR SELECT
  USING (
    EXISTS(
      SELECT 1 FROM content_items
      JOIN modules ON modules.id = content_items.module_id
      WHERE content_items.id = quizzes.content_item_id
        AND is_enrolled_in_course(modules.course_id)
    )
  );

DROP POLICY IF EXISTS admin_manage_quizzes ON quizzes;
CREATE POLICY admin_manage_quizzes ON quizzes
  FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS public_select_quiz_questions_published ON quiz_questions;
CREATE POLICY public_select_quiz_questions_published ON quiz_questions
  FOR SELECT
  USING (
    EXISTS(
      SELECT 1 FROM quizzes
      JOIN content_items ON content_items.id = quizzes.content_item_id
      JOIN modules ON modules.id = content_items.module_id
      JOIN courses ON courses.id = modules.course_id
      WHERE quizzes.id = quiz_questions.quiz_id
        AND courses.published = true
    )
  );

DROP POLICY IF EXISTS students_select_quiz_questions_enrolled ON quiz_questions;
CREATE POLICY students_select_quiz_questions_enrolled ON quiz_questions
  FOR SELECT
  USING (
    EXISTS(
      SELECT 1 FROM quizzes
      JOIN content_items ON content_items.id = quizzes.content_item_id
      JOIN modules ON modules.id = content_items.module_id
      WHERE quizzes.id = quiz_questions.quiz_id
        AND is_enrolled_in_course(modules.course_id)
    )
  );

DROP POLICY IF EXISTS admin_manage_quiz_questions ON quiz_questions;
CREATE POLICY admin_manage_quiz_questions ON quiz_questions
  FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS students_manage_own_quiz_attempts ON quiz_attempts;
CREATE POLICY students_manage_own_quiz_attempts ON quiz_attempts
  FOR ALL
  USING (get_current_user_id() = user_id)
  WITH CHECK (get_current_user_id() = user_id);

DROP POLICY IF EXISTS admin_select_all_quiz_attempts ON quiz_attempts;
CREATE POLICY admin_select_all_quiz_attempts ON quiz_attempts
  FOR SELECT
  USING (is_admin());

-- ----------------------------------------------------------------------------
-- Practice content (flashcards, question banks, case studies, activities)
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS public_select_flashcards_published ON flashcards;
CREATE POLICY public_select_flashcards_published ON flashcards
  FOR SELECT
  USING (
    EXISTS(
      SELECT 1 FROM courses
      WHERE courses.id = flashcards.course_id
        AND courses.published = true
    )
  );

DROP POLICY IF EXISTS students_select_flashcards_enrolled ON flashcards;
CREATE POLICY students_select_flashcards_enrolled ON flashcards
  FOR SELECT
  USING (is_enrolled_in_course(course_id));

DROP POLICY IF EXISTS admin_manage_flashcards ON flashcards;
CREATE POLICY admin_manage_flashcards ON flashcards
  FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS students_manage_own_study_sessions ON flashcard_study_sessions;
CREATE POLICY students_manage_own_study_sessions ON flashcard_study_sessions
  FOR ALL
  USING (get_current_user_id() = user_id)
  WITH CHECK (get_current_user_id() = user_id);

DROP POLICY IF EXISTS admin_select_all_study_sessions ON flashcard_study_sessions;
CREATE POLICY admin_select_all_study_sessions ON flashcard_study_sessions
  FOR SELECT
  USING (is_admin());

DROP POLICY IF EXISTS students_select_case_studies_enrolled ON case_studies;
CREATE POLICY students_select_case_studies_enrolled ON case_studies
  FOR SELECT
  USING (is_enrolled_in_course(course_id));

DROP POLICY IF EXISTS admin_manage_case_studies ON case_studies;
CREATE POLICY admin_manage_case_studies ON case_studies
  FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS students_select_case_study_questions_enrolled ON case_study_questions;
CREATE POLICY students_select_case_study_questions_enrolled ON case_study_questions
  FOR SELECT
  USING (
    EXISTS(
      SELECT 1 FROM case_studies
      WHERE case_studies.id = case_study_questions.case_study_id
        AND is_enrolled_in_course(case_studies.course_id)
    )
  );

DROP POLICY IF EXISTS admin_manage_case_study_questions ON case_study_questions;
CREATE POLICY admin_manage_case_study_questions ON case_study_questions
  FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS students_manage_own_case_study_attempts ON case_study_attempts;
CREATE POLICY students_manage_own_case_study_attempts ON case_study_attempts
  FOR ALL
  USING (get_current_user_id() = user_id)
  WITH CHECK (get_current_user_id() = user_id);

DROP POLICY IF EXISTS admin_select_case_study_attempts ON case_study_attempts;
CREATE POLICY admin_select_case_study_attempts ON case_study_attempts
  FOR SELECT
  USING (is_admin());

DROP POLICY IF EXISTS students_select_learning_activities_enrolled ON learning_activities;
CREATE POLICY students_select_learning_activities_enrolled ON learning_activities
  FOR SELECT
  USING (is_enrolled_in_course(course_id));

DROP POLICY IF EXISTS admin_manage_learning_activities ON learning_activities;
CREATE POLICY admin_manage_learning_activities ON learning_activities
  FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS students_manage_own_learning_activity_attempts ON learning_activity_attempts;
CREATE POLICY students_manage_own_learning_activity_attempts ON learning_activity_attempts
  FOR ALL
  USING (get_current_user_id() = user_id)
  WITH CHECK (get_current_user_id() = user_id);

DROP POLICY IF EXISTS admin_select_learning_activity_attempts ON learning_activity_attempts;
CREATE POLICY admin_select_learning_activity_attempts ON learning_activity_attempts
  FOR SELECT
  USING (is_admin());

DROP POLICY IF EXISTS students_select_question_banks_enrolled ON question_banks;
CREATE POLICY students_select_question_banks_enrolled ON question_banks
  FOR SELECT
  USING (is_enrolled_in_course(course_id));

DROP POLICY IF EXISTS admin_manage_question_banks ON question_banks;
CREATE POLICY admin_manage_question_banks ON question_banks
  FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS students_select_question_bank_questions_enrolled ON question_bank_questions;
CREATE POLICY students_select_question_bank_questions_enrolled ON question_bank_questions
  FOR SELECT
  USING (
    EXISTS(
      SELECT 1 FROM question_banks
      WHERE question_banks.id = question_bank_questions.question_bank_id
        AND is_enrolled_in_course(question_banks.course_id)
    )
  );

DROP POLICY IF EXISTS admin_manage_question_bank_questions ON question_bank_questions;
CREATE POLICY admin_manage_question_bank_questions ON question_bank_questions
  FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS students_manage_own_question_bank_attempts ON question_bank_attempts;
CREATE POLICY students_manage_own_question_bank_attempts ON question_bank_attempts
  FOR ALL
  USING (get_current_user_id() = user_id)
  WITH CHECK (get_current_user_id() = user_id);

DROP POLICY IF EXISTS admin_select_question_bank_attempts ON question_bank_attempts;
CREATE POLICY admin_select_question_bank_attempts ON question_bank_attempts
  FOR SELECT
  USING (is_admin());

-- ----------------------------------------------------------------------------
-- Notes
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS admin_manage_admin_notes ON notes;
CREATE POLICY admin_manage_admin_notes ON notes
  FOR ALL
  USING (
    type = 'ADMIN'::"NoteType" AND is_admin()
  )
  WITH CHECK (
    type = 'ADMIN'::"NoteType" AND is_admin()
  );

DROP POLICY IF EXISTS students_select_admin_notes_enrolled ON notes;
CREATE POLICY students_select_admin_notes_enrolled ON notes
  FOR SELECT
  USING (
    type = 'ADMIN'::"NoteType" AND
    content_item_id IS NOT NULL AND
    EXISTS(
      SELECT 1 FROM content_items
      JOIN modules ON modules.id = content_items.module_id
      WHERE content_items.id = notes.content_item_id
        AND is_enrolled_in_course(modules.course_id)
    )
  );

DROP POLICY IF EXISTS students_manage_own_notes ON notes;
CREATE POLICY students_manage_own_notes ON notes
  FOR ALL
  USING (
    type = 'STUDENT'::"NoteType" AND
    get_current_user_id() = user_id
  )
  WITH CHECK (
    type = 'STUDENT'::"NoteType" AND
    get_current_user_id() = user_id
  );

DROP POLICY IF EXISTS admin_select_all_notes ON notes;
CREATE POLICY admin_select_all_notes ON notes
  FOR SELECT
  USING (is_admin());

-- ----------------------------------------------------------------------------
-- Enrollments and subscriptions
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS students_select_own_enrollments ON enrollments;
CREATE POLICY students_select_own_enrollments ON enrollments
  FOR SELECT
  USING (get_current_user_id() = user_id);

DROP POLICY IF EXISTS admin_manage_enrollments ON enrollments;
CREATE POLICY admin_manage_enrollments ON enrollments
  FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS students_select_own_subscriptions ON subscriptions;
CREATE POLICY students_select_own_subscriptions ON subscriptions
  FOR SELECT
  USING (get_current_user_id() = user_id);

DROP POLICY IF EXISTS admin_manage_subscriptions ON subscriptions;
CREATE POLICY admin_manage_subscriptions ON subscriptions
  FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- ----------------------------------------------------------------------------
-- Progress, study plans, and assessments
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS students_manage_own_progress ON progress_tracking;
CREATE POLICY students_manage_own_progress ON progress_tracking
  FOR ALL
  USING (get_current_user_id() = user_id)
  WITH CHECK (get_current_user_id() = user_id);

DROP POLICY IF EXISTS admin_select_all_progress ON progress_tracking;
CREATE POLICY admin_select_all_progress ON progress_tracking
  FOR SELECT
  USING (is_admin());

DROP POLICY IF EXISTS students_manage_own_course_settings ON user_course_settings;
CREATE POLICY students_manage_own_course_settings ON user_course_settings
  FOR ALL
  USING (get_current_user_id() = user_id)
  WITH CHECK (get_current_user_id() = user_id);

DROP POLICY IF EXISTS admin_select_course_settings ON user_course_settings;
CREATE POLICY admin_select_course_settings ON user_course_settings
  FOR SELECT
  USING (is_admin());

DROP POLICY IF EXISTS students_manage_own_module_progress ON module_progress;
CREATE POLICY students_manage_own_module_progress ON module_progress
  FOR ALL
  USING (get_current_user_id() = user_id)
  WITH CHECK (get_current_user_id() = user_id);

DROP POLICY IF EXISTS admin_select_module_progress ON module_progress;
CREATE POLICY admin_select_module_progress ON module_progress
  FOR SELECT
  USING (is_admin());

DROP POLICY IF EXISTS students_manage_own_smart_review_items ON smart_review_items;
CREATE POLICY students_manage_own_smart_review_items ON smart_review_items
  FOR ALL
  USING (get_current_user_id() = user_id)
  WITH CHECK (get_current_user_id() = user_id);

DROP POLICY IF EXISTS admin_select_smart_review_items ON smart_review_items;
CREATE POLICY admin_select_smart_review_items ON smart_review_items
  FOR SELECT
  USING (is_admin());

DROP POLICY IF EXISTS students_manage_own_smart_review_progress ON smart_review_progress;
CREATE POLICY students_manage_own_smart_review_progress ON smart_review_progress
  FOR ALL
  USING (get_current_user_id() = user_id)
  WITH CHECK (get_current_user_id() = user_id);

DROP POLICY IF EXISTS admin_select_smart_review_progress ON smart_review_progress;
CREATE POLICY admin_select_smart_review_progress ON smart_review_progress
  FOR SELECT
  USING (is_admin());

DROP POLICY IF EXISTS students_manage_own_assessment_results ON assessment_results;
CREATE POLICY students_manage_own_assessment_results ON assessment_results
  FOR ALL
  USING (get_current_user_id() = user_id)
  WITH CHECK (get_current_user_id() = user_id);

DROP POLICY IF EXISTS admin_select_assessment_results ON assessment_results;
CREATE POLICY admin_select_assessment_results ON assessment_results
  FOR SELECT
  USING (is_admin());

DROP POLICY IF EXISTS students_manage_own_daily_plan_entries ON daily_plan_entries;
CREATE POLICY students_manage_own_daily_plan_entries ON daily_plan_entries
  FOR ALL
  USING (get_current_user_id() = user_id)
  WITH CHECK (get_current_user_id() = user_id);

DROP POLICY IF EXISTS admin_select_daily_plan_entries ON daily_plan_entries;
CREATE POLICY admin_select_daily_plan_entries ON daily_plan_entries
  FOR SELECT
  USING (is_admin());

DROP POLICY IF EXISTS admin_manage_analytics ON analytics;
CREATE POLICY admin_manage_analytics ON analytics
  FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- ----------------------------------------------------------------------------
-- Messaging
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS students_select_own_messages ON messages;
CREATE POLICY students_select_own_messages ON messages
  FOR SELECT
  USING (
    EXISTS(
      SELECT 1 FROM message_threads
      WHERE message_threads.id = messages.thread_id
        AND message_threads.user_id = get_current_user_id()
    )
  );

DROP POLICY IF EXISTS students_insert_own_messages ON messages;
CREATE POLICY students_insert_own_messages ON messages
  FOR INSERT
  WITH CHECK (
    get_current_user_id() = user_id AND
    EXISTS(
      SELECT 1 FROM message_threads
      WHERE message_threads.id = messages.thread_id
        AND message_threads.user_id = get_current_user_id()
    )
  );

DROP POLICY IF EXISTS admin_select_all_messages ON messages;
CREATE POLICY admin_select_all_messages ON messages
  FOR SELECT
  USING (is_admin());

DROP POLICY IF EXISTS admin_insert_messages ON messages;
CREATE POLICY admin_insert_messages ON messages
  FOR INSERT
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS students_manage_own_threads ON message_threads;
CREATE POLICY students_manage_own_threads ON message_threads
  FOR ALL
  USING (get_current_user_id() = user_id)
  WITH CHECK (get_current_user_id() = user_id);

DROP POLICY IF EXISTS admin_select_all_threads ON message_threads;
CREATE POLICY admin_select_all_threads ON message_threads
  FOR SELECT
  USING (is_admin());

DROP POLICY IF EXISTS admin_update_threads ON message_threads;
CREATE POLICY admin_update_threads ON message_threads
  FOR UPDATE
  USING (is_admin())
  WITH CHECK (is_admin());

-- ----------------------------------------------------------------------------
-- Appointments
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS students_manage_own_appointments ON appointments;
CREATE POLICY students_manage_own_appointments ON appointments
  FOR ALL
  USING (get_current_user_id() = user_id)
  WITH CHECK (get_current_user_id() = user_id);

DROP POLICY IF EXISTS admin_manage_appointments ON appointments;
CREATE POLICY admin_manage_appointments ON appointments
  FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS admin_manage_appointment_availability ON appointment_availability;
CREATE POLICY admin_manage_appointment_availability ON appointment_availability
  FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS admin_manage_availability_rules ON availability_rules;
CREATE POLICY admin_manage_availability_rules ON availability_rules
  FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS public_select_availability_rules ON availability_rules;
CREATE POLICY public_select_availability_rules ON availability_rules
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS admin_manage_availability_exceptions ON availability_exceptions;
CREATE POLICY admin_manage_availability_exceptions ON availability_exceptions
  FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS public_select_availability_exceptions ON availability_exceptions;
CREATE POLICY public_select_availability_exceptions ON availability_exceptions
  FOR SELECT
  USING (true);

-- ----------------------------------------------------------------------------
-- Articles and coupons
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS public_select_published_articles ON seo_articles;
CREATE POLICY public_select_published_articles ON seo_articles
  FOR SELECT
  USING (published = true);

DROP POLICY IF EXISTS admin_manage_articles ON seo_articles;
CREATE POLICY admin_manage_articles ON seo_articles
  FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS public_select_active_coupons ON coupons;
CREATE POLICY public_select_active_coupons ON coupons
  FOR SELECT
  USING (
    active = true
    AND NOW() >= valid_from
    AND NOW() <= valid_until
  );

DROP POLICY IF EXISTS admin_manage_coupons ON coupons;
CREATE POLICY admin_manage_coupons ON coupons
  FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS students_select_own_coupon_usage ON coupon_usage;
CREATE POLICY students_select_own_coupon_usage ON coupon_usage
  FOR SELECT
  USING (
    EXISTS(
      SELECT 1 FROM enrollments
      WHERE enrollments.id = coupon_usage.enrollment_id
        AND enrollments.user_id = get_current_user_id()
    )
  );

DROP POLICY IF EXISTS admin_manage_coupon_usage ON coupon_usage;
CREATE POLICY admin_manage_coupon_usage ON coupon_usage
  FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- ----------------------------------------------------------------------------
-- Support tickets
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS students_manage_own_tickets ON support_tickets;
CREATE POLICY students_manage_own_tickets ON support_tickets
  FOR ALL
  USING (
    get_current_user_id() = student_id AND
    EXISTS(
      SELECT 1 FROM users
      WHERE users.id = get_current_user_id()
        AND users.role = 'STUDENT'::"UserRole"
    )
  )
  WITH CHECK (
    get_current_user_id() = student_id AND
    EXISTS(
      SELECT 1 FROM users
      WHERE users.id = get_current_user_id()
        AND users.role = 'STUDENT'::"UserRole"
    )
  );

DROP POLICY IF EXISTS admin_manage_tickets ON support_tickets;
CREATE POLICY admin_manage_tickets ON support_tickets
  FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS students_select_own_ticket_replies ON support_ticket_replies;
CREATE POLICY students_select_own_ticket_replies ON support_ticket_replies
  FOR SELECT
  USING (
    EXISTS(
      SELECT 1 FROM support_tickets
      WHERE support_tickets.id = support_ticket_replies.ticket_id
        AND support_tickets.student_id = get_current_user_id()
    )
  );

DROP POLICY IF EXISTS students_insert_own_ticket_replies ON support_ticket_replies;
CREATE POLICY students_insert_own_ticket_replies ON support_ticket_replies
  FOR INSERT
  WITH CHECK (
    get_current_user_id() = author_id AND
    author_role = 'STUDENT'::"UserRole" AND
    EXISTS(
      SELECT 1 FROM support_tickets
      WHERE support_tickets.id = support_ticket_replies.ticket_id
        AND support_tickets.student_id = get_current_user_id()
    )
  );

DROP POLICY IF EXISTS admin_manage_ticket_replies ON support_ticket_replies;
CREATE POLICY admin_manage_ticket_replies ON support_ticket_replies
  FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- ----------------------------------------------------------------------------
-- Error logs
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS admin_manage_error_logs ON error_logs;
CREATE POLICY admin_manage_error_logs ON error_logs
  FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS users_insert_own_error_logs ON error_logs;
CREATE POLICY users_insert_own_error_logs ON error_logs
  FOR INSERT
  WITH CHECK (
    user_id IS NULL OR
    get_current_user_id() = user_id
  );

-- ----------------------------------------------------------------------------
-- Cohorts and group coaching
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS public_select_published_cohorts ON cohorts;
CREATE POLICY public_select_published_cohorts ON cohorts
  FOR SELECT
  USING (published = true);

DROP POLICY IF EXISTS students_select_enrolled_cohorts ON cohorts;
CREATE POLICY students_select_enrolled_cohorts ON cohorts
  FOR SELECT
  USING (is_enrolled_in_cohort(id));

DROP POLICY IF EXISTS instructors_manage_own_cohorts ON cohorts;
CREATE POLICY instructors_manage_own_cohorts ON cohorts
  FOR ALL
  USING (
    is_instructor() AND
    instructor_id = get_current_user_id()
  )
  WITH CHECK (
    is_instructor() AND
    instructor_id = get_current_user_id()
  );

DROP POLICY IF EXISTS admin_manage_cohorts ON cohorts;
CREATE POLICY admin_manage_cohorts ON cohorts
  FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS public_select_cohort_modules_published ON cohort_modules;
CREATE POLICY public_select_cohort_modules_published ON cohort_modules
  FOR SELECT
  USING (
    EXISTS(
      SELECT 1 FROM cohorts
      WHERE cohorts.id = cohort_modules.cohort_id
        AND cohorts.published = true
    )
  );

DROP POLICY IF EXISTS students_select_cohort_modules_enrolled ON cohort_modules;
CREATE POLICY students_select_cohort_modules_enrolled ON cohort_modules
  FOR SELECT
  USING (is_enrolled_in_cohort(cohort_id));

DROP POLICY IF EXISTS instructors_manage_cohort_modules ON cohort_modules;
CREATE POLICY instructors_manage_cohort_modules ON cohort_modules
  FOR ALL
  USING (
    is_instructor() AND
    is_cohort_instructor(cohort_id)
  )
  WITH CHECK (
    is_instructor() AND
    is_cohort_instructor(cohort_id)
  );

DROP POLICY IF EXISTS admin_manage_cohort_modules ON cohort_modules;
CREATE POLICY admin_manage_cohort_modules ON cohort_modules
  FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS students_select_own_cohort_enrollments ON cohort_enrollments;
CREATE POLICY students_select_own_cohort_enrollments ON cohort_enrollments
  FOR SELECT
  USING (get_current_user_id() = user_id);

DROP POLICY IF EXISTS instructors_manage_cohort_enrollments ON cohort_enrollments;
CREATE POLICY instructors_manage_cohort_enrollments ON cohort_enrollments
  FOR ALL
  USING (
    is_instructor() AND
    is_cohort_instructor(cohort_id)
  )
  WITH CHECK (
    is_instructor() AND
    is_cohort_instructor(cohort_id)
  );

DROP POLICY IF EXISTS admin_manage_cohort_enrollments ON cohort_enrollments;
CREATE POLICY admin_manage_cohort_enrollments ON cohort_enrollments
  FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS students_select_cohort_sessions ON group_coaching_sessions;
CREATE POLICY students_select_cohort_sessions ON group_coaching_sessions
  FOR SELECT
  USING (is_enrolled_in_cohort(cohort_id));

DROP POLICY IF EXISTS instructors_manage_cohort_sessions ON group_coaching_sessions;
CREATE POLICY instructors_manage_cohort_sessions ON group_coaching_sessions
  FOR ALL
  USING (
    is_instructor() AND
    is_cohort_instructor(cohort_id)
  )
  WITH CHECK (
    is_instructor() AND
    is_cohort_instructor(cohort_id)
  );

DROP POLICY IF EXISTS admin_manage_cohort_sessions ON group_coaching_sessions;
CREATE POLICY admin_manage_cohort_sessions ON group_coaching_sessions
  FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS students_manage_cohort_messages ON cohort_messages;
CREATE POLICY students_manage_cohort_messages ON cohort_messages
  FOR ALL
  USING (
    is_enrolled_in_cohort(cohort_id) AND
    (get_current_user_id() = author_id OR NOT pinned)
  )
  WITH CHECK (
    is_enrolled_in_cohort(cohort_id) AND
    get_current_user_id() = author_id
  );

DROP POLICY IF EXISTS instructors_manage_cohort_messages ON cohort_messages;
CREATE POLICY instructors_manage_cohort_messages ON cohort_messages
  FOR ALL
  USING (
    is_instructor() AND
    is_cohort_instructor(cohort_id)
  )
  WITH CHECK (
    is_instructor() AND
    is_cohort_instructor(cohort_id)
  );

DROP POLICY IF EXISTS admin_manage_cohort_messages ON cohort_messages;
CREATE POLICY admin_manage_cohort_messages ON cohort_messages
  FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS students_manage_own_message_reads ON cohort_message_reads;
CREATE POLICY students_manage_own_message_reads ON cohort_message_reads
  FOR ALL
  USING (get_current_user_id() = user_id)
  WITH CHECK (get_current_user_id() = user_id);

DROP POLICY IF EXISTS admin_select_message_reads ON cohort_message_reads;
CREATE POLICY admin_select_message_reads ON cohort_message_reads
  FOR SELECT
  USING (is_admin());

DROP POLICY IF EXISTS public_select_cohort_faqs_published ON cohort_faqs;
CREATE POLICY public_select_cohort_faqs_published ON cohort_faqs
  FOR SELECT
  USING (
    EXISTS(
      SELECT 1 FROM cohorts
      WHERE cohorts.id = cohort_faqs.cohort_id
        AND cohorts.published = true
    )
  );

DROP POLICY IF EXISTS students_select_cohort_faqs_enrolled ON cohort_faqs;
CREATE POLICY students_select_cohort_faqs_enrolled ON cohort_faqs
  FOR SELECT
  USING (is_enrolled_in_cohort(cohort_id));

DROP POLICY IF EXISTS instructors_manage_cohort_faqs ON cohort_faqs;
CREATE POLICY instructors_manage_cohort_faqs ON cohort_faqs
  FOR ALL
  USING (
    is_instructor() AND
    is_cohort_instructor(cohort_id)
  )
  WITH CHECK (
    is_instructor() AND
    is_cohort_instructor(cohort_id)
  );

DROP POLICY IF EXISTS admin_manage_cohort_faqs ON cohort_faqs;
CREATE POLICY admin_manage_cohort_faqs ON cohort_faqs
  FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- ----------------------------------------------------------------------------
-- Course FAQs
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS public_select_course_faqs_published ON course_faqs;
CREATE POLICY public_select_course_faqs_published ON course_faqs
  FOR SELECT
  USING (
    EXISTS(
      SELECT 1 FROM courses
      WHERE courses.id = course_faqs.course_id
        AND courses.published = true
    )
  );

DROP POLICY IF EXISTS students_select_course_faqs_enrolled ON course_faqs;
CREATE POLICY students_select_course_faqs_enrolled ON course_faqs
  FOR SELECT
  USING (is_enrolled_in_course(course_id));

DROP POLICY IF EXISTS admin_manage_course_faqs ON course_faqs;
CREATE POLICY admin_manage_course_faqs ON course_faqs
  FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- ----------------------------------------------------------------------------
-- Investor diagnostic tables (admin only by default)
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS admin_manage_investor_leads ON investor_leads;
CREATE POLICY admin_manage_investor_leads ON investor_leads
  FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS admin_manage_investor_assessments ON investor_assessments;
CREATE POLICY admin_manage_investor_assessments ON investor_assessments
  FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS admin_manage_investor_report_instances ON investor_report_instances;
CREATE POLICY admin_manage_investor_report_instances ON investor_report_instances
  FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

