import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import path from "path";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { ticker, date, numCandles, interval = "15m" } = body;

    if (!ticker || !date || !numCandles) {
      return NextResponse.json(
        { error: "Missing required fields: ticker, date, numCandles" },
        { status: 400 }
      );
    }

    // Call Python script - correct path for pattern-finder/api/
    const scriptPath = path.join(process.cwd(), "api", "fetch_yahoo.py");
    const python = spawn("python", [
      scriptPath,
      ticker,
      date,
      numCandles.toString(),
      interval,
    ]);

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
              { error: "Failed to fetch data", details: stderr },
              { status: 500 }
            )
          );
          return;
        }

        try {
          const result = JSON.parse(stdout);
          
          if (result.error) {
            resolve(
              NextResponse.json({ error: result.error }, { status: 400 })
            );
            return;
          }

          resolve(NextResponse.json(result));
        } catch (e) {
          resolve(
            NextResponse.json(
              { error: "Invalid response from fetcher" },
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
