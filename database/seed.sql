-- Passwords are hashed with bcrypt, 'password' for all
INSERT INTO users (username, password_hash, role)
VALUES
('admin', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin'), -- password: password
('rep1', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'rep'),
('rep2', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'rep');

INSERT INTO shops (shop_id, shop_name, owner_mobile, qr_slug, rep_id)
VALUES
('SHOP001', 'Nugegoda Local Shop', '0777000001', 'nugegoda-local-shop', 2), -- rep1
('SHOP002', 'Kandy Corner Store', '0777000002', 'kandy-corner-store', 2),
('SHOP003', 'Maharagama Mini Mart', '0777000003', 'maharagama-mini-mart', 3);

-- Add campaigns
INSERT INTO campaigns (campaign_id, campaign_name, description, start_date, end_date, status)
VALUES
('CMP001', 'Nestle Q2 Spring Offer', 'Limited time spring promotion - enjoy exclusive vouchers', NOW(), NOW() + INTERVAL '90 days', 'active'),
('CMP002', 'Nescafé Summer Rewards', 'Summer campaign for beverage products', NOW(), NOW() + INTERVAL '60 days', 'active'),
('CMP003', 'Loyalty Month Special', 'Monthly loyalty rewards for returning customers', NOW(), NOW() + INTERVAL '30 days', 'active');