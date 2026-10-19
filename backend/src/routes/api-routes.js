import { handleMovies } from '../controllers/movie-controller.js';
import { getDashboard } from '../controllers/dashboard-controller.js';
import { HttpError, sendJson } from '../utils/http.js';

export async function routeApi(request, response, store) {
  const path = new URL(request.url, 'http://localhost').pathname;
  if (path === '/api/health' && request.method === 'GET') return sendJson(response, 200, { status: 'ok' });
  const movieMatch = path.match(/^\/api\/movies(?:\/([^/]+))?$/);
  if (movieMatch) return handleMovies(request, response, store, movieMatch[1]);
  if (['/api/dashboard', '/api/bookings', '/api/showtimes'].includes(path)) {
    if (request.method !== 'GET') throw new HttpError(405, 'Method not allowed');
    if (path === '/api/dashboard') return getDashboard(response, store);
    const data = store.read();
    const movieFor = id => data.movies.find(movie => movie.id === id);
    if (path === '/api/bookings') {
      return sendJson(response, 200, data.bookings.map(booking => ({ ...booking, movieTitle: movieFor(booking.movieId)?.title ?? 'Unknown movie' })));
    }
    return sendJson(response, 200, data.showtimes.filter(show => movieFor(show.movieId)?.status === 'Now showing')
      .map(show => ({ ...show, movieTitle: movieFor(show.movieId).title, runtime: movieFor(show.movieId).runtime })));
  }
  throw new HttpError(404, 'API route not found');
}
