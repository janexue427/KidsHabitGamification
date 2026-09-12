import { useEffect, useState } from 'react';
import { api } from '../../api/client.js';

export default function ParentSuggestions() {
  const [suggestions, setSuggestions] = useState([]);
  const [filter, setFilter] = useState('pending');

  async function load() {
    const data = await api.get(`/suggestions?status=${filter}`);
    setSuggestions(data.suggestions);
  }

  useEffect(() => {
    load();
  }, [filter]);

  async function resolve(s, decision) {
    const parentNote = decision === 'rejected' ? prompt('Optional note for the kid:') || '' : '';
    await api.post(`/suggestions/${s.id}/resolve`, { decision, parentNote });
    load();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-fun text-2xl font-bold text-kid-purple">Suggestions</h2>
        <select value={filter} onChange={(e) => setFilter(e.target.value)} className="text-sm border rounded-lg px-2 py-1">
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      <div className="space-y-3">
        {suggestions.map((s) => (
          <div key={s.id} className="bg-white rounded-2xl p-4 shadow">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-gray-400 uppercase font-semibold">{s.type} · from {s.kid?.avatar} {s.kid?.name}</p>
                <p className="font-fun font-bold text-lg">{s.title}</p>
                {s.description && <p className="text-sm text-gray-500">{s.description}</p>}
                {s.proposedXp && <p className="text-xs text-kid-purple font-semibold mt-1">Suggested: {s.proposedXp} XP</p>}
              </div>
              {s.status === 'pending' && (
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => resolve(s, 'approved')} className="text-xs bg-green-100 text-green-700 px-3 py-1.5 rounded-lg font-semibold">
                    Approve
                  </button>
                  <button onClick={() => resolve(s, 'rejected')} className="text-xs bg-red-100 text-red-600 px-3 py-1.5 rounded-lg font-semibold">
                    Reject
                  </button>
                </div>
              )}
            </div>
            {s.status === 'approved' && (
              <p className="text-xs text-green-600 mt-2">
                Approved — create the matching {s.type} on the {s.type === 'task' ? 'Tasks' : 'Milestones'} page to activate it.
              </p>
            )}
          </div>
        ))}
        {suggestions.length === 0 && <p className="text-gray-400 text-sm">Nothing here.</p>}
      </div>
    </div>
  );
}
