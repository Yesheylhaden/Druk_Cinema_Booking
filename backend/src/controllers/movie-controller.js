import { randomUUID } from 'node:crypto';
import { HttpError, readJson, sendJson } from '../utils/http.js';

const genres = ['Drama', 'Romance', 'Comedy', 'Adventure', 'Action'];
function validateMovie(input) {
  if (typeof input.title !== 'string' || !input.title.trim() || input.title.trim().length > 80) {
    throw new HttpError(400, 'Movie title must contain 1–80 characters');
  }
  if (!genres.includes(input.genre)) throw new HttpError(400, 'Choose a supported movie genre');
  if (!Number.isInteger(input.runtime) || input.runtime < 1 || input.runtime > 600) {
    throw new HttpError(400, 'Runtime must be an integer between 1 and 600 minutes');
  }
  if (!['Now showing', 'Coming soon'].includes(input.status)) throw new HttpError(400, 'Invalid movie status');
  return { title: input.title.trim(), genre: input.genre, runtime: input.runtime, status: input.status };
}

export async function handleMovies(request, response, store, id) {
  if (request.method === 'GET' && !id) return sendJson(response, 200, store.read().movies);
  if (request.method === 'POST' && !id) {
    const movie = { id: randomUUID(), ...validateMovie(await readJson(request)) };
    await store.update(data => { data.movies.push(movie); });
    return sendJson(response, 201, movie);
  }
  if (request.method === 'PATCH' && id) {
    const input = await readJson(request);
    if (Object.keys(input).some(key => !['title', 'genre', 'runtime', 'status'].includes(key))) {
      throw new HttpError(400, 'Unsupported movie field');
    }
    const movie = await store.update(data => {
      const index = data.movies.findIndex(movie => movie.id === id);
      if (index < 0) throw new HttpError(404, 'Movie not found');
      data.movies[index] = { id, ...validateMovie({ ...data.movies[index], ...input }) };
      return data.movies[index];
    });
    return sendJson(response, 200, movie);
  }
  throw new HttpError(405, 'Method not allowed');
}
