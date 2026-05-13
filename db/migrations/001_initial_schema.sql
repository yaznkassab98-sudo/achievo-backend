-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ENUMS
CREATE TYPE user_role AS ENUM ('customer', 'business_owner', 'admin');
CREATE TYPE business_category AS ENUM ('restaurant', 'salon', 'hotel', 'cafe', 'clinic', 'gym', 'retail', 'other');
CREATE TYPE challenge_type AS ENUM ('review', 'visit', 'referral', 'purchase', 'social', 'custom');
CREATE TYPE reward_type AS ENUM ('free_item', 'discount', 'experience', 'points');
CREATE TYPE completion_status AS ENUM ('pending', 'confirmed', 'rejected', 'claimed');
CREATE TYPE reward_status AS ENUM ('available', 'used', 'expired');
CREATE TYPE subscription_plan AS ENUM ('free', 'starter', 'pro', 'agency');
CREATE TYPE subscription_status AS ENUM ('active', 'cancelled', 'past_due', 'trialing');
CREATE TYPE staff_role AS ENUM ('manager', 'cashier', 'receptionist');

-- CITIES
CREATE TABLE cities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  country VARCHAR(100) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- USERS
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  avatar_url VARCHAR(500),
  phone VARCHAR(30),
  role user_role NOT NULL DEFAULT 'customer',
  city_id UUID REFERENCES cities(id) ON DELETE SET NULL,
  total_points INTEGER DEFAULT 0,
  is_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- SUBSCRIPTIONS (created before businesses — businesses reference it)
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID, -- FK added after businesses table
  plan subscription_plan NOT NULL DEFAULT 'free',
  price_monthly DECIMAL(10,2) DEFAULT 0,
  max_challenges INTEGER DEFAULT 1,
  max_staff INTEGER DEFAULT 1,
  status subscription_status NOT NULL DEFAULT 'trialing',
  trial_ends_at TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  stripe_sub_id VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- BUSINESSES
CREATE TABLE businesses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  city_id UUID NOT NULL REFERENCES cities(id) ON DELETE RESTRICT,
  category business_category NOT NULL DEFAULT 'other',
  address TEXT,
  logo_url VARCHAR(500),
  cover_url VARCHAR(500),
  phone VARCHAR(30),
  website VARCHAR(255),
  google_maps_url VARCHAR(500),
  qr_code_url VARCHAR(500),
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add FK back to subscriptions
ALTER TABLE subscriptions ADD CONSTRAINT fk_subscription_business
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;

-- CHALLENGES
CREATE TABLE challenges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  type challenge_type NOT NULL DEFAULT 'custom',
  reward_title VARCHAR(255) NOT NULL,
  reward_description TEXT,
  reward_type reward_type NOT NULL DEFAULT 'free_item',
  discount_percent INTEGER CHECK (discount_percent BETWEEN 1 AND 100),
  points_value INTEGER DEFAULT 0,
  max_completions INTEGER,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- STAFF
CREATE TABLE staff (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  name VARCHAR(255) NOT NULL,
  role staff_role NOT NULL DEFAULT 'cashier',
  pin_code VARCHAR(6) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- COMPLETIONS
CREATE TABLE completions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  challenge_id UUID NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  confirmed_by UUID REFERENCES staff(id) ON DELETE SET NULL,
  status completion_status NOT NULL DEFAULT 'pending',
  points_earned INTEGER DEFAULT 0,
  reward_claimed_at TIMESTAMPTZ,
  notes TEXT,
  completed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- SAVED_REWARDS (customer wallet)
CREATE TABLE saved_rewards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  completion_id UUID NOT NULL REFERENCES completions(id) ON DELETE CASCADE,
  challenge_id UUID NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  reward_title VARCHAR(255) NOT NULL,
  status reward_status NOT NULL DEFAULT 'available',
  expires_at TIMESTAMPTZ,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- INDEXES for common queries
CREATE INDEX idx_businesses_city ON businesses(city_id);
CREATE INDEX idx_businesses_owner ON businesses(owner_id);
CREATE INDEX idx_businesses_slug ON businesses(slug);
CREATE INDEX idx_challenges_business ON challenges(business_id);
CREATE INDEX idx_challenges_active ON challenges(business_id, is_active);
CREATE INDEX idx_completions_user ON completions(user_id);
CREATE INDEX idx_completions_business ON completions(business_id);
CREATE INDEX idx_completions_status ON completions(business_id, status);
CREATE INDEX idx_saved_rewards_user ON saved_rewards(user_id);
CREATE INDEX idx_staff_business ON staff(business_id);
CREATE INDEX idx_users_email ON users(email);
