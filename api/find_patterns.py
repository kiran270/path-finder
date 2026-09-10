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
            "close": chunk[-1]["close"],
            "volume": sum(c.get("volume", 0) for c in chunk)  # Sum volumes
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

def normalize_volume(candles):
    """
    Normalize volume as relative to average volume.
    Returns list of volume ratios (1.0 = average volume).
    """
    if not candles:
        return []
    
    volumes = [c.get("volume", 0) for c in candles]
    avg_volume = sum(volumes) / len(volumes) if volumes else 1
    
    if avg_volume == 0:
        return [1.0] * len(candles)
    
    return [v / avg_volume for v in volumes]

def volume_distance(vol1, vol2):
    """
    Calculate distance between two volume patterns.
    Compares relative volume profiles.
    """
    if len(vol1) != len(vol2):
        return float('inf')
    
    total = sum((v1 - v2)**2 for v1, v2 in zip(vol1, vol2))
    return (total / len(vol1)) ** 0.5

def calculate_cpr(prev_high, prev_low, prev_close):
    """Calculate CPR levels from previous day data."""
    pivot = (prev_high + prev_low + prev_close) / 3
    bc = (prev_high + prev_low) / 2
    tc = 2 * pivot - bc
    r1 = 2 * pivot - prev_low
    r2 = pivot + (prev_high - prev_low)
    s1 = 2 * pivot - prev_high
    s2 = pivot - (prev_high - prev_low)
    return {
        "tc": tc, "pivot": pivot, "bc": bc,
        "r1": r1, "r2": r2, "s1": s1, "s2": s2
    }

def get_cpr_zone(price, cpr):
    """
    Determine which CPR zone a price is in.
    Zones: below_s2, s2_s1, s1_bc, bc_pivot, pivot_tc, tc_r1, r1_r2, above_r2
    """
    if price < cpr["s2"]:
        return "below_s2"
    elif price < cpr["s1"]:
        return "s2_s1"
    elif price < cpr["bc"]:
        return "s1_bc"
    elif price < cpr["pivot"]:
        return "bc_pivot"
    elif price < cpr["tc"]:
        return "pivot_tc"
    elif price < cpr["r1"]:
        return "tc_r1"
    elif price < cpr["r2"]:
        return "r1_r2"
    else:
        return "above_r2"

def calculate_cpr_zone_features(candles, cpr):
    """
    Calculate features about how candles interact with CPR zones.
    Returns: dominant zone, zone changes, touches
    """
    if not candles or not cpr:
        return None
    
    from collections import Counter
    
    # Track which zones each candle is in (using close price)
    zones = []
    zone_touches = {
        "below_s2": 0, "s2_s1": 0, "s1_bc": 0, "bc_pivot": 0,
        "pivot_tc": 0, "tc_r1": 0, "r1_r2": 0, "above_r2": 0
    }
    
    for candle in candles:
        # Check zone for each price point
        open_zone = get_cpr_zone(candle["open"], cpr)
        high_zone = get_cpr_zone(candle["high"], cpr)
        low_zone = get_cpr_zone(candle["low"], cpr)
        close_zone = get_cpr_zone(candle["close"], cpr)
        
        zones.append(close_zone)
        
        # Count all zones touched by this candle
        all_zones = {open_zone, high_zone, low_zone, close_zone}
        for z in all_zones:
            zone_touches[z] += 1
    
    # Find dominant zone (most common close zone)
    zone_counts = Counter(zones)
    dominant_zone = zone_counts.most_common(1)[0][0] if zone_counts else "unknown"
    
    # Calculate zone changes (trend)
    zone_order = ["below_s2", "s2_s1", "s1_bc", "bc_pivot", "pivot_tc", "tc_r1", "r1_r2", "above_r2"]
    zone_indices = [zone_order.index(z) for z in zones]
    trend = "neutral"
    if len(zone_indices) > 1:
        if zone_indices[-1] > zone_indices[0]:
            trend = "up"
        elif zone_indices[-1] < zone_indices[0]:
            trend = "down"
    
    return {
        "dominant_zone": dominant_zone,
        "trend": trend,
        "zone_touches": zone_touches
    }

def normalize_cpr_levels(cpr, base_price):
    """Normalize CPR levels as % from base price."""
    return {
        "tc": (cpr["tc"] - base_price) / base_price * 100,
        "pivot": (cpr["pivot"] - base_price) / base_price * 100,
        "bc": (cpr["bc"] - base_price) / base_price * 100,
        "r1": (cpr["r1"] - base_price) / base_price * 100,
        "r2": (cpr["r2"] - base_price) / base_price * 100,
        "s1": (cpr["s1"] - base_price) / base_price * 100,
        "s2": (cpr["s2"] - base_price) / base_price * 100,
    }

def cpr_distance(cpr1, cpr2):
    """Calculate distance between two normalized CPR levels."""
    keys = ["tc", "pivot", "bc", "r1", "r2", "s1", "s2"]
    total = sum((cpr1[k] - cpr2[k])**2 for k in keys)
    return total ** 0.5

def euclidean_distance(p1, p2):
    """Distance between two normalized patterns."""
    if len(p1) != len(p2):
        return float('inf')
    total = 0.0
    for (o1,h1,l1,c1), (o2,h2,l2,c2) in zip(p1, p2):
        total += (o1-o2)**2 + (h1-h2)**2 + (l1-l2)**2 + (c1-c2)**2
    return total ** 0.5

def find_similar_patterns(input_candles, input_cpr=None, symbol=None, interval=None, db_path=DB_PATH, top_k=10):
    """
    Find top K similar historical patterns considering both candles and CPR levels.
    
    Args:
        input_candles: Input pattern
        input_cpr: CPR levels from input pattern (dict with prev_high, prev_low, prev_close)
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
    
    # Calculate and normalize input CPR if provided
    input_cpr_norm = None
    input_cpr_levels = None
    input_cpr_zone_features = None
    if input_cpr and input_cpr.get("prev_high") and input_cpr.get("prev_low") and input_cpr.get("prev_close"):
        input_cpr_levels = calculate_cpr(
            input_cpr["prev_high"], 
            input_cpr["prev_low"], 
            input_cpr["prev_close"]
        )
        base_price = input_candles[0]["open"]
        input_cpr_norm = normalize_cpr_levels(input_cpr_levels, base_price)
        
        # Calculate input CPR zone features
        input_cpr_zone_features = calculate_cpr_zone_features(input_candles, input_cpr_levels)
    
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
                SELECT time, open, high, low, close, volume
                FROM candles
                WHERE day = ? AND symbol = ? AND open IS NOT NULL AND close IS NOT NULL
                ORDER BY time
            """, (day, symbol)).fetchall()
        else:
            day_candles_5m = cur.execute("""
                SELECT time, open, high, low, close, volume
                FROM candles
                WHERE day = ? AND open IS NOT NULL AND close IS NOT NULL
                ORDER BY time
            """, (day,)).fetchall()
        
        if len(day_candles_5m) == 0:
            continue
        
        # Convert to list of dicts
        candles_5m_list = [
            {"time": r["time"], "open": r["open"], "high": r["high"], "low": r["low"], "close": r["close"], "volume": r["volume"] or 0}
            for r in day_candles_5m
        ]
        
        # Aggregate to target interval
        aggregated = aggregate_candles(candles_5m_list, interval)
        
        # Match using available candles (up to N)
        # If historical day has fewer candles than input, skip it
        # But allow matching if it has at least 80% of requested candles
        min_required = int(n * 0.8)  # Require at least 80% of candles
        if len(aggregated) < min_required:
            continue
        
        # Use the smaller of: input length or available candles
        match_length = min(n, len(aggregated))
        first_n = aggregated[:match_length]
        hist_candles = [{"open": c["open"], "high": c["high"], "low": c["low"], "close": c["close"]}
                        for c in first_n]
        
        # Normalize to the same length for comparison
        # If historical has fewer candles, pad input to match
        input_for_comparison = input_candles[:match_length]
        input_norm_matched = normalize_candles(input_for_comparison)
        hist_norm = normalize_candles(hist_candles)
        
        # Normalize volumes
        input_vol_norm = normalize_volume(input_for_comparison)
        hist_vol_norm = normalize_volume(hist_candles)
        
        # Compute candle pattern distance
        candle_dist = euclidean_distance(input_norm_matched, hist_norm)
        
        # Compute volume distance
        vol_dist = volume_distance(input_vol_norm, hist_vol_norm)
        
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
        
        # Get previous day's high and low for CPR calculation
        if symbol:
            prev_day_data = cur.execute("""
                SELECT high, low FROM candles
                WHERE day = ? AND symbol = ? AND high IS NOT NULL AND low IS NOT NULL
                ORDER BY time
            """, (prev_day, symbol)).fetchall()
        else:
            prev_day_data = cur.execute("""
                SELECT high, low FROM candles
                WHERE day = ? AND high IS NOT NULL AND low IS NOT NULL
                ORDER BY time
            """, (prev_day,)).fetchall()
        
        if prev_day_data:
            prev_high = max(row["high"] for row in prev_day_data)
            prev_low = min(row["low"] for row in prev_day_data)
        else:
            prev_high = None
            prev_low = None
        
        # Calculate CPR distance if both input and historical have CPR data
        cpr_dist = 0
        zone_match_score = 0
        if input_cpr_norm and prev_high and prev_low:
            hist_cpr_levels = calculate_cpr(prev_high, prev_low, prev_close)
            hist_base_price = hist_candles[0]["open"]
            hist_cpr_norm = normalize_cpr_levels(hist_cpr_levels, hist_base_price)
            cpr_dist = cpr_distance(input_cpr_norm, hist_cpr_norm)
            
            # Calculate CPR zone matching
            if input_cpr_zone_features:
                hist_cpr_zone_features = calculate_cpr_zone_features(hist_candles, hist_cpr_levels)
                
                if hist_cpr_zone_features:
                    # Zone match: 0 if same zone, penalty if different
                    if input_cpr_zone_features["dominant_zone"] == hist_cpr_zone_features["dominant_zone"]:
                        zone_match_score = 0  # Perfect match
                    else:
                        # Calculate zone distance (how many zones apart)
                        zone_order = ["below_s2", "s2_s1", "s1_bc", "bc_pivot", "pivot_tc", "tc_r1", "r1_r2", "above_r2"]
                        input_zone_idx = zone_order.index(input_cpr_zone_features["dominant_zone"])
                        hist_zone_idx = zone_order.index(hist_cpr_zone_features["dominant_zone"])
                        zone_diff = abs(input_zone_idx - hist_zone_idx)
                        zone_match_score = zone_diff * 2  # Penalty: 2 points per zone difference
                    
                    # Trend match bonus/penalty
                    if input_cpr_zone_features["trend"] != hist_cpr_zone_features["trend"]:
                        zone_match_score += 1  # Small penalty for different trend
        
        # Combined distance: 90% candle pattern + 70% CPR levels + 100% zone matching + 40% volume
        # Zone matching heavily penalizes patterns in different CPR zones
        # Volume adds context about strength/momentum
        if input_cpr_norm:
            dist = (0.9 * candle_dist) + (0.7 * cpr_dist) + (1.0 * zone_match_score) + (0.4 * vol_dist)
        else:
            dist = (0.9 * candle_dist) + (0.4 * vol_dist)
        
        # Calculate outcome statistics (next 6, 12 candles and day end)
        outcomes = {}
        
        # Get the pattern end price (last candle close of matched pattern)
        pattern_end_price = aggregated[match_length - 1]["close"]
        
        # Next 6 candles outcome
        if len(aggregated) > match_length + 5:
            next_6_candles = aggregated[match_length:match_length + 6]
            next_6_high = max(c["high"] for c in next_6_candles)
            next_6_low = min(c["low"] for c in next_6_candles)
            next_6_close = aggregated[match_length + 5]["close"]
            
            outcomes["next_6_candles_points"] = round(next_6_close - pattern_end_price, 2)
            outcomes["next_6_max_gain"] = round(next_6_high - pattern_end_price, 2)
            outcomes["next_6_max_loss"] = round(next_6_low - pattern_end_price, 2)
        else:
            outcomes["next_6_candles_points"] = None
            outcomes["next_6_max_gain"] = None
            outcomes["next_6_max_loss"] = None
        
        # Next 12 candles outcome
        if len(aggregated) > match_length + 11:
            next_12_candles = aggregated[match_length:match_length + 12]
            next_12_high = max(c["high"] for c in next_12_candles)
            next_12_low = min(c["low"] for c in next_12_candles)
            next_12_close = aggregated[match_length + 11]["close"]
            
            outcomes["next_12_candles_points"] = round(next_12_close - pattern_end_price, 2)
            outcomes["next_12_max_gain"] = round(next_12_high - pattern_end_price, 2)
            outcomes["next_12_max_loss"] = round(next_12_low - pattern_end_price, 2)
        else:
            outcomes["next_12_candles_points"] = None
            outcomes["next_12_max_gain"] = None
            outcomes["next_12_max_loss"] = None
        
        # Get current day's close for day end outcome
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
        
        # Day end outcome (from pattern end to day close)
        # Also get max gain/loss for the entire day from pattern end
        remaining_candles = aggregated[match_length:]
        if remaining_candles:
            day_high = max(c["high"] for c in remaining_candles)
            day_low = min(c["low"] for c in remaining_candles)
            outcomes["day_end_points"] = round(day_close - pattern_end_price, 2)
            outcomes["day_max_gain"] = round(day_high - pattern_end_price, 2)
            outcomes["day_max_loss"] = round(day_low - pattern_end_price, 2)
        else:
            outcomes["day_end_points"] = None
            outcomes["day_max_gain"] = None
            outcomes["day_max_loss"] = None
        
        # Get CPR zone info if available
        cpr_zone_info = None
        if input_cpr_zone_features and prev_high and prev_low:
            hist_cpr_levels = calculate_cpr(prev_high, prev_low, prev_close)
            hist_cpr_zone_features = calculate_cpr_zone_features(hist_candles, hist_cpr_levels)
            if hist_cpr_zone_features:
                cpr_zone_info = hist_cpr_zone_features["dominant_zone"]
        
        match_result = {
            "day": day,
            "start_time": first_n[0]["time"],
            "distance": round(dist, 3),
            "matched_candles": hist_candles,
            "prev_close": round(prev_close, 2),
            "prev_high": round(prev_high, 2) if prev_high else None,
            "prev_low": round(prev_low, 2) if prev_low else None,
            "day_close": round(day_close, 2),
            "day_pct_change": round(day_pct_change, 2),
            "outcomes": outcomes,
            "pattern_direction": "bullish" if day_pct_change > 0 else "bearish" if day_pct_change < 0 else "neutral",
        }
        
        if cpr_zone_info:
            match_result["cpr_zone"] = cpr_zone_info
        
        matches.append(match_result)
    
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
        input_cpr = None
    else:
        # Parse arguments: candles_json, symbol, interval, top_k, cpr_json
        candles_json = sys.argv[1]
        test_input = json.loads(candles_json)
        
        # Handle arguments (may be empty strings)
        symbol = sys.argv[2] if len(sys.argv) > 2 and sys.argv[2] else None
        interval = sys.argv[3] if len(sys.argv) > 3 and sys.argv[3] else None
        top_k = int(sys.argv[4]) if len(sys.argv) > 4 and sys.argv[4] else 10
        input_cpr = json.loads(sys.argv[5]) if len(sys.argv) > 5 and sys.argv[5] else None
        
        print(f"DEBUG: symbol={symbol}, interval={interval}, top_k={top_k}, cpr={input_cpr is not None}", file=sys.stderr)
    
    results = find_similar_patterns(test_input, input_cpr=input_cpr, symbol=symbol, interval=interval, top_k=top_k)
    print(json.dumps(results, indent=2))
