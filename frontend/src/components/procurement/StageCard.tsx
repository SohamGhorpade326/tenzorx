import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import React, { Children } from 'react';

type ColorVariant = 'blue' | 'amber' | 'purple' | 'cyan' | 'rose' | 'indigo' | 'emerald';

interface StageCardProps {
  title: string;
  children: React.ReactNode;
  className?: string;
  icon?: React.ReactNode;
  color?: ColorVariant;
}

const colorConfig: Record<ColorVariant, {
  cardAccent: string;
  iconBg: string;
  iconBorder: string;
  labelDot: string;
}> = {
  blue: {
    cardAccent: 'border-t-blue-500',
    iconBg: 'bg-blue-900/20',
    iconBorder: 'border-blue-700',
    labelDot: 'bg-blue-500',
  },
  amber: {
    cardAccent: 'border-t-amber-500',
    iconBg: 'bg-amber-900/20',
    iconBorder: 'border-amber-700',
    labelDot: 'bg-amber-500',
  },
  purple: {
    cardAccent: 'border-t-blue-500',
    iconBg: 'bg-blue-900/20',
    iconBorder: 'border-blue-700',
    labelDot: 'bg-blue-500',
  },
  cyan: {
    cardAccent: 'border-t-blue-500',
    iconBg: 'bg-blue-900/20',
    iconBorder: 'border-blue-700',
    labelDot: 'bg-blue-500',
  },
  rose: {
    cardAccent: 'border-t-red-500',
    iconBg: 'bg-red-900/20',
    iconBorder: 'border-red-700',
    labelDot: 'bg-red-500',
  },
  indigo: {
    cardAccent: 'border-t-blue-500',
    iconBg: 'bg-blue-900/20',
    iconBorder: 'border-blue-700',
    labelDot: 'bg-blue-500',
  },
  emerald: {
    cardAccent: 'border-t-green-500',
    iconBg: 'bg-green-900/20',
    iconBorder: 'border-green-700',
    labelDot: 'bg-green-500',
  },
};

export function StageCard({ title, children, className, icon, color = 'blue' }: StageCardProps) {
  const childArray = Children.toArray(children);
  const colors = colorConfig[color];
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className={cn(
        `border bg-card border-border border-t-2 ${colors.cardAccent} transition-colors`,
        className
      )}>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            {icon && (
              <div className={cn(`p-2 rounded-md ${colors.iconBg} border ${colors.iconBorder} text-base`)}>
                {icon}
              </div>
            )}
            <CardTitle className="text-base font-semibold text-foreground">
              {title}
            </CardTitle>
          </div>
        </CardHeader>

        <CardContent className="space-y-0">
          {childArray.map((child, idx) => (
            <React.Fragment key={idx}>
              {child}
              {idx < childArray.length - 1 && (
                <div className="h-px bg-border my-2" />
              )}
            </React.Fragment>
          ))}
        </CardContent>
      </Card>
    </motion.div>
  );
}

interface StageDetailRowProps {
  label: string;
  value: React.ReactNode;
  className?: string;
}

export function StageDetailRow({ label, value, className }: StageDetailRowProps) {
  const tone = className?.includes('text-red')
    ? 'bg-red-500'
    : className?.includes('text-amber')
      ? 'bg-amber-500'
      : className?.includes('text-green')
        ? 'bg-green-500'
        : 'bg-blue-500';

  return (
    <motion.div
      initial={{ opacity: 0, x: -5 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2 }}
      className={cn(
        'flex justify-between items-center gap-4 px-2 py-2 rounded-md hover:bg-muted/30 transition-colors duration-200',
        className
      )}
    >
      <div className="flex items-center gap-2 flex-1">
        <div className={cn('w-1.5 h-1.5 rounded-full', tone)} />
        <span className="text-sm font-medium text-muted-foreground">
          {label}
        </span>
      </div>
      <span className="text-sm font-semibold text-foreground text-right flex-shrink-0">
        {value}
      </span>
    </motion.div>
  );
}
