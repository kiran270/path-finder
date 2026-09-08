"""
Fetch historical candle data from Yahoo Finance
================================================
Given ticker, date, and N candles, fetch the N candles ending at that date.
Uses yfinance library.

Install: pip install yfinance
"""

import yfinance as yf
import pandas as pd
import sys
import json
from datetime import datetime, timedelta

def fetch_candles(ticker: str, start_date: str, num_candles: int, interval: str = "15m"):
    """
    Fetch N candles from Yahoo Finance starting from start_date.
    Also fetches previous day's OHLC for CPR calculation.
    
    Args:
        ticker: e.g. "AAPL", "^NSEI", "BTC-USD"
        start_date: ISO format "2024-01-15" or "2024-01-15 09:30"
        num_candles: number of candles to fetch
        interval: "15m", "5m", "1h"
    
    Returns:
        {"candles": [...], "prev_day": {"high": ..., "low": ..., "close": ...}}
    """
    try:
        # Parse start date
        try:
            start_dt = datetime.fromisoformat(start_date.replace("Z", "+00:00"))
        except:
            start_dt = datetime.strptime(start_date, "%Y-%m-%d")
        
        # Keep timezone-naive for comparison with pandas index
        if start_dt.tzinfo is not None:
            start_dt = start_dt.replace(tzinfo=None)
        
        # Calculate end date (fetch extra to ensure we get enough)
        days_needed = max(7, num_candles // 20 + 3)
        end_dt = start_dt + timedelta(days=days_needed)
        
        # Fetch extra days before start_date to get previous day data
        fetch_start = start_dt - timedelta(days=5)  # Fetch 5 days before to account for weekends
        
        # Fetch data
        data = yf.download(
            ticker,
            start=fetch_start.strftime("%Y-%m-%d"),
            end=end_dt.strftime("%Y-%m-%d"),
            interval=interval,
            progress=False,
            auto_adjust=False,
        )
        
        if data.empty:
            return {"error": f"No data found for {ticker}"}
        
        # Handle multi-index columns (happens with some tickers)
        if isinstance(data.columns, pd.MultiIndex):
            data.columns = data.columns.droplevel(1)
        
        # Ensure index is timezone-naive for comparison
        if hasattr(data.index, 'tz') and data.index.tz is not None:
            data.index = data.index.tz_localize(None)
        
        # Separate data before and after start_date
        before_start = data[data.index < start_dt]
        after_start = data[data.index >= start_dt]
        
        if len(after_start) == 0:
            return {"error": f"No candles found after {start_date}"}
        
        # Get previous day data for CPR (last complete day before start_date)
        prev_day_data = None
        if len(before_start) > 0:
            # Get the last day before start_date
            prev_day_df = before_start.tail(100)  # Get last 100 candles to cover full previous day
            if len(prev_day_df) > 0:
                prev_day_data = {
                    "high": float(prev_day_df["High"].max()),
                    "low": float(prev_day_df["Low"].min()),
                    "close": float(prev_day_df["Close"].iloc[-1]),
                }
        
        # Take first N candles from start_date onwards
        data_subset = after_start.head(num_candles)
        
        # Convert to list of dicts
        candles = []
        for idx, row in data_subset.iterrows():
            candles.append({
                "timestamp": idx.isoformat(),
                "open": float(row.get("Open", row.get("open", 0))),
                "high": float(row.get("High", row.get("high", 0))),
                "low": float(row.get("Low", row.get("low", 0))),
                "close": float(row.get("Close", row.get("close", 0))),
                "volume": int(row.get("Volume", row.get("volume", 0))),
            })
        
        return {
            "candles": candles, 
            "count": len(candles),
            "prev_day": prev_day_data
        }
    
    except Exception as e:
        return {"error": str(e)}

if __name__ == "__main__":
    if len(sys.argv) < 4:
        print(json.dumps({"error": "Usage: python fetch_yahoo.py <ticker> <start_date> <num_candles> [interval]"}))
        sys.exit(1)
    
    ticker = sys.argv[1]
    start_date = sys.argv[2]
    num_candles = int(sys.argv[3])
    interval = sys.argv[4] if len(sys.argv) > 4 else "15m"
    
    result = fetch_candles(ticker, start_date, num_candles, interval)
    print(json.dumps(result, indent=2))
