import { line, curveMonotoneX } from 'd3-shape';

interface ProjectionChartProps {
  values: number[];
  width?: number;
  height?: number;
}

export const ProjectionChart = ({ values, width = 640, height = 180 }: ProjectionChartProps) => {
  if (!values.length) {
    return (
      <div className="flex h-[180px] items-center justify-center rounded-3xl border border-dashed border-ocean/20 bg-white/60 text-ocean/50">
        Projection unavailable
      </div>
    );
  }

  const max = Math.max(...values);
  const min = Math.min(...values);
  const scaleX = (idx: number) => (idx / Math.max(1, values.length - 1)) * width;
  const scaleY = (val: number) => height - ((val - min) / Math.max(1, max - min)) * height;
  const shape = line<number>()
    .x((_, idx) => scaleX(idx))
    .y((val) => scaleY(val))
    .curve(curveMonotoneX)(values);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-[180px] w-full">
      <defs>
        <linearGradient id="projectionGradient" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="rgba(58,247,184,0.4)" />
          <stop offset="100%" stopColor="rgba(9,179,251,0.15)" />
        </linearGradient>
      </defs>
      {shape ? (
        <>
          <path d={shape} fill="none" stroke="url(#projectionGradient)" strokeWidth={4} />
          <path
            d={`${shape} L ${width} ${height} L 0 ${height} Z`}
            fill="url(#projectionGradient)"
            opacity={0.35}
          />
        </>
      ) : null}
    </svg>
  );
};
