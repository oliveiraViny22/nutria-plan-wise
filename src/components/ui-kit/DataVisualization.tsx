import * as React from 'react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

/* ========================
   PROGRESS RING
   ======================== */

interface ProgressRingProps {
  value: number;
  max?: number;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  strokeWidth?: number;
  color?: 'primary' | 'success' | 'warning' | 'destructive' | 'protein' | 'carbs' | 'fat';
  showLabel?: boolean;
  label?: string;
  className?: string;
}

export function ProgressRing({
  value,
  max = 100,
  size = 'md',
  strokeWidth,
  color = 'primary',
  showLabel = true,
  label,
  className,
}: ProgressRingProps) {
  const percentage = Math.min((value / max) * 100, 100);
  
  const sizeConfig = {
    sm: { size: 48, stroke: 4, fontSize: 'text-xs' },
    md: { size: 64, stroke: 5, fontSize: 'text-sm' },
    lg: { size: 96, stroke: 6, fontSize: 'text-lg' },
    xl: { size: 128, stroke: 8, fontSize: 'text-2xl' },
  };
  
  const config = sizeConfig[size];
  const actualStroke = strokeWidth || config.stroke;
  const radius = (config.size - actualStroke) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (percentage / 100) * circumference;

  const colorClasses = {
    primary: 'text-primary',
    success: 'text-success',
    warning: 'text-warning',
    destructive: 'text-destructive',
    protein: 'text-protein',
    carbs: 'text-carbs',
    fat: 'text-fat',
  };

  return (
    <div className={cn('relative inline-flex items-center justify-center', className)}>
      <svg width={config.size} height={config.size} className="transform -rotate-90">
        {/* Background circle */}
        <circle
          cx={config.size / 2}
          cy={config.size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={actualStroke}
          className="text-muted/30"
        />
        {/* Progress circle */}
        <motion.circle
          cx={config.size / 2}
          cy={config.size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={actualStroke}
          strokeLinecap="round"
          className={colorClasses[color]}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          style={{
            strokeDasharray: circumference,
          }}
        />
      </svg>
      {showLabel && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={cn('font-bold tabular-nums', config.fontSize)}>
            {Math.round(percentage)}%
          </span>
          {label && <span className="text-[10px] text-muted-foreground">{label}</span>}
        </div>
      )}
    </div>
  );
}

/* ========================
   MINI BAR CHART
   ======================== */

interface MiniBarData {
  value: number;
  label?: string;
  color?: 'primary' | 'success' | 'warning' | 'muted';
}

interface MiniBarChartProps {
  data: MiniBarData[];
  max?: number;
  height?: number;
  showLabels?: boolean;
  className?: string;
}

export function MiniBarChart({
  data,
  max,
  height = 48,
  showLabels = false,
  className,
}: MiniBarChartProps) {
  const maxValue = max || Math.max(...data.map(d => d.value));
  
  const colorClasses = {
    primary: 'bg-primary',
    success: 'bg-success',
    warning: 'bg-warning',
    muted: 'bg-muted-foreground/50',
  };

  return (
    <div className={cn('flex items-end gap-1', className)} style={{ height }}>
      {data.map((item, index) => {
        const barHeight = (item.value / maxValue) * 100;
        
        return (
          <div key={index} className="flex flex-col items-center gap-1 flex-1">
            <motion.div
              className={cn(
                'w-full rounded-t-sm',
                colorClasses[item.color || 'primary']
              )}
              initial={{ height: 0 }}
              animate={{ height: `${barHeight}%` }}
              transition={{ duration: 0.5, delay: index * 0.05 }}
            />
            {showLabels && item.label && (
              <span className="text-[10px] text-muted-foreground truncate">
                {item.label}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ========================
   SPARKLINE
   ======================== */

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: 'primary' | 'success' | 'warning' | 'destructive';
  showArea?: boolean;
  className?: string;
}

export function Sparkline({
  data,
  width = 100,
  height = 32,
  color = 'primary',
  showArea = true,
  className,
}: SparklineProps) {
  if (data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  
  const padding = 2;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;
  
  const points = data.map((value, index) => {
    const x = padding + (index / (data.length - 1)) * chartWidth;
    const y = padding + chartHeight - ((value - min) / range) * chartHeight;
    return `${x},${y}`;
  });
  
  const linePath = `M ${points.join(' L ')}`;
  const areaPath = `${linePath} L ${width - padding},${height - padding} L ${padding},${height - padding} Z`;

  const colorClasses = {
    primary: { stroke: 'stroke-primary', fill: 'fill-primary/20' },
    success: { stroke: 'stroke-success', fill: 'fill-success/20' },
    warning: { stroke: 'stroke-warning', fill: 'fill-warning/20' },
    destructive: { stroke: 'stroke-destructive', fill: 'fill-destructive/20' },
  };

  return (
    <svg 
      width={width} 
      height={height} 
      className={cn('overflow-visible', className)}
    >
      {showArea && (
        <motion.path
          d={areaPath}
          className={colorClasses[color].fill}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
        />
      )}
      <motion.path
        d={linePath}
        fill="none"
        className={colorClasses[color].stroke}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
      />
      {/* Last point indicator */}
      <motion.circle
        cx={width - padding}
        cy={padding + chartHeight - ((data[data.length - 1] - min) / range) * chartHeight}
        r={3}
        className={cn('fill-background', colorClasses[color].stroke)}
        strokeWidth={2}
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ duration: 0.3, delay: 0.5 }}
      />
    </svg>
  );
}

/* ========================
   STAT COMPARISON
   ======================== */

interface StatComparisonProps {
  label: string;
  current: number;
  previous: number;
  unit?: string;
  format?: 'number' | 'percent';
  className?: string;
}

export function StatComparison({
  label,
  current,
  previous,
  unit,
  format = 'number',
  className,
}: StatComparisonProps) {
  const diff = current - previous;
  const percentChange = previous !== 0 ? ((diff / previous) * 100) : 0;
  const isPositive = diff > 0;
  const isNeutral = diff === 0;

  return (
    <div className={cn('space-y-1', className)}>
      <p className="text-sm text-muted-foreground">{label}</p>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold tabular-nums">
          {format === 'percent' ? `${current}%` : current.toLocaleString()}
          {unit && <span className="text-sm font-normal text-muted-foreground ml-1">{unit}</span>}
        </span>
        {!isNeutral && (
          <span
            className={cn(
              'text-sm font-medium',
              isPositive ? 'text-success' : 'text-destructive'
            )}
          >
            {isPositive ? '↑' : '↓'} {Math.abs(percentChange).toFixed(1)}%
          </span>
        )}
      </div>
    </div>
  );
}

/* ========================
   DONUT CHART SIMPLE
   ======================== */

interface DonutSegment {
  value: number;
  color: 'primary' | 'secondary' | 'success' | 'warning' | 'protein' | 'carbs' | 'fat';
  label?: string;
}

interface DonutChartProps {
  segments: DonutSegment[];
  size?: number;
  strokeWidth?: number;
  centerLabel?: string;
  centerValue?: string;
  className?: string;
}

export function DonutChart({
  segments,
  size = 120,
  strokeWidth = 16,
  centerLabel,
  centerValue,
  className,
}: DonutChartProps) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  
  let cumulativeOffset = 0;

  const colorClasses = {
    primary: 'text-primary',
    secondary: 'text-secondary',
    success: 'text-success',
    warning: 'text-warning',
    protein: 'text-protein',
    carbs: 'text-carbs',
    fat: 'text-fat',
  };

  return (
    <div className={cn('relative inline-flex items-center justify-center', className)}>
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-muted/20"
        />
        {/* Segments */}
        {segments.map((segment, index) => {
          const segmentLength = (segment.value / total) * circumference;
          const offset = circumference - cumulativeOffset;
          cumulativeOffset += segmentLength;
          
          return (
            <motion.circle
              key={index}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="currentColor"
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              className={colorClasses[segment.color]}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset: offset }}
              transition={{ duration: 0.8, delay: index * 0.1, ease: 'easeOut' }}
              style={{
                strokeDasharray: `${segmentLength} ${circumference - segmentLength}`,
              }}
            />
          );
        })}
      </svg>
      {(centerLabel || centerValue) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {centerValue && <span className="text-xl font-bold">{centerValue}</span>}
          {centerLabel && <span className="text-xs text-muted-foreground">{centerLabel}</span>}
        </div>
      )}
    </div>
  );
}
