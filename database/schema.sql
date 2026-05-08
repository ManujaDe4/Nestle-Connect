-- Nestlé Connect — canonical schema.
-- Matches what backend/server.js initDatabase() creates at runtime.

DROP TABLE IF EXISTS sms_logs CASCADE;
DROP TABLE IF EXISTS activity_logs CASCADE;
DROP TABLE IF EXISTS redemptions CASCADE;
DROP TABLE IF EXISTS vouchers CASCADE;
DROP TABLE IF EXISTS shops CASCADE;
DROP TABLE IF EXISTS campaigns CASCADE;
DROP TABLE IF EXISTS users CASCADE;

CREATE TABLE users (
    id              SERIAL PRIMARY KEY,
    username        VARCHAR(50) UNIQUE NOT NULL,
    employee_id     VARCHAR(50) UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    role            VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'sales_distributor')),
    province        VARCHAR(100),
    region          VARCHAR(100),
    area            VARCHAR(100),
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE campaigns (
    id               SERIAL PRIMARY KEY,
    campaign_id      VARCHAR(20) UNIQUE NOT NULL,
    campaign_name    VARCHAR(100) NOT NULL,
    description      TEXT,
    start_date       TIMESTAMP NOT NULL,
    end_date         TIMESTAMP NOT NULL,
    objective        VARCHAR(50),
    target_audience  VARCHAR(50),
    voucher_value    VARCHAR(50),
    voucher_limit    INTEGER,
    budget           NUMERIC(10,2),
    banner_url       VARCHAR(255),
    status           VARCHAR(20) DEFAULT 'active'
                     CHECK (status IN ('draft', 'active', 'expired', 'disabled')),
    created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE shops (
    id                  SERIAL PRIMARY KEY,
    shop_id             VARCHAR(20) UNIQUE NOT NULL,
    shop_name           VARCHAR(100) NOT NULL,
    owner_mobile        VARCHAR(15) NOT NULL,
    nic_number          VARCHAR(20),
    qr_slug             VARCHAR(50) UNIQUE NOT NULL,
    rep_id              INTEGER REFERENCES users(id),
    created_by_rep_id   INTEGER REFERENCES users(id),
    qr_identifier       VARCHAR(100) UNIQUE,
    province            VARCHAR(100),
    region              VARCHAR(100),
    area                VARCHAR(100),
    br_number           VARCHAR(100),
    address             TEXT,
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE vouchers (
    id              SERIAL PRIMARY KEY,
    claim_id        VARCHAR(30) UNIQUE NOT NULL,
    campaign_id     VARCHAR(20) NOT NULL REFERENCES campaigns(campaign_id) ON DELETE CASCADE,
    ad_id           VARCHAR(20) NOT NULL,
    platform        VARCHAR(20),
    customer_mobile VARCHAR(15) NOT NULL,
    voucher_code    VARCHAR(20) NOT NULL,
    claim_status    VARCHAR(20) DEFAULT 'claimed'
                    CHECK (claim_status IN ('claimed', 'redeemed', 'expired', 'disabled')),
    expiry_status   VARCHAR(20) DEFAULT 'active'
                    CHECK (expiry_status IN ('active', 'expired')),
    sms_sent        BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE redemptions (
    id              SERIAL PRIMARY KEY,
    redemption_id   VARCHAR(30) UNIQUE NOT NULL,
    claim_id        VARCHAR(30) NOT NULL REFERENCES vouchers(claim_id) ON DELETE CASCADE,
    shop_id         VARCHAR(20) NOT NULL REFERENCES shops(shop_id) ON DELETE CASCADE,
    otp_code        VARCHAR(10) NOT NULL,
    otp_status      VARCHAR(20) DEFAULT 'pending',
    final_status    VARCHAR(20) DEFAULT 'pending',
    otp_expires_at  TIMESTAMP DEFAULT (NOW() + INTERVAL '5 minutes'),
    otp_attempts    INTEGER DEFAULT 0,
    redeemed_at     TIMESTAMP,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE activity_logs (
    id          SERIAL PRIMARY KEY,
    user_id     INTEGER REFERENCES users(id),
    shop_id     INTEGER REFERENCES shops(id),
    action      VARCHAR(50) NOT NULL,
    detail      TEXT,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE sms_logs (
    id                SERIAL PRIMARY KEY,
    recipient_mobile  VARCHAR(15) NOT NULL,
    message           TEXT NOT NULL,
    sms_type          VARCHAR(30),
    related_id        VARCHAR(50),
    status            VARCHAR(20) DEFAULT 'sent',
    created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
