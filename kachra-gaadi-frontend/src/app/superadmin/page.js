"use client";

import { useState, useEffect, useCallback } from "react";
import api from "../../utils/axios";

// ── Status Badge ──────────────────────────────────────────────────────────────
const StatusBadge = ({ status }) => (
  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
    status === 'active'
      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
      : 'bg-red-500/15 text-red-400 border border-red-500/30'
  }`}>
    <span className={`w-1.5 h-1.5 rounded-full ${status === 'active' ? 'bg-emerald-400' : 'bg-red-400'}`} />
    {status === 'active' ? 'Active' : 'Inactive'}
  </span>
);

// ── KPI Card ──────────────────────────────────────────────────────────────────
const KpiCard = ({ label, value, icon, color }) => (
  <div className={`bg-slate-900 border border-slate-800 rounded-2xl p-5 flex items-center gap-4`}>
    <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${color}`}>{icon}</div>
    <div>
      <p className="text-slate-400 text-xs font-medium uppercase tracking-wider">{label}</p>
      <p className="text-white text-2xl font-black mt-0.5">{value ?? '—'}</p>
    </div>
  </div>
);

// ── Create City Modal ─────────────────────────────────────────────────────────
const CreateCityModal = ({ onClose, onCreated }) => {
  const [form, setForm] = useState({
    name: '', code: '', state: '', subdomain: '', custom_domain: '',
    contact_name: '', contact_email: '', contact_phone: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [inviteResult, setInviteResult] = useState(null);

  const autoSubdomain = (name) => name.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9-]/g, '');

  const handleChange = (e) => {
    const updates = { ...form, [e.target.name]: e.target.value };
    if (e.target.name === 'name' && !form.subdomain) {
      updates.subdomain = autoSubdomain(e.target.value);
    }
    setForm(updates);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await api.post('/api/superadmin/cities', form);
      if (res.data.success) {
        setInviteResult(res.data);
        onCreated();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Error creating city');
    } finally {
      setLoading(false);
    }
  };

  if (inviteResult) {
    const inviteLink = inviteResult.invitation
      ? `${window.location.origin.replace(/^[^.]+/, 'app')}/accept-invite?token=${inviteResult.invitation.token}`
      : null;
    return (
      <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
        <div className="bg-slate-900 border border-slate-700 rounded-2xl p-8 w-full max-w-md text-center">
          <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">✅</div>
          <h3 className="text-xl font-bold text-white mb-2">City Created!</h3>
          <p className="text-slate-400 text-sm mb-6">{inviteResult.message}</p>
          {inviteLink && (
            <div className="bg-slate-800 rounded-xl p-4 mb-6 text-left">
              <p className="text-xs text-slate-400 mb-2 font-medium">Send this invite link to the City Admin:</p>
              <p className="text-indigo-300 text-xs break-all font-mono">{inviteLink}</p>
            </div>
          )}
          <button onClick={onClose} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-xl transition-colors">
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg">
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-xl font-bold text-white">Create New City</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-2xl leading-none">×</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">City Name *</label>
              <input name="name" required value={form.name} onChange={handleChange}
                className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500"
                placeholder="e.g. Lucknow" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">City Code *</label>
              <input name="code" required value={form.code} onChange={handleChange}
                className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500 uppercase"
                placeholder="e.g. LKO" maxLength={5} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">State</label>
              <input name="state" value={form.state} onChange={handleChange}
                className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500"
                placeholder="e.g. Uttar Pradesh" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Subdomain *</label>
              <div className="flex items-center bg-slate-800 border border-slate-700 rounded-xl focus-within:border-indigo-500 overflow-hidden">
                <input name="subdomain" required value={form.subdomain} onChange={handleChange}
                  className="flex-1 bg-transparent text-white px-4 py-2.5 text-sm focus:outline-none"
                  placeholder="lucknow" />
                <span className="text-slate-500 text-xs pr-3 font-mono">.mybuildspace.in</span>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Custom Domain (optional)</label>
              <input name="custom_domain" value={form.custom_domain} onChange={handleChange}
                className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500"
                placeholder="e.g. tracker.city.gov.in" />
            </div>
          </div>
          <div className="pt-2 border-t border-slate-800">
            <p className="text-xs text-slate-500 mb-3 font-medium">Contact (optional — for City Admin invite)</p>
            <div className="space-y-3">
              <input name="contact_name" value={form.contact_name} onChange={handleChange}
                className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500"
                placeholder="Contact person name" />
              <input name="contact_email" type="email" value={form.contact_email} onChange={handleChange}
                className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500"
                placeholder="cityAdmin@example.com" />
              <input name="contact_phone" value={form.contact_phone} onChange={handleChange}
                className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500"
                placeholder="Phone number" />
            </div>
          </div>
          {error && <p className="text-red-400 text-sm text-center">{error}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 rounded-xl transition-colors text-sm">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-colors text-sm">
              {loading ? 'Creating…' : 'Create City'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function SuperadminPage() {
  const [cities, setCities] = useState([]);
  const [kpis, setKpis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [toast, setToast] = useState(null);
  const [search, setSearch] = useState('');

  const showToast = (msg, isError = false) => {
    setToast({ msg, isError });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [citiesRes, kpisRes] = await Promise.all([
        api.get('/api/superadmin/cities'),
        api.get('/api/superadmin/kpis'),
      ]);
      if (citiesRes.data.success) setCities(citiesRes.data.data);
      if (kpisRes.data.success) setKpis(kpisRes.data.data);
    } catch (err) {
      console.error(err);
      showToast('Error loading data', true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const toggleStatus = async (city) => {
    const newStatus = city.status === 'active' ? 'inactive' : 'active';
    try {
      await api.put(`/api/superadmin/cities/${city.id}/status`, { status: newStatus });
      showToast(`${city.name} ${newStatus === 'active' ? 'activated' : 'deactivated'}`);
      fetchData();
    } catch (err) {
      showToast(err.response?.data?.message || 'Error updating status', true);
    }
  };

  const softDelete = async (city) => {
    if (!confirm(`Remove "${city.name}" from the platform? Data will be retained but the city will be deactivated.`)) return;
    try {
      await api.delete(`/api/superadmin/cities/${city.id}`);
      showToast(`${city.name} removed from platform`);
      fetchData();
    } catch (err) {
      showToast(err.response?.data?.message || 'Error removing city', true);
    }
  };

  const filtered = cities.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.subdomain?.toLowerCase().includes(search.toLowerCase()) ||
    c.code?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      {/* Header */}
      <header className="h-20 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-8 shrink-0">
        <div>
          <h1 className="text-xl font-bold text-white">Platform Overview</h1>
          <p className="text-slate-500 text-sm">Manage all city tenants</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-5 py-2.5 rounded-xl transition-colors text-sm shadow-lg shadow-indigo-500/20"
        >
          <span className="text-lg">+</span> New City
        </button>
      </header>

      {/* Toast */}
      {toast && (
        <div className={`fixed top-6 right-6 z-50 px-5 py-3 rounded-xl shadow-2xl text-sm font-bold flex items-center gap-2 transition-all ${
          toast.isError ? 'bg-red-600 text-white' : 'bg-emerald-600 text-white'
        }`}>
          {toast.isError ? '❌' : '✅'} {toast.msg}
        </div>
      )}

      <div className="flex-1 overflow-auto p-8 space-y-8">

        {/* KPI Cards */}
        {kpis && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard label="Total Cities" value={kpis.total_cities} icon="🏙️" color="bg-indigo-500/20" />
            <KpiCard label="Active Cities" value={kpis.active_cities} icon="✅" color="bg-emerald-500/20" />
            <KpiCard label="Total Vehicles" value={kpis.total_vehicles} icon="🚛" color="bg-blue-500/20" />
            <KpiCard label="Active Now" value={kpis.active_vehicles_now} icon="📡" color="bg-orange-500/20" />
          </div>
        )}

        {/* Cities Table */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          {/* Table Header */}
          <div className="p-5 border-b border-slate-800 flex items-center justify-between gap-4">
            <h2 className="text-lg font-bold text-white">Cities ({cities.length})</h2>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search cities…"
              className="bg-slate-800 border border-slate-700 text-white text-sm rounded-xl px-4 py-2 focus:outline-none focus:border-indigo-500 w-56"
            />
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20 text-slate-500">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20 text-slate-600">
              <p className="text-4xl mb-3">🏙️</p>
              <p className="font-medium">{search ? 'No cities match your search' : 'No cities yet. Create your first one!'}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800">
                    {['City', 'Subdomain', 'Contact', 'Vehicles', 'Active Now', 'Status', 'Actions'].map(h => (
                      <th key={h} className="px-5 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filtered.map(city => (
                    <tr key={city.id} className="hover:bg-slate-800/40 transition-colors group">
                      <td className="px-5 py-4">
                        <div className="font-semibold text-white">{city.name}</div>
                        <div className="text-slate-500 text-xs font-mono">{city.code} · {city.state || '—'}</div>
                      </td>
                      <td className="px-5 py-4">
                        <a
                          href={`https://${city.subdomain}.mybuildspace.in`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-indigo-400 hover:text-indigo-300 font-mono text-xs transition-colors block mb-1"
                        >
                          {city.subdomain}.mybuildspace.in ↗
                        </a>
                        {city.custom_domain && (
                          <a
                            href={`https://${city.custom_domain}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-emerald-400 hover:text-emerald-300 font-mono text-xs transition-colors"
                          >
                            {city.custom_domain} ↗
                          </a>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <div className="text-slate-300 text-xs">{city.contact_name || '—'}</div>
                        <div className="text-slate-500 text-xs">{city.contact_email || ''}</div>
                      </td>
                      <td className="px-5 py-4 text-white font-bold">{city.vehicle_count ?? 0}</td>
                      <td className="px-5 py-4">
                        <span className={`font-bold ${city.active_count > 0 ? 'text-emerald-400' : 'text-slate-600'}`}>
                          {city.active_count ?? 0}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <StatusBadge status={city.status} />
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => toggleStatus(city)}
                            className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-colors ${
                              city.status === 'active'
                                ? 'bg-amber-500/15 text-amber-400 hover:bg-amber-500 hover:text-white'
                                : 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500 hover:text-white'
                            }`}
                          >
                            {city.status === 'active' ? 'Deactivate' : 'Activate'}
                          </button>
                          <button
                            onClick={() => softDelete(city)}
                            className="text-xs font-bold px-3 py-1.5 rounded-lg bg-red-500/15 text-red-400 hover:bg-red-500 hover:text-white transition-colors"
                          >
                            Remove
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Create City Modal */}
      {showCreate && (
        <CreateCityModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { fetchData(); }}
        />
      )}
    </>
  );
}
