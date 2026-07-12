/* eslint-disable */
"use client";

import { useState, useEffect, useCallback } from "react";
import api from "../../utils/axios";

// ── Status Badge ──────────────────────────────────────────────────────────────
const StatusBadge = ({ status }) => (
  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
    status === 'active'
      ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
      : 'bg-red-50 text-red-600 border border-red-200'
  }`}>
    <span className={`w-1.5 h-1.5 rounded-full ${status === 'active' ? 'bg-emerald-500' : 'bg-red-500'}`} />
    {status === 'active' ? 'Active' : 'Inactive'}
  </span>
);

// ── KPI Card ──────────────────────────────────────────────────────────────────
const KpiCard = ({ label, value, icon, color }) => (
  <div className={`bg-white shadow-sm border border-gray-100 rounded-3xl p-5 md:p-6 flex items-center gap-5 hover:shadow-md transition-shadow`}>
    <div className={`w-14 h-14 md:w-16 md:h-16 rounded-2xl flex items-center justify-center text-3xl shrink-0 ${color}`}>{icon}</div>
    <div>
      <p className="text-gray-500 text-xs font-bold uppercase tracking-widest mb-1">{label}</p>
      <p className="text-gray-900 text-3xl md:text-4xl font-black">{value ?? '—'}</p>
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
      ? `https://${process.env.NEXT_PUBLIC_BASE_DOMAIN || 'mybuildspace.in'}/accept-invite?token=${inviteResult.invitation.token}`
      : null;
    return (
      <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-white border border-gray-100 rounded-3xl p-8 w-full max-w-md text-center shadow-2xl">
          <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">✅</div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">City Created!</h3>
          <p className="text-gray-500 text-sm mb-6">{inviteResult.message}</p>
          {inviteLink && (
            <div className="bg-gray-50 rounded-xl p-4 mb-6 text-left border border-gray-100">
              <p className="text-xs text-gray-500 mb-2 font-medium">Send this invite link to the City Admin:</p>
              <p className="text-indigo-600 text-xs break-all font-mono font-medium">{inviteLink}</p>
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
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white border border-gray-100 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-white">
          <h3 className="text-xl font-bold text-gray-900">Create New City</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4 bg-gray-50/30">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wider">City Name *</label>
              <input name="name" required value={form.name} onChange={handleChange}
                className="w-full bg-white border border-gray-200 text-gray-900 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-shadow"
                placeholder="e.g. Lucknow" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wider">City Code *</label>
              <input name="code" required value={form.code} onChange={handleChange}
                className="w-full bg-white border border-gray-200 text-gray-900 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-shadow uppercase"
                placeholder="e.g. LKO" maxLength={5} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wider">State</label>
              <input name="state" value={form.state} onChange={handleChange}
                className="w-full bg-white border border-gray-200 text-gray-900 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-shadow"
                placeholder="e.g. Uttar Pradesh" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wider">Subdomain *</label>
              <div className="flex items-center bg-white border border-gray-200 rounded-xl focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500 overflow-hidden transition-shadow">
                <input name="subdomain" required value={form.subdomain} onChange={handleChange}
                  className="flex-1 bg-transparent text-gray-900 px-4 py-2.5 text-sm focus:outline-none"
                  placeholder="lucknow" />
                <span className="text-gray-400 text-xs pr-3 font-mono">.mybuildspace.in</span>
              </div>
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-wider">Custom Domain (optional)</label>
              <input name="custom_domain" value={form.custom_domain} onChange={handleChange}
                className="w-full bg-white border border-gray-200 text-gray-900 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-shadow"
                placeholder="e.g. tracker.city.gov.in" />
            </div>
          </div>
          <div className="pt-4 border-t border-gray-100 mt-2">
            <p className="text-xs text-gray-500 mb-3 font-bold uppercase tracking-wider">Contact <span className="normal-case tracking-normal font-normal opacity-70">(optional — for City Admin invite)</span></p>
            <div className="space-y-3">
              <input name="contact_name" value={form.contact_name} onChange={handleChange}
                className="w-full bg-white border border-gray-200 text-gray-900 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-shadow"
                placeholder="Contact person name" />
              <input name="contact_email" type="email" value={form.contact_email} onChange={handleChange}
                className="w-full bg-white border border-gray-200 text-gray-900 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-shadow"
                placeholder="cityadmin@example.com" />
              <input name="contact_phone" value={form.contact_phone} onChange={handleChange}
                className="w-full bg-white border border-gray-200 text-gray-900 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-shadow"
                placeholder="Phone number" />
            </div>
          </div>
          {error && <p className="text-red-500 text-sm text-center">{error}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-bold py-3 rounded-xl transition-colors text-sm shadow-sm">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-colors text-sm shadow-md">
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
      <header className="h-24 bg-transparent border-b border-gray-100 flex items-center justify-between px-8 shrink-0">
        <div>
          <h1 className="text-3xl font-black text-gray-900">Platform Overview</h1>
          <p className="text-gray-500 text-sm font-medium mt-1">Manage all city tenants</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-6 py-3 rounded-xl transition-colors text-sm shadow-md"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
          New City
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            <KpiCard label="Total Cities" value={kpis.total_cities} icon={<svg className="w-7 h-7 md:w-8 md:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path></svg>} color="bg-indigo-50 text-indigo-500" />
            <KpiCard label="Active Cities" value={kpis.active_cities} icon={<svg className="w-7 h-7 md:w-8 md:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>} color="bg-emerald-50 text-emerald-500" />
            <KpiCard label="Total Vehicles" value={kpis.total_vehicles} icon={<svg className="w-7 h-7 md:w-8 md:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>} color="bg-blue-50 text-blue-500" />
            <KpiCard label="Active Now" value={kpis.active_vehicles_now} icon={<svg className="w-7 h-7 md:w-8 md:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>} color="bg-orange-50 text-orange-500" />
          </div>
        )}

        {/* Cities Table */}
        <div className="bg-white border border-gray-100 rounded-3xl overflow-hidden shadow-sm">
          {/* Table Header */}
          <div className="p-5 md:p-6 border-b border-gray-100 flex items-center justify-between gap-4 bg-white">
            <h2 className="text-lg font-bold text-gray-900">Cities ({cities.length})</h2>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search cities…"
              className="bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-indigo-500 w-56 transition-colors placeholder-gray-400"
            />
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20 text-gray-500 font-medium">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20 text-gray-400">
              <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path></svg>
              <p className="font-medium text-gray-500">{search ? 'No cities match your search' : 'No cities yet. Create your first one!'}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[800px]">
                <thead className="bg-gray-50">
                  <tr className="border-b border-gray-100">
                    {['City', 'Subdomain', 'Contact', 'Vehicles', 'Active Now', 'Status', 'Actions'].map(h => (
                      <th key={h} className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {filtered.map(city => (
                    <tr key={city.id} className="hover:bg-gray-50 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="font-semibold text-gray-900">{city.name}</div>
                        <div className="text-gray-500 text-xs font-mono">{city.code} · {city.state || '—'}</div>
                      </td>
                      <td className="px-6 py-4">
                        <a
                          href={`https://${city.subdomain}.mybuildspace.in`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-indigo-600 hover:text-indigo-500 font-mono text-xs transition-colors block mb-1"
                        >
                          {city.subdomain}.mybuildspace.in ↗
                        </a>
                        {city.custom_domain && (
                          <a
                            href={`https://${city.custom_domain}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-emerald-600 hover:text-emerald-500 font-mono text-xs transition-colors"
                          >
                            {city.custom_domain} ↗
                          </a>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-gray-900 text-xs font-medium">{city.contact_name || '—'}</div>
                        <div className="text-gray-500 text-xs">{city.contact_email || ''}</div>
                      </td>
                      <td className="px-6 py-4 text-gray-900 font-bold">{city.vehicle_count ?? 0}</td>
                      <td className="px-6 py-4">
                        <span className={`font-bold ${city.active_count > 0 ? 'text-emerald-600' : 'text-gray-400'}`}>
                          {city.active_count ?? 0}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <StatusBadge status={city.status} />
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => toggleStatus(city)}
                            className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-colors ${
                              city.status === 'active'
                                ? 'bg-amber-50 text-amber-600 hover:bg-amber-500 hover:text-white'
                                : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-500 hover:text-white'
                            }`}
                          >
                            {city.status === 'active' ? 'Deactivate' : 'Activate'}
                          </button>
                          <button
                            onClick={() => softDelete(city)}
                            className="text-xs font-bold px-3 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-500 hover:text-white transition-colors"
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
