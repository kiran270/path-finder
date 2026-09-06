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
  day_close: number;
  day_pct_change: number;
}

export default function PatternFinder() {
  const [mounted, setMounted] = useState(false);
  const [ticker, setTicker] = useState("^NSEBANK");
  const [date, setDate] = useState("");
  const [numCandles, setNumCandles] = useState(5);
  const [interval, setInterval] = useState("15m");
  const [candles, setCandles] = useState<Candle[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(false);
  const [loadLatestLoading, setLoadLatestLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setMounted(true);
    const today = new Date().toISOString().split("T")[0];
    setDate(today);
  }, []);

  if (!mounted) {
    return (
      <div className="min-h-screen bg-gray-950 text-gray-100 p-6">
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

  const handleFetchLatest = async () => {
    // Fetch and load data from last DB date to today, then fetch today's candles
    setLoadLatestLoading(true);
    setError("");

    try {
      // Step 1: Load latest data into DB
      const loadRes = await fetch("/api/load-latest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker, interval }),
      });

      const loadData = await loadRes.json();

      if (!loadRes.ok) {
        setError(loadData.error || "Failed to load latest data");
        return;
      }

      // Step 2: Fetch today's candles
      const today = new Date().toISOString().split("T")[0];
      setDate(today);

      const fetchRes = await fetch("/api/fetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker, date: today, numCandles, interval }),
      });

      const fetchData = await fetchRes.json();

      if (!fetchRes.ok) {
        setError(fetchData.error || "Failed to fetch today's data");
        return;
      }

      if (fetchData.candles && fetchData.candles.length > 0) {
        setCandles(fetchData.candles);
        setError(`Loaded ${loadData.loaded_candles} candles from ${loadData.fetched_from} to ${loadData.fetched_to}`);
      } else {
        setError("Data loaded but no candles returned for today");
      }
    } catch (err: any) {
      setError(err.message || "Network error");
    } finally {
      setLoadLatestLoading(false);
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

    try {
      const res = await fetch("/api/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candles, topK: 10 }),
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

  return (
    <div className="h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 text-gray-100 overflow-hidden flex flex-col">
      {/* Header - Compact */}
      <header className="flex-none px-4 md:px-6 py-3 relative border-b border-gray-800/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 md:w-8 md:h-8 rounded-lg bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center">
              <svg className="w-3 h-3 md:w-4 md:h-4 text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
              </svg>
            </div>
            <h1 className="text-lg md:text-xl font-bold bg-gradient-to-r from-yellow-400 to-yellow-200 bg-clip-text text-transparent">
              Pattern Finder
            </h1>
          </div>
          {error && (
            <div className="hidden md:flex items-center gap-2 text-xs text-red-400 bg-red-900/30 px-3 py-1 rounded-lg border border-red-700/50">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              {error}
            </div>
          )}
        </div>
        {/* Mobile error display */}
        {error && (
          <div className="md:hidden mt-2 flex items-center gap-2 text-xs text-red-400 bg-red-900/30 px-2 py-1 rounded-lg border border-red-700/50">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            {error}
          </div>
        )}
      </header>

      {/* Main Content - Responsive Layout */}
      <div className="flex-1 min-h-0 px-2 md:px-4 pb-2 md:pb-4">
        <div className="h-full bg-gray-900/50 backdrop-blur-xl border border-gray-800/50 rounded-xl overflow-hidden flex flex-col">
          
          {/* Desktop: Table Header Row | Mobile: Hidden */}
          <div className="hidden md:grid flex-none grid-cols-12 gap-3 p-3 border-b border-gray-800/50 bg-gray-800/30">
            <div className="col-span-2 text-sm font-semibold text-yellow-400">Fetch Data</div>
            <div className="col-span-7 text-sm font-semibold text-green-400">Candles Preview</div>
            <div className="col-span-3 text-sm font-semibold text-purple-400">Pattern Matches</div>
          </div>

          {/* Desktop: 3-Column Layout | Mobile: Stacked Sections */}
          <div className="flex-1 min-h-0 flex flex-col md:grid md:grid-cols-12 gap-2 md:gap-3 p-2 md:p-3 overflow-y-auto md:overflow-hidden">
            
            {/* Section 1: Fetch Form */}
            <div className="md:col-span-2 flex flex-col gap-2 md:overflow-y-auto md:pr-2">
              <div className="md:hidden text-sm font-semibold text-yellow-400 mb-1">Fetch Data</div>
              
              <div>
                <label className="text-xs text-gray-400 block mb-1">Ticker</label>
                <input
                  type="text"
                  value={ticker}
                  onChange={(e) => setTicker(e.target.value.toUpperCase())}
                  placeholder="^NSEBANK"
                  className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 w-full text-sm focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 transition"
                />
              </div>

              <div>
                <label className="text-xs text-gray-400 block mb-1">Date</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 w-full text-sm focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 transition"
                />
              </div>

              <div>
                <label className="text-xs text-gray-400 block mb-1">Candles</label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={numCandles}
                  onChange={(e) => setNumCandles(parseInt(e.target.value) || 5)}
                  className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 w-full text-sm focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 transition"
                />
              </div>

              <div>
                <label className="text-xs text-gray-400 block mb-1">Interval</label>
                <select
                  value={interval}
                  onChange={(e) => setInterval(e.target.value)}
                  className="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 w-full text-sm focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 transition"
                >
                  <option value="5m">5min</option>
                  <option value="15m">15min</option>
                  <option value="1h">1hour</option>
                  <option value="1d">1day</option>
                </select>
              </div>

              <button
                onClick={handleFetch}
                disabled={fetchLoading || !ticker || !date}
                className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 disabled:from-gray-700 disabled:to-gray-800 text-white font-semibold py-1.5 rounded-lg transition-all text-sm mt-2"
              >
                {fetchLoading ? "Fetching..." : "Fetch"}
              </button>

              <button
                onClick={handleFetchLatest}
                disabled={loadLatestLoading || !ticker}
                className="w-full bg-gradient-to-r from-green-600 to-green-700 hover:from-green-500 hover:to-green-600 disabled:from-gray-700 disabled:to-gray-800 text-white font-semibold py-1.5 rounded-lg transition-all text-sm"
              >
                {loadLatestLoading ? "Loading..." : "Load Latest"}
              </button>
            </div>

            {/* Section 2: Candles */}
            <div className="md:col-span-7 flex flex-col min-h-0">
              <div className="md:hidden text-sm font-semibold text-green-400 mb-1">Candles Preview</div>
              
              {candles.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-gray-500 py-8 md:py-0">
                  <div className="text-center">
                    <svg className="w-12 h-12 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    <p className="text-xs">Fetch data first</p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex-1 min-h-0 min-h-[300px] md:min-h-0">
                    <CandleStickChart candles={candles} />
                  </div>

                  <button
                    onClick={handleSubmit}
                    disabled={loading}
                    className="flex-none w-full bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-400 hover:to-yellow-500 disabled:from-gray-700 disabled:to-gray-800 text-gray-900 font-bold py-2 rounded-lg transition-all mt-2"
                  >
                    {loading ? "Searching..." : "Find Patterns"}
                  </button>
                </>
              )}
            </div>

            {/* Section 3: Matches */}
            <div className="md:col-span-3 flex flex-col min-h-0">
              <div className="md:hidden text-sm font-semibold text-purple-400 mb-1">Pattern Matches</div>
              
              {matches.length === 0 ? (
                <div className="h-full flex items-center justify-center text-gray-500 py-8 md:py-0">
                  <div className="text-center">
                    <svg className="w-12 h-12 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <p className="text-xs">Matches will appear here</p>
                  </div>
                </div>
              ) : (
                <div className="h-full grid grid-cols-2 md:grid-cols-1 md:grid-rows-10 gap-1.5">
                  {matches.slice(0, 10).map((m, i) => (
                    <div
                      key={i}
                      className="bg-gradient-to-br from-gray-800/80 to-gray-800/40 border border-gray-700/50 rounded-lg px-2 py-1.5 hover:border-yellow-500/50 transition-all flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <div className="flex-none w-4 h-4 rounded bg-yellow-400/20 flex items-center justify-center text-[10px] text-yellow-400 font-bold">
                          {i + 1}
                        </div>
                        <div className="text-[11px] font-semibold truncate">{m.day}</div>
                      </div>

                      <div className={`flex-none px-2 py-0.5 rounded font-bold text-[11px] ${
                        m.day_pct_change > 0
                          ? "bg-green-500/30 text-green-400"
                          : m.day_pct_change < 0
                          ? "bg-red-500/30 text-red-400"
                          : "bg-gray-700/50 text-gray-400"
                      }`}>
                        {m.day_pct_change > 0 ? "+" : ""}
                        {m.day_pct_change.toFixed(2)}%
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
