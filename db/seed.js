require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { query } = require('../src/lib/db');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

async function seed() {
  console.log('Seeding database...');

  await query(`
    INSERT INTO cities (id, name, country, slug, is_active) VALUES
    ($1, 'Istanbul', 'Turkey', 'istanbul', true),
    ($2, 'Ankara', 'Turkey', 'ankara', true)
    ON CONFLICT (slug) DO NOTHING
  `, [uuidv4(), uuidv4()]);

  const { rows: cityRows } = await query(`SELECT id, slug FROM cities WHERE slug IN ('istanbul', 'ankara')`);
  const istanbulId = cityRows.find(c => c.slug === 'istanbul').id;

  const ownerHash = await bcrypt.hash('password123', 12);
  const customerHash = await bcrypt.hash('password123', 12);

  await query(`
    INSERT INTO users (id, email, password_hash, full_name, role, city_id, is_verified) VALUES
    ($1, 'owner@demo.com', $2, 'Demo Owner', 'business_owner', $3, true),
    ($4, 'customer@demo.com', $5, 'Demo Customer', 'customer', $3, true)
    ON CONFLICT (email) DO NOTHING
  `, [uuidv4(), ownerHash, istanbulId, uuidv4(), customerHash]);

  const { rows: [ownerRow] } = await query(`SELECT id FROM users WHERE email = 'owner@demo.com'`);
  const ownerId = ownerRow.id;

  const subId = uuidv4();
  await query(`
    INSERT INTO subscriptions (id, plan, price_monthly, max_challenges, max_staff, status, current_period_end)
    VALUES ($1, 'pro', 79.00, 999, 10, 'active', NOW() + INTERVAL '30 days')
    ON CONFLICT DO NOTHING
  `, [subId]);

  await query(`
    INSERT INTO businesses (id, name, slug, description, city_id, category, address, owner_id, is_active)
    VALUES ($1, 'Karaköy Café', 'karakoy-cafe', 'Specialty coffee in the heart of Karaköy', $2, 'cafe', 'Kemeraltı Cd. No:12, Karaköy, Istanbul', $3, true)
    ON CONFLICT (slug) DO NOTHING
  `, [uuidv4(), istanbulId, ownerId]);

  const { rows: [biz] } = await query(`SELECT id FROM businesses WHERE slug = 'karakoy-cafe'`);
  const businessId = biz.id;

  await query(`
    UPDATE subscriptions SET business_id = $1 WHERE id = $2
  `, [businessId, subId]);

  await query(`
    UPDATE businesses SET subscription_id = $1 WHERE id = $2
  `, [subId, businessId]);

  await query(`
    INSERT INTO challenges (id, business_id, title, description, type, reward_title, reward_description, reward_type, points_value, is_active)
    VALUES ($1, $2, 'Leave us a Google Review', 'Share your experience on Google Maps', 'review', 'Free Pastry', 'Any pastry from our showcase', 'free_item', 100, true)
    ON CONFLICT DO NOTHING
  `, [uuidv4(), businessId]);

  const { rows: staffRows } = await query(`SELECT id FROM staff WHERE business_id = $1`, [businessId]);
  if (staffRows.length === 0) {
    await query(`
      INSERT INTO staff (id, business_id, name, role, pin_code, is_active)
      VALUES ($1, $2, 'Ali Yılmaz', 'manager', '1234', true),
             ($3, $2, 'Selin Koç', 'cashier', '5678', true)
    `, [uuidv4(), businessId, uuidv4()]);
  }

  console.log('Seed complete.');
  console.log('  Owner login:    owner@demo.com / password123');
  console.log('  Customer login: customer@demo.com / password123');
  console.log('  Staff PINs:     1234 (manager), 5678 (cashier)');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err.message, err.detail || '', err.hint || '');
  process.exit(1);
});
