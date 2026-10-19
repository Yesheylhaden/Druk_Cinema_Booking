export const seedData = {
  movies: [
    { id: 'movie-1', title: 'Sergam', genre: 'Drama', runtime: 132, status: 'Now showing' },
    { id: 'movie-2', title: 'Hing', genre: 'Romance', runtime: 118, status: 'Now showing' },
    { id: 'movie-3', title: 'The Monk and the Gun', genre: 'Drama', runtime: 107, status: 'Now showing' }
  ],
  bookings: [
    { id: 'DC-1048', customer: 'Pema Dorji', movieId: 'movie-1', tickets: 2, amount: 600, status: 'Confirmed' },
    { id: 'DC-1047', customer: 'Sonam Choden', movieId: 'movie-2', tickets: 3, amount: 900, status: 'Confirmed' },
    { id: 'DC-1046', customer: 'Karma Wangchuk', movieId: 'movie-3', tickets: 2, amount: 600, status: 'Pending' },
    { id: 'DC-1045', customer: 'Tshering Yangden', movieId: 'movie-1', tickets: 4, amount: 1200, status: 'Confirmed' }
  ],
  showtimes: [
    { id: 'show-1', movieId: 'movie-1', date: '2026-10-19', time: '10:00', auditorium: 'Main auditorium' },
    { id: 'show-2', movieId: 'movie-2', date: '2026-10-19', time: '14:00', auditorium: 'Main auditorium' },
    { id: 'show-3', movieId: 'movie-3', date: '2026-10-19', time: '18:00', auditorium: 'Main auditorium' }
  ]
};
