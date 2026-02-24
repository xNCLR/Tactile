import { useState, useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../api/client';

function ThreadList({ threads, activeId, onSelect }) {
  if (threads.length === 0) {
    return (
      <div className="p-8 text-center text-gray-400 text-sm">
        No conversations yet. Book a lesson to start chatting!
      </div>
    );
  }

  return (
    <div className="divide-y divide-gray-100">
      {threads.map((thread) => (
        <button
          key={thread.id}
          onClick={() => onSelect(thread.id)}
          className={`w-full text-left p-4 hover:bg-gray-50 transition-colors ${activeId === thread.id ? 'bg-brand-50' : ''}`}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-100 to-brand-200 flex items-center justify-center overflow-hidden flex-shrink-0">
              {thread.other_photo ? (
                <img src={thread.other_photo} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-sm font-bold text-brand-500">
                  {thread.other_name?.split(' ').map((n) => n[0]).join('').toUpperCase()}
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm">{thread.other_name}</span>
                {thread.unread_count > 0 && (
                  <span className="bg-brand-600 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
                    {thread.unread_count}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400 truncate">
                {thread.last_message || `Lesson on ${thread.booking_date}`}
              </p>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}

function ChatView({ bookingId, currentUserId }) {
  const [messages, setMessages] = useState([]);
  const [otherUser, setOtherUser] = useState(null);
  const [bookingInfo, setBookingInfo] = useState(null);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (!bookingId) return;
    setLoading(true);
    api.getMessages(bookingId)
      .then((data) => {
        setMessages(data.messages);
        setOtherUser(data.otherUser);
        setBookingInfo(data.booking);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [bookingId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Poll for new messages
  useEffect(() => {
    if (!bookingId) return;
    const interval = setInterval(() => {
      api.getMessages(bookingId)
        .then((data) => setMessages(data.messages))
        .catch(() => {});
    }, 5000);
    return () => clearInterval(interval);
  }, [bookingId]);

  const handleSend = async () => {
    if (!newMessage.trim() || sending) return;
    setSending(true);
    try {
      const { message } = await api.sendMessage(bookingId, newMessage.trim());
      setMessages((prev) => [...prev, message]);
      setNewMessage('');
    } catch (err) {
      console.error('Send failed:', err);
    } finally {
      setSending(false);
    }
  };

  if (!bookingId) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
        Select a conversation
      </div>
    );
  }

  if (loading) {
    return <div className="flex-1 flex items-center justify-center text-gray-400">Loading...</div>;
  }

  return (
    <div className="flex-1 flex flex-col">
      {/* Chat header */}
      <div className="p-4 border-b border-gray-200 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-100 to-brand-200 flex items-center justify-center overflow-hidden">
          {otherUser?.profile_photo ? (
            <img src={otherUser.profile_photo} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="text-xs font-bold text-brand-500">
              {otherUser?.name?.split(' ').map((n) => n[0]).join('').toUpperCase()}
            </span>
          )}
        </div>
        <div>
          <p className="font-medium text-sm">{otherUser?.name}</p>
          <p className="text-xs text-gray-400">Lesson on {bookingInfo?.date} at {bookingInfo?.time}</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <p className="text-center text-gray-400 text-sm py-8">No messages yet. Say hello!</p>
        )}
        {messages.map((msg) => {
          const isMine = msg.sender_id === currentUserId;
          return (
            <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[75%] px-4 py-2 rounded-2xl text-sm ${
                isMine
                  ? 'bg-brand-600 text-white rounded-br-md'
                  : 'bg-gray-100 text-gray-800 rounded-bl-md'
              }`}>
                <p>{msg.content}</p>
                <p className={`text-xs mt-1 ${isMine ? 'text-brand-200' : 'text-gray-400'}`}>
                  {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-gray-200">
        <div className="flex gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Type a message..."
            className="flex-1 border border-gray-200 rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <button
            onClick={handleSend}
            disabled={!newMessage.trim() || sending}
            className="bg-brand-600 text-white px-4 py-2 rounded-full text-sm font-medium hover:bg-brand-700 disabled:opacity-50 transition-colors"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Messages() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showThreads, setShowThreads] = useState(true);

  const activeBookingId = searchParams.get('booking');

  useEffect(() => {
    api.getThreads()
      .then((data) => {
        setThreads(data.threads);
        // Auto-select first thread if none selected on desktop
        if (!activeBookingId && data.threads.length > 0 && window.innerWidth >= 640) {
          setSearchParams({ booking: data.threads[0].id });
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleSelectThread = (bookingId) => {
    setSearchParams({ booking: bookingId });
    setShowThreads(false); // Hide thread list on mobile
  };

  if (loading) return <div className="text-center py-16 text-gray-400">Loading...</div>;

  // Calculate total unread
  const totalUnread = threads.reduce((sum, t) => sum + t.unread_count, 0);

  return (
    <div className="max-w-4xl mx-auto px-4 py-4 sm:py-8">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Messages</h1>
        {totalUnread > 0 && (
          <span className="text-sm text-gray-400">{totalUnread} unread</span>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden flex" style={{ height: '70vh' }}>
        {/* Thread list — visible on desktop, toggle on mobile */}
        <div className={`w-full sm:w-80 sm:border-r border-gray-200 flex-shrink-0 overflow-y-auto ${
          activeBookingId && !showThreads ? 'hidden sm:block' : ''
        }`}>
          <ThreadList threads={threads} activeId={activeBookingId} onSelect={handleSelectThread} />
        </div>

        {/* Chat view */}
        <div className={`flex-1 flex flex-col ${!activeBookingId || showThreads ? 'hidden sm:flex' : ''}`}>
          {activeBookingId && (
            <button
              onClick={() => setShowThreads(true)}
              className="sm:hidden p-3 text-sm text-brand-600 border-b border-gray-200 text-left"
            >
              ← Back to conversations
            </button>
          )}
          <ChatView bookingId={activeBookingId} currentUserId={user?.id} />
        </div>
      </div>
    </div>
  );
}
