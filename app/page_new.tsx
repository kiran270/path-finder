"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

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
  const [ticker, setTicker] = useState("^NSEBANK");
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
    const today = new Date().toISOString().split("T")[0];
    setDate(today);
  }, []);

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-slate-500 animate-pulse">Loading...</div>
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
        setError(data.error || "F