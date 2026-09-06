interface Candle {
  open: number;
  high: number;
  low: number;
  close: number;
}

interface CandleStickChartProps {
  candles: Candle[];
}

export default function CandleStickChart({ candles }: CandleStickChartProps) {
  if (candles.length === 0) return null;

  // Fixed 30-column grid
  const GRID_COLUMNS = 30;
  const numCandles = candles.length;
  const width = 900;
  const height = 400;
  const paddingLeft = 10;
  const paddingRight = 50;
  const paddingTop = 10;
  const paddingBottom = 30;
  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  // Fixed column width based on 30 columns
  const columnWidth = chartWidth / GRID_COLUMNS;
  
  // Candle sizing - much thinner to fit 30 columns
  const bodyWidth = columnWidth * 0.6; // 60% of column width
  const wickWidth = Math.max(columnWidth * 0.1, 1); // 10% of column, min 1px

  // Find min/max for scaling
  const allPrices = candles.flatMap(c => [c.high, c.low]);
  const minPrice = Math.min(...allPrices);
  const maxPrice = Math.max(...allPrices);
  const priceRange = maxPrice - minPrice;
  const pricePadding = priceRange * 0.05; // 5% padding

  // Scale function with padding
  const scalePrice = (price: number) => {
    return chartHeight - ((price - (minPrice - pricePadding)) / (priceRange + pricePadding * 2)) * chartHeight + paddingTop;
  };

  // Generate 5 price levels
  const priceLevels = Array.from({ length: 5 }, (_, i) => {
    return maxPrice - (priceRange * i) / 4;
  });

  // TradingView colors
  const BULLISH_COLOR = '#26a69a'; // Teal/cyan
  const BEARISH_COLOR = '#ef5350'; // Red

  return (
    <div className="w-full h-full bg-gray-800/30 rounded-lg p-4 border border-gray-700/30 flex flex-col">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-full"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Vertical grid lines for 30 columns */}
        {Array.from({ length: GRID_COLUMNS + 1 }, (_, i) => {
          const x = paddingLeft + i * columnWidth;
          return (
            <line
              key={`vgrid-${i}`}
              x1={x}
              y1={paddingTop}
              x2={x}
              y2={height - paddingBottom}
              stroke="rgb(45, 55, 72)"
              strokeWidth="0.5"
              opacity="0.3"
            />
          );
        })}

        {/* Horizontal grid lines and Y-axis labels */}
        {priceLevels.map((price, i) => {
          const y = scalePrice(price);
          return (
            <g key={i}>
              <line
                x1={paddingLeft}
                y1={y}
                x2={width - paddingRight}
                y2={y}
                stroke="rgb(55, 65, 81)"
                strokeWidth="1"
                strokeDasharray="4,4"
              />
              <text
                x={width - paddingRight + 5}
                y={y + 4}
                fontSize="11"
                fill="rgb(156, 163, 175)"
                className="select-none"
              >
                {price.toFixed(0)}
              </text>
            </g>
          );
        })}

        {/* Candles - placed in fixed grid columns */}
        {candles.slice(0, GRID_COLUMNS).map((candle, i) => {
          // Place each candle in its corresponding grid column
          const x = paddingLeft + i * columnWidth + columnWidth / 2;
          const isBullish = candle.close >= candle.open;

          const highY = scalePrice(candle.high);
          const lowY = scalePrice(candle.low);
          const openY = scalePrice(candle.open);
          const closeY = scalePrice(candle.close);

          const bodyTop = Math.min(openY, closeY);
          const bodyHeight = Math.abs(closeY - openY) || 0.5;

          const candleColor = isBullish ? BULLISH_COLOR : BEARISH_COLOR;

          return (
            <g key={i}>
              {/* Wick */}
              <line
                x1={x}
                y1={highY}
                x2={x}
                y2={lowY}
                stroke={candleColor}
                strokeWidth={wickWidth}
              />
              
              {/* Body */}
              <rect
                x={x - bodyWidth / 2}
                y={bodyTop}
                width={bodyWidth}
                height={bodyHeight}
                fill={isBullish ? candleColor : candleColor}
                stroke={candleColor}
                strokeWidth="0.5"
              />

              {/* Candle number on X-axis (show every 5th) */}
              {(i + 1) % 5 === 0 && (
                <text
                  x={x}
                  y={height - paddingBottom + 15}
                  fontSize="9"
                  fill="rgb(156, 163, 175)"
                  textAnchor="middle"
                  className="select-none"
                >
                  {i + 1}
                </text>
              )}
            </g>
          );
        })}

        {/* X-axis line */}
        <line
          x1={paddingLeft}
          y1={height - paddingBottom}
          x2={width - paddingRight}
          y2={height - paddingBottom}
          stroke="rgb(75, 85, 99)"
          strokeWidth="1"
        />

        {/* Y-axis line */}
        <line
          x1={paddingLeft}
          y1={paddingTop}
          x2={paddingLeft}
          y2={height - paddingBottom}
          stroke="rgb(75, 85, 99)"
          strokeWidth="1"
        />
      </svg>

      {/* Legend */}
      <div className="flex-none mt-3 pt-3 border-t border-gray-700/30 flex items-center justify-between text-xs">
        <div className="flex gap-3">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: BULLISH_COLOR }} />
            <span className="text-gray-400">Bullish</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: BEARISH_COLOR }} />
            <span className="text-gray-400">Bearish</span>
          </div>
        </div>
        <div className="text-gray-500">
          {Math.min(numCandles, GRID_COLUMNS)}/{numCandles} candles | Range: {minPrice.toFixed(0)} - {maxPrice.toFixed(0)}
        </div>
      </div>
    </div>
  );
}
