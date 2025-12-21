-- Cloudflare D1 Schema for Blog Comments
-- Run this schema using: wrangler d1 execute DB --file=./db/schema.sql

-- Comments table
CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_slug TEXT NOT NULL,               -- The slug of the blog post
    parent_id INTEGER,                      -- For replies, references parent comment
    name TEXT NOT NULL,                     -- Commenter's display name
    email TEXT,                             -- Optional email (for Gravatar, notifications)
    content TEXT NOT NULL,                  -- The comment text
    created_at TEXT DEFAULT (datetime('now')), -- When the comment was created
    approved INTEGER DEFAULT 1,             -- 1 = approved, 0 = pending moderation
    ip_hash TEXT,                           -- Hashed IP for spam prevention
    FOREIGN KEY (parent_id) REFERENCES comments(id) ON DELETE CASCADE
);

-- Index for faster lookups by post
CREATE INDEX IF NOT EXISTS idx_comments_post ON comments(post_slug);

-- Index for parent comments (for threading)
CREATE INDEX IF NOT EXISTS idx_comments_parent ON comments(parent_id);

-- Index for approved status
CREATE INDEX IF NOT EXISTS idx_comments_approved ON comments(approved);

