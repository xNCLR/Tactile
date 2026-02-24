const API_BASE = '/api';

function getToken() {
  return localStorage.getItem('tactile_token');
}

async function request(endpoint, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };

  const res = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || 'Request failed');
  }

  return data;
}

export const api = {
  // Auth
  login: (email, password) => request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  register: (data) => request('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  getMe: () => request('/auth/me'),

  // Teachers
  searchTeachers: (params) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/teachers/search?${qs}`);
  },
  getTeacher: (id) => request(`/teachers/${id}`),
  updateTeacherProfile: (data) => request('/teachers/profile', { method: 'PUT', body: JSON.stringify(data) }),
  addTimeSlot: (data) => request('/teachers/time-slots', { method: 'POST', body: JSON.stringify(data) }),
  removeTimeSlot: (id) => request(`/teachers/time-slots/${id}`, { method: 'DELETE' }),

  // Bookings (two-step Stripe flow)
  createPaymentIntent: (data) => request('/bookings/create-intent', { method: 'POST', body: JSON.stringify(data) }),
  confirmBooking: (data) => request('/bookings/confirm', { method: 'POST', body: JSON.stringify(data) }),
  getBookings: () => request('/bookings'),
  cancelBooking: (id) => request(`/bookings/${id}/cancel`, { method: 'PATCH' }),

  // Users
  updateProfile: (data) => request('/users/profile', { method: 'PUT', body: JSON.stringify(data) }),

  // Uploads
  uploadProfilePhoto: async (file) => {
    const formData = new FormData();
    formData.append('photo', file);
    const token = getToken();
    const res = await fetch(`${API_BASE}/uploads/profile-photo`, {
      method: 'POST',
      headers: { ...(token && { Authorization: `Bearer ${token}` }) },
      body: formData,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Upload failed');
    return data;
  },

  uploadPortfolioPhoto: async (file) => {
    const formData = new FormData();
    formData.append('photo', file);
    const token = getToken();
    const res = await fetch(`${API_BASE}/uploads/portfolio`, {
      method: 'POST',
      headers: { ...(token && { Authorization: `Bearer ${token}` }) },
      body: formData,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Upload failed');
    return data;
  },

  deletePortfolioPhoto: (slot) => request(`/uploads/portfolio/${slot}`, { method: 'DELETE' }),

  // Reviews
  createReview: (data) => request('/reviews', { method: 'POST', body: JSON.stringify(data) }),
  getTeacherReviews: (teacherId) => request(`/reviews/teacher/${teacherId}`),

  // Messages
  getThreads: () => request('/messages/threads'),
  getMessages: (bookingId) => request(`/messages/${bookingId}`),
  sendMessage: (bookingId, content) => request(`/messages/${bookingId}`, { method: 'POST', body: JSON.stringify({ content }) }),
};
