require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { query } = require('../src/lib/db');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

async function seed() {
  console.log('Seeding database...');

  const istanbulId = uuidv4();
  const ankaraId = uuidv4();

  await query(`
    INSERT INTO cities (id, name, country, slug, is_active) VALUES
    ($1, 'Istanbul', 'Turkey', 'istanbul', true),
    ($2, 'Ankara', 'Turkey', 'ankara', true)
    ON CONFLICT (slug) DO NOTHING
  `, [istanbulId, ankaraId]);

  const ownerHash = await bcrypt.hash('password123', 12);
  const customerHash = await bcrypt.hash('password123', 12);

  const ownerId = uuidv4();
  const customerId = uuidv4();

  await query(`
    INSERT INTO users (id, email, password_hash, full_name, role, city_id, is_verified) VALUES
    ($1, 'owner@demo.com', $2, 'Demo Owner', 'business_owner', $3, true),
    ($4, 'customer@demo.com', $5, 'Demo Customer', 'customer', $3, true)
    ON CONFLICT (email) DO NOTHING
  `, [ownerId, ownerHash, istanbulId, customerId, customerHash]);

  const subId = uuidv4();
  await query(`
    INSERT INTO subscriptions (id, plan, price_monthly, max_challenges, max_staff, status, current_period_end)
    VALUES ($1, 'pro', 79.00, 999, 10, 'active', NOW() + INTERVAL '30 days')
    ON CONFLICT DO NOTHING
  `, [subId]);

  const businessId = uuidv4();
  await query(`
    INSERT INTO businesses (id, name, slug, description, city_id, category, address, owner_id, subscription_id, is_active)
    VALUES ($1, 'Karaköy Café', 'karakoy-cafe', 'Specialty coffee in the heart of Karaköy', $2, 'cafe', 'Kemeraltı Cd. No:12, Karaköy, Istanbul', $3, $4, true)
    ON CONFLICT (slug) DO NOTHING
  `, [businessId, istanbulId, ownerId, subId]);

  await query(`UPDATE subscriptions SET business_id = $1 WHERE id = $2`, [businessId, subId]);

  const challengeId = uuidv4();
  await query(`
    INSERT INTO challenges (id, business_id, title, description, type, reward_title, reward_description, reward_type, points_value, is_active)
    VALUES ($1, $2, 'Leave us a Google Review', 'Share your experience on Google Maps', 'review', 'Free Pastry', 'Any pastry from our showcase', 'free_item', 100, true)
    ON CONFLICT DO NOTHING
  `, [challengeId, businessId]);

  await query(`
    INSERT INTO staff (business_id, name, role, pin_code, is_active)
    VALUES ($1, 'Ali Yılmaz', 'manager', '1234', true),
           ($1, 'Selin Koç', 'cashier', '5678', true)
    ON CONFLICT DO NOTHING
  `, [businessId]);

  console.log('Seed complete.');
  console.log('  Owner login:    owner@demo.com / password123');
  console.log('  Customer login: customer@demo.com / password123');
  console.log('  Staff PINs:     1234 (manager), 5678 (cashier)');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
