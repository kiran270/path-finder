"""
Get all candles for a specific day from the database
"""

import sqlite3
import json
import sys
from pathlib import Path

DB_PATH = Path(__file__).parent.parent / "silver.db"

def aggregate_candles(candles_5m, interval):
    """
    Aggregate 5-minute candles into larger timeframes.
    
    Args:
        candles_5m: List of 5-min candles
        interval: Target interval ("5m", "15m", "1h", "1d")
    
    Returns:
        Aggregated candles
    """
    if interval == "5m" or not interval:
        return candles_5m
    
    # Map interval to number of 5-min candles to aggregate
    interval_map = {
        "15m": 3,   # 3 x 5min = 15min
        "1h": 12,   # 12 x 5min = 1hour
        "1d": 75,   # 75 x 5min = 6.25 hours
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

def get_day_candles(day, symbol=None, interval=None, db_path=DB_PATH):
    """
    Get all candles for a specific day and symbol, aggregated to interval.
    
    Args:
        day: Date string like "Jan 20 2024"
        symbol: Stock symbol to filter by (e.g., "BANKNIFTY", "MARUTI.NS")
        interval: Timeframe ("5m", "15m", "1h") - aggregates 5m candles
        db_path: Path to silver.db
    
    Returns:
        [{"time": "09:15", "open": 30000, "high": 30100, "low": 29950, "close": 30050}, ...]
    """
    con = sqlite3.connect(db_path)
    con.row_factory = sqlite3.Row
    cur = con.cursor()
    
    if symbol:
        rows = cur.execute("""
            SELECT time, open, high, low, close
            FROM candles
            WHERE day = ? AND symbol = ?
            ORDER BY time
        """, (day, symbol)).fetchall()
    else:
        rows = cur.execute("""
            SELECT time, open, high, low, close
            FROM candles
            WHERE day = ?
            ORDER BY time
        """, (day,)).fetchall()
    
    con.close()
    
    candles_5m = [
        {
            "time": r["time"],
            "open": r["open"],
            "high": r["high"],
            "low": r["low"],
            "close": r["close"]
        }
        for r in rows
    ]
    
    # Aggregate to target interval
    candles = aggregate_candles(candles_5m, interval)
    
    return candles

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Day parameter required"}))
        sys.exit(1)
    
    day = sys.argv[1]
    symbol = sys.argv[2] if len(sys.argv) > 2 else None
    interval = sys.argv[3] if len(sys.argv) > 3 else None
    candles = get_day_candles(day, symbol, interval)
    
    print(json.dumps({"candles": candles}))
