-- Optional seed data. backend/server.js initDatabase() creates a default
-- sysadmin automatically. This file adds extra demo distributors/shops.
-- Passwords below are bcrypt hashes for the literal string 'password'.

INSERT INTO users (username, employee_id, password_hash, role, province, region, area)
VALUES
  ('sysadmin', 'SYS-000001',
   '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
   'admin', NULL, NULL, NULL),
  ('sd1', 'SD-WES-COL-000001',
   '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
   'sales_distributor', 'Western', 'Colombo', 'Colombo 1-15'),
  ('sd2', 'SD-CEN-KAN-000001',
   '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
   'sales_distributor', 'Central', 'Kandy', 'Kandy City')
ON CONFLICT (username) DO NOTHING;

INSERT INTO shops (shop_id, shop_name, owner_mobile, qr_slug, rep_id, province, region, area)
VALUES
  ('SHOP001', 'Nugegoda Local Shop',  '0777000001', 'nugegoda-local-shop',
   (SELECT id FROM users WHERE username = 'sd1'),
   'Western', 'Colombo', 'Colombo 1-15'),
  ('SHOP002', 'Kandy Corner Store',   '0777000002', 'kandy-corner-store',
   (SELECT id FROM users WHERE username = 'sd1'),
   'Western', 'Colombo', 'Colombo 1-15'),
  ('SHOP003', 'Maharagama Mini Mart', '0777000003', 'maharagama-mini-mart',
   (SELECT id FROM users WHERE username = 'sd2'),
   'Central', 'Kandy', 'Kandy City')
ON CONFLICT (shop_id) DO NOTHING;

INSERT INTO campaigns (campaign_id, campaign_name, description, start_date, end_date, status)
VALUES
  ('CMP001', 'Nestle Q2 Spring Offer',  'Limited time spring promotion - enjoy exclusive vouchers',
   NOW(), NOW() + INTERVAL '90 days', 'active'),
  ('CMP002', 'Nescafé Summer Rewards',  'Summer campaign for beverage products',
   NOW(), NOW() + INTERVAL '60 days', 'active'),
  ('CMP003', 'Loyalty Month Special',   'Monthly loyalty rewards for returning customers',
   NOW(), NOW() + INTERVAL '30 days', 'active')
ON CONFLICT (campaign_id) DO NOTHING;
