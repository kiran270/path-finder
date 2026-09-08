"""
Pattern Matching API — Find historical candle sequences
========================================================
Input: N candles (OHLC), finds similar historical patterns
Output: Top K matching days + what happened next

Method:
  1. Normalize input pattern (convert to % moves from first open)
  2. Scan all historical N-candle windows
  3. Compute Euclidean distance between normalized patterns
  4. Return top K matches + outcome (next candle direction, magnitude)
  
Database stores 5-minute candles. For 15min/1h patterns, we aggregate on-the-fly.
"""

import sqlite3
import json
import sys
from pathlib import Path
from datetime import datetime

DB_PATH = Path(__file__).parent.parent / "silver.db"

def parse_date(date_str):
    """Parse date string like 'Dec 01 2025' to datetime for sorting."""
    try:
        return datetime.strptime(date_str, "%b %d %Y")
    except:
        try:
            return datetime.strptime(date_str, "%Y-%m-%d")
        except:
            return datetime.min

def aggregate_candles(candles_5m, interval):
    """
    Aggregate 5-minute candles into larger timeframes.
    
    Args:
        candles_5m: List of 5-min candles
        interval: Target interval ("5m", "15m", "1h")
    
    Returns:
        Aggregated candles
    """
    if interval == "5m" or not interval:
        return candles_5m
    
    # Map interval to number of 5-min candles to aggregate
    interval_map = {
        "15m": 3,   # 3 x 5min = 15min
        "1h": 12,   # 12 x 5min = 1hour
    }
    
    if interval not in interval_map:
        return candles_5m
    
    chunk_size = interval_map[interval]
    aggregated = []
    
    for i in range(0, len(candles_5m), chunk_size):
        chunk = candles_5m[i:i + chunk_size]
        if not chunk:
            continue
        
        agg_candle = {
            "time": chunk[0]["time"],
            "open": chunk[0]["open"],
            "high": max(c["high"] for c in chunk),
            "low": min(c["low"] for c in chunk),
            "close": chunk[-1]["close"]
        }
        aggregated.append(agg_candle)
    
    return aggregated

def normalize_candles(candles):
    """Convert OHLC candles to % moves from the first open."""
    if not candles or not candles[0].get("open"):
        return []
    
    base = candles[0]["open"]
    normalized = []
    for c in candles:
        o = (c["open"]  - base) / base * 100
        h = (c["high"]  - base) / base * 100
        l = (c["low"]   - base) / base * 100
        cl= (c["close"] - base) / base * 100
        normalized.append((o, h, l, cl))
    return normalized

def euclidean_distance(p1, p2):
    """Distance between two normalized patterns."""
    if len(p1) != len(p2):
        return float('inf')
    total = 0.0
    for (o1,h1,l1,c1), (o2,h2,l2,c2) in zip(p1, p2):
        total += (o1-o2)**2 + (h1-h2)**2 + (l1-l2)**2 + (c1-c2)**2
    return total ** 0.5

def find_similar_patterns(input_candles, symbol=None, interval=None, db_path=DB_PATH, top_k=10):
    """
    Find top K similar historical patterns.
    
    Args:
        input_candles: Input pattern
        symbol: Stock symbol filter
        interval: Timeframe ("5m", "15m", "1h") - aggregates 5m candles
        db_path: Database path
        top_k: Number of results
    
    Returns:
        List of matching patterns with outcomes
    """
    n = len(input_candles)
    if n == 0:
        return []
    
    input_norm = normalize_candles(input_candles)
    
    con = sqlite3.connect(db_path)
    con.row_factory = sqlite3.Row
    cur = con.cursor()
    
    # Get all days for the specific symbol
    if symbol:
        all_days_raw = [row["day"] for row in cur.execute(
            "SELECT DISTINCT day FROM candles WHERE symbol = ? ORDER BY day", (symbol,)
        ).fetchall()]
    else:
        all_days_raw = [row["day"] for row in cur.execute(
            "SELECT DISTINCT day FROM candles ORDER BY day"
        ).fetchall()]
    
    all_days = sorted(all_days_raw, key=parse_date)
    matches = []
    
    for day_idx, day in enumerate(all_days):
        # Get ALL 5-minute candles for this day
        if symbol:
            day_candles_5m = cur.execute("""
                SELECT time, open, high, low, close
                FROM candles
                WHERE day = ? AND symbol = ? AND open IS NOT NULL AND close IS NOT NULL
                ORDER BY time
            """, (day, symbol)).fetchall()
        else:
            day_candles_5m = cur.execute("""
                SELECT time, open, high, low, close
                FROM candles
                WHERE day = ? AND open IS NOT NULL AND close IS NOT NULL
                ORDER BY time
            """, (day,)).fetchall()
        
        if len(day_candles_5m) == 0:
            continue
        
        # Convert to list of dicts
        candles_5m_list = [
            {"time": r["time"], "open": r["open"], "high": r["high"], "low": r["low"], "close": r["close"]}
            for r in day_candles_5m
        ]
        
        # Aggregate to target interval
        aggregated = aggregate_candles(candles_5m_list, interval)
        
        # Get first N aggregated candles
        if len(aggregated) < n:
            continue
        
        first_n = aggregated[:n]
        hist_candles = [{"open": c["open"], "high": c["high"], "low": c["low"], "close": c["close"]}
                        for c in first_n]
        hist_norm = normalize_candles(hist_candles)
        
        # Compute distance
        dist = euclidean_distance(input_norm, hist_norm)
        
        # Get previous day's close
        if day_idx == 0:
            continue
        
        prev_day = all_days[day_idx - 1]
        if symbol:
            prev_day_close = cur.execute("""
                SELECT close FROM candles
                WHERE day = ? AND symbol = ? AND close IS NOT NULL
                ORDER BY time DESC LIMIT 1
            """, (prev_day, symbol)).fetchone()
        else:
            prev_day_close = cur.execute("""
                SELECT close FROM candles
                WHERE day = ? AND close IS NOT NULL
                ORDER BY time DESC LIMIT 1
            """, (prev_day,)).fetchone()
        
        if not prev_day_close:
            continue
        
        prev_close = prev_day_close["close"]
        
        # Get current day's close
        if symbol:
            last_candle = cur.execute("""
                SELECT close FROM candles
                WHERE day = ? AND symbol = ? AND close IS NOT NULL
                ORDER BY time DESC LIMIT 1
            """, (day, symbol)).fetchone()
        else:
            last_candle = cur.execute("""
                SELECT close FROM candles
                WHERE day = ? AND close IS NOT NULL
                ORDER BY time DESC LIMIT 1
            """, (day,)).fetchone()
        
        if not last_candle:
            continue
        
        day_close = last_candle["close"]
        day_pct_change = (day_close - prev_close) / prev_close * 100
        
        matches.append({
            "day": day,
            "start_time": first_n[0]["time"],
            "distance": round(dist, 3),
            "matched_candles": hist_candles,
            "prev_close": round(prev_close, 2),
            "day_close": round(day_close, 2),
            "day_pct_change": round(day_pct_change, 2),
        })
    
    con.close()
    
    matches.sort(key=lambda m: m["distance"])
    return matches[:top_k]

# CLI interface
if __name__ == "__main__":
    if len(sys.argv) < 2:
        test_input = [
            {"open": 30000, "high": 30100, "low": 29950, "close": 30050},
            {"open": 30050, "high": 30200, "low": 30000, "close": 30150},
            {"open": 30150, "high": 30300, "low": 30100, "close": 30250},
        ]
        symbol = "BANKNIFTY"
        interval = "15m"
        top_k = 5
    else:
        # Parse arguments: candles_json, symbol, interval, top_k
        candles_json = sys.argv[1]
        test_input = json.loads(candles_json)
        
        # Handle arguments (may be empty strings)
        symbol = sys.argv[2] if len(sys.argv) > 2 and sys.argv[2] else None
        interval = sys.argv[3] if len(sys.argv) > 3 and sys.argv[3] else None
        top_k = int(sys.argv[4]) if len(sys.argv) > 4 and sys.argv[4] else 10
        
        print(f"DEBUG: symbol={symbol}, interval={interval}, top_k={top_k}", file=sys.stderr)
    
    results = find_similar_patterns(test_input, symbol=symbol, interval=interval, top_k=top_k)
    print(json.dumps(results, indent=2))
