const API_BASE = '/api';

async function request(endpoint, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  let res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
    credentials: 'include', // Send cookies with every request
  });

  // If 401, try to refresh token and retry once
  if (res.status === 401) {
    try {
      const refreshRes = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      });

      if (refreshRes.ok) {
        // Retry original request with new token
        res = await fetch(`${API_BASE}${endpoint}`, {
          ...options,
          headers,
          credentials: 'include',
        });
      } else {
        // Refresh failed, user is not authenticated
        // Redirect to login will be handled by the caller or global handler
        const data = await res.json();
        throw new Error(data.error || 'Authentication failed');
      }
    } catch (err) {
      throw new Error('Authentication required');
    }
  }

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
  logout: () => request('/auth/logout', { method: 'POST' }),

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
  getRebookSuggestions: () => request('/bookings/rebook-suggestions'),

  // Recurring bookings
  createRecurringIntent: (data) => request('/bookings/create-recurring-intent', { method: 'POST', body: JSON.stringify(data) }),
  cancelRecurringSeries: (groupId) => request(`/bookings/recurring/${groupId}/cancel-all`, { method: 'PATCH' }),

  // Users
  updateProfile: (data) => request('/users/profile', { method: 'PUT', body: JSON.stringify(data) }),

  // Uploads
  uploadProfilePhoto: async (file) => {
    const formData = new FormData();
    formData.append('photo', file);
    const res = await fetch(`${API_BASE}/uploads/profile-photo`, {
      method: 'POST',
      body: formData,
      credentials: 'include', // Send cookies
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Upload failed');
    return data;
  },

  uploadPortfolioPhoto: async (file) => {
    const formData = new FormData();
    formData.append('photo', file);
    const res = await fetch(`${API_BASE}/uploads/portfolio`, {
      method: 'POST',
      body: formData,
      credentials: 'include', // Send cookies
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

  // Disputes
  createDispute: (data) => request('/disputes', { method: 'POST', body: JSON.stringify(data) }),
  respondToDispute: (id, data) => request(`/disputes/${id}/respond`, { method: 'PATCH', body: JSON.stringify(data) }),
  getDisputes: () => request('/disputes'),

  // Badges
  getBadges: (userId) => request(`/badges/${userId}`),

  // Categories
  getCategories: () => request('/teachers/categories'),

  // Booking acceptance (teacher actions)
  acceptBooking: (id) => request(`/bookings/${id}/accept`, { method: 'PATCH' }),
  declineBooking: (id) => request(`/bookings/${id}/decline`, { method: 'PATCH' }),

  // Inquiry messaging (pre-booking)
  sendInquiry: (teacherProfileId, content) => request(`/messages/inquiry/${teacherProfileId}`, { method: 'POST', body: JSON.stringify({ content }) }),
  getInquiryMessages: (teacherProfileId) => request(`/messages/inquiry/${teacherProfileId}`),

  // Notifications
  getNotifications: () => request('/notifications'),
  getUnreadCount: () => request('/notifications/unread-count'),
  markNotificationsRead: () => request('/notifications/read-all', { method: 'PATCH' }),

  // Earnings
  getEarnings: () => request('/earnings'),

  // Meeting point
  updateMeetingPoint: (bookingId, meetingPoint) => request(`/bookings/${bookingId}/meeting-point`, { method: 'PATCH', body: JSON.stringify({ meetingPoint }) }),

  // Verification
  submitVerification: (data) => request('/verification/submit', { method: 'POST', body: JSON.stringify(data) }),
  getVerificationStatus: () => request('/verification/status'),

  // Blocks
  blockStudent: (studentId, reason) => request('/blocks', { method: 'POST', body: JSON.stringify({ studentId, reason }) }),
  unblockStudent: (studentId) => request(`/blocks/${studentId}`, { method: 'DELETE' }),
  getBlockedStudents: () => request('/blocks'),

  // Review editing
  editReview: (id, data) => request(`/reviews/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  // Shortlist
  toggleShortlist: (teacherProfileId) => request(`/shortlist/${teacherProfileId}`, { method: 'POST' }),
  getShortlist: () => request('/shortlist'),

  // Password reset
  forgotPassword: (email) => request('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),
  resetPassword: (token, password) => request('/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, password }) }),

  // Notification marking as read
  markNotificationRead: (notificationId) => request(`/notifications/${notificationId}/read`, { method: 'PATCH' }),
};
