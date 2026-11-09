import React, { useState } from 'react';

const API = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

export default function DiscountInput({ bookingAmount, onDiscountApplied, disabled = false }) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [discount, setDiscount] = useState(null);

  async function validateCode() {
    if (!code.trim()) {
      setError('Please enter a discount code.');
      return;
    }

    setLoading(true);
    setError('');
    setDiscount(null);

    try {
      const response = await fetch(`${API}/api/discounts/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ code: code.trim(), bookingAmount })
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Invalid discount code.');
        return;
      }

      if (data.valid) {
        setDiscount(data);
        onDiscountApplied?.(data);
      } else {
        setError(data.reason || 'Invalid discount code.');
      }
    } catch (err) {
      setError('Unable to validate discount code. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function clearDiscount() {
    setCode('');
    setDiscount(null);
    setError('');
    onDiscountApplied?.(null);
  }

  return (
    <div className="discount-input">
      {discount ? (
        <div className="discount-applied">
          <span className="discount-badge">✓ Code applied</span>
          <div className="discount-details">
            <p><strong>{discount.code}</strong></p>
            <p className="discount-amount">
              {discount.discountType === 'percentage' 
                ? `${discount.discountValue}% off` 
                : `Nu. ${discount.discountValue} off`}
            </p>
            <p className="discount-savings">You save: Nu. {discount.discountAmount.toFixed(2)}</p>
          </div>
          <button 
            type="button" 
            className="text-button small" 
            onClick={clearDiscount}
            disabled={disabled}
          >
            Remove
          </button>
        </div>
      ) : (
        <div className="discount-form">
          <label htmlFor="discount-code">Discount code</label>
          <div className="discount-input-row">
            <input
              id="discount-code"
              type="text"
              placeholder="Enter code"
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === 'Enter' && validateCode()}
              disabled={disabled || loading}
              aria-describedby={error ? 'discount-error' : undefined}
            />
            <button
              type="button"
              className="secondary small"
              onClick={validateCode}
              disabled={disabled || loading || !code.trim()}
            >
              {loading ? 'Checking…' : 'Apply'}
            </button>
          </div>
          {error && <p id="discount-error" className="error" role="alert">{error}</p>}
        </div>
      )}
    </div>
  );
}
