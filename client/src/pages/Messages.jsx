import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../api/client';
import BookingModal from '../components/BookingModal';
import * as chrono from 'chrono-node';

function ThreadList({ threads, activeId, onSelect }) {
  if (threads.length === 0) {
    return (
      <div className="p-8 text-center text-stone text-sm font-serif italic">
        No conversations yet. Book a lesson to start chatting!
      </div>
    );
  }

  return (
    <div className="divide-y divide-sand/40">
      {threads.map((thread) => (
        <button
          key={thread.thread_id}
          onClick={() => onSelect(thread.thread_id)}
          className={`w-full text-left p-4 hover:bg-paper transition-colors ${activeId === thread.thread_id ? 'bg-blush' : ''}`}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-sand/40 to-sand/60 flex items-center justify-center overflow-hidden flex-shrink-0">
              {thread.other_photo ? (
                <img src={thread.other_photo} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-sm font-bold text-rust">
                  {thread.other_name?.split(' ').map((n) => n[0]).join('').toUpperCase()}
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm">{thread.other_name}</span>
                {thread.unread_count > 0 && (
                  <span className="bg-bark text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
                    {thread.unread_count}
                  </span>
                )}
              </div>
              <p className="text-xs text-stone truncate">
                {thread.last_message || (thread.next_booking_date ? `Lesson on ${thread.next_booking_date}` : 'Start a conversation')}
              </p>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}

// Parse dates from message text using chrono-node (British DD/MM format)
function extractFutureDate(text) {
  try {
    const results = chrono.en.GB.parse(text, new Date(), { forwardDate: true });
    if (results.length === 0) return null;

    const parsed = results[0];
    const date = parsed.start.date();

    // Only return future dates
    if (date <= new Date()) return null;

    // Build a human-readable label
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    const dayName = dayNames[date.getDay()];
    const day = date.getDate();
    const month = monthNames[date.getMonth()];

    let label = `${dayName} ${day} ${month}`;

    // If a time was mentioned, include it
    if (parsed.start.isCertain('hour')) {
      const h = date.getHours();
      const m = date.getMinutes();
      const timeStr = `${h > 12 ? h - 12 : h}${m > 0 ? ':' + String(m).padStart(2, '0') : ''}${h >= 12 ? 'pm' : 'am'}`;
      label += ` at ${timeStr}`;
    }

    return {
      date: date.toISOString().split('T')[0],
      time: parsed.start.isCertain('hour')
        ? `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
        : null,
      label,
    };
  } catch {
    return null;
  }
}

function DateChip({ dateInfo, onClick }) {
  return (
    <button
      onClick={onClick}
      className="mt-1.5 inline-flex items-center gap-1.5 px-3 py-1.5 bg-blush border border-sand rounded-full text-xs font-medium text-bark font-mono hover:bg-sand transition-colors"
    >
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
      Book {dateInfo.label}?
    </button>
  );
}

function ChatView({ threadId, currentUserId, onBookingClick }) {
  const [messages, setMessages] = useState([]);
  const [otherUser, setOtherUser] = useState(null);
  const [teacherProfile, setTeacherProfile] = useState(null);
  const [timeSlots, setTimeSlots] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [contactsUnlocked, setContactsUnlocked] = useState(false);
  const [isStudent, setIsStudent] = useState(true);
  const [messagesRemaining, setMessagesRemaining] = useState(null);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [contactWarning, setContactWarning] = useState(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (!threadId) return;
    setLoading(true);
    setMessages([]);
    setOtherUser(null);
    setTeacherProfile(null);

    api.getConversationMessages(threadId)
      .then((data) => {
        setMessages(data.messages);
        setOtherUser(data.otherUser);
        setTeacherProfile(data.teacherProfile);
        setTimeSlots(data.timeSlots || []);
        setBookings(data.bookings || []);
        setContactsUnlocked(data.contactsUnlocked ?? false);
        setIsStudent(data.isStudent ?? true);
        setMessagesRemaining(data.messagesRemaining);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [threadId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Poll for new messages
  useEffect(() => {
    if (!threadId) return;
    const interval = setInterval(() => {
      api.getConversationMessages(threadId)
        .then((data) => setMessages(data.messages))
        .catch(() => {});
    }, 5000);
    return () => clearInterval(interval);
  }, [threadId]);

  const handleSend = async () => {
    if (!newMessage.trim() || sending) return;
    const content = newMessage.trim();
    const tempId = `temp-${Date.now()}`;

    // Optimistic: show message immediately with "sending" state
    const optimisticMsg = {
      id: tempId,
      sender_id: currentUserId,
      content,
      created_at: null, // null = "Sending..."
      _sending: true,
    };
    setMessages((prev) => [...prev, optimisticMsg]);
    setNewMessage('');
    setSending(true);

    try {
      const result = await api.sendConversationMessage(threadId, content);
      // Replace optimistic message with real one
      setMessages((prev) => prev.map((m) => m.id === tempId ? result.message : m));
      if (messagesRemaining !== null) setMessagesRemaining((r) => Math.max(0, r - 1));

      // Show contact warning toast if applicable
      if (result.contactWarning) {
        setContactWarning(result.contactWarning);
        setTimeout(() => setContactWarning(null), result.contactWarning.level === 'severe' ? 8000 : 5000);
      }
    } catch (err) {
      // Remove optimistic message on cap error, otherwise mark as failed
      if (err.message?.includes('Message limit')) {
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        setMessagesRemaining(0);
      } else {
        setMessages((prev) => prev.map((m) => m.id === tempId ? { ...m, _sending: false, _failed: true } : m));
      }
      console.error('Send failed:', err);
    } finally {
      setSending(false);
    }
  };

  if (!threadId) {
    return (
      <div className="flex-1 flex items-center justify-center text-stone text-sm">
        Select a conversation
      </div>
    );
  }

  if (loading) {
    return <div className="flex-1 flex items-center justify-center text-stone">Loading...</div>;
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Chat header */}
      <div className="p-4 border-b border-sand/60 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-sand/40 to-sand/60 flex items-center justify-center overflow-hidden">
            {otherUser?.profile_photo ? (
              <img src={otherUser.profile_photo} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-xs font-bold text-rust">
                {otherUser?.name?.split(' ').map((n) => n[0]).join('').toUpperCase()}
              </span>
            )}
          </div>
          <div>
            <p className="font-medium text-sm">{otherUser?.name}</p>
            <p className="text-xs text-stone">
              {teacherProfile ? `£${teacherProfile.hourly_rate}/hr` : 'Conversation'}
            </p>
          </div>
        </div>

        {/* Book a Lesson button */}
        {teacherProfile && (
          <button
            onClick={() => onBookingClick({
              teacher: teacherProfile,
              timeSlots,
              bookings,
            })}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-terracotta text-white text-xs font-medium rounded-full hover:bg-rust transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Book a Lesson
          </button>
        )}
      </div>

      {/* Contact info notice */}
      {!contactsUnlocked && (
        <div className="px-4 py-2 bg-blush border-b border-sand flex-shrink-0">
          <p className="text-xs text-bark">
            {isStudent
              ? 'Contact details are shared after your first booking is confirmed.'
              : 'Contact details are hidden until the first booking is confirmed.'}
          </p>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <p className="text-center text-stone text-sm py-8 font-serif italic">No messages yet. Say hello!</p>
        )}
        {messages.map((msg) => {
          const isMine = msg.sender_id === currentUserId;
          const dateInfo = extractFutureDate(msg.content);

          return (
            <div key={msg.id}>
              <div className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[75%] px-4 py-2 rounded-2xl text-sm ${
                  isMine
                    ? 'bg-bark text-white rounded-br-md'
                    : 'bg-blush text-bark rounded-bl-md'
                }`}>
                  <p>{msg.content}</p>
                  <p className={`text-xs mt-1 font-mono ${isMine ? 'text-sand' : 'text-stone'}`}>
                    {msg._sending ? 'Sending...' : msg._failed ? 'Failed to send' : (
                      msg.created_at ? new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''
                    )}
                  </p>
                </div>
              </div>
              {/* Date detection chip */}
              {dateInfo && teacherProfile && (
                <div className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                  <DateChip
                    dateInfo={dateInfo}
                    onClick={() => onBookingClick({
                      teacher: teacherProfile,
                      timeSlots,
                      bookings,
                      preselect: {
                        date: dateInfo.date,
                        startTime: dateInfo.time,
                      },
                    })}
                  />
                </div>
              )}
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Contact warning toast */}
      {contactWarning && (
        <div className={`mx-4 mb-0 px-4 py-2.5 rounded-lg text-sm flex-shrink-0 ${
          contactWarning.level === 'severe'
            ? 'bg-red-50 text-red-700 border border-red-200'
            : contactWarning.level === 'warning'
              ? 'bg-blush text-bark border border-sand'
              : 'bg-paper text-stone border border-sand/60'
        }`}>
          {contactWarning.message}
        </div>
      )}

      {/* Input */}
      <div className="px-4 pt-3 pb-2 border-t border-sand/60 flex-shrink-0">
        {messagesRemaining === 0 ? (
          <div className="text-center py-2">
            <p className="text-sm text-stone mb-2">Message limit reached.</p>
            {teacherProfile && (
              <button
                onClick={() => onBookingClick({ teacher: teacherProfile, timeSlots, bookings })}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-bark text-white text-sm font-medium rounded-full hover:bg-stone transition-colors"
              >
                Book a Lesson to continue chatting
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="flex gap-2">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Type a message..."
                className="flex-1 border border-sand/60 rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-bark"
              />
              <button
                onClick={handleSend}
                disabled={!newMessage.trim() || sending}
                className="bg-bark text-white px-4 py-2 rounded-full text-sm font-medium hover:bg-stone disabled:opacity-50 transition-colors"
              >
                Send
              </button>
            </div>
            <div className="flex items-center justify-between mt-1.5">
              <p className="text-[10px] text-sand">Messages may be reviewed for safety purposes.</p>
              {messagesRemaining !== null && messagesRemaining <= 3 && (
                <p className="text-[10px] text-terracotta">{messagesRemaining} message{messagesRemaining !== 1 ? 's' : ''} remaining</p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function Messages() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showThreads, setShowThreads] = useState(true);
  const [bookingModal, setBookingModal] = useState(null);

  const activeThreadId = searchParams.get('thread');

  useEffect(() => {
    api.getThreads()
      .then((data) => {
        setThreads(data.threads);
        // Auto-select first thread if none selected on desktop
        if (!activeThreadId && data.threads.length > 0 && window.innerWidth >= 640) {
          setSearchParams({ thread: data.threads[0].thread_id });
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleSelectThread = (threadId) => {
    setSearchParams({ thread: threadId });
    setShowThreads(false);
  };

  const handleBookingClick = ({ teacher, timeSlots, bookings, preselect }) => {
    setBookingModal({ teacher, timeSlots, bookings, preselect: preselect || null });
  };

  if (loading) return <div className="text-center py-16 text-stone">Loading...</div>;

  const totalUnread = threads.reduce((sum, t) => sum + t.unread_count, 0);

  return (
    <div className="max-w-4xl mx-auto px-4 py-4 sm:py-8">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold font-serif">Messages</h1>
        {totalUnread > 0 && (
          <span className="text-sm text-stone">{totalUnread} unread</span>
        )}
      </div>

      <div className="bg-white rounded-xl border border-sand/60 overflow-hidden flex" style={{ height: '70vh' }}>
        {/* Thread list */}
        <div className={`w-full sm:w-80 sm:border-r border-sand/60 flex-shrink-0 overflow-y-auto ${
          activeThreadId && !showThreads ? 'hidden sm:block' : ''
        }`}>
          <ThreadList threads={threads} activeId={activeThreadId} onSelect={handleSelectThread} />
        </div>

        {/* Chat view */}
        <div className={`flex-1 flex flex-col min-h-0 ${!activeThreadId || showThreads ? 'hidden sm:flex' : ''}`}>
          {activeThreadId && (
            <button
              onClick={() => setShowThreads(true)}
              className="sm:hidden p-3 text-sm text-terracotta border-b border-sand/60 text-left"
            >
              &larr; Back to conversations
            </button>
          )}
          <ChatView
            threadId={activeThreadId}
            currentUserId={user?.id}
            onBookingClick={handleBookingClick}
          />
        </div>
      </div>

      {/* Booking Modal */}
      {bookingModal && (
        <BookingModal
          teacher={bookingModal.teacher}
          timeSlots={bookingModal.timeSlots}
          preselect={bookingModal.preselect}
          onClose={() => setBookingModal(null)}
        />
      )}
    </div>
  );
}
