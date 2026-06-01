"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const [cityId, setCityId] = useState("");
  const [vehicleCode, setVehicleCode] = useState("");
  const [isHovered, setIsHovered] = useState(false);
  const router = useRouter();

  const handleSearch = (e) => {
    e.preventDefault();
    if (cityId && vehicleCode) {
      router.push(`/track/${vehicleCode}?city=${cityId}`);
    }
  };

  return (
    <main className="min-h-screen relative flex flex-col items-center justify-center overflow-hidden bg-[#f0f4f8]">
      {/* Dynamic Background Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-green-400/30 rounded-full blur-3xl mix-blend-multiply animate-blob"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-emerald-400/30 rounded-full blur-3xl mix-blend-multiply animate-blob animation-delay-2000"></div>

      <div className="z-10 max-w-lg w-full px-6">
        <div 
          className="backdrop-blur-xl bg-white/80 border border-white/40 shadow-2xl rounded-3xl p-10 transition-all duration-500 transform hover:scale-[1.01]"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          <div className="flex justify-center mb-6">
            <div className={`p-4 bg-gradient-to-tr from-green-500 to-emerald-400 rounded-2xl shadow-lg transform transition-transform duration-500 ${isHovered ? 'rotate-12' : 'rotate-0'}`}>
              <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
              </svg>
            </div>
          </div>
          
          <h1 className="text-4xl font-extrabold text-center text-transparent bg-clip-text bg-gradient-to-r from-green-600 to-emerald-500 mb-2">
            E-Van Tracker
          </h1>
          <p className="text-center text-gray-500 mb-8 font-medium">
            Next-Gen Municipal Waste Tracking
          </p>

          <form onSubmit={handleSearch} className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700 tracking-wide">
                CITY / MUNICIPALITY
              </label>
              <div className="relative">
                <select 
                  value={cityId}
                  onChange={(e) => setCityId(e.target.value)}
                  className="w-full appearance-none bg-gray-50 border border-gray-200 text-gray-700 py-3 px-4 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:bg-white transition-colors"
                  required
                >
                  <option value="" disabled>Select your region</option>
                  <option value="LKO">Lucknow (LKO)</option>
                  <option value="KNP">Kanpur (KNP)</option>
                  <option value="AGR">Agra (AGR)</option>
                  <option value="VNS">Varanasi (VNS)</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-gray-500">
                  <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700 tracking-wide">
                VEHICLE REGISTRATION
              </label>
              <input 
                type="text" 
                placeholder="e.g. LKO-001"
                value={vehicleCode}
                onChange={(e) => setVehicleCode(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 text-gray-700 py-3 px-4 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:bg-white transition-colors uppercase font-mono"
                required
              />
            </div>

            <button 
              type="submit"
              className="w-full group relative flex justify-center py-4 px-4 border border-transparent text-sm font-bold rounded-xl text-white bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 shadow-lg shadow-green-500/30 transform transition-all hover:-translate-y-0.5"
            >
              <span>Locate My Vehicle</span>
              <svg className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
            </button>
          </form>
          
          <div className="mt-8 text-center">
            <a href="/admin" className="text-sm text-green-600 hover:text-green-800 font-semibold transition-colors">
              Access Admin Dashboard &rarr;
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}
