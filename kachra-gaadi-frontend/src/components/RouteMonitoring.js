/* eslint-disable */
"use client";

import { useState } from 'react';

export default function RouteMonitoring({ checkpointStats }) {
  const [expandedSection, setExpandedSection] = useState(null);

  if (!checkpointStats) return null;

  const total = checkpointStats.total || 0;
  const completed = checkpointStats.covered || 0;
  
  // Create an array for the visual progress bar (e.g. up to 10 chunks)
  const segments = 10;
  const completedSegments = total === 0 ? 0 : Math.floor((completed / total) * segments);

  const toggleSection = (section) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  const renderStopList = (stops) => {
    if (!stops || stops.length === 0) return <p className="text-[11px] text-gray-500 italic py-2">None</p>;
    
    return (
      <div className="flex flex-col gap-2 mt-2">
        {stops.map(stop => (
          <div key={stop.id} className="flex justify-between items-center bg-[#1a1a1a] p-2.5 rounded-lg border border-[#2a2a2a]">
            <span className="text-[12px] font-semibold text-gray-300">{stop.name}</span>
            {stop.eta_minutes !== null && stop.eta_minutes !== undefined && (
              <span className="text-[10px] font-bold text-gray-500 bg-[#2a2a2a] px-2 py-1 rounded-md">
                ETA: {stop.eta_minutes}m
              </span>
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="bg-black text-white p-6 rounded-2xl font-sans max-w-md shadow-2xl border border-[#222]">
      <h2 className="text-xl font-bold mb-6 tracking-tight flex items-center gap-2">
        6. Route Monitoring
      </h2>
      
      {/* Progress Bar Section */}
      <div className="mb-6">
        <p className="text-[13px] font-bold text-gray-300 mb-3">Progress Bar</p>
        <div className="bg-[#111] rounded-xl border border-[#222] p-4">
          <div className="flex justify-between items-center mb-3">
            <span className="text-[12px] font-bold text-gray-400">{total} Stops</span>
            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2"></path></svg>
          </div>
          
          <div className="flex gap-[2px] mb-3">
            {[...Array(segments)].map((_, i) => (
              <div 
                key={i} 
                className={`h-2 flex-1 rounded-sm ${i < completedSegments ? 'bg-white' : 'border border-gray-700 bg-transparent'}`}
              ></div>
            ))}
          </div>
          
          <span className="text-[12px] font-bold text-gray-300">{completed} Completed</span>
        </div>
      </div>

      {/* Accordion Sections */}
      <div className="space-y-1">
        {/* Missed Stops */}
        <div className="border-b border-[#222]">
          <button 
            onClick={() => toggleSection('missed')}
            className="w-full py-4 flex justify-between items-center text-[13px] font-bold text-gray-200 hover:text-white transition-colors"
          >
            <div className="flex items-center gap-2">
              Missed Stops
              {checkpointStats.missed_stops?.length > 0 && (
                <span className="bg-red-900/50 text-red-400 text-[10px] px-1.5 py-0.5 rounded-full">{checkpointStats.missed_stops.length}</span>
              )}
            </div>
            <svg className={`w-4 h-4 text-gray-500 transition-transform ${expandedSection === 'missed' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
          </button>
          {expandedSection === 'missed' && (
            <div className="pb-4">
              {renderStopList(checkpointStats.missed_stops)}
            </div>
          )}
        </div>

        {/* Delayed Stops */}
        <div className="border-b border-[#222]">
          <button 
            onClick={() => toggleSection('delayed')}
            className="w-full py-4 flex justify-between items-center text-[13px] font-bold text-gray-200 hover:text-white transition-colors"
          >
            <div className="flex items-center gap-2">
              Delayed Stops
              {checkpointStats.delayed_stops?.length > 0 && (
                <span className="bg-amber-900/50 text-amber-400 text-[10px] px-1.5 py-0.5 rounded-full">{checkpointStats.delayed_stops.length}</span>
              )}
            </div>
            <svg className={`w-4 h-4 text-gray-500 transition-transform ${expandedSection === 'delayed' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
          </button>
          {expandedSection === 'delayed' && (
            <div className="pb-4">
              {renderStopList(checkpointStats.delayed_stops)}
            </div>
          )}
        </div>

        {/* Upcoming Stops */}
        <div>
          <button 
            onClick={() => toggleSection('upcoming')}
            className="w-full py-4 flex justify-between items-center text-[13px] font-bold text-gray-200 hover:text-white transition-colors"
          >
            <div className="flex items-center gap-2">
              Upcoming Stops
              {checkpointStats.upcoming_stops?.length > 0 && (
                <span className="bg-[#222] text-gray-400 text-[10px] px-1.5 py-0.5 rounded-full">{checkpointStats.upcoming_stops.length}</span>
              )}
            </div>
            <svg className={`w-4 h-4 text-gray-500 transition-transform ${expandedSection === 'upcoming' ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
          </button>
          {expandedSection === 'upcoming' && (
            <div className="pb-4">
              {renderStopList(checkpointStats.upcoming_stops)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
