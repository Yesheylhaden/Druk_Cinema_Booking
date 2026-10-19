import { api } from './api.js';

const $ = selector => document.querySelector(selector);
const escapeHtml = value => String(value).replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[character]));

const pageContent = {
  overview: ['Dashboard overview', 'Welcome back, Admin. Here’s what’s happening at Druk Cinema.'],
  movies: ['Movie library', 'Manage the stories that bring your audience together.'],
  showtimes: ['Showtime schedule', 'Plan the day, one screening at a time.'],
  bookings: ['Cinema bookings', 'Keep track of every seat and every guest.']
};

let movies = [];
let bookings = [];
let showtimes = [];
let dashboard;
let currentPage = 'overview';
let selectedRange = 'today';
let toastTimer;

function notify(message) {
  $('#toast').textContent = message;
  $('#toast').style.display = 'block';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { $('#toast').style.display = 'none'; }, 5000);
}

function renderBookingTable(rows) {
  if (!rows.length) return '<p class="empty">No bookings found.</p>';
  return `<table>
    <thead><tr><th>Booking ID</th><th>Customer</th><th>Movie</th><th>Amount</th><th>Status</th></tr></thead>
    <tbody>${rows.map(booking => {
      const initials = booking.customer.split(' ').map(word => word[0]).slice(0, 2).join('');
      return `<tr>
        <td>#${escapeHtml(booking.id)}</td>
        <td><div class="customer"><span class="initials">${escapeHtml(initials)}</span>${escapeHtml(booking.customer)}</div></td>
        <td>${escapeHtml(booking.movieTitle)}</td>
        <td>Nu. ${Number(booking.amount).toLocaleString('en-US')}</td>
        <td><span class="badge ${booking.status === 'Pending' ? 'pending' : ''}">${escapeHtml(booking.status)}</span></td>
      </tr>`;
    }).join('')}</tbody>
  </table>`;
}

function renderStats() {
  if (!dashboard) return;
  const [revenue, tickets, occupancy] = dashboard.ranges[selectedRange];
  const values = [revenue, tickets, movies.filter(movie => movie.status === 'Now showing').length, occupancy];
  const labels = ['Sample revenue', 'Sample tickets booked', 'Movies showing', 'Sample seat occupancy'];
  $('#stats').innerHTML = labels.map((label, index) => `<article class="stat">
    <div class="stat-label">${label}<span class="stat-icon">${['↗', '▤', '▣', '◉'][index]}</span></div>
    <strong>${index === 0 ? 'Nu. ' : ''}${values[index]}</strong>
    <small>${index === 2 ? 'From your movie library' : 'Illustrative demo data'}</small>
  </article>`).join('');
}

function renderMoviePreview() {
  $('#movie-preview').innerHTML = movies.filter(movie => movie.status === 'Now showing').slice(0, 3)
    .map((movie, index) => `<div class="movie-row">
      <div class="poster p${index}">${escapeHtml(movie.title)}</div>
      <div><h3>${escapeHtml(movie.title)}</h3><p>${escapeHtml(movie.genre)} · ${movie.runtime} min</p></div>
      <div class="rating">★ ${[4.8, 4.7, 4.9][index]}<small>Sample rating</small></div>
    </div>`).join('') || '<p class="empty">No movies showing.</p>';
}

function navigate(page) {
  if (!pageContent[page]) page = 'overview';
  currentPage = page;
  location.hash = page;
  $('#overview').hidden = page !== 'overview';
  $('#management').hidden = page === 'overview';
  document.querySelectorAll('[data-page]').forEach(button => {
    button.classList.toggle('active', button.dataset.page === page);
  });
  $('#crumb').textContent = page[0].toUpperCase() + page.slice(1);
  $('#page-title').innerHTML = `${pageContent[page][0]}<span>.</span>`;
  $('#subtitle').textContent = pageContent[page][1];
  $('#sidebar').classList.remove('open');
  if (!dashboard) {
    $('#management').innerHTML = '<p class="empty">Waiting for the backend. Reload after starting the API server.</p>';
    return;
  }
  if (page === 'movies') renderMovies();
  if (page === 'bookings') renderBookings();
  if (page === 'showtimes') renderShowtimes();
}

function renderMovies() {
  $('#management').innerHTML = `
    <div class="management-tools">
      <input id="movie-search" aria-label="Search movies" placeholder="Search movies…">
      <select id="movie-filter" aria-label="Filter movies">
        <option>All movies</option><option>Now showing</option><option>Coming soon</option>
      </select>
    </div><div class="movie-cards" id="movie-cards"></div>`;

  function updateList() {
    const query = $('#movie-search').value.toLowerCase();
    const status = $('#movie-filter').value;
    const filtered = movies.filter(movie => movie.title.toLowerCase().includes(query)
      && (status === 'All movies' || movie.status === status));
    $('#movie-cards').innerHTML = filtered.map((movie, index) => `<article class="panel movie-card">
      <div class="poster p${index % 3}">${escapeHtml(movie.title)}</div>
      <span class="badge ${movie.status === 'Coming soon' ? 'pending' : ''}">${movie.status}</span>
      <h2 style="margin-top:16px">${escapeHtml(movie.title)}</h2>
      <p>${escapeHtml(movie.genre)} · ${movie.runtime} minutes</p>
      <button data-movie-id="${escapeHtml(movie.id)}">${movie.status === 'Now showing' ? 'Move to coming soon' : 'Mark as now showing'}</button>
    </article>`).join('') || '<p class="empty">No movies match your search.</p>';

    document.querySelectorAll('[data-movie-id]').forEach(button => {
      button.onclick = async () => {
        const movie = movies.find(item => item.id === button.dataset.movieId);
        button.disabled = true;
        try {
          await api.updateMovie(movie.id, { status: movie.status === 'Now showing' ? 'Coming soon' : 'Now showing' });
          await refreshData();
          if (currentPage === 'movies') renderMovies();
          notify('Movie status saved');
        } catch (error) { notify(error.message); }
        finally { button.disabled = false; }
      };
    });
  }
  $('#movie-search').oninput = updateList;
  $('#movie-filter').onchange = updateList;
  updateList();
}

function renderBookings() {
  $('#management').innerHTML = `
    <div class="management-tools">
      <input id="booking-search" aria-label="Search bookings" placeholder="Search by name, movie or booking ID…">
      <button id="booking-export">↓ Export bookings</button>
    </div><article class="panel" id="bookings-list"></article>`;
  function updateList() {
    const query = $('#booking-search').value.toLowerCase();
    const filtered = bookings.filter(booking => [booking.id, booking.customer, booking.movieTitle, booking.status]
      .join(' ').toLowerCase().includes(query));
    $('#bookings-list').innerHTML = renderBookingTable(filtered);
  }
  $('#booking-search').oninput = updateList;
  $('#booking-export').onclick = () => exportCsv('druk-bookings.csv', [
    ['Booking ID', 'Customer', 'Movie', 'Tickets', 'Amount (Nu)', 'Status'],
    ...bookings.map(booking => [booking.id, booking.customer, booking.movieTitle, booking.tickets, booking.amount, booking.status])
  ]);
  updateList();
}

function renderShowtimes() {
  $('#management').innerHTML = `
    <div class="management-tools"><span class="date">Sample schedule · 19 October 2026</span></div>
    <article class="panel">${showtimes.map(show => `<div class="showtime">
      <div><h2>${escapeHtml(show.movieTitle)}</h2><p>${escapeHtml(show.auditorium)} · ${show.runtime} min</p></div>
      <span>${escapeHtml(show.time)}</span><span class="badge">Scheduled</span>
    </div>`).join('') || '<p class="empty">No scheduled screenings for movies now showing.</p>'}</article>
    <p style="margin-top:16px">Screenings are read from the backend sample database. Adding a movie does not automatically schedule a screening.</p>`;
}

function exportCsv(name, rows) {
  const content = rows.map(row => row.map(value => {
    // Prevent spreadsheet software from treating user-entered titles as formulas.
    const text = String(value);
    const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
    return `"${safe.replace(/"/g, '""')}"`;
  }).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8;' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  notify('Report exported');
}

async function refreshData() {
  const result = await Promise.all([api.getMovies(), api.getBookings(), api.getShowtimes(), api.getDashboard()]);
  [movies, bookings, showtimes, dashboard] = result;
  renderStats();
  renderMoviePreview();
  $('#recent-table').innerHTML = renderBookingTable(bookings.slice(0, 4));
  $('nav [data-page="bookings"] b').textContent = bookings.length;
}

async function addMovie(event) {
  event.preventDefault();
  const form = event.target;
  const fields = new FormData(form);
  const submit = form.querySelector('[type="submit"]');
  submit.disabled = true;
  try {
    await api.createMovie({
      title: fields.get('title').trim(),
      genre: fields.get('genre'),
      runtime: Number(fields.get('runtime')),
      status: fields.get('status')
    });
    $('#movie-dialog').close();
    form.reset();
    await refreshData();
    navigate(currentPage);
    notify('Movie saved to the backend');
  } catch (error) { notify(error.message); }
  finally { submit.disabled = false; }
}

function attachEvents() {
  document.querySelectorAll('[data-page]').forEach(button => {
    button.onclick = () => navigate(button.dataset.page);
  });
  document.querySelectorAll('[data-goto]').forEach(button => {
    button.onclick = () => navigate(button.dataset.goto);
  });
  document.querySelectorAll('[data-range]').forEach(button => {
    button.onclick = () => {
      selectedRange = button.dataset.range;
      document.querySelectorAll('[data-range]').forEach(item => item.classList.toggle('selected', item === button));
      renderStats();
    };
  });
  $('#menu').onclick = () => $('#sidebar').classList.toggle('open');
  $('#add-movie').onclick = () => $('#movie-dialog').showModal();
  $('#close-dialog').onclick = () => $('#movie-dialog').close();
  $('#movie-form').onsubmit = addMovie;
  $('#notifications').onclick = () => {
    const count = bookings.filter(booking => booking.status === 'Pending').length;
    notify(`${count} pending sample booking${count === 1 ? '' : 's'}`);
  };
  $('#export').onclick = () => {
    if (!dashboard) return notify('Load the backend data before exporting.');
    exportCsv('druk-revenue-report.csv', [['Day', 'Revenue (Nu)'], ...dashboard.revenue.map(row => [row.day, row.amount])]);
  };
  window.addEventListener('hashchange', () => {
    const page = location.hash.slice(1);
    if (page !== currentPage) navigate(page);
  });
}

async function initialize() {
  attachEvents();
  $('#stats').innerHTML = '<p class="empty">Loading dashboard data…</p>';
  $('#add-movie').disabled = true;
  navigate(location.hash.slice(1) || 'overview');
  try {
    await refreshData();
    $('#add-movie').disabled = false;
    navigate(location.hash.slice(1) || 'overview');
  } catch (error) {
    $('#stats').innerHTML = '<p class="empty">Backend unavailable. Run npm start, then reload this page.</p>';
    notify(error.message);
  }
}

initialize();
