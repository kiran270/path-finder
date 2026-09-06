import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import path from "path";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { ticker, interval = "15m" } = body;

    if (!ticker) {
      return NextResponse.json(
        { error: "Missing required field: ticker" },
        { status: 400 }
      );
    }

    const scriptPath = path.join(process.cwd(), "api", "load_latest.py");
    const python = spawn("python", [scriptPath, ticker, interval]);

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
              { error: "Failed to load latest data", details: stderr },
              { status: 500 }
            )
          );
          return;
        }

        try {
          const result = JSON.parse(stdout);

          if (!result.success) {
            resolve(
              NextResponse.json({ error: result.error }, { status: 400 })
            );
            return;
          }

          resolve(NextResponse.json(result));
        } catch (e) {
          resolve(
            NextResponse.json(
              { error: "Invalid response from loader" },
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
