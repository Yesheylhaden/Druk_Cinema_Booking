// Change this URL when deploying the frontend and API to different hosts.
const API_BASE_URL = 'http://localhost:3001/api';

async function request(path, options = {}) {
  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...options.headers },
      signal: AbortSignal.timeout(10000)
    });
  } catch {
    throw new Error('Cannot reach the backend. Start both servers with npm start.');
  }
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'The request failed');
  return data;
}

export const api = {
  getMovies: () => request('/movies'),
  createMovie: movie => request('/movies', { method: 'POST', body: JSON.stringify(movie) }),
  updateMovie: (id, changes) => request(`/movies/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(changes) }),
  getBookings: () => request('/bookings'),
  getShowtimes: () => request('/showtimes'),
  getDashboard: () => request('/dashboard')
};
