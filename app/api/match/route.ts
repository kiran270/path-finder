import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import path from "path";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { candles, topK = 10, ticker, interval, prevDay } = body;

    if (!Array.isArray(candles) || candles.length === 0) {
      return NextResponse.json({ error: "Invalid candles array" }, { status: 400 });
    }

    // Validate candles format
    for (const c of candles) {
      if (
        typeof c.open !== "number" ||
        typeof c.high !== "number" ||
        typeof c.low !== "number" ||
        typeof c.close !== "number"
      ) {
        return NextResponse.json(
          { error: "Each candle must have open, high, low, close as numbers" },
          { status: 400 }
        );
      }
    }

    // Map ticker to database symbol
    const tickerToSymbol: Record<string, string> = {
      "^NSEBANK": "BANKNIFTY",
      "MARUTI.NS": "MARUTI.NS",
      "SI=F": "SILVER",  // US Silver futures (Yahoo) matches MCX Silver (database)
    };
    
    const symbol = ticker ? tickerToSymbol[ticker] || ticker : null;

    // Prepare CPR data if available
    const cprData = prevDay ? {
      prev_high: prevDay.high,
      prev_low: prevDay.low,
      prev_close: prevDay.close
    } : null;

    // Call Python script with symbol, interval, and CPR parameters
    const scriptPath = path.join(process.cwd(), "api", "find_patterns.py");
    const args = [
      scriptPath, 
      JSON.stringify(candles),
      symbol || "",
      interval || "",
      topK.toString(),
      cprData ? JSON.stringify(cprData) : ""
    ];
    
    const python = spawn("python", args);

    let stdout = "";
    let stderr = "";

    python.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    python.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    return new Promise<NextResponse>((resolve) => {
      python.on("close", (code) => {
        if (code !== 0) {
          console.error("Python error:", stderr);
          resolve(
            NextResponse.json(
              { error: "Pattern matching failed", details: stderr },
              { status: 500 }
            )
          );
          return;
        }

        try {
          const results = JSON.parse(stdout);
          resolve(NextResponse.json({ matches: results }));
        } catch (e) {
          resolve(
            NextResponse.json(
              { error: "Invalid response from matcher" },
              { status: 500 }
            )
          );
        }
      });
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Server error", message: error.message },
      { status: 500 }
    );
  }
}
