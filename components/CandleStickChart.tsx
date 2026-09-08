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

  // Dynamic sizing - show all candles up to max 75
  const numCandles = candles.length;
  const MAX_DISPLAY_CANDLES = 75;
  const displayCandles = Math.min(numCandles, MAX_DISPLAY_CANDLES);
  
  const width = 900;
  const height = 400;
  const paddingLeft = 10;
  const paddingRight = 50;
  const paddingTop = 10;
  const paddingBottom = 30;
  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  // Dynamic column width based on number of candles to display
  const columnWidth = chartWidth / displayCandles;
  
  // Candle sizing - adaptive
  const bodyWidth = Math.max(columnWidth * 0.65, 1.5); // 65% of column, min 1.5px
  const wickWidth = Math.max(columnWidth * 0.15, 0.8); // 15% of column, min 0.8px

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

  // Fresh green/teal colors
  const BULLISH_COLOR = '#10b981'; // Emerald green
  const BEARISH_COLOR = '#f43f5e'; // Rose red

  return (
    <div className="w-full h-full bg-white rounded-xl p-4 border-2 border-emerald-200 shadow-md flex flex-col">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-full"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Vertical grid lines - every 5th candle position */}
        {Array.from({ length: Math.ceil(displayCandles / 5) + 1 }, (_, i) => {
          const candleIndex = i * 5;
          const x = paddingLeft + candleIndex * columnWidth;
          return (
            <line
              key={`vgrid-${i}`}
              x1={x}
              y1={paddingTop}
              x2={x}
              y2={height - paddingBottom}
              stroke="rgb(167, 243, 208)"
              strokeWidth="0.5"
              opacity="0.5"
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
                stroke="rgb(167, 243, 208)"
                strokeWidth="1"
                strokeDasharray="4,4"
                opacity="0.6"
              />
              <text
                x={width - paddingRight + 5}
                y={y + 4}
                fontSize="11"
                fill="rgb(4, 120, 87)"
                fontWeight="600"
                className="select-none"
              >
                {price.toFixed(0)}
              </text>
            </g>
          );
        })}

        {/* Candles - show all candles up to MAX_DISPLAY_CANDLES */}
        {candles.slice(0, displayCandles).map((candle, i) => {
          // Place each candle in its column
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

              {/* Candle number on X-axis - show every 10th or adaptive */}
              {(() => {
                const labelStep = displayCandles <= 30 ? 5 : 10;
                return (i + 1) % labelStep === 0 ? (
                  <text
                    x={x}
                    y={height - paddingBottom + 15}
                    fontSize="9"
                    fill="rgb(4, 120, 87)"
                    fontWeight="600"
                    textAnchor="middle"
                    className="select-none"
                  >
                    {i + 1}
                  </text>
                ) : null;
              })()}
            </g>
          );
        })}

        {/* X-axis line */}
        <line
          x1={paddingLeft}
          y1={height - paddingBottom}
          x2={width - paddingRight}
          y2={height - paddingBottom}
          stroke="rgb(16, 185, 129)"
          strokeWidth="2"
        />

        {/* Y-axis line */}
        <line
          x1={paddingLeft}
          y1={paddingTop}
          x2={paddingLeft}
          y2={height - paddingBottom}
          stroke="rgb(16, 185, 129)"
          strokeWidth="2"
        />
      </svg>

      {/* Legend */}
      <div className="flex-none mt-3 pt-3 border-t-2 border-emerald-200 flex items-center justify-between text-xs">
        <div className="flex gap-3">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: BULLISH_COLOR }} />
            <span className="text-gray-700 font-semibold">Bullish</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: BEARISH_COLOR }} />
            <span className="text-gray-700 font-semibold">Bearish</span>
          </div>
        </div>
        <div className="text-gray-600 font-semibold">
          {displayCandles} of {numCandles} candles | Range: {minPrice.toFixed(0)} - {maxPrice.toFixed(0)}
        </div>
      </div>
    </div>
  );
}
