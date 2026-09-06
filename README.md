# Pattern Finder

A Next.js application for finding historical candlestick patterns in financial market data.

## Features

- 📊 **Real-time Data Fetching**: Fetch candlestick data from Yahoo Finance
- 🔍 **Pattern Matching**: Find similar historical patterns using Euclidean distance
- 📈 **TradingView-style Charts**: Beautiful candlestick visualization with 30-column grid
- 📱 **Fully Responsive**: Works seamlessly on mobile and desktop
- 🐳 **Dockerized**: Easy deployment with Docker

## Tech Stack

- **Frontend**: Next.js 15, React, TypeScript, TailwindCSS
- **Backend**: Python (yfinance, pandas, numpy)
- **Database**: SQLite
- **Deployment**: Docker

## Getting Started

### Prerequisites

- Node.js 18+
- Python 3.x
- Docker (optional)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/kiran270/path-finder.git
cd path-finder
```

2. Install dependencies:
```bash
npm install
pip install yfinance pandas numpy
```

3. Run the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Docker Deployment

Build and run with Docker:

```bash
docker build -t pattern-finder:latest .
docker run -p 3000:3000 pattern-finder:latest
```

## Usage

1. **Fetch Data**: Enter a ticker symbol (e.g., ^NSEBANK), select date and interval
2. **View Chart**: Candlestick chart displays fetched data in TradingView style
3. **Find Patterns**: Click "Find Patterns" to discover similar historical patterns
4. **Analyze Results**: View top 10 matches with percentage change from previous close

## Pattern Matching Algorithm

The application uses:
- Normalized OHLC data (percentage from first open)
- Euclidean distance for similarity measurement
- Matches first N candles of each historical day
- Returns day-close percentage change from previous day's close

## Database

- Contains 216 unique trading days
- 16,084 total candles
- Pre-loaded with BANKNIFTY historical data
- Cleaned of duplicates and inconsistencies

## License

MIT

## Author

Kiran
