import { useEffect, useRef, useState } from 'react';

const SCRIPT_SRC = 'https://accounts.google.com/gsi/client';
const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

let scriptPromise = null;
function loadGoogleScript() {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const el = document.createElement('script');
    el.src = SCRIPT_SRC;
    el.async = true;
    el.onload = resolve;
    el.onerror = () => reject(new Error('Could not load Google sign-in'));
    document.head.appendChild(el);
  });
  return scriptPromise;
}

/**
 * Renders Google's own sign-in button and hands the resulting ID token up.
 *
 * Nothing is shown unless the app was built with a client id and the server
 * says it can verify one — a button that cannot possibly work is worse than
 * no button at all.
 */
export default function GoogleSignIn({ enabled, onCredential, disabled }) {
  const holder = useRef(null);
  const [error, setError] = useState('');
  const callbackRef = useRef(onCredential);
  callbackRef.current = onCredential;

  useEffect(() => {
    if (!clientId || !enabled) return;
    let cancelled = false;

    loadGoogleScript()
      .then(() => {
        if (cancelled || !holder.current) return;
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (response) => callbackRef.current?.(response.credential),
        });
        window.google.accounts.id.renderButton(holder.current, {
          theme: 'outline',
          size: 'large',
          width: holder.current.offsetWidth || 320,
          text: 'continue_with',
          shape: 'pill',
        });
      })
      .catch((e) => !cancelled && setError(e.message));

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  if (!clientId || !enabled) return null;

  return (
    <div className={disabled ? 'opacity-50 pointer-events-none' : ''}>
      <div ref={holder} className="flex justify-center min-h-[44px]" />
      {error && <p className="text-red-500 text-sm text-center mt-2">{error}</p>}
    </div>
  );
}
