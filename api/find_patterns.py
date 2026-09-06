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
        # Fallback for different formats
        try:
            return datetime.strptime(date_str, "%Y-%m-%d")
        except:
            return datetime.min  # Put unparseable dates at the start

def normalize_candles(candles):
    """
    Convert OHLC candles to % moves from the first open.
    Input: [{"open":100,"high":102,"low":99,"close":101}, ...]
    Output: [(0, 2%, -1%, 1%), (o%, h%, l%, c%), ...]
    """
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
    """Distance between two normalized patterns (list of tuples)."""
    if len(p1) != len(p2):
        return float('inf')
    total = 0.0
    for (o1,h1,l1,c1), (o2,h2,l2,c2) in zip(p1, p2):
        total += (o1-o2)**2 + (h1-h2)**2 + (l1-l1)**2 + (c1-c2)**2
    return total ** 0.5

def find_similar_patterns(input_candles, db_path=DB_PATH, top_k=10):
    """
    Find top K similar historical patterns by matching first N candles of each day.
    
    Args:
        input_candles: [{"open":..., "high":..., "low":..., "close":...}, ...]
        db_path: path to silver.db
        top_k: number of results to return
    
    Returns:
        [{
            "day": "Jan 20 2026",
            "start_time": "09:15",
            "distance": 1.23,
            "matched_candles": [...],
            "prev_close": 29900,
            "day_close": 30500,
            "day_pct_change": +2.01,  (calculated from prev_close to day_close)
        }, ...]
    """
    n = len(input_candles)
    if n == 0:
        return []
    
    input_norm = normalize_candles(input_candles)
    
    con = sqlite3.connect(db_path)
    con.row_factory = sqlite3.Row
    cur = con.cursor()
    
    # Get all days and sort them chronologically
    all_days_raw = [row["day"] for row in cur.execute("SELECT DISTINCT day FROM candles").fetchall()]
    all_days = sorted(all_days_raw, key=parse_date)
    
    matches = []
    
    for day_idx, day in enumerate(all_days):
        
        # Get first N candles of this day (ordered by time)
        first_n = cur.execute("""
            SELECT time, open, high, low, close
            FROM candles
            WHERE day = ? AND open IS NOT NULL AND close IS NOT NULL
            ORDER BY time
            LIMIT ?
        """, (day, n)).fetchall()
        
        if len(first_n) < n:
            continue  # Not enough candles for this day
        
        # Normalize this day's first N candles
        hist_candles = [{"open": r["open"], "high": r["high"], "low": r["low"], "close": r["close"]}
                        for r in first_n]
        hist_norm = normalize_candles(hist_candles)
        
        # Compute distance
        dist = euclidean_distance(input_norm, hist_norm)
        
        # Get previous day's close (use day_idx to find actual previous day)
        if day_idx == 0:
            continue  # Skip first day (no previous day)
        
        prev_day = all_days[day_idx - 1]
        prev_day_close = cur.execute("""
            SELECT close FROM candles
            WHERE day = ? AND close IS NOT NULL
            ORDER BY time DESC
            LIMIT 1
        """, (prev_day,)).fetchone()
        
        if not prev_day_close:
            continue  # No previous day data
        
        prev_close = prev_day_close["close"]
        
        # Get current day's close (last candle close of the matched day)
        last_candle = cur.execute("""
            SELECT close FROM candles
            WHERE day = ? AND close IS NOT NULL
            ORDER BY time DESC
            LIMIT 1
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
    
    # Sort by distance, return top K
    matches.sort(key=lambda m: m["distance"])
    return matches[:top_k]

# ── CLI interface ────────────────────────────────────────────────────────────
if __name__ == "__main__":
    if len(sys.argv) < 2:
        # Test mode
        test_input = [
            {"open": 30000, "high": 30100, "low": 29950, "close": 30050},
            {"open": 30050, "high": 30200, "low": 30000, "close": 30150},
            {"open": 30150, "high": 30300, "low": 30100, "close": 30250},
        ]
        top_k = 5
    else:
        # Production mode: args from Next.js API
        candles_json = sys.argv[1]
        top_k = int(sys.argv[2]) if len(sys.argv) > 2 else 10
        test_input = json.loads(candles_json)
    
    results = find_similar_patterns(test_input, top_k=top_k)
    print(json.dumps(results, indent=2))
