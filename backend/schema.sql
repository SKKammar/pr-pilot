-- ==============================================================================
-- PR PILOT SUPABASE DATABASE SCHEMA
-- Run this script in your Supabase Project SQL Editor
-- (https://supabase.com/dashboard/project/_/sql)
-- ==============================================================================

-- 1. Create Webhook Jobs Queue
CREATE TABLE IF NOT EXISTS public.pr_pilot_webhook_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    delivery_id TEXT NOT NULL,
    payload JSONB NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    attempts INT NOT NULL DEFAULT 0,
    error_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_webhook_jobs_status ON public.pr_pilot_webhook_jobs(status, created_at);
CREATE INDEX IF NOT EXISTS idx_webhook_jobs_delivery ON public.pr_pilot_webhook_jobs(delivery_id);

-- 2. Create Reviews Table
CREATE TABLE IF NOT EXISTS public.pr_pilot_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    installation_id BIGINT NOT NULL,
    pr_number INT NOT NULL,
    repo_full_name TEXT NOT NULL,
    pr_title TEXT NOT NULL,
    pr_author TEXT NOT NULL,
    total_issues INT NOT NULL DEFAULT 0,
    error_count INT NOT NULL DEFAULT 0,
    warning_count INT NOT NULL DEFAULT 0,
    suggestion_count INT NOT NULL DEFAULT 0,
    summary TEXT,
    delivery_id TEXT,
    status TEXT NOT NULL DEFAULT 'posted',
    error_reason TEXT,
    prompt_version TEXT DEFAULT 'v1',
    reviewed_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_reviews_repo ON public.pr_pilot_reviews(repo_full_name);
CREATE INDEX IF NOT EXISTS idx_reviews_delivery ON public.pr_pilot_reviews(delivery_id);
CREATE INDEX IF NOT EXISTS idx_reviews_date ON public.pr_pilot_reviews(reviewed_at DESC);

-- 3. Create Review Comments Table
CREATE TABLE IF NOT EXISTS public.pr_pilot_review_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    review_id UUID NOT NULL REFERENCES public.pr_pilot_reviews(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    line_pos INT NOT NULL DEFAULT 1,
    severity TEXT NOT NULL DEFAULT 'suggestion',
    message TEXT NOT NULL,
    suggestion TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_comments_review_id ON public.pr_pilot_review_comments(review_id);

-- 4. Create Installations Table
CREATE TABLE IF NOT EXISTS public.pr_pilot_installations (
    installation_id BIGINT PRIMARY KEY,
    account_login TEXT NOT NULL,
    account_type TEXT NOT NULL DEFAULT 'User',
    installed_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    uninstalled_at TIMESTAMPTZ,
    suspended BOOLEAN NOT NULL DEFAULT FALSE
);

-- ==============================================================================
-- 5. Row Level Security (RLS) & Permissions
-- ==============================================================================

-- Enable RLS
ALTER TABLE public.pr_pilot_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pr_pilot_review_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pr_pilot_webhook_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pr_pilot_installations ENABLE ROW LEVEL SECURITY;

-- Grant Full Privileges to service_role (used by backend)
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- Allow read-only access to anon key for public dashboard view
GRANT SELECT ON public.pr_pilot_reviews TO anon;
GRANT SELECT ON public.pr_pilot_review_comments TO anon;

-- Permissive policies for service_role
CREATE POLICY "service_role full access to reviews" ON public.pr_pilot_reviews
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role full access to comments" ON public.pr_pilot_review_comments
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role full access to jobs" ON public.pr_pilot_webhook_jobs
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role full access to installations" ON public.pr_pilot_installations
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Public read policies for dashboard
CREATE POLICY "Public read reviews" ON public.pr_pilot_reviews
    FOR SELECT TO anon USING (true);

CREATE POLICY "Public read comments" ON public.pr_pilot_review_comments
    FOR SELECT TO anon USING (true);
