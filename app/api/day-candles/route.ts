import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import path from "path";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { day, ticker, interval } = body;

    if (!day) {
      return NextResponse.json({ error: "Day parameter required" }, { status: 400 });
    }

    // Map ticker to database symbol
    const tickerToSymbol: Record<string, string> = {
      "^NSEBANK": "BANKNIFTY",
      "MARUTI.NS": "MARUTI.NS",
      "SI=F": "SILVER",  // US Silver futures (Yahoo) matches MCX Silver (database)
    };
    
    const symbol = ticker ? tickerToSymbol[ticker] || ticker : null;

    // Call Python script with symbol and interval parameters
    const scriptPath = path.join(process.cwd(), "api", "get_day_candles.py");
    const args = [scriptPath, day];
    
    if (symbol) args.push(symbol);
    if (interval) args.push(interval);
    
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
              { error: "Failed to fetch day candles", details: stderr },
              { status: 500 }
            )
          );
          return;
        }

        try {
          const results = JSON.parse(stdout);
          if (results.error) {
            resolve(NextResponse.json({ error: results.error }, { status: 400 }));
            return;
          }
          resolve(NextResponse.json({ candles: results.candles }));
        } catch (e) {
          resolve(
            NextResponse.json(
              { error: "Invalid response from script" },
              { status: 500 }
            )
          );
        }
      });
    });
  } catch (error: any) {
    console.error("Day candles fetch error:", error);
    return NextResponse.json(
      { error: "Server error", message: error.message },
      { status: 500 }
    );
  }
}
