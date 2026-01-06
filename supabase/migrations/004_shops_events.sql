-- ============================================
-- 004: 盆栽園・イベント関連テーブル
-- ============================================

-- ============================================
-- 盆栽園テーブル
-- ============================================
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

-- ============================================
-- 盆栽園ジャンルテーブル
-- ============================================
CREATE TABLE shop_genres (
  shop_id UUID NOT NULL REFERENCES bonsai_shops(id) ON DELETE CASCADE,
  genre TEXT NOT NULL,
  PRIMARY KEY (shop_id, genre)
);

-- ============================================
-- 盆栽園レビューテーブル
-- ============================================
CREATE TABLE shop_reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id UUID NOT NULL REFERENCES bonsai_shops(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  content TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  -- 同じユーザーが同じ店舗に複数レビューできない
  CONSTRAINT shop_reviews_user_shop_unique UNIQUE (user_id, shop_id)
);

-- ============================================
-- レビュー画像テーブル
-- ============================================
CREATE TABLE shop_review_images (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  review_id UUID NOT NULL REFERENCES shop_reviews(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- イベントテーブル
-- ============================================
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
-- インデックス
-- ============================================
CREATE INDEX idx_bonsai_shops_location ON bonsai_shops(latitude, longitude);
CREATE INDEX idx_bonsai_shops_name ON bonsai_shops(name);
CREATE INDEX idx_shop_reviews_shop_id ON shop_reviews(shop_id);
CREATE INDEX idx_shop_reviews_user_id ON shop_reviews(user_id);
CREATE INDEX idx_events_start_date ON events(start_date);
CREATE INDEX idx_events_prefecture ON events(prefecture);
CREATE INDEX idx_events_end_date ON events(end_date);
