-- Discounts table
CREATE TABLE IF NOT EXISTS discount.discounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    discount_type VARCHAR(20) NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
    discount_value DECIMAL(10, 2) NOT NULL CHECK (discount_value > 0),
    min_booking_amount DECIMAL(10, 2) DEFAULT 0 CHECK (min_booking_amount >= 0),
    max_discount_amount DECIMAL(10, 2),
    valid_from TIMESTAMP WITH TIME ZONE NOT NULL,
    valid_until TIMESTAMP WITH TIME ZONE NOT NULL,
    usage_limit INTEGER,
    usage_count INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster code lookups
CREATE INDEX IF NOT EXISTS idx_discounts_code ON discount.discounts(code);
CREATE INDEX IF NOT EXISTS idx_discounts_active ON discount.discounts(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_discounts_validity ON discount.discounts(valid_from, valid_until);
