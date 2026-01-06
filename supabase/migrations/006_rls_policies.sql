-- ============================================
-- 006: Row Level Security (RLS) ポリシー
-- ============================================

-- ============================================
-- RLS有効化
-- ============================================
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

-- ============================================
-- users ポリシー
-- ============================================
-- 誰でも公開ユーザーのプロフィールを閲覧可能
CREATE POLICY "Public profiles are viewable by everyone"
ON users FOR SELECT
USING (is_public = true OR auth.uid() = id);

-- 自分のプロフィールのみ更新可能
CREATE POLICY "Users can update own profile"
ON users FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- 新規ユーザー登録（auth.users連携）
CREATE POLICY "Users can insert own profile"
ON users FOR INSERT
WITH CHECK (auth.uid() = id);

-- ============================================
-- posts ポリシー
-- ============================================
-- 公開ユーザーの投稿は誰でも閲覧可能
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

-- 自分の投稿のみ作成可能
CREATE POLICY "Users can create own posts"
ON posts FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- 自分の投稿のみ削除可能
CREATE POLICY "Users can delete own posts"
ON posts FOR DELETE
USING (auth.uid() = user_id);

-- ============================================
-- post_media ポリシー
-- ============================================
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

-- ============================================
-- post_genres ポリシー
-- ============================================
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

-- ============================================
-- genres ポリシー（マスターデータ）
-- ============================================
CREATE POLICY "Genres are viewable by everyone"
ON genres FOR SELECT
USING (true);

-- ============================================
-- comments ポリシー
-- ============================================
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

-- ============================================
-- likes ポリシー
-- ============================================
CREATE POLICY "Likes are viewable by everyone"
ON likes FOR SELECT
USING (true);

CREATE POLICY "Authenticated users can like"
ON likes FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove own likes"
ON likes FOR DELETE
USING (auth.uid() = user_id);

-- ============================================
-- bookmarks ポリシー
-- ============================================
CREATE POLICY "Users can view own bookmarks"
ON bookmarks FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own bookmarks"
ON bookmarks FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own bookmarks"
ON bookmarks FOR DELETE
USING (auth.uid() = user_id);

-- ============================================
-- follows ポリシー
-- ============================================
CREATE POLICY "Follows are viewable by everyone"
ON follows FOR SELECT
USING (true);

CREATE POLICY "Users can follow others"
ON follows FOR INSERT
WITH CHECK (auth.uid() = follower_id);

CREATE POLICY "Users can unfollow"
ON follows FOR DELETE
USING (auth.uid() = follower_id);

-- ============================================
-- blocks ポリシー
-- ============================================
CREATE POLICY "Users can view own blocks"
ON blocks FOR SELECT
USING (auth.uid() = blocker_id);

CREATE POLICY "Users can block others"
ON blocks FOR INSERT
WITH CHECK (auth.uid() = blocker_id);

CREATE POLICY "Users can unblock"
ON blocks FOR DELETE
USING (auth.uid() = blocker_id);

-- ============================================
-- mutes ポリシー
-- ============================================
CREATE POLICY "Users can view own mutes"
ON mutes FOR SELECT
USING (auth.uid() = muter_id);

CREATE POLICY "Users can mute others"
ON mutes FOR INSERT
WITH CHECK (auth.uid() = muter_id);

CREATE POLICY "Users can unmute"
ON mutes FOR DELETE
USING (auth.uid() = muter_id);

-- ============================================
-- notifications ポリシー
-- ============================================
CREATE POLICY "Users can view own notifications"
ON notifications FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "System can create notifications"
ON notifications FOR INSERT
WITH CHECK (true);

CREATE POLICY "Users can update own notifications"
ON notifications FOR UPDATE
USING (auth.uid() = user_id);

-- ============================================
-- bonsai_shops ポリシー
-- ============================================
CREATE POLICY "Shops are viewable by everyone"
ON bonsai_shops FOR SELECT
USING (true);

CREATE POLICY "Authenticated users can create shops"
ON bonsai_shops FOR INSERT
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Creators can update own shops"
ON bonsai_shops FOR UPDATE
USING (auth.uid() = created_by);

-- ============================================
-- shop_genres ポリシー
-- ============================================
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

-- ============================================
-- shop_reviews ポリシー
-- ============================================
CREATE POLICY "Reviews are viewable by everyone"
ON shop_reviews FOR SELECT
USING (true);

CREATE POLICY "Authenticated users can create reviews"
ON shop_reviews FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own reviews"
ON shop_reviews FOR DELETE
USING (auth.uid() = user_id);

-- ============================================
-- shop_review_images ポリシー
-- ============================================
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

-- ============================================
-- events ポリシー
-- ============================================
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

-- ============================================
-- reports ポリシー
-- ============================================
CREATE POLICY "Users can view own reports"
ON reports FOR SELECT
USING (auth.uid() = reporter_id);

CREATE POLICY "Authenticated users can create reports"
ON reports FOR INSERT
WITH CHECK (auth.uid() = reporter_id);

-- ============================================
-- admin_users ポリシー
-- ============================================
CREATE POLICY "Admins can view admin list"
ON admin_users FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM admin_users au
    WHERE au.user_id = auth.uid()
  )
);

-- ============================================
-- admin_logs ポリシー
-- ============================================
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
