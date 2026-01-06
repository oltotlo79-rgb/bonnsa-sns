-- ============================================
-- 盆栽SNS 完全スキーマ
-- Supabase SQL Editorで実行してください
-- ============================================

-- ============================================
-- 001: ユーザー・投稿関連テーブル
-- ============================================

-- UUID拡張機能を有効化
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- ユーザーテーブル
-- ============================================
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  nickname TEXT NOT NULL,
  avatar_url TEXT,
  header_url TEXT,
  bio TEXT,
  location TEXT,
  is_public BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- updated_at自動更新トリガー
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ジャンルマスターテーブル
-- ============================================
CREATE TABLE genres (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 投稿テーブル
-- ============================================
CREATE TABLE posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT CHECK (char_length(content) <= 500),
  quote_post_id UUID REFERENCES posts(id) ON DELETE SET NULL,
  repost_post_id UUID REFERENCES posts(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 投稿メディアテーブル
-- ============================================
CREATE TABLE post_media (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('image', 'video')),
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 投稿ジャンル中間テーブル
-- ============================================
CREATE TABLE post_genres (
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  genre_id UUID NOT NULL REFERENCES genres(id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, genre_id)
);

-- ============================================
-- 002: インタラクション関連テーブル
-- ============================================

-- コメントテーブル
CREATE TABLE comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES comments(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (char_length(content) <= 500),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- いいねテーブル
CREATE TABLE likes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT likes_target_check CHECK (
    (post_id IS NOT NULL AND comment_id IS NULL) OR
    (post_id IS NULL AND comment_id IS NOT NULL)
  ),
  CONSTRAINT likes_user_post_unique UNIQUE (user_id, post_id),
  CONSTRAINT likes_user_comment_unique UNIQUE (user_id, comment_id)
);

-- ブックマークテーブル
CREATE TABLE bookmarks (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, post_id)
);

-- フォローテーブル
CREATE TABLE follows (
  follower_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (follower_id, following_id),
  CONSTRAINT follows_self_check CHECK (follower_id != following_id)
);

-- ブロックテーブル
CREATE TABLE blocks (
  blocker_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (blocker_id, blocked_id),
  CONSTRAINT blocks_self_check CHECK (blocker_id != blocked_id)
);

-- ミュートテーブル
CREATE TABLE mutes (
  muter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  muted_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (muter_id, muted_id),
  CONSTRAINT mutes_self_check CHECK (muter_id != muted_id)
);

-- ============================================
-- 003: 通知テーブル
-- ============================================
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  actor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('like', 'comment', 'follow', 'quote', 'reply', 'repost')),
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 004: 盆栽園・イベント関連テーブル
-- ============================================

-- 盆栽園テーブル
CREATE TABLE bonsai_shops (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  phone TEXT,
  website TEXT,
  business_hours TEXT,
  closed_days TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER update_bonsai_shops_updated_at
  BEFORE UPDATE ON bonsai_shops
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 盆栽園ジャンルテーブル
CREATE TABLE shop_genres (
  shop_id UUID NOT NULL REFERENCES bonsai_shops(id) ON DELETE CASCADE,
  genre TEXT NOT NULL,
  PRIMARY KEY (shop_id, genre)
);

-- 盆栽園レビューテーブル
CREATE TABLE shop_reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id UUID NOT NULL REFERENCES bonsai_shops(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  content TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT shop_reviews_user_shop_unique UNIQUE (user_id, shop_id)
);

-- レビュー画像テーブル
CREATE TABLE shop_review_images (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  review_id UUID NOT NULL REFERENCES shop_reviews(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- イベントテーブル
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  start_date DATE NOT NULL,
  end_date DATE,
  prefecture TEXT,
  city TEXT,
  venue TEXT,
  organizer TEXT,
  admission_fee TEXT,
  has_sales BOOLEAN DEFAULT false,
  external_url TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER update_events_updated_at
  BEFORE UPDATE ON events
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 005: 通報・管理者関連テーブル
-- ============================================

-- 通報テーブル
CREATE TABLE reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reporter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('post', 'comment', 'event', 'shop', 'user')),
  target_id UUID NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('spam', 'inappropriate', 'harassment', 'copyright', 'other')),
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 管理者ユーザーテーブル
CREATE TABLE admin_users (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'moderator')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 管理者操作ログテーブル
CREATE TABLE admin_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id UUID NOT NULL REFERENCES admin_users(user_id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id UUID,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- インデックス
-- ============================================
CREATE INDEX idx_posts_user_id ON posts(user_id);
CREATE INDEX idx_posts_created_at ON posts(created_at DESC);
CREATE INDEX idx_post_media_post_id ON post_media(post_id);
CREATE INDEX idx_post_genres_post_id ON post_genres(post_id);
CREATE INDEX idx_post_genres_genre_id ON post_genres(genre_id);
CREATE INDEX idx_comments_post_id ON comments(post_id);
CREATE INDEX idx_comments_user_id ON comments(user_id);
CREATE INDEX idx_comments_parent_id ON comments(parent_id);
CREATE INDEX idx_likes_post_id ON likes(post_id);
CREATE INDEX idx_likes_comment_id ON likes(comment_id);
CREATE INDEX idx_likes_user_id ON likes(user_id);
CREATE INDEX idx_bookmarks_user_id ON bookmarks(user_id);
CREATE INDEX idx_follows_follower_id ON follows(follower_id);
CREATE INDEX idx_follows_following_id ON follows(following_id);
CREATE INDEX idx_blocks_blocker_id ON blocks(blocker_id);
CREATE INDEX idx_blocks_blocked_id ON blocks(blocked_id);
CREATE INDEX idx_mutes_muter_id ON mutes(muter_id);
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_is_read ON notifications(user_id, is_read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX idx_bonsai_shops_location ON bonsai_shops(latitude, longitude);
CREATE INDEX idx_bonsai_shops_name ON bonsai_shops(name);
CREATE INDEX idx_shop_reviews_shop_id ON shop_reviews(shop_id);
CREATE INDEX idx_shop_reviews_user_id ON shop_reviews(user_id);
CREATE INDEX idx_events_start_date ON events(start_date);
CREATE INDEX idx_events_prefecture ON events(prefecture);
CREATE INDEX idx_events_end_date ON events(end_date);
CREATE INDEX idx_reports_reporter_id ON reports(reporter_id);
CREATE INDEX idx_reports_status ON reports(status);
CREATE INDEX idx_reports_target ON reports(target_type, target_id);
CREATE INDEX idx_admin_logs_admin_id ON admin_logs(admin_id);
CREATE INDEX idx_admin_logs_created_at ON admin_logs(created_at DESC);

-- ============================================
-- 006: Row Level Security (RLS) ポリシー
-- ============================================

-- RLS有効化
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_genres ENABLE ROW LEVEL SECURITY;
ALTER TABLE genres ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE mutes ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE bonsai_shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_genres ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_review_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_logs ENABLE ROW LEVEL SECURITY;

-- users ポリシー
CREATE POLICY "Public profiles are viewable by everyone"
ON users FOR SELECT
USING (is_public = true OR auth.uid() = id);

CREATE POLICY "Users can update own profile"
ON users FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
ON users FOR INSERT
WITH CHECK (auth.uid() = id);

-- posts ポリシー
CREATE POLICY "Public posts are viewable by everyone"
ON posts FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = posts.user_id
    AND users.is_public = true
  )
  OR auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM follows
    WHERE follows.follower_id = auth.uid()
    AND follows.following_id = posts.user_id
  )
);

CREATE POLICY "Users can create own posts"
ON posts FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own posts"
ON posts FOR DELETE
USING (auth.uid() = user_id);

-- post_media ポリシー
CREATE POLICY "Post media follows post visibility"
ON post_media FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM posts
    WHERE posts.id = post_media.post_id
  )
);

CREATE POLICY "Users can add media to own posts"
ON post_media FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM posts
    WHERE posts.id = post_media.post_id
    AND posts.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete media from own posts"
ON post_media FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM posts
    WHERE posts.id = post_media.post_id
    AND posts.user_id = auth.uid()
  )
);

-- post_genres ポリシー
CREATE POLICY "Post genres follow post visibility"
ON post_genres FOR SELECT
USING (true);

CREATE POLICY "Users can add genres to own posts"
ON post_genres FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM posts
    WHERE posts.id = post_genres.post_id
    AND posts.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete genres from own posts"
ON post_genres FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM posts
    WHERE posts.id = post_genres.post_id
    AND posts.user_id = auth.uid()
  )
);

-- genres ポリシー（マスターデータ）
CREATE POLICY "Genres are viewable by everyone"
ON genres FOR SELECT
USING (true);

-- comments ポリシー
CREATE POLICY "Comments follow post visibility"
ON comments FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM posts
    WHERE posts.id = comments.post_id
  )
);

CREATE POLICY "Authenticated users can create comments"
ON comments FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own comments"
ON comments FOR DELETE
USING (auth.uid() = user_id);

-- likes ポリシー
CREATE POLICY "Likes are viewable by everyone"
ON likes FOR SELECT
USING (true);

CREATE POLICY "Authenticated users can like"
ON likes FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove own likes"
ON likes FOR DELETE
USING (auth.uid() = user_id);

-- bookmarks ポリシー
CREATE POLICY "Users can view own bookmarks"
ON bookmarks FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own bookmarks"
ON bookmarks FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own bookmarks"
ON bookmarks FOR DELETE
USING (auth.uid() = user_id);

-- follows ポリシー
CREATE POLICY "Follows are viewable by everyone"
ON follows FOR SELECT
USING (true);

CREATE POLICY "Users can follow others"
ON follows FOR INSERT
WITH CHECK (auth.uid() = follower_id);

CREATE POLICY "Users can unfollow"
ON follows FOR DELETE
USING (auth.uid() = follower_id);

-- blocks ポリシー
CREATE POLICY "Users can view own blocks"
ON blocks FOR SELECT
USING (auth.uid() = blocker_id);

CREATE POLICY "Users can block others"
ON blocks FOR INSERT
WITH CHECK (auth.uid() = blocker_id);

CREATE POLICY "Users can unblock"
ON blocks FOR DELETE
USING (auth.uid() = blocker_id);

-- mutes ポリシー
CREATE POLICY "Users can view own mutes"
ON mutes FOR SELECT
USING (auth.uid() = muter_id);

CREATE POLICY "Users can mute others"
ON mutes FOR INSERT
WITH CHECK (auth.uid() = muter_id);

CREATE POLICY "Users can unmute"
ON mutes FOR DELETE
USING (auth.uid() = muter_id);

-- notifications ポリシー
CREATE POLICY "Users can view own notifications"
ON notifications FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "System can create notifications"
ON notifications FOR INSERT
WITH CHECK (true);

CREATE POLICY "Users can update own notifications"
ON notifications FOR UPDATE
USING (auth.uid() = user_id);

-- bonsai_shops ポリシー
CREATE POLICY "Shops are viewable by everyone"
ON bonsai_shops FOR SELECT
USING (true);

CREATE POLICY "Authenticated users can create shops"
ON bonsai_shops FOR INSERT
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Creators can update own shops"
ON bonsai_shops FOR UPDATE
USING (auth.uid() = created_by);

-- shop_genres ポリシー
CREATE POLICY "Shop genres are viewable by everyone"
ON shop_genres FOR SELECT
USING (true);

CREATE POLICY "Shop creators can manage genres"
ON shop_genres FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM bonsai_shops
    WHERE bonsai_shops.id = shop_genres.shop_id
    AND bonsai_shops.created_by = auth.uid()
  )
);

CREATE POLICY "Shop creators can delete genres"
ON shop_genres FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM bonsai_shops
    WHERE bonsai_shops.id = shop_genres.shop_id
    AND bonsai_shops.created_by = auth.uid()
  )
);

-- shop_reviews ポリシー
CREATE POLICY "Reviews are viewable by everyone"
ON shop_reviews FOR SELECT
USING (true);

CREATE POLICY "Authenticated users can create reviews"
ON shop_reviews FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own reviews"
ON shop_reviews FOR DELETE
USING (auth.uid() = user_id);

-- shop_review_images ポリシー
CREATE POLICY "Review images are viewable by everyone"
ON shop_review_images FOR SELECT
USING (true);

CREATE POLICY "Review authors can add images"
ON shop_review_images FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM shop_reviews
    WHERE shop_reviews.id = shop_review_images.review_id
    AND shop_reviews.user_id = auth.uid()
  )
);

CREATE POLICY "Review authors can delete images"
ON shop_review_images FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM shop_reviews
    WHERE shop_reviews.id = shop_review_images.review_id
    AND shop_reviews.user_id = auth.uid()
  )
);

-- events ポリシー
CREATE POLICY "Events are viewable by everyone"
ON events FOR SELECT
USING (true);

CREATE POLICY "Authenticated users can create events"
ON events FOR INSERT
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Creators can update own events"
ON events FOR UPDATE
USING (auth.uid() = created_by);

CREATE POLICY "Creators can delete own events"
ON events FOR DELETE
USING (auth.uid() = created_by);

-- reports ポリシー
CREATE POLICY "Users can view own reports"
ON reports FOR SELECT
USING (auth.uid() = reporter_id);

CREATE POLICY "Authenticated users can create reports"
ON reports FOR INSERT
WITH CHECK (auth.uid() = reporter_id);

-- admin_users ポリシー
CREATE POLICY "Admins can view admin list"
ON admin_users FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM admin_users au
    WHERE au.user_id = auth.uid()
  )
);

-- admin_logs ポリシー
CREATE POLICY "Admins can view logs"
ON admin_logs FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM admin_users au
    WHERE au.user_id = auth.uid()
  )
);

CREATE POLICY "Admins can create logs"
ON admin_logs FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM admin_users au
    WHERE au.user_id = auth.uid()
  )
);

-- ============================================
-- 007: マスターデータ投入
-- ============================================

-- 松柏類
INSERT INTO genres (name, category, sort_order) VALUES
('黒松', '松柏類', 1),
('赤松', '松柏類', 2),
('五葉松', '松柏類', 3),
('真柏', '松柏類', 4),
('杜松', '松柏類', 5),
('一位', '松柏類', 6),
('蝦夷松', '松柏類', 7),
('檜', '松柏類', 8),
('その他松柏類', '松柏類', 99);

-- 雑木類
INSERT INTO genres (name, category, sort_order) VALUES
('紅葉', '雑木類', 1),
('楓', '雑木類', 2),
('銀杏', '雑木類', 3),
('梅', '雑木類', 4),
('長寿梅', '雑木類', 5),
('桜', '雑木類', 6),
('欅', '雑木類', 7),
('楡', '雑木類', 8),
('椿', '雑木類', 9),
('皐月', '雑木類', 10),
('山もみじ', '雑木類', 11),
('姫りんご', '雑木類', 12),
('その他雑木類', '雑木類', 99);

-- 用品・道具
INSERT INTO genres (name, category, sort_order) VALUES
('剪定鋏', '用品・道具', 1),
('針金', '用品・道具', 2),
('ピンセット', '用品・道具', 3),
('ジン・シャリ道具', '用品・道具', 4),
('肥料', '用品・道具', 5),
('薬剤', '用品・道具', 6),
('用土', '用品・道具', 7),
('その他道具', '用品・道具', 99);

-- 鉢
INSERT INTO genres (name, category, sort_order) VALUES
('和鉢', '鉢', 1),
('中国鉢', '鉢', 2),
('洋鉢', '鉢', 3),
('手作り鉢', '鉢', 4),
('その他鉢', '鉢', 99);

-- 施設・イベント
INSERT INTO genres (name, category, sort_order) VALUES
('盆栽園', '施設・イベント', 1),
('展示会', '施設・イベント', 2),
('即売会', '施設・イベント', 3),
('講習会', '施設・イベント', 4),
('その他イベント', '施設・イベント', 99);

-- その他
INSERT INTO genres (name, category, sort_order) VALUES
('草もの', 'その他', 1),
('苔', 'その他', 2),
('水石', 'その他', 3),
('卓', 'その他', 4),
('飾り', 'その他', 5),
('その他', 'その他', 99);
