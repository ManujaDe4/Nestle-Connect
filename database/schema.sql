DROP TABLE IF EXISTS redemptions;
DROP TABLE IF EXISTS vouchers;
DROP TABLE IF EXISTS shops;
DROP TABLE IF EXISTS users;

CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'rep')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE shops (
    id SERIAL PRIMARY KEY,
    shop_id VARCHAR(20) UNIQUE NOT NULL,
    shop_name VARCHAR(100) NOT NULL,
    owner_mobile VARCHAR(15) NOT NULL,
    qr_slug VARCHAR(50) UNIQUE NOT NULL,
    rep_id INTEGER REFERENCES users(id),
    created_by_rep_id INTEGER REFERENCES users(id),
    qr_identifier VARCHAR(100) UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE activity_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    shop_id INTEGER REFERENCES shops(id),
    action VARCHAR(50) NOT NULL,
    detail TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE vouchers (
    id SERIAL PRIMARY KEY,
    claim_id VARCHAR(30) UNIQUE NOT NULL,
    campaign_id VARCHAR(20) NOT NULL,
    ad_id VARCHAR(20) NOT NULL,
    customer_mobile VARCHAR(15) NOT NULL,
    voucher_code VARCHAR(10) NOT NULL,
    claim_status VARCHAR(20) DEFAULT 'claimed',
    sms_sent BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE redemptions (
    id SERIAL PRIMARY KEY,
    redemption_id VARCHAR(30) UNIQUE NOT NULL,
    claim_id VARCHAR(30) NOT NULL,
    shop_id VARCHAR(20) NOT NULL,
    otp_code VARCHAR(10) NOT NULL,
    otp_status VARCHAR(20) DEFAULT 'pending',
    final_status VARCHAR(20) DEFAULT 'pending',
    redeemed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_claim
        FOREIGN KEY(claim_id)
        REFERENCES vouchers(claim_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_shop
        FOREIGN KEY(shop_id)
        REFERENCES shops(shop_id)
        ON DELETE CASCADE
);