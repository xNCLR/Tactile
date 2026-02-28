import { useEffect, useState, useRef } from 'react';
import { api } from '../api/client';

export default function GoogleSignIn({ onSuccess, onError, text = 'signin_with' }) {
  const [clientId, setClientId] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const buttonRef = useRef(null);

  // Fetch the Google Client ID from server
  useEffect(() => {
    api.getGoogleClientId()
      .then(data => setClientId(data.clientId))
      .catch(() => setClientId(null));
  }, []);

  // Load the Google Identity Services script
  useEffect(() => {
    if (!clientId) return;

    // Check if already loaded
    if (window.google?.accounts?.id) {
      setLoaded(true);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => setLoaded(true);
    script.onerror = () => console.error('Failed to load Google Sign-In');
    document.head.appendChild(script);

    return () => {
      // Don't remove the script on unmount — other components may need it
    };
  }, [clientId]);

  // Initialize the button once script is loaded
  useEffect(() => {
    if (!loaded || !clientId || !buttonRef.current) return;

    try {
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async (response) => {
          try {
            const data = await api.googleLogin(response.credential);
            onSuccess?.(data);
          } catch (err) {
            onError?.(err.message || 'Google login failed');
          }
        },
      });

      window.google.accounts.id.renderButton(buttonRef.current, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        width: buttonRef.current.offsetWidth || 320,
        text,
        shape: 'rectangular',
        logo_alignment: 'left',
      });
    } catch (err) {
      console.error('Google Sign-In init error:', err);
    }
  }, [loaded, clientId, onSuccess, onError, text]);

  // Don't render anything if Google OAuth isn't configured
  if (!clientId) return null;

  return (
    <div className="w-full">
      <div ref={buttonRef} className="w-full flex justify-center" />
    </div>
  );
}
