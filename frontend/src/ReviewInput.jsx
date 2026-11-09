import React, { useState } from 'react';

const API = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

export default function ReviewInput({ movieId, onReviewSubmitted, disabled = false }) {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [title, setTitle] = useState('');
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess(false);

    if (rating === 0) {
      setError('Please select a rating.');
      return;
    }

    if (!title.trim()) {
      setError('Please enter a review title.');
      return;
    }

    if (!comment.trim()) {
      setError('Please enter your review.');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API}/api/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          movieId,
          rating,
          title: title.trim(),
          comment: comment.trim()
        })
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Unable to submit review.');
        return;
      }

      setSuccess(true);
      onReviewSubmitted?.(data);
      
      // Reset form after successful submission
      setTimeout(() => {
        setRating(0);
        setHoverRating(0);
        setTitle('');
        setComment('');
        setSuccess(false);
      }, 2000);
    } catch (err) {
      setError('Unable to submit review. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="review-input">
      <h3>Write a review</h3>
      
      {success ? (
        <div className="review-success" role="status">
          <span className="success-icon">✓</span>
          <p>Your review has been submitted!</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <div className="rating-input">
            <label>Your rating</label>
            <div className="stars" aria-label="Select rating">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  className={`star ${star <= (hoverRating || rating) ? 'filled' : ''}`}
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  disabled={disabled || loading}
                  aria-label={`${star} star${star !== 1 ? 's' : ''}`}
                  aria-pressed={rating === star}
                >
                  ★
                </button>
              ))}
            </div>
            <p className="rating-label">
              {rating > 0 ? `${rating} star${rating !== 1 ? 's' : ''}` : 'Select a rating'}
            </p>
          </div>

          <div className="review-field">
            <label htmlFor="review-title">Review title</label>
            <input
              id="review-title"
              type="text"
              placeholder="Summarize your experience"
              value={title}
              onChange={e => setTitle(e.target.value)}
              disabled={disabled || loading}
              maxLength={100}
              aria-describedby={error ? 'review-error' : undefined}
            />
          </div>

          <div className="review-field">
            <label htmlFor="review-comment">Your review</label>
            <textarea
              id="review-comment"
              placeholder="Share your thoughts about this movie..."
              value={comment}
              onChange={e => setComment(e.target.value)}
              disabled={disabled || loading}
              rows={4}
              maxLength={1000}
              aria-describedby={error ? 'review-error' : undefined}
            />
            <p className="char-count">{comment.length}/1000</p>
          </div>

          {error && <p id="review-error" className="error" role="alert">{error}</p>}

          <button
            type="submit"
            className="primary"
            disabled={disabled || loading}
          >
            {loading ? 'Submitting…' : 'Submit review'}
          </button>
        </form>
      )}
    </div>
  );
}
