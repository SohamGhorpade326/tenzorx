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
  gradient: string;
  overlay: string;
  iconBg: string;
  iconBorder: string;
  divider: string;
  hover: string;
}> = {
  blue: {
    gradient: 'from-blue-950/40 to-slate-950',
    overlay: 'from-blue-500/10 via-transparent to-transparent',
    iconBg: 'bg-blue-600/20',
    iconBorder: 'border-blue-500/40',
    divider: 'from-blue-700/30 via-blue-600/30 to-transparent',
    hover: 'hover:border-blue-600/50',
  },
  amber: {
    gradient: 'from-amber-950/40 to-slate-950',
    overlay: 'from-amber-500/10 via-transparent to-transparent',
    iconBg: 'bg-amber-600/20',
    iconBorder: 'border-amber-500/40',
    divider: 'from-amber-700/30 via-amber-600/30 to-transparent',
    hover: 'hover:border-amber-600/50',
  },
  purple: {
    gradient: 'from-purple-950/40 to-slate-950',
    overlay: 'from-purple-500/10 via-transparent to-transparent',
    iconBg: 'bg-purple-600/20',
    iconBorder: 'border-purple-500/40',
    divider: 'from-purple-700/30 via-purple-600/30 to-transparent',
    hover: 'hover:border-purple-600/50',
  },
  cyan: {
    gradient: 'from-cyan-950/40 to-slate-950',
    overlay: 'from-cyan-500/10 via-transparent to-transparent',
    iconBg: 'bg-cyan-600/20',
    iconBorder: 'border-cyan-500/40',
    divider: 'from-cyan-700/30 via-cyan-600/30 to-transparent',
    hover: 'hover:border-cyan-600/50',
  },
  rose: {
    gradient: 'from-rose-950/40 to-slate-950',
    overlay: 'from-rose-500/10 via-transparent to-transparent',
    iconBg: 'bg-rose-600/20',
    iconBorder: 'border-rose-500/40',
    divider: 'from-rose-700/30 via-rose-600/30 to-transparent',
    hover: 'hover:border-rose-600/50',
  },
  indigo: {
    gradient: 'from-indigo-950/40 to-slate-950',
    overlay: 'from-indigo-500/10 via-transparent to-transparent',
    iconBg: 'bg-indigo-600/20',
    iconBorder: 'border-indigo-500/40',
    divider: 'from-indigo-700/30 via-indigo-600/30 to-transparent',
    hover: 'hover:border-indigo-600/50',
  },
  emerald: {
    gradient: 'from-emerald-950/40 to-slate-950',
    overlay: 'from-emerald-500/10 via-transparent to-transparent',
    iconBg: 'bg-emerald-600/20',
    iconBorder: 'border-emerald-500/40',
    divider: 'from-emerald-700/30 via-emerald-600/30 to-transparent',
    hover: 'hover:border-emerald-600/50',
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
        `relative overflow-hidden border-slate-700/50 bg-gradient-to-br ${colors.gradient} shadow-lg hover:shadow-xl ${colors.hover} transition-all duration-300`,
        className
      )}>
        {/* Colored gradient overlay */}
        <div className={`absolute inset-0 bg-gradient-to-b ${colors.overlay} pointer-events-none`} />
        
        <CardHeader className="pb-4 relative z-10">
          <div className="flex items-center gap-3">
            {icon && (
              <div className={cn(`p-2 rounded-lg ${colors.iconBg} border ${colors.iconBorder} text-lg transition-all`)}>
                {icon}
              </div>
            )}
            <CardTitle className="text-lg font-bold bg-gradient-to-r from-slate-100 to-slate-300 bg-clip-text text-transparent">
              {title}
            </CardTitle>
          </div>
        </CardHeader>

        <CardContent className="space-y-0 relative z-10">
          {childArray.map((child, idx) => (
            <React.Fragment key={idx}>
              {child}
              {idx < childArray.length - 1 && (
                <div className={`h-px bg-gradient-to-r ${colors.divider} my-3`} />
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
  return (
    <motion.div
      initial={{ opacity: 0, x: -5 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2 }}
      className={cn(
        'flex justify-between items-center gap-4 px-3 py-3 rounded-lg group hover:bg-slate-800/40 transition-colors duration-200',
        className
      )}
    >
      <div className="flex items-center gap-2 flex-1">
        <div className="w-1 h-1 rounded-full bg-blue-400/60 group-hover:bg-blue-400 transition-colors" />
        <span className="text-sm font-medium text-slate-400 group-hover:text-slate-300 transition-colors">
          {label}
        </span>
      </div>
      <span className="text-sm font-semibold text-slate-100 text-right flex-shrink-0 group-hover:text-white transition-colors">
        {value}
      </span>
    </motion.div>
  );
}
