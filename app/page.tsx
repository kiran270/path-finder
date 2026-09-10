"use client";

import { useEffect, useState } from "react";
import CandleStickChart from "@/components/CandleStickChart";

interface Candle {
  timestamp?: string;
  open: number;
  high: number;
  low: number;
  close: number;
}

interface Match {
  day: string;
  start_time: string;
  distance: number;
  prev_close: number;
  prev_high?: number;
  prev_low?: number;
  day_close: number;
  day_pct_change: number;
  pattern_direction?: "bullish" | "bearish" | "neutral";
  outcomes?: {
    next_6_candles_points: number | null;
    next_6_max_gain: number | null;
    next_6_max_loss: number | null;
    next_12_candles_points: number | null;
    next_12_max_gain: number | null;
    next_12_max_loss: number | null;
    day_end_points: number | null;
    day_max_gain: number | null;
    day_max_loss: number | null;
  };
  cpr_zone?: string;
}

export default function PatternFinder() {
  const [mounted, setMounted] = useState(false);
  const [ticker, setTicker] = useState("^NSEBANK");
  const [date, setDate] = useState("");
  const [numCandles, setNumCandles] = useState(5);
  const [interval, setInterval] = useState("15m");
  const [candles, setCandles] = useState<Candle[]>([]);
  const [prevDayData, setPrevDayData] = useState<{high: number, low: number, close: number} | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(false);
  const [error, setError] = useState("");
  const [expandedMatch, setExpandedMatch] = useState<number | null>(null);
  const [expandedDayCandles, setExpandedDayCandles] = useState<Candle[]>([]);

  useEffect(() => {
    setMounted(true);
    const today = new Date().toISOString().split("T")[0];
    setDate(today);
  }, []);

  if (!mounted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Loading...</div>
        </div>
      </div>
    );
  }

  const handleFetch = async () => {
    setFetchLoading(true);
    setError("");
    setCandles([]);

    try {
      const res = await fetch("/api/fetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker, date, numCandles, interval }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to fetch data");
        return;
      }

      if (data.candles && data.candles.length > 0) {
        setCandles(data.candles);
        setPrevDayData(data.prev_day || null);
        setError("");
      } else {
        setError("No candles returned");
      }
    } catch (err: any) {
      setError(err.message || "Network error");
    } finally {
      setFetchLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (candles.length === 0) {
      setError("Fetch data first");
      return;
    }

    setLoading(true);
    setError("");
    setMatches([]);
    setExpandedMatch(null);
    setExpandedDayCandles([]);

    try {
      const res = await fetch("/api/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          candles, 
          topK: 10, 
          ticker, 
          interval,
          prevDay: prevDayData  // Include CPR data for matching
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Request failed");
        return;
      }

      setMatches(data.matches || []);
    } catch (err: any) {
      setError(err.message || "Network error");
    } finally {
      setLoading(false);
    }
  };

  const handleMatchClick = async (index: number, match: Match) => {
    if (expandedMatch === index) {
      // Collapse if already expanded
      setExpandedMatch(null);
      setExpandedDayCandles([]);
      return;
    }

    // Expand and fetch full day candles
    setExpandedMatch(index);
    
    try {
      const res = await fetch("/api/day-candles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ day: match.day, ticker, interval }),
      });

      const data = await res.json();
      
      if (res.ok && data.candles) {
        setExpandedDayCandles(data.candles);
      } else {
        console.error("Failed to fetch day candles:", data.error);
        setExpandedDayCandles([]);
      }
    } catch (err) {
      console.error("Failed to fetch expanded day candles:", err);
      setExpandedDayCandles([]);
    }
  };

  return (
    <div className="h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 text-gray-900 overflow-hidden flex flex-col">
      {/* Header */}
      <header className="flex-none px-4 md:px-6 py-3 relative border-b border-emerald-200/60 bg-white/80 backdrop-blur-sm shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 md:w-10 md:h-10 rounded-xl bg-gradient-to-br from-emerald-400 via-teal-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-emerald-300">
              <svg className="w-3 h-3 md:w-5 md:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <div>
              <h1 className="text-lg md:text-2xl font-black tracking-tight bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 bg-clip-text text-transparent">
                Pattern Finder
              </h1>
              <div className="text-[10px] text-emerald-600/70 font-semibold">AI Pattern Matching Engine</div>
            </div>
          </div>
          {error && (
            <div className="hidden md:flex items-center gap-2 text-xs text-red-700 bg-red-50 px-4 py-2 rounded-xl border border-red-200 shadow-sm">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              {error}
            </div>
          )}
        </div>
        {error && (
          <div className="md:hidden mt-2 flex items-center gap-2 text-xs text-red-700 bg-red-50 px-3 py-2 rounded-xl border border-red-200">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            {error}
          </div>
        )}
      </header>

      {/* Main Content */}
      <div className="flex-1 min-h-0 px-2 md:px-4 pb-2 md:pb-4 pt-3">
        <div className="h-full bg-white/70 backdrop-blur-xl border border-emerald-200/50 rounded-2xl overflow-hidden flex flex-col shadow-xl">
          
          {/* Desktop: Header Row */}
          <div className="hidden md:grid flex-none grid-cols-12 gap-3 p-3 border-b border-emerald-100/70 bg-gradient-to-r from-emerald-50/50 to-teal-50/50">
            <div className="col-span-2 text-sm font-bold text-emerald-700">Fetch Data</div>
            <div className="col-span-5 text-sm font-bold text-teal-700">Candles Preview</div>
            <div className="col-span-5 text-sm font-bold text-cyan-700">Pattern Matches</div>
          </div>

          {/* Content Grid */}
          <div className="flex-1 min-h-0 flex flex-col md:grid md:grid-cols-12 gap-3 md:gap-3 p-2 md:p-3 overflow-y-auto md:overflow-hidden">
            
            {/* Fetch Form */}
            <div className="flex-shrink-0 md:col-span-2 md:flex md:flex-col gap-2 md:overflow-y-auto md:pr-2 bg-emerald-50/50 md:bg-transparent p-3 md:p-0 rounded-xl md:rounded-none border md:border-0 border-emerald-200">
              <div className="md:hidden text-sm font-bold text-emerald-700 mb-2">Fetch Data</div>
              
              <div>
                <label className="text-xs text-gray-700 font-semibold block mb-1">Ticker</label>
                <select
                  value={ticker}
                  onChange={(e) => setTicker(e.target.value)}
                  className="bg-white border border-emerald-200 rounded-lg px-3 py-2 w-full text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition shadow-sm"
                >
                  <option value="^NSEBANK">BANKNIFTY</option>
                  <option value="MARUTI.NS">MARUTI</option>
                  <option value="SI=F">SILVER (MCX)</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-gray-700 font-semibold block mb-1">Date</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="bg-white border border-emerald-200 rounded-lg px-3 py-2 w-full text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition shadow-sm"
                />
              </div>

              <div>
                <label className="text-xs text-gray-700 font-semibold block mb-1">Candles</label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={numCandles}
                  onChange={(e) => setNumCandles(parseInt(e.target.value) || 5)}
                  className="bg-white border border-emerald-200 rounded-lg px-3 py-2 w-full text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition shadow-sm"
                />
              </div>

              <div>
                <label className="text-xs text-gray-700 font-semibold block mb-1">Interval</label>
                <select
                  value={interval}
                  onChange={(e) => setInterval(e.target.value)}
                  className="bg-white border border-emerald-200 rounded-lg px-3 py-2 w-full text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition shadow-sm"
                >
                  <option value="5m">5min</option>
                  <option value="15m">15min</option>
                  <option value="1h">1hour</option>
                </select>
              </div>

              <button
                onClick={handleFetch}
                disabled={fetchLoading || !ticker || !date}
                className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 disabled:from-gray-300 disabled:to-gray-400 text-white font-bold py-2 rounded-xl transition-all text-sm mt-2 shadow-lg shadow-emerald-200"
              >
                {fetchLoading ? "Fetching..." : "Fetch"}
              </button>
            </div>

            {/* Candles Preview - Reduced to col-span-5 */}
            <div className="flex-shrink-0 md:col-span-5 md:flex md:flex-col min-h-0 bg-teal-50/50 md:bg-transparent p-3 md:p-0 rounded-xl md:rounded-none border md:border-0 border-teal-200">
              <div className="md:hidden text-sm font-bold text-teal-700 mb-2">Candles Preview</div>
              
              {candles.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-gray-500 py-8 md:py-0">
                  <div className="text-center">
                    <svg className="w-16 h-16 mx-auto mb-3 text-emerald-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    <p className="text-sm text-gray-600">Fetch data to preview candles</p>
                  </div>
                </div>
              ) : (
                <>
                  {/* Pattern Direction Summary */}
                  {matches.length > 0 && (
                    <div className="flex-none mb-2 flex gap-2">
                      <div className="flex-1 bg-gradient-to-br from-emerald-100 to-emerald-50 border-2 border-emerald-300 rounded-lg p-2 text-center">
                        <div className="text-[10px] text-emerald-700 font-semibold mb-0.5">🟢 Bullish</div>
                        <div className="text-lg font-black text-emerald-700">
                          {matches.filter(m => m.pattern_direction === "bullish").length}
                        </div>
                        <div className="text-[9px] text-emerald-600">
                          {((matches.filter(m => m.pattern_direction === "bullish").length / matches.length) * 100).toFixed(0)}%
                        </div>
                      </div>
                      <div className="flex-1 bg-gradient-to-br from-red-100 to-red-50 border-2 border-red-300 rounded-lg p-2 text-center">
                        <div className="text-[10px] text-red-700 font-semibold mb-0.5">🔴 Bearish</div>
                        <div className="text-lg font-black text-red-700">
                          {matches.filter(m => m.pattern_direction === "bearish").length}
                        </div>
                        <div className="text-[9px] text-red-600">
                          {((matches.filter(m => m.pattern_direction === "bearish").length / matches.length) * 100).toFixed(0)}%
                        </div>
                      </div>
                      <div className="flex-1 bg-gradient-to-br from-gray-100 to-gray-50 border-2 border-gray-300 rounded-lg p-2 text-center">
                        <div className="text-[10px] text-gray-700 font-semibold mb-0.5">⚪ Neutral</div>
                        <div className="text-lg font-black text-gray-700">
                          {matches.filter(m => m.pattern_direction === "neutral").length}
                        </div>
                        <div className="text-[9px] text-gray-600">
                          {((matches.filter(m => m.pattern_direction === "neutral").length / matches.length) * 100).toFixed(0)}%
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Outcome Statistics */}
                  {matches.length > 0 && (
                    <div className="flex-none mb-3 bg-gradient-to-r from-emerald-50 to-cyan-50 border-2 border-emerald-200 rounded-xl p-3">
                      <div className="text-xs font-bold text-emerald-800 mb-2">📊 Average Outcomes from {matches.length} Matches</div>
                      <div className="grid grid-cols-3 gap-2">
                        {/* Next 6 Candles */}
                        <div className="bg-white rounded-lg p-2 border border-emerald-200">
                          <div className="text-[10px] text-gray-600 mb-1 font-semibold">Next 6 Candles</div>
                          <div className="space-y-0.5">
                            <div className={`text-xs font-bold ${
                              (() => {
                                const validMatches = matches.filter(m => m.outcomes?.next_6_candles_points != null);
                                if (validMatches.length === 0) return 'text-gray-400';
                                const avg = validMatches.reduce((sum, m) => sum + (m.outcomes?.next_6_candles_points || 0), 0) / validMatches.length;
                                return avg > 0 ? 'text-emerald-600' : avg < 0 ? 'text-red-600' : 'text-gray-600';
                              })()
                            }`}>
                              Close: {(() => {
                                const validMatches = matches.filter(m => m.outcomes?.next_6_candles_points != null);
                                if (validMatches.length === 0) return 'N/A';
                                const avg = validMatches.reduce((sum, m) => sum + (m.outcomes?.next_6_candles_points || 0), 0) / validMatches.length;
                                return `${avg > 0 ? '+' : ''}${avg.toFixed(0)}`;
                              })()}
                            </div>
                            <div className="text-[9px] text-emerald-600 font-semibold">
                              ↑ {(() => {
                                const validMatches = matches.filter(m => m.outcomes?.next_6_max_gain != null);
                                if (validMatches.length === 0) return 'N/A';
                                const avg = validMatches.reduce((sum, m) => sum + (m.outcomes?.next_6_max_gain || 0), 0) / validMatches.length;
                                return `+${avg.toFixed(0)}`;
                              })()}
                            </div>
                            <div className="text-[9px] text-red-600 font-semibold">
                              ↓ {(() => {
                                const validMatches = matches.filter(m => m.outcomes?.next_6_max_loss != null);
                                if (validMatches.length === 0) return 'N/A';
                                const avg = validMatches.reduce((sum, m) => sum + (m.outcomes?.next_6_max_loss || 0), 0) / validMatches.length;
                                return `${avg.toFixed(0)}`;
                              })()}
                            </div>
                          </div>
                        </div>

                        {/* Next 12 Candles */}
                        <div className="bg-white rounded-lg p-2 border border-emerald-200">
                          <div className="text-[10px] text-gray-600 mb-1 font-semibold">Next 12 Candles</div>
                          <div className="space-y-0.5">
                            <div className={`text-xs font-bold ${
                              (() => {
                                const validMatches = matches.filter(m => m.outcomes?.next_12_candles_points != null);
                                if (validMatches.length === 0) return 'text-gray-400';
                                const avg = validMatches.reduce((sum, m) => sum + (m.outcomes?.next_12_candles_points || 0), 0) / validMatches.length;
                                return avg > 0 ? 'text-emerald-600' : avg < 0 ? 'text-red-600' : 'text-gray-600';
                              })()
                            }`}>
                              Close: {(() => {
                                const validMatches = matches.filter(m => m.outcomes?.next_12_candles_points != null);
                                if (validMatches.length === 0) return 'N/A';
                                const avg = validMatches.reduce((sum, m) => sum + (m.outcomes?.next_12_candles_points || 0), 0) / validMatches.length;
                                return `${avg > 0 ? '+' : ''}${avg.toFixed(0)}`;
                              })()}
                            </div>
                            <div className="text-[9px] text-emerald-600 font-semibold">
                              ↑ {(() => {
                                const validMatches = matches.filter(m => m.outcomes?.next_12_max_gain != null);
                                if (validMatches.length === 0) return 'N/A';
                                const avg = validMatches.reduce((sum, m) => sum + (m.outcomes?.next_12_max_gain || 0), 0) / validMatches.length;
                                return `+${avg.toFixed(0)}`;
                              })()}
                            </div>
                            <div className="text-[9px] text-red-600 font-semibold">
                              ↓ {(() => {
                                const validMatches = matches.filter(m => m.outcomes?.next_12_max_loss != null);
                                if (validMatches.length === 0) return 'N/A';
                                const avg = validMatches.reduce((sum, m) => sum + (m.outcomes?.next_12_max_loss || 0), 0) / validMatches.length;
                                return `${avg.toFixed(0)}`;
                              })()}
                            </div>
                          </div>
                        </div>

                        {/* Day End */}
                        <div className="bg-white rounded-lg p-2 border border-emerald-200">
                          <div className="text-[10px] text-gray-600 mb-1 font-semibold">Day End</div>
                          <div className="space-y-0.5">
                            <div className={`text-xs font-bold ${
                              (() => {
                                const validMatches = matches.filter(m => m.outcomes?.day_end_points != null);
                                if (validMatches.length === 0) return 'text-gray-400';
                                const avg = validMatches.reduce((sum, m) => sum + (m.outcomes?.day_end_points || 0), 0) / validMatches.length;
                                return avg > 0 ? 'text-emerald-600' : avg < 0 ? 'text-red-600' : 'text-gray-600';
                              })()
                            }`}>
                              Close: {(() => {
                                const validMatches = matches.filter(m => m.outcomes?.day_end_points != null);
                                if (validMatches.length === 0) return 'N/A';
                                const avg = validMatches.reduce((sum, m) => sum + (m.outcomes?.day_end_points || 0), 0) / validMatches.length;
                                return `${avg > 0 ? '+' : ''}${avg.toFixed(0)}`;
                              })()}
                            </div>
                            <div className="text-[9px] text-emerald-600 font-semibold">
                              ↑ {(() => {
                                const validMatches = matches.filter(m => m.outcomes?.day_max_gain != null);
                                if (validMatches.length === 0) return 'N/A';
                                const avg = validMatches.reduce((sum, m) => sum + (m.outcomes?.day_max_gain || 0), 0) / validMatches.length;
                                return `+${avg.toFixed(0)}`;
                              })()}
                            </div>
                            <div className="text-[9px] text-red-600 font-semibold">
                              ↓ {(() => {
                                const validMatches = matches.filter(m => m.outcomes?.day_max_loss != null);
                                if (validMatches.length === 0) return 'N/A';
                                const avg = validMatches.reduce((sum, m) => sum + (m.outcomes?.day_max_loss || 0), 0) / validMatches.length;
                                return `${avg.toFixed(0)}`;
                              })()}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <div className="flex-1 min-h-0 min-h-[200px] md:min-h-0">
                    <CandleStickChart 
                      candles={candles}
                      prevDayHigh={prevDayData?.high}
                      prevDayLow={prevDayData?.low}
                      prevDayClose={prevDayData?.close}
                    />
                  </div>

                  <button
                    onClick={handleSubmit}
                    disabled={loading}
                    className="flex-none w-full bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-600 hover:via-teal-600 hover:to-cyan-600 disabled:from-gray-300 disabled:to-gray-400 text-white font-black py-3 rounded-xl transition-all mt-3 shadow-xl shadow-emerald-300 text-lg"
                  >
                    {loading ? "🔍 Searching..." : "✨ Find Patterns"}
                  </button>
                </>
              )}
            </div>

            {/* Pattern Matches - Increased to col-span-5 */}
            <div className="flex-shrink-0 md:col-span-5 md:flex md:flex-col min-h-0 bg-cyan-50/50 md:bg-transparent p-3 md:p-0 rounded-xl md:rounded-none border md:border-0 border-cyan-200">
              <div className="md:hidden text-sm font-bold text-cyan-700 mb-2">Pattern Matches</div>
              
              {matches.length === 0 ? (
                <div className="h-full flex items-center justify-center text-gray-500 py-8 md:py-0">
                  <div className="text-center">
                    <svg className="w-16 h-16 mx-auto mb-3 text-cyan-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <p className="text-sm text-gray-600">Matches will appear here</p>
                  </div>
                </div>
              ) : (
                <div className="h-full flex flex-col gap-2 overflow-y-auto">
                  <div className="grid grid-cols-2 md:grid-cols-1 gap-2">
                    {matches.slice(0, 10).map((m, i) => (
                      <div key={i} className={`flex flex-col gap-1 ${expandedMatch === i ? 'col-span-2 md:col-span-1' : ''}`}>
                        <div
                          onClick={() => handleMatchClick(i, m)}
                          className={`bg-gradient-to-br from-white to-emerald-50/30 border-2 rounded-xl px-3 py-2 transition-all flex flex-col gap-1 cursor-pointer ${
                            expandedMatch === i 
                              ? 'border-emerald-500 shadow-lg' 
                              : 'border-emerald-200 hover:border-emerald-400 hover:shadow-lg'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <div className="flex-none w-6 h-6 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center text-[11px] text-white font-black shadow-md">
                                {i + 1}
                              </div>
                              <div className="text-[12px] font-bold text-gray-700 truncate">{m.day}</div>
                              <div className="text-xs">
                                {m.pattern_direction === "bullish" ? "🟢" : m.pattern_direction === "bearish" ? "🔴" : "⚪"}
                              </div>
                            </div>

                            <div className={`flex-none px-2.5 py-1 rounded-lg font-black text-[12px] shadow-sm ${
                              m.day_pct_change > 0
                                ? "bg-emerald-100 text-emerald-700 border border-emerald-300"
                                : m.day_pct_change < 0
                                ? "bg-red-100 text-red-700 border border-red-300"
                                : "bg-gray-100 text-gray-600 border border-gray-300"
                            }`}>
                              {m.day_pct_change > 0 ? "+" : ""}
                              {m.day_pct_change.toFixed(2)}%
                            </div>
                          </div>
                          
                          <div className="flex items-center justify-between">
                            <div className="text-[10px] text-teal-600 font-semibold bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                              Similarity: {(100 - Math.min(m.distance, 100)).toFixed(1)}%
                            </div>
                            <div className="text-[10px] text-gray-500">
                              {expandedMatch === i ? '▼ Click to collapse' : '► Click for details'}
                            </div>
                          </div>
                        </div>

                        {/* Expanded View */}
                        {expandedMatch === i && expandedDayCandles.length > 0 && (
                          <div className="bg-white border-2 border-emerald-300 rounded-xl p-4 shadow-lg space-y-3">
                            <div className="text-sm font-bold text-emerald-700 mb-2">
                              Full Day Chart - {m.day}
                            </div>
                            {/* Increased height from h-48 to h-96 for better candle visibility */}
                            <div className="h-96">
                              <CandleStickChart 
                                candles={expandedDayCandles}
                                prevDayHigh={m.prev_high}
                                prevDayLow={m.prev_low}
                                prevDayClose={m.prev_close}
                              />
                            </div>
                            {/* Compact 3-column stats */}
                            <div className="grid grid-cols-3 gap-x-3 gap-y-1 text-[10px] text-gray-600 bg-gray-50 p-2 rounded">
                              <div className="flex justify-between">
                                <span>Candles:</span>
                                <span className="font-bold">{expandedDayCandles.length}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Open:</span>
                                <span className="font-bold">{expandedDayCandles[0]?.open.toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Close:</span>
                                <span className="font-bold">{expandedDayCandles[expandedDayCandles.length - 1]?.close.toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>High:</span>
                                <span className="font-bold text-emerald-600">
                                  {Math.max(...expandedDayCandles.map(c => c.high)).toFixed(2)}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span>Low:</span>
                                <span className="font-bold text-red-600">
                                  {Math.min(...expandedDayCandles.map(c => c.low)).toFixed(2)}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span>Prev:</span>
                                <span className="font-bold">{m.prev_close.toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between col-span-3 pt-1 border-t border-gray-300">
                                <span className="font-semibold">Day Change:</span>
                                <span className={`font-bold ${m.day_pct_change > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                  {m.day_pct_change > 0 ? '+' : ''}{m.day_pct_change.toFixed(2)}%
                                </span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
