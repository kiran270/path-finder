"use client";

import { useState, useEffect } from "react";

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
  matched_candles: Candle[];
  day_open: number;
  day_close: number;
  day_pct_change: number;
}

export default function PatternFinder() {
  const [mounted, setMounted] = useState(false);
  
  // Yahoo Finance inputs
  const [ticker, setTicker] = useState("AAPL");
  const [date, setDate] = useState("");
  const [numCandles, setNumCandles] = useState(5);
  const [interval, setInterval] = useState("15m");
  
  // Fetched candles
  const [candles, setCandles] = useState<Candle[]>([]);
  
  // Pattern matches
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setMounted(true);
    // Set today's date as default
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

  const handleCandleChange = (idx: number, field: keyof Candle, value: string) => {
    const updated = [...candles];
    updated[idx] = { ...updated[idx], [field]: parseFloat(value) || 0 };
    setCandles(updated);
  };

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
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 text-gray-100 p-6">
      {/* Header with gradient */}
      <header className="mb-8 relative">
        <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/10 to-blue-500/10 blur-3xl -z-10" />
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center shadow-lg shadow-yellow-500/50">
            <svg className="w-6 h-6 text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
            </svg>
          </div>
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-yellow-400 to-yellow-200 bg-clip-text text-transparent">
              Pattern Finder
            </h1>
            <p className="text-gray-400 text-sm">Historical pattern matching for trading analysis</p>
          </div>
        </div>
      </header>

      {/* Main 3-column grid layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Column 1: Fetch Data Form */}
        <div className="bg-gray-900/50 backdrop-blur-xl border border-gray-800/50 rounded-2xl p-6 shadow-2xl h-fit sticky top-6">
          <div className="flex items-center gap-2 mb-6">
            <div className="h-8 w-1 bg-gradient-to-b from-yellow-400 to-yellow-600 rounded-full" />
            <h2 className="text-xl font-semibold">Fetch Data</h2>
          </div>
          <div>
            <label className="text-sm text-gray-400 block mb-2">
              Ticker Symbol
            </label>
            <input
              type="text"
              value={ticker}
              onChange={(e) => setTicker(e.target.value.toUpperCase())}
              placeholder="AAPL, ^NSEI, BTC-USD"
              className="bg-gray-800 border border-gray-700 rounded px-3 py-2 w-full text-gray-100"
            />
          </div>
          
          <div>
            <label className="text-sm text-gray-400 block mb-2">
              Start Date
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded px-3 py-2 w-full text-gray-100"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="text-sm text-gray-400 block mb-2">
              Number of Candles
            </label>
            <input
              type="number"
              min="1"
              max="50"
              value={numCandles}
              onChange={(e) => setNumCandles(parseInt(e.target.value) || 5)}
              className="bg-gray-800 border border-gray-700 rounded px-3 py-2 w-full text-gray-100"
            />
          </div>
          
          <div>
            <label className="text-sm text-gray-400 block mb-2">
              Interval
            </label>
            <select
              value={interval}
              onChange={(e) => setInterval(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded px-3 py-2 w-full text-gray-100"
            >
              <option value="5m">5 min</option>
              <option value="15m">15 min</option>
              <option value="30m">30 min</option>
              <option value="1h">1 hour</option>
              <option value="1d">1 day</option>
            </select>
          </div>
        </div>

        <button
          onClick={handleFetch}
          disabled={fetchLoading || !ticker || !date}
          className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 disabled:from-gray-700 disabled:to-gray-800 text-white font-semibold px-8 py-3 rounded-xl transition-all duration-200 shadow-lg hover:shadow-blue-500/50 disabled:shadow-none transform hover:scale-105 disabled:scale-100"
        >
          {fetchLoading ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Fetching...
            </span>
          ) : (
            "Fetch Data"
          )}
        </button>

        {error && (
          <div className="mt-4 bg-red-900/30 backdrop-blur border border-red-700/50 text-red-400 rounded-xl px-4 py-3 animate-pulse">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              {error}
            </div>
          </div>
        )}
      </div>

      {/* Fetched Candles Preview with gradient border */}
      {candles.length > 0 && (
        <div className="bg-gray-900/50 backdrop-blur-xl border border-gray-800/50 rounded-2xl p-6 mb-6 shadow-2xl relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-green-500/5 to-blue-500/5 pointer-events-none" />
          
          <div className="flex items-center gap-2 mb-6 relative z-10">
            <div className="h-8 w-1 bg-gradient-to-b from-green-400 to-green-600 rounded-full" />
            <h2 className="text-xl font-semibold">
              Fetched {candles.length} Candles
            </h2>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-gray-400">
                  <th className="text-left pb-2">#</th>
                  <th className="text-left pb-2">Timestamp</th>
                  <th className="text-right pb-2">Open</th>
                  <th className="text-right pb-2">High</th>
                  <th className="text-right pb-2">Low</th>
                  <th className="text-right pb-2">Close</th>
                </tr>
              </thead>
              <tbody>
                {candles.map((c, i) => (
                  <tr key={i} className="border-b border-gray-800/50">
                    <td className="py-2 text-gray-500">{i + 1}</td>
                    <td className="py-2 text-gray-400 font-mono text-xs">
                      {c.timestamp ? new Date(c.timestamp).toLocaleString() : "—"}
                    </td>
                    <td className="py-2 text-right font-mono">{c.open.toFixed(2)}</td>
                    <td className="py-2 text-right font-mono">{c.high.toFixed(2)}</td>
                    <td className="py-2 text-right font-mono">{c.low.toFixed(2)}</td>
                    <td className="py-2 text-right font-mono">{c.close.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="mt-6 bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-400 hover:to-yellow-500 disabled:from-gray-700 disabled:to-gray-800 text-gray-900 font-bold px-8 py-3 rounded-xl transition-all duration-200 shadow-lg hover:shadow-yellow-500/50 disabled:shadow-none transform hover:scale-105 disabled:scale-100"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Searching Patterns...
              </span>
            ) : (
              "Find Similar Patterns"
            )}
          </button>
        </div>
      )}

      {/* Results with animated cards */}
      {matches.length > 0 && (
        <div className="bg-gray-900/50 backdrop-blur-xl border border-gray-800/50 rounded-2xl p-6 shadow-2xl">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <div className="h-8 w-1 bg-gradient-to-b from-purple-400 to-purple-600 rounded-full" />
              <h2 className="text-xl font-semibold">
                Top {matches.length} Matches
              </h2>
            </div>
            <div className="text-sm text-gray-400 bg-gray-800/50 px-3 py-1 rounded-lg">
              Sorted by similarity
            </div>
          </div>

          <div className="space-y-4">
            {matches.map((m, i) => (
              <div
                key={i}
                className="group bg-gradient-to-br from-gray-800/80 to-gray-800/40 backdrop-blur border border-gray-700/50 rounded-xl p-5 hover:border-yellow-500/50 transition-all duration-300 hover:shadow-lg hover:shadow-yellow-500/10 transform hover:-translate-y-1"
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-yellow-400/20 to-yellow-600/20 flex items-center justify-center text-yellow-400 font-bold border border-yellow-500/30">
                      #{i + 1}
                    </div>
                    <div>
                      <span className="text-lg font-semibold text-gray-100">{m.day}</span>
                      <div className="text-xs text-gray-500 mt-0.5">starts @ {m.start_time}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-gray-500 mb-1">Similarity</div>
                    <div className="px-3 py-1 bg-gray-900/50 rounded-lg text-sm font-mono text-gray-300 border border-gray-700/50">
                      {m.distance.toFixed(3)}
                    </div>
                  </div>
                </div>

                <div className="border-t border-gray-700/50 pt-4">
                  <div className="text-xs text-gray-500 mb-3 uppercase tracking-wider">
                    Day Outcome (Open → Close)
                  </div>
                  <div className="flex items-center gap-4">
                    <div
                      className={`px-4 py-2 rounded-lg font-bold text-xl shadow-lg ${
                        m.day_pct_change > 0
                          ? "bg-gradient-to-br from-green-500/30 to-green-600/20 text-green-400 border border-green-500/30 shadow-green-500/20"
                          : m.day_pct_change < 0
                          ? "bg-gradient-to-br from-red-500/30 to-red-600/20 text-red-400 border border-red-500/30 shadow-red-500/20"
                          : "bg-gray-700/50 text-gray-400 border border-gray-600/30"
                      }`}
                    >
                      {m.day_pct_change > 0 ? "+" : ""}
                      {m.day_pct_change.toFixed(2)}%
                    </div>
                    <div className="flex-1 bg-gray-900/30 rounded-lg p-3 border border-gray-700/30">
                      <div className="flex items-center justify-between text-sm">
                        <div>
                          <span className="text-gray-500">Open:</span>
                          <span className="ml-2 font-mono text-gray-300">{m.day_open.toFixed(0)}</span>
                        </div>
                        <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                        </svg>
                        <div>
                          <span className="text-gray-500">Close:</span>
                          <span className="ml-2 font-mono text-gray-300">{m.day_close.toFixed(0)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
