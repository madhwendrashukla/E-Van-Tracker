"use client";

import { useState, useEffect } from "react";
import api from "../utils/axios";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function Home() {
  const [cityId, setCityId] = useState("");
  const [vehicleCode, setVehicleCode] = useState("");
  const [cities, setCities] = useState([]);
  const router = useRouter();

  useEffect(() => {
    api.get('/api/cities')
      .then(res => {
        if (res.data.success) {
          setCities(res.data.data);
        }
      })
      .catch(err => console.error("Failed to load cities", err));
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    if (cityId && vehicleCode) {
      router.push(`/track/${vehicleCode}?city=${cityId}`);
    }
  };

  return (
    <main className="min-h-screen relative flex flex-col items-center justify-center overflow-hidden bg-[#f3f5f9] bg-[radial-gradient(#e5e7eb_1.5px,transparent_1.5px)] [background-size:24px_24px]">
      
      {/* Background Glowing Blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-[#bbf7d0] opacity-40 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-[#bbf7d0] opacity-40 rounded-full blur-[120px] pointer-events-none"></div>

      <div className="z-10 w-full max-w-[460px] px-4">
        <div className="bg-white rounded-[32px] shadow-[0_30px_60px_-15px_rgba(0,0,0,0.05)] p-10 flex flex-col items-center">
          
          {/* Custom Logo icon */}
          <div className="mb-5 shadow-[0_8px_16px_rgba(22,163,74,0.15)] rounded-[14px] overflow-hidden flex items-center justify-center">
            <img src="/logo.svg" alt="E-Van Tracker Logo" className="w-16 h-16 object-cover" />
          </div>

          <h1 className="text-[34px] font-black text-[#4ade80] mb-2 tracking-tight">
            E-Van Tracker
          </h1>
          <p className="text-[13px] text-gray-500 font-medium mb-10">
            Next-Gen Municipal Waste Tracking
          </p>

          <form onSubmit={handleSearch} className="w-full space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-700 tracking-wider">
                CITY / MUNICIPALITY
              </label>
              <div className="relative">
                <select 
                  value={cityId}
                  onChange={(e) => setCityId(e.target.value)}
                  className="w-full appearance-none bg-[#f8fafc] border border-gray-100 text-slate-600 py-3.5 px-4 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#4ade80] transition-colors text-[13px] font-medium shadow-sm"
                  required
                >
                  <option value="" disabled>Select your region</option>
                  {cities.map(c => (
                    <option key={c.id} value={c.code || c.id}>{c.name} ({c.code || c.id})</option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                  <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-700 tracking-wider">
                VEHICLE REGISTRATION
              </label>
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
                className="w-full bg-[#4ade80] hover:bg-[#22c55e] text-white py-4 px-4 rounded-xl font-bold text-[14px] flex justify-center items-center gap-2 transition-all shadow-[0_8px_20px_-6px_rgba(74,222,128,0.5)] hover:shadow-[0_8px_25px_-6px_rgba(74,222,128,0.6)]"
              >
                Locate My Vehicle &rarr;
              </button>
              
              <Link 
                href="/admin"
                className="text-[#4ade80] hover:text-[#22c55e] font-bold text-[12px] transition-colors"
              >
                Access Admin Dashboard &rarr;
              </Link>
            </div>
          </form>

        </div>
      </div>
    </main>
  );
}
