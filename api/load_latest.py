"""
Load Latest Data from Yahoo Finance
====================================
Fetches historical data from last date in DB to today and inserts into DB.
"""

import sqlite3
import sys
import json
from datetime import datetime, timedelta
from pathlib import Path
import yfinance as yf
import pandas as pd

DB_PATH = Path(__file__).parent.parent / "silver.db"

def get_last_date(ticker, db_path=DB_PATH):
    """Get the last date available in DB for the symbol."""
    try:
        con = sqlite3.connect(db_path)
        cur = con.cursor()
        
        # Get max day from candles table for this symbol
        result = cur.execute("""
            SELECT MAX(day) as last_day FROM candles WHERE symbol = ?
        """, (ticker,)).fetchone()
        
        con.close()
        
        if result and result[0]:
            return result[0]
        return None
    except Exception as e:
        print(json.dumps({"error": f"DB error: {str(e)}"}))
        return None

def fetch_and_load(ticker, interval="15m"):
    """
    Fetch data from last DB date to today and insert into database.
    
    Args:
        ticker: Yahoo Finance ticker symbol
        interval: 5m, 15m, 1h, 1d
    
    Returns:
        JSON with status and count of loaded candles
    """
    try:
        # Get last date from DB
        last_date = get_last_date(ticker)
        
        if last_date:
            # Parse last date and add 1 day
            start_date = datetime.strptime(last_date, "%Y-%m-%d") + timedelta(days=1)
        else:
            # No data exists, fetch last 60 days
            start_date = datetime.now() - timedelta(days=60)
        
        end_date = datetime.now()
        
        # Fetch from Yahoo Finance
        data = yf.download(
            ticker,
            start=start_date.strftime("%Y-%m-%d"),
            end=end_date.strftime("%Y-%m-%d"),
            interval=interval,
            progress=False
        )
        
        if data.empty:
            return {
                "success": True,
                "message": "No new data available",
                "loaded_candles": 0,
                "last_date": last_date,
                "fetched_from": start_date.strftime("%Y-%m-%d"),
                "fetched_to": end_date.strftime("%Y-%m-%d")
            }
        
        # Clean column names (remove multi-level index if present)
        if isinstance(data.columns, pd.MultiIndex):
            data.columns = data.columns.droplevel(1)
        
        data.columns = [c.lower() for c in data.columns]
        data.reset_index(inplace=True)
        
        # Rename datetime column
        if 'datetime' in data.columns:
            data.rename(columns={'datetime': 'timestamp'}, inplace=True)
        elif 'date' in data.columns:
            data.rename(columns={'date': 'timestamp'}, inplace=True)
        
        # Convert timestamp to day and time
        data['day'] = data['timestamp'].dt.strftime('%Y-%m-%d')
        data['time'] = data['timestamp'].dt.strftime('%H:%M')
        data['symbol'] = ticker
        
        # Insert into database
        con = sqlite3.connect(DB_PATH)
        cur = con.cursor()
        
        inserted = 0
        for _, row in data.iterrows():
            try:
                cur.execute("""
                    INSERT OR IGNORE INTO candles (symbol, day, time, open, high, low, close, volume)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    row['symbol'],
                    row['day'],
                    row['time'],
                    float(row['open']),
                    float(row['high']),
                    float(row['low']),
                    float(row['close']),
                    int(row.get('volume', 0))
                ))
                inserted += cur.rowcount
            except Exception as e:
                continue
        
        con.commit()
        con.close()
        
        return {
            "success": True,
            "message": f"Successfully loaded {inserted} candles",
            "loaded_candles": inserted,
            "last_date": last_date,
            "fetched_from": start_date.strftime("%Y-%m-%d"),
            "fetched_to": end_date.strftime("%Y-%m-%d"),
            "new_last_date": data['day'].max() if not data.empty else last_date
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: python load_latest.py <ticker> [interval]"}))
        sys.exit(1)
    
    ticker = sys.argv[1]
    interval = sys.argv[2] if len(sys.argv) > 2 else "15m"
    
    result = fetch_and_load(ticker, interval)
    print(json.dumps(result, indent=2))
