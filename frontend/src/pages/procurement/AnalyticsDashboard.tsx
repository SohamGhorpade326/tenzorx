import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ComposedChart
} from 'recharts';
import {
  IndianRupee, TrendingUp, AlertTriangle, PiggyBank, Clock, AlertCircle,
  RefreshCw, Sparkles, Download, BarChart3
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import * as procurementApi from '@/lib/procurementApi';

// Format currency in INR
const formatINR = (value: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value);

// KPI Card Component
function KPICard({
  title,
  value,
  icon: Icon,
  subtitle,
  color = 'blue',
}: {
  title: string;
  value: string | number;
  icon: any;
  subtitle: string;
  color?: 'blue' | 'green' | 'amber' | 'red';
}) {
  const colorClasses = {
    blue: 'text-blue-400 bg-blue-900/20 border-blue-700/50',
    green: 'text-green-400 bg-green-900/20 border-green-700/50',
    amber: 'text-amber-400 bg-amber-900/20 border-amber-700/50',
    red: 'text-red-400 bg-red-900/20 border-red-700/50',
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <Card className={`border ${colorClasses[color]} bg-slate-950`}>
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-sm text-slate-400">{title}</p>
              <p className="text-2xl font-bold text-slate-100">{value}</p>
              <p className="text-xs text-slate-500 mt-2">{subtitle}</p>
            </div>
            <Icon className={`w-8 h-8 ${colorClasses[color].split(' ')[0]}`} />
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default function AnalyticsDashboard() {
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'7days' | '30days' | '90days'>('30days');

  // Data states
  const [summary, setSummary] = useState<any>(null);
  const [spendTrend, setSpendTrend] = useState<any[]>([]);
  const [budgetUtil, setBudgetUtil] = useState<any>(null);
  const [invoiceStats, setInvoiceStats] = useState<any>(null);
  const [pipelinePerf, setPipelinePerf] = useState<any>(null);
  const [savingsSummary, setSavingsSummary] = useState<any>(null);
  const [spendByDept, setSpendByDept] = useState<any>(null);
  const [aiInsight, setAiInsight] = useState<any>(null);
  const [loadingInsight, setLoadingInsight] = useState(false);

  useEffect(() => {
    fetchAllData();
  }, [period]);

  const fetchAllData = async () => {
    try {
      setLoading(true);
      const [summaryData, trendData, budgetData, invoiceData, perfData, savingsData, deptData] =
        await Promise.all([
          procurementApi.analyticsApi.getSummary(),
          procurementApi.analyticsApi.getSpendTrend(period),
          procurementApi.analyticsApi.getBudgetUtilisation(),
          procurementApi.analyticsApi.getInvoiceMatchStats(),
          procurementApi.analyticsApi.getPipelinePerformance(),
          procurementApi.analyticsApi.getSavingsSummary(),
          procurementApi.analyticsApi.getSpendByDepartment(),
        ]);

      setSummary(summaryData);
      setSpendTrend(Array.isArray(trendData) ? trendData : []);
      setBudgetUtil(budgetData);
      setInvoiceStats(invoiceData);
      setPipelinePerf(perfData);
      setSavingsSummary(savingsData);
      setSpendByDept(deptData);
    } catch (error) {
      toast.error('Failed to load analytics data');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAIInsight = async () => {
    try {
      setLoadingInsight(true);
      const data = await procurementApi.analyticsApi.getAIInsight();
      setAiInsight(data);
    } catch (error) {
      toast.error('Failed to generate AI insight');
      console.error(error);
    } finally {
      setLoadingInsight(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-1/3 bg-slate-900/40" />
        <div className="grid grid-cols-6 gap-4">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-32 bg-slate-900/40" />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-80 bg-slate-900/40" />
          <Skeleton className="h-80 bg-slate-900/40" />
        </div>
      </div>
    );
  }

  // Transform data for charts
  const byStatusData = summary ? [
    { name: 'Completed', value: summary.completed_runs, fill: '#10b981' },
    { name: 'Failed', value: summary.failed_runs, fill: '#ef4444' },
    { name: 'Blocked', value: summary.blocked_runs, fill: '#f59e0b' },
  ] : [];

  const invoiceChartData = invoiceStats ? [
    { name: 'Clean', value: invoiceStats.clean, fill: '#10b981' },
    { name: 'Partial', value: invoiceStats.partial, fill: '#f59e0b' },
    { name: 'Failed', value: invoiceStats.failed, fill: '#ef4444' },
  ] : [];

  const successRate =
    summary && summary.total_runs > 0
      ? ((summary.completed_runs / summary.total_runs) * 100).toFixed(1)
      : 0;

  const successColor =
    parseFloat(String(successRate)) > 80
      ? 'green'
      : parseFloat(String(successRate)) >= 60
        ? 'amber'
        : 'red';

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-slate-100">Procurement Analytics</h1>
          <p className="text-slate-400 mt-1">Executive overview of procurement performance</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Period Selector */}
          <div className="flex gap-2">
            {(['7days', '30days', '90days'] as const).map((p) => (
              <Button
                key={p}
                size="sm"
                variant={period === p ? 'default' : 'outline'}
                onClick={() => setPeriod(p)}
                className={
                  period === p
                    ? 'bg-blue-700 hover:bg-blue-600'
                    : 'border-slate-700 text-slate-300 hover:text-slate-100'
                }
              >
                {p === '7days' ? '7 days' : p === '30days' ? '30 days' : '90 days'}
              </Button>
            ))}
          </div>

          {/* Refresh */}
          <Button
            size="sm"
            variant="outline"
            onClick={fetchAllData}
            className="border-slate-700 text-slate-300 hover:text-slate-100"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>

          {/* AI Insight Button */}
          <Button
            size="sm"
            onClick={fetchAIInsight}
            disabled={loadingInsight}
            className="bg-purple-700 hover:bg-purple-600"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            {loadingInsight ? 'Generating...' : 'AI Insight'}
          </Button>
        </div>
      </div>

      {/* Row 1: KPI Cards */}
      <div className="grid grid-cols-6 gap-4">
        <KPICard
          title="Total Spend This Month"
          value={summary ? formatINR(summary.total_spend_this_month) : '₹0'}
          icon={IndianRupee}
          subtitle="Scheduled payments"
          color="blue"
        />
        <KPICard
          title="Pipeline Success Rate"
          value={`${successRate}%`}
          icon={TrendingUp}
          subtitle={`${summary?.completed_runs} of ${summary?.total_runs} runs`}
          color={successColor}
        />
        <KPICard
          title="Invoice Mismatch Rate"
          value={`${summary?.invoice_mismatch_rate || 0}%`}
          icon={AlertTriangle}
          subtitle={`${(invoiceStats?.partial || 0) + (invoiceStats?.failed || 0)} flagged`}
          color={
            (summary?.invoice_mismatch_rate || 0) < 10
              ? 'green'
              : (summary?.invoice_mismatch_rate || 0) < 25
                ? 'amber'
                : 'red'
          }
        />
        <KPICard
          title="Early Payment Savings"
          value={summary ? formatINR(summary.total_early_discount_savings) : '₹0'}
          icon={PiggyBank}
          subtitle="Saved via early payments"
          color="green"
        />
        <KPICard
          title="Avg Completion Time"
          value={`${summary?.avg_completion_minutes.toFixed(0) || 0} mins`}
          icon={Clock}
          subtitle="Per procurement run"
          color="blue"
        />
        <KPICard
          title="Pending Reviews"
          value={summary?.pending_reviews || 0}
          icon={AlertCircle}
          subtitle="Awaiting human approval"
          color={summary?.pending_reviews > 0 ? 'amber' : 'green'}
        />
      </div>

      {/* Row 2: Spend Trend & Runs by Status */}
      <div className="grid grid-cols-3 gap-4">
        {/* Spend Trend - 60% width */}
        <Card className="col-span-2 border-slate-800 bg-slate-950">
          <CardHeader>
            <CardTitle>Spend Trend</CardTitle>
          </CardHeader>
          <CardContent>
            {spendTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={spendTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="date" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }}
                    formatter={(value) => [formatINR(Number(value)), 'Spend']}
                  />
                  <Line
                    type="monotone"
                    dataKey="spend"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={{ fill: '#3b82f6', r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-80 flex items-center justify-center text-slate-400">
                No spend data for this period
              </div>
            )}
          </CardContent>
        </Card>

        {/* Runs by Status - 40% width */}
        <Card className="border-slate-800 bg-slate-950">
          <CardHeader>
            <CardTitle>Runs by Status</CardTitle>
          </CardHeader>
          <CardContent className="flex justify-center">
            {byStatusData.some((d) => d.value > 0) ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={byStatusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {byStatusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => String(value)} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center text-slate-400">No pipeline runs yet</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Row 3: Budget Utilisation & Invoice Match Results */}
      <div className="grid grid-cols-2 gap-4">
        {/* Budget Utilisation */}
        <Card className="border-slate-800 bg-slate-950">
          <CardHeader>
            <CardTitle>Budget Utilisation by Department</CardTitle>
          </CardHeader>
          <CardContent>
            {budgetUtil?.departments?.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={budgetUtil.departments}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 150, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis type="number" stroke="#94a3b8" />
                  <YAxis dataKey="department" type="category" width={140} stroke="#94a3b8" />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }}
                    formatter={(value) => `${Number(value).toFixed(1)}%`}
                  />
                  <Bar
                    dataKey="utilisation_pct"
                    fill="#3b82f6"
                    radius={[0, 8, 8, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-80 flex items-center justify-center text-slate-400">
                No budget data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Invoice Match Results */}
        <Card className="border-slate-800 bg-slate-950">
          <CardHeader>
            <CardTitle>Invoice Match Results</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center">
            {invoiceChartData.some((d) => d.value > 0) ? (
              <>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={invoiceChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {invoiceChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="text-sm text-slate-400 mt-4">
                  Mismatch Rate: <span className="text-slate-100 font-bold">{invoiceStats?.mismatch_rate_pct}%</span>
                </div>
              </>
            ) : (
              <div className="h-80 flex items-center justify-center text-slate-400">
                No invoice data yet
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Row 4: AI Insight Panel */}
      {aiInsight && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Card className="border-purple-700/50 bg-purple-900/10">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-purple-400" />
                  <CardTitle>AI Executive Summary</CardTitle>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={fetchAIInsight}
                  disabled={loadingInsight}
                  className="text-purple-400 hover:text-purple-300"
                >
                  Regenerate
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-slate-100 leading-relaxed">{aiInsight.insight}</p>
              <p className="text-xs text-slate-500">
                Generated by Mistral 7B • {new Date(aiInsight.generated_at).toLocaleString()}
              </p>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {loadingInsight && !aiInsight && (
        <Card className="border-purple-700/50 bg-purple-900/10">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="animate-spin">
                <Sparkles className="w-5 h-5 text-purple-400" />
              </div>
              <p className="text-slate-300">Generating insight with Mistral 7B...</p>
            </div>
          </CardContent>
        </Card>
      )}
    </motion.div>
  );
}
