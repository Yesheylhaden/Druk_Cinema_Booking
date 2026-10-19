import { sendJson } from '../utils/http.js';

export function getDashboard(response, store) {
  const data = store.read();
  const confirmed = data.bookings.filter(booking => booking.status === 'Confirmed');
  const revenue = confirmed.reduce((total, booking) => total + booking.amount, 0);
  const tickets = confirmed.reduce((total, booking) => total + booking.tickets, 0);
  sendJson(response, 200, {
    demo: true,
    summary: { revenue, tickets, moviesShowing: data.movies.filter(movie => movie.status === 'Now showing').length },
    // These illustrative historical metrics are separate from the seeded bookings.
    ranges: {
      today: ['24,600', '82', '78%'],
      week: ['148,500', '495', '74%'],
      month: ['592,800', '1,976', '81%']
    },
    revenue: [
      { day: 'Monday', amount: 12000 }, { day: 'Tuesday', amount: 18500 },
      { day: 'Wednesday', amount: 14500 }, { day: 'Thursday', amount: 22000 },
      { day: 'Friday', amount: 28500 }, { day: 'Saturday', amount: 23000 },
      { day: 'Sunday', amount: 30000 }
    ]
  });
}
