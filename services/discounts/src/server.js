import { service, wrap, authenticate, failure, uuid } from '../../common/http.js';

const { app, pool, start } = service('discounts');

// Get all active discounts
app.get('/api/discounts', wrap(async (req, res) => {
    const now = new Date().toISOString();
    const { rows } = await pool.query(
        `SELECT id, code, description, discount_type, discount_value, 
                min_booking_amount, max_discount_amount, valid_from, valid_until,
                usage_limit, usage_count, is_active
         FROM discount.discounts 
         WHERE is_active = true 
         AND valid_from <= $1 
         AND valid_until >= $2
         ORDER BY created_at DESC`,
        [now, now]
    );
    res.json(rows.map(row => ({
        id: row.id,
        code: row.code,
        description: row.description,
        discountType: row.discount_type,
        discountValue: Number(row.discount_value),
        minBookingAmount: Number(row.min_booking_amount),
        maxDiscountAmount: row.max_discount_amount ? Number(row.max_discount_amount) : null,
        validFrom: row.valid_from,
        validUntil: row.valid_until,
        usageLimit: row.usage_limit,
        usageCount: row.usage_count,
        isActive: row.is_active
    })));
}));

// Get specific discount by ID
app.get('/api/discounts/:id', wrap(async (req, res) => {
    if (!uuid(req.params.id)) throw failure(404, 'Discount not found.');
    
    const { rows } = await pool.query(
        'SELECT * FROM discount.discounts WHERE id = $1',
        [req.params.id]
    );
    
    if (rows.length === 0) throw failure(404, 'Discount not found.');
    
    const row = rows[0];
    res.json({
        id: row.id,
        code: row.code,
        description: row.description,
        discountType: row.discount_type,
        discountValue: Number(row.discount_value),
        minBookingAmount: Number(row.min_booking_amount),
        maxDiscountAmount: row.max_discount_amount ? Number(row.max_discount_amount) : null,
        validFrom: row.valid_from,
        validUntil: row.valid_until,
        usageLimit: row.usage_limit,
        usageCount: row.usage_count,
        isActive: row.is_active,
        createdAt: row.created_at,
        updatedAt: row.updated_at
    });
}));

// Validate discount code
app.post('/api/discounts/validate', wrap(async (req, res) => {
    const { code, bookingAmount } = req.body;
    
    if (!code || !bookingAmount) {
        throw failure(400, 'Code and booking amount are required.');
    }
    
    if (typeof bookingAmount !== 'number' || bookingAmount <= 0) {
        throw failure(400, 'Invalid booking amount.');
    }
    
    const now = new Date().toISOString();
    const { rows } = await pool.query(
        `SELECT * FROM discount.discounts 
         WHERE code = $1 
         AND is_active = true 
         AND valid_from <= $2 
         AND valid_until >= $3`,
        [code, now, now]
    );
    
    if (rows.length === 0) {
        return res.json({ valid: false, reason: 'Invalid or expired discount code.' });
    }
    
    const discount = rows[0];
    
    // Check usage limit
    if (discount.usage_limit && discount.usage_count >= discount.usage_limit) {
        return res.json({ valid: false, reason: 'Discount code has reached its usage limit.' });
    }
    
    // Check minimum booking amount
    if (bookingAmount < Number(discount.min_booking_amount)) {
        return res.json({ 
            valid: false, 
            reason: `Minimum booking amount of ${discount.min_booking_amount} required.` 
        });
    }
    
    // Calculate discount
    let discountAmount;
    if (discount.discount_type === 'percentage') {
        discountAmount = bookingAmount * (Number(discount.discount_value) / 100);
    } else {
        discountAmount = Number(discount.discount_value);
    }
    
    // Apply max discount limit if set
    if (discount.max_discount_amount && discountAmount > Number(discount.max_discount_amount)) {
        discountAmount = Number(discount.max_discount_amount);
    }
    
    // Ensure discount doesn't exceed booking amount
    discountAmount = Math.min(discountAmount, bookingAmount);
    
    res.json({
        valid: true,
        discountId: discount.id,
        code: discount.code,
        discountType: discount.discount_type,
        discountValue: Number(discount.discount_value),
        discountAmount: Math.round(discountAmount * 100) / 100,
        finalAmount: Math.round((bookingAmount - discountAmount) * 100) / 100
    });
}));

// Create discount (admin only)
app.post('/api/discounts', authenticate(), wrap(async (req, res) => {
    const { 
        code, 
        description, 
        discountType, 
        discountValue, 
        minBookingAmount = 0, 
        maxDiscountAmount,
        validFrom, 
        validUntil, 
        usageLimit 
    } = req.body;
    
    if (!code || !discountType || !discountValue || !validFrom || !validUntil) {
        throw failure(400, 'Missing required fields.');
    }
    
    if (!['percentage', 'fixed'].includes(discountType)) {
        throw failure(400, 'Invalid discount type. Must be "percentage" or "fixed".');
    }
    
    if (discountValue <= 0) {
        throw failure(400, 'Discount value must be greater than 0.');
    }
    
    if (discountType === 'percentage' && discountValue > 100) {
        throw failure(400, 'Percentage discount cannot exceed 100%.');
    }
    
    const { rows } = await pool.query(
        `INSERT INTO discount.discounts 
         (code, description, discount_type, discount_value, min_booking_amount, 
          max_discount_amount, valid_from, valid_until, usage_limit)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [code, description, discountType, discountValue, minBookingAmount, 
         maxDiscountAmount, validFrom, validUntil, usageLimit]
    );
    
    res.status(201).json({
        id: rows[0].id,
        code: rows[0].code,
        description: rows[0].description,
        discountType: rows[0].discount_type,
        discountValue: Number(rows[0].discount_value),
        minBookingAmount: Number(rows[0].min_booking_amount),
        maxDiscountAmount: rows[0].max_discount_amount ? Number(rows[0].max_discount_amount) : null,
        validFrom: rows[0].valid_from,
        validUntil: rows[0].valid_until,
        usageLimit: rows[0].usage_limit,
        usageCount: rows[0].usage_count,
        isActive: rows[0].is_active
    });
}));

// Update discount (admin only)
app.put('/api/discounts/:id', authenticate(), wrap(async (req, res) => {
    if (!uuid(req.params.id)) throw failure(404, 'Discount not found.');
    
    const { 
        description, 
        discountType, 
        discountValue, 
        minBookingAmount, 
        maxDiscountAmount,
        validFrom, 
        validUntil, 
        usageLimit,
        isActive 
    } = req.body;
    
    const updates = [];
    const values = [];
    let paramCount = 1;
    
    if (description !== undefined) {
        updates.push(`description = $${paramCount++}`);
        values.push(description);
    }
    if (discountType !== undefined) {
        if (!['percentage', 'fixed'].includes(discountType)) {
            throw failure(400, 'Invalid discount type.');
        }
        updates.push(`discount_type = $${paramCount++}`);
        values.push(discountType);
    }
    if (discountValue !== undefined) {
        if (discountValue <= 0) throw failure(400, 'Discount value must be greater than 0.');
        if (discountType === 'percentage' && discountValue > 100) {
            throw failure(400, 'Percentage discount cannot exceed 100%.');
        }
        updates.push(`discount_value = $${paramCount++}`);
        values.push(discountValue);
    }
    if (minBookingAmount !== undefined) {
        updates.push(`min_booking_amount = $${paramCount++}`);
        values.push(minBookingAmount);
    }
    if (maxDiscountAmount !== undefined) {
        updates.push(`max_discount_amount = $${paramCount++}`);
        values.push(maxDiscountAmount);
    }
    if (validFrom !== undefined) {
        updates.push(`valid_from = $${paramCount++}`);
        values.push(validFrom);
    }
    if (validUntil !== undefined) {
        updates.push(`valid_until = $${paramCount++}`);
        values.push(validUntil);
    }
    if (usageLimit !== undefined) {
        updates.push(`usage_limit = $${paramCount++}`);
        values.push(usageLimit);
    }
    if (isActive !== undefined) {
        updates.push(`is_active = $${paramCount++}`);
        values.push(isActive);
    }
    
    if (updates.length === 0) {
        throw failure(400, 'No fields to update.');
    }
    
    updates.push(`updated_at = NOW()`);
    values.push(req.params.id);
    
    const { rows } = await pool.query(
        `UPDATE discount.discounts SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
        values
    );
    
    if (rows.length === 0) throw failure(404, 'Discount not found.');
    
    res.json({
        id: rows[0].id,
        code: rows[0].code,
        description: rows[0].description,
        discountType: rows[0].discount_type,
        discountValue: Number(rows[0].discount_value),
        minBookingAmount: Number(rows[0].min_booking_amount),
        maxDiscountAmount: rows[0].max_discount_amount ? Number(rows[0].max_discount_amount) : null,
        validFrom: rows[0].valid_from,
        validUntil: rows[0].valid_until,
        usageLimit: rows[0].usage_limit,
        usageCount: rows[0].usage_count,
        isActive: rows[0].is_active
    });
}));

// Delete discount (admin only)
app.delete('/api/discounts/:id', authenticate(), wrap(async (req, res) => {
    if (!uuid(req.params.id)) throw failure(404, 'Discount not found.');
    
    const { rows } = await pool.query(
        'DELETE FROM discount.discounts WHERE id = $1 RETURNING id',
        [req.params.id]
    );
    
    if (rows.length === 0) throw failure(404, 'Discount not found.');
    
    res.status(204).send();
}));

// Increment usage count (internal endpoint)
app.post('/internal/discounts/:id/use', wrap(async (req, res) => {
    if (!uuid(req.params.id)) throw failure(404, 'Discount not found.');
    
    const { rows } = await pool.query(
        `UPDATE discount.discounts 
         SET usage_count = usage_count + 1 
         WHERE id = $1 
         RETURNING usage_count, usage_limit`,
        [req.params.id]
    );
    
    if (rows.length === 0) throw failure(404, 'Discount not found.');
    
    res.json({
        usageCount: rows[0].usage_count,
        usageLimit: rows[0].usage_limit,
        limitReached: rows[0].usage_limit ? rows[0].usage_count >= rows[0].usage_limit : false
    });
}));

start();
