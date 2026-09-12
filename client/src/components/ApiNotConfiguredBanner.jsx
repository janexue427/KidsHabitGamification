import { apiIsConfigured } from '../api/client.js';

/**
 * Shown when the deployed build has no API address baked in. Without one every
 * write lands on the static host and comes back 405, so say that up front
 * instead of letting someone fill in a signup form to find out.
 */
export default function ApiNotConfiguredBanner() {
  if (apiIsConfigured) return null;

  return (
    <div
      role="status"
      className="bg-amber-50 border-b-2 border-amber-300 px-4 py-3 text-center"
    >
      <p className="text-sm font-semibold text-amber-900">
        ⚠️ Demo only — no server connected
      </p>
      <p className="text-xs text-amber-800 mt-0.5 max-w-lg mx-auto">
        You can look around, but signing up and saving XP need a running API.
        Whoever deployed this site has to set <code className="font-mono">VITE_API_BASE_URL</code>.
      </p>
    </div>
  );
}
