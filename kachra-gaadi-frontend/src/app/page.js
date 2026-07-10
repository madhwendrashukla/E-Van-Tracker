"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import api from "../utils/axios";
import Link from "next/link";
import { getTenantDomainClient, subdomainToDisplayName } from "../utils/tenant";

export default function Home() {
  const [tenantSubdomain, setTenantSubdomain] = useState(null);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    const domain = getTenantDomainClient();
    setTenantSubdomain(domain);
    setIsInitializing(false);
  }, []);

  if (isInitializing) {
    return <div className="min-h-screen bg-[#0b0f1a]" />; // Empty while detecting domain
  }

  // If on a city subdomain, show the Citizen tracker
  if (tenantSubdomain) {
    return <CitizenHome tenantSubdomain={tenantSubdomain} />;
  }

  // If on the root domain (dbeos.in), show the Superadmin global monitor
  return <SuperadminHome />;
}

// ─────────────────────────────────────────────────────────────────────────────
// SUPERADMIN HOME (Root domain: dbeos.in)
// ─────────────────────────────────────────────────────────────────────────────
function SuperadminHome() {
  const router = useRouter();
  const [cities, setCities] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [selectedCity, setSelectedCity] = useState("");
  const [selectedVehicle, setSelectedVehicle] = useState("");
  const [loading, setLoading] = useState(true);
  const [vehiclesLoading, setVehiclesLoading] = useState(false);
  const [error, setError] = useState("");

  // Check auth & load cities
  useEffect(() => {
    api.get("/api/auth/me")
      .then((res) => {
        const u = res.data.user || res.data.data;
        if (!u || u.role !== "superadmin") {
          router.replace("/login");
          return;
        }
        return api.get("/api/cities");
      })
      .then((res) => {
        if (res?.data?.success) {
          setCities(res.data.data.filter(c => !c.deleted_at));
        }
      })
      .catch(() => {
        router.replace("/login");
      })
      .finally(() => setLoading(false));
  }, [router]);

  // Load vehicles when city changes
  useEffect(() => {
    if (!selectedCity) {
      setVehicles([]);
      setSelectedVehicle("");
      return;
    }
    setVehiclesLoading(true);
    setSelectedVehicle("");
    api.get("/api/vehicles", { headers: { "x-tenant-domain": selectedCity } })
      .then((res) => {
        if (res.data.success) setVehicles(res.data.data);
      })
      .catch(() => setVehicles([]))
      .finally(() => setVehiclesLoading(false));
  }, [selectedCity]);

  const handleTrack = (e) => {
    e.preventDefault();
    if (selectedVehicle) {
      router.push(`/track/${selectedVehicle}?city=${selectedCity}`);
    }
  };

  const handleLogout = async () => {
    try { await api.post("/api/auth/logout"); } catch (_) {}
    document.cookie = "accessToken=; path=/; max-age=0; SameSite=Lax; Secure";
    document.cookie = "refreshToken=; path=/; max-age=0; SameSite=Lax; Secure";
    router.replace("/login");
  };

  const selectedCityData = cities.find(c => c.subdomain === selectedCity || c.code === selectedCity);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0b0f1a] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-400 text-sm">Loading platform...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b0f1a] text-white flex flex-col">
      <nav className="border-b border-white/5 bg-[#0d1120]/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center text-sm font-black">E</div>
            <span className="font-bold text-white/90">E-Van Tracker</span>
            <span className="text-xs bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full ml-1">Superadmin</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/superadmin" className="text-sm text-gray-400 hover:text-white transition-colors">
              Full Dashboard →
            </Link>
            <button onClick={handleLogout} className="text-sm text-gray-500 hover:text-red-400 transition-colors">
              Logout
            </button>
          </div>
        </div>
      </nav>

      <div className="flex-1 flex flex-col items-center justify-center px-6 py-16">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-emerald-500/5 rounded-full blur-[120px] pointer-events-none" />

        <div className="relative w-full max-w-lg">
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-4 py-1.5 text-xs text-emerald-400 font-medium mb-5">
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
              Global Fleet Monitor
            </div>
            <h1 className="text-4xl font-black text-white mb-3 tracking-tight">Track Any Vehicle</h1>
            <p className="text-gray-400 text-sm">Select a city, pick a vehicle — see it live on the map.</p>
          </div>

          <div className="bg-white/5 border border-white/8 rounded-3xl p-8 backdrop-blur-sm">
            {error && (
              <div className="mb-6 bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-4 py-3 rounded-xl">{error}</div>
            )}

            <form onSubmit={handleTrack} className="space-y-5">
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-gray-400 tracking-widest uppercase">City / Municipality</label>
                <div className="relative">
                  <select
                    value={selectedCity}
                    onChange={(e) => setSelectedCity(e.target.value)}
                    className="w-full appearance-none bg-white/5 border border-white/10 text-white py-3.5 pl-4 pr-10 rounded-xl focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 transition-all text-sm cursor-pointer"
                    required
                  >
                    <option value="" disabled className="bg-[#0d1120] text-gray-400">— Select a city —</option>
                    {cities.map((c) => (
                      <option key={c.id} value={c.subdomain || c.code} className="bg-[#0d1120] text-white">
                        {c.name} ({c.code}){c.status === "inactive" ? " ⏸ Inactive" : ""}
                      </option>
                    ))}
                  </select>
                  <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none">
                    <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  </div>
                </div>
                {selectedCityData && (
                  <div className="flex items-center gap-2 mt-1.5 px-1">
                    <span className={`w-1.5 h-1.5 rounded-full ${selectedCityData.status === 'active' ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                    <span className="text-xs text-gray-500">
                      {selectedCityData.status === 'active' ? 'Active — tracking enabled' : 'Inactive — tracking paused'}
                    </span>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-bold text-gray-400 tracking-widest uppercase">Vehicle</label>
                <div className="relative">
                  <select
                    value={selectedVehicle}
                    onChange={(e) => setSelectedVehicle(e.target.value)}
                    disabled={!selectedCity || vehiclesLoading}
                    className="w-full appearance-none bg-white/5 border border-white/10 text-white py-3.5 pl-4 pr-10 rounded-xl focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 transition-all text-sm cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    required
                  >
                    <option value="" disabled className="bg-[#0d1120] text-gray-400">
                      {vehiclesLoading ? "Loading vehicles..." : !selectedCity ? "— Select a city first —" : vehicles.length === 0 ? "No vehicles in this city" : "— Select a vehicle —"}
                    </option>
                    {vehicles.map((v) => (
                      <option key={v.id} value={v.vehicle_code} className="bg-[#0d1120] text-white">
                        {v.vehicle_code}{v.drivers?.name ? ` — ${v.drivers.name}` : ""}{v.status === "inactive" ? " (inactive)" : ""}
                      </option>
                    ))}
                  </select>
                  <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none">
                    {vehiclesLoading ? (
                      <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    )}
                  </div>
                </div>
                {selectedCity && !vehiclesLoading && (
                  <p className="text-xs text-gray-600 px-1">{vehicles.length} vehicle{vehicles.length !== 1 ? "s" : ""} registered</p>
                )}
              </div>

              <button
                type="submit"
                disabled={!selectedCity || !selectedVehicle}
                className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-500/30 disabled:cursor-not-allowed text-white py-4 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 mt-2"
                style={{ boxShadow: selectedVehicle ? "0 8px 24px -6px rgba(16,185,129,0.4)" : "none" }}
              >
                <span>Track Live</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
              </button>
            </form>
          </div>

          <div className="mt-8 grid grid-cols-3 gap-4">
            {[
              { label: "Total Cities", value: cities.length },
              { label: "Active Cities", value: cities.filter(c => c.status === "active").length },
              { label: "Inactive", value: cities.filter(c => c.status === "inactive").length },
            ].map((stat) => (
              <div key={stat.label} className="bg-white/3 border border-white/5 rounded-2xl p-4 text-center">
                <div className="text-2xl font-black text-white">{stat.value}</div>
                <div className="text-[11px] text-gray-500 mt-0.5">{stat.label}</div>
              </div>
            ))}
          </div>

          <p className="text-center text-xs text-gray-600 mt-6">
            Need to manage cities or admins?{" "}
            <Link href="/superadmin" className="text-emerald-400 hover:text-emerald-300 transition-colors font-medium">Open Superadmin Dashboard →</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CITIZEN HOME (Subdomain: e.g., lucknow.dbeos.in)
// ─────────────────────────────────────────────────────────────────────────────
function CitizenHome({ tenantSubdomain }) {
  const router = useRouter();
  const [vehicleCode, setVehicleCode] = useState("");
  const [cityId, setCityId] = useState("");
  const [cityStatus, setCityStatus] = useState("loading");
  const [logoUrl, setLogoUrl] = useState("/logo.svg");
  const [brandColor, setBrandColor] = useState("#4ade80");

  useEffect(() => {
    api.get(`/api/cities/by-domain/${tenantSubdomain}`)
      .then(res => {
        if (res.data.success) {
          setCityId(res.data.data.code || res.data.data.id);
          setCityStatus(res.data.data.status);
          if (res.data.data.logo_url) setLogoUrl(res.data.data.logo_url);
          if (res.data.data.brand_color) setBrandColor(res.data.data.brand_color);
        }
      })
      .catch(err => {
        console.error("Failed to load tenant city", err);
        setCityStatus("inactive"); // Default to inactive on error
      });
  }, [tenantSubdomain]);

  const handleSearch = (e) => {
    e.preventDefault();
    if (cityId && vehicleCode) {
      router.push(`/track/${vehicleCode}?city=${cityId}`);
    }
  };

  if (cityStatus === "inactive") {
    return (
      <main className="min-h-screen relative flex flex-col items-center justify-center bg-[#f3f5f9]">
        <div className="z-10 w-full max-w-[460px] px-4 text-center">
          <div className="bg-white rounded-[32px] shadow-lg p-10 flex flex-col items-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center text-3xl mb-4">⏸️</div>
            <h1 className="text-2xl font-black text-gray-800 mb-2">Tracking Unavailable</h1>
            <p className="text-gray-500 text-sm">
              The tracking service for <strong>{subdomainToDisplayName(tenantSubdomain)}</strong> is currently inactive. Please check back later.
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen relative flex flex-col items-center justify-center overflow-hidden bg-[#f3f5f9] bg-[radial-gradient(#e5e7eb_1.5px,transparent_1.5px)] [background-size:24px_24px]">
      <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-[#bbf7d0] opacity-40 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-[#bbf7d0] opacity-40 rounded-full blur-[120px] pointer-events-none"></div>

      <div className="z-10 w-full max-w-[460px] px-4">
        <div className="bg-white rounded-[32px] shadow-[0_30px_60px_-15px_rgba(0,0,0,0.05)] p-10 flex flex-col items-center">
          
          <div className="mb-5 rounded-[14px] overflow-hidden flex items-center justify-center p-2 bg-white" style={{ boxShadow: `0 8px 16px ${brandColor}26` }}>
            <img src={logoUrl} alt="Tracking Logo" className="w-16 h-16 object-contain" />
          </div>

          <h1 className="text-[34px] font-black mb-2 tracking-tight" style={{ color: brandColor }}>
            {subdomainToDisplayName(tenantSubdomain)}
          </h1>
          <p className="text-[13px] text-gray-500 font-medium mb-10">
            Citizen Tracking Portal
          </p>

          <form onSubmit={handleSearch} className="w-full space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-700 tracking-wider">CITY / MUNICIPALITY</label>
              <div className="relative">
                <select 
                  value={cityId}
                  disabled
                  className="w-full appearance-none bg-[#f8fafc] border border-gray-100 text-slate-600 py-3.5 px-4 rounded-xl focus:outline-none transition-colors text-[13px] font-medium shadow-sm opacity-70"
                >
                  <option value={cityId}>{subdomainToDisplayName(tenantSubdomain)}</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-700 tracking-wider">VEHICLE REGISTRATION</label>
              <input 
                type="text" 
                placeholder="E.G. LKO-001"
                value={vehicleCode}
                onChange={(e) => setVehicleCode(e.target.value)}
                className="w-full bg-[#f8fafc] border border-gray-100 text-slate-600 py-3.5 px-4 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#4ade80] transition-colors text-[13px] uppercase placeholder:normal-case font-mono shadow-sm"
                required
              />
            </div>

            <div className="pt-4 flex flex-col items-center space-y-6">
              <button 
                type="submit"
                style={{ backgroundColor: brandColor, boxShadow: `0 8px 20px -6px ${brandColor}80` }}
                className="w-full text-white py-4 px-4 rounded-xl font-bold text-[14px] flex justify-center items-center gap-2 transition-all hover:opacity-90"
              >
                Locate My Vehicle &rarr;
              </button>
              
              <Link href="/admin" style={{ color: brandColor }} className="font-bold text-[12px] transition-colors hover:opacity-80">
                Admin Dashboard &rarr;
              </Link>
            </div>
          </form>

        </div>
      </div>
    </main>
  );
}
