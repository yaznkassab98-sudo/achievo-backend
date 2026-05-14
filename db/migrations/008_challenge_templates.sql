CREATE TABLE IF NOT EXISTS challenge_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(120) NOT NULL,
  description TEXT,
  reward_title VARCHAR(120) NOT NULL,
  reward_description TEXT,
  reward_type VARCHAR(30) NOT NULL DEFAULT 'free_item',
  discount_percent INTEGER,
  points_value INTEGER NOT NULL DEFAULT 0,
  icon VARCHAR(10) DEFAULT '🎯',
  category VARCHAR(50),
  tags TEXT[],
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_challenge_templates_active ON challenge_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_challenge_templates_category ON challenge_templates(category);

INSERT INTO challenge_templates (title, description, reward_title, reward_description, reward_type, points_value, icon, category, tags, sort_order) VALUES
('Visit 5 times', 'Come back 5 times and earn a reward.', 'Free coffee', 'One free coffee of your choice.', 'free_item', 100, '☕', 'cafe', ARRAY['loyalty','repeat'], 1),
('Lunch 5x Challenge', 'Eat lunch with us 5 times this month.', 'Free lunch', 'A complimentary main dish on us.', 'free_item', 150, '🍽️', 'restaurant', ARRAY['lunch','repeat'], 2),
('Try 3 menu items', 'Try any 3 different items on our menu.', '15% off your next visit', NULL, 'discount', 80, '🧪', 'restaurant', ARRAY['discovery','menu'], 3),
('Bring a friend', 'Bring a friend who is new to us.', 'Free dessert for two', NULL, 'free_item', 120, '👥', NULL, ARRAY['referral','social'], 4),
('Morning regular', 'Visit before 10am on 5 different days.', 'Upgrade on us', 'Free size upgrade or add-on.', 'free_item', 90, '🌅', 'cafe', ARRAY['morning','regular'], 5),
('Weekend warrior', 'Visit on 3 consecutive weekends.', '20% off your next order', NULL, 'discount', 110, '🎉', NULL, ARRAY['weekend','loyalty'], 6),
('Review & earn', 'Leave us a Google review and show us.', 'Free item', 'Pick any item under $10 on us.', 'free_item', 200, '⭐', NULL, ARRAY['review','social'], 7),
('Fitness check-in', 'Check in at the gym 10 times this month.', 'Free class pass', 'One complimentary group class.', 'free_item', 180, '💪', 'gym', ARRAY['fitness','monthly'], 8),
('Spa day reward', 'Book 3 treatments in a month.', '25% off next treatment', NULL, 'discount', 130, '💆', 'salon', ARRAY['wellness','repeat'], 9),
('Hotel loyalty', 'Stay with us 3 nights total.', 'Free room upgrade', 'Complimentary room upgrade on next stay.', 'upgrade', 250, '🏨', 'hotel', ARRAY['stay','loyalty'], 10)
ON CONFLICT DO NOTHING;
