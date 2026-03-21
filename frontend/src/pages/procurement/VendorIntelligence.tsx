import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Plus, Edit, Trash2, Eye, BarChart3, Building2,
  X, Check, AlertCircle, TrendingUp, Shield, Package
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import * as procurementApi from '@/lib/procurementApi';

// Format currency
const formatINR = (value: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value);

// Gauge Component for performance metrics
function PerformanceGauge({
  label,
  value,
  maxValue = 100,
}: {
  label: string;
  value: number;
  maxValue?: number;
}) {
  const percentage = (value / maxValue) * 100;
  const color = percentage >= 85 ? '#10b981' : percentage >= 70 ? '#f59e0b' : '#ef4444';

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <span className="text-sm text-slate-400">{label}</span>
        <span className="text-sm font-bold text-slate-100">{value.toFixed(1)}%</span>
      </div>
      <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
        <div
          className="h-full transition-all"
          style={{ width: `${Math.min(percentage, 100)}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

// Risk Badge
function RiskBadge({ level }: { level: 'LOW' | 'MEDIUM' | 'HIGH' }) {
  const colors = {
    LOW: 'bg-green-900/30 text-green-300 border-green-700/50',
    MEDIUM: 'bg-amber-900/30 text-amber-300 border-amber-700/50',
    HIGH: 'bg-red-900/30 text-red-300 border-red-700/50',
  };

  return (
    <span className={`px-2 py-1 rounded text-xs font-semibold border ${colors[level]}`}>
      {level === 'LOW' ? '✓' : level === 'MEDIUM' ? '⚠' : '✗'} {level} RISK
    </span>
  );
}

// Vendor Card (Grid View)
function VendorCard({
  vendor,
  onView,
  onEdit,
  onDelete,
}: {
  vendor: any;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const riskLevel =
    vendor.performance?.risk_level ||
    (vendor.overall_score < 70 ? 'HIGH' : vendor.overall_score < 85 ? 'MEDIUM' : 'LOW');

  return (
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
      <Card
        className={`border-slate-800 bg-slate-950 cursor-pointer hover:border-slate-600 transition-colors ${
          riskLevel === 'HIGH' ? 'border-l-4 border-l-red-600' : ''
        }`}
      >
        <CardContent className="p-4 space-y-3">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-bold text-slate-100">{vendor.vendor_name}</h3>
              <span className="text-xs text-slate-500 font-mono">{vendor.vendor_id}</span>
            </div>
            <div className="flex items-center gap-1">
              {vendor.is_preferred && (
                <span className="px-2 py-0.5 rounded text-xs bg-yellow-900/30 text-yellow-300 border border-yellow-700/50">
                  Preferred
                </span>
              )}
              {!vendor.is_approved && (
                <span className="px-2 py-0.5 rounded text-xs bg-slate-700/30 text-slate-300">
                  Unapproved
                </span>
              )}
            </div>
          </div>

          {/* Categories */}
          <div className="flex flex-wrap gap-1">
            {vendor.category_codes?.slice(0, 3).map((cat: string) => (
              <span key={cat} className="text-xs px-2 py-0.5 bg-slate-800 text-slate-300 rounded">
                {cat}
              </span>
            ))}
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div>
              <span className="text-slate-400">Price:</span>
              <p className="font-semibold text-slate-100">{formatINR(vendor.unit_price)}</p>
            </div>
            <div>
              <span className="text-slate-400">Lead Time:</span>
              <p className="font-semibold text-slate-100">{vendor.lead_time_days} days</p>
            </div>
            <div>
              <span className="text-slate-400">Quality:</span>
              <p className="font-semibold text-slate-100">⭐ {vendor.quality_rating}/5</p>
            </div>
          </div>

          {/* Performance Bar */}
          {vendor.performance?.overall_score !== undefined && (
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-400">Overall Score</span>
                <span className="text-xs font-bold text-slate-100">{vendor.performance.overall_score}%</span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                <div
                  className="h-full"
                  style={{
                    width: `${vendor.performance.overall_score}%`,
                    backgroundColor:
                      vendor.performance.overall_score > 75
                        ? '#10b981'
                        : vendor.performance.overall_score > 50
                          ? '#f59e0b'
                          : '#ef4444',
                  }}
                />
              </div>
            </div>
          )}

          {/* Risk Badge */}
          {vendor.performance?.risk_level && <RiskBadge level={vendor.performance.risk_level} />}

          {/* Actions */}
          <div className="flex gap-2 pt-2 border-t border-slate-800">
            <Button
              size="sm"
              variant="ghost"
              className="flex-1 text-blue-400 hover:text-blue-300"
              onClick={onView}
            >
              <Eye className="w-4 h-4 mr-1" />
              Details
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-slate-400 hover:text-slate-300"
              onClick={onEdit}
            >
              <Edit className="w-4 h-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-red-400 hover:text-red-300"
              onClick={onDelete}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// Vendor Detail Drawer
function VendorDetailDrawer({
  vendor,
  onClose,
}: {
  vendor: any;
  onClose: () => void;
}) {
  const [activeTab, setActiveTab] = useState<'overview' | 'performance' | 'orders' | 'analysis'>(
    'overview'
  );
  const [performanceData, setPerformanceData] = useState<any>(null);
  const [aiInsight, setAiInsight] = useState<string>('');
  const [loading, setLoading] = useState(false);

  // Fetch performance history and AI insights when drawer opens
  useEffect(() => {
    if (vendor?.vendor_id) {
      fetchPerformanceData();
      fetchAiInsight();
    }
  }, [vendor?.vendor_id]);

  const fetchPerformanceData = async () => {
    try {
      const data = await procurementApi.vendorApi.getPerformance(vendor.vendor_id);
      console.log('📊 Performance data loaded:', data);
      setPerformanceData(data);
    } catch (error) {
      console.error('Failed to load performance data:', error);
    }
  };

  const fetchAiInsight = async () => {
    try {
      setLoading(true);
      // Generate vendor-specific insights based on performance data
      const perf = vendor.performance;
      const onTime = perf?.on_time_rate || 0;
      const qtyMatch = perf?.qty_match_rate || 0;
      const invClean = perf?.inv_clean_rate || 0;
      const riskLevel = perf?.risk_level || 'UNKNOWN';
      
      let insight = '';
      
      // Generate assessment based on vendor metrics
      if (riskLevel === 'LOW') {
        insight = `${vendor.vendor_name} demonstrates excellent vendor performance with a LOW RISK profile. Delivery reliability stands at ${onTime}% on-time rate, indicating consistent adherence to commitments. Quality consistency is strong with ${qtyMatch}% quantity match accuracy and ${invClean}% clean invoice submissions. With an overall score of ${(perf?.overall_score * 100).toFixed(0)}%, this vendor is a reliable partner for critical procurement operations. Recommendation: Maintain current relationship and consider increasing order volume or expanding category coverage. This vendor is suitable for high-priority items with strict SLAs.`;
      } else if (riskLevel === 'MEDIUM') {
        insight = `${vendor.vendor_name} shows MEDIUM RISK with mixed performance indicators. On-time delivery rate is ${onTime}%, suggesting occasional delays that may impact production schedules. Quantity matching at ${qtyMatch}% indicates some discrepancies in order fulfillment. Invoice cleanliness of ${invClean}% shows moderate quality in documentation. With an overall score of ${(perf?.overall_score * 100).toFixed(0)}%, this vendor requires performance monitoring and improvement initiatives. Recommendation: Implement quarterly performance reviews, establish clear SLAs, and consider implementing incentive structures for on-time delivery. Monitor closely for the next 3 cycles before increasing order volumes.`;
      } else {
        insight = `${vendor.vendor_name} presents HIGH RISK and requires immediate attention. Delivery performance is concerning at ${onTime}% on-time rate, affecting supply chain reliability. Quantity accuracy of ${qtyMatch}% suggests fulfillment inconsistencies. Invoice quality at ${invClean}% indicates documentation issues that may delay payment cycles. With an overall score of ${(perf?.overall_score * 100).toFixed(0)}%, this vendor needs a corrective action plan. Recommendation: Schedule urgent meeting to address performance gaps, set improvement targets, and consider alternative vendors. Place this vendor on probation status. Do not increase order volumes until performance improves to MEDIUM RISK level over 2+ consecutive cycles.`;
      }
      
      setAiInsight(insight);
    } catch (error) {
      console.error('Failed to generate vendor insights:', error);
      // Fallback insight
      setAiInsight(`${vendor.vendor_name} shows a ${vendor.performance?.risk_level || 'MEDIUM'} RISK level based on current performance metrics. Consider reviewing recent delivery performance and quality metrics to maintain optimal vendor relationships.`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {vendor && (
        <>
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 z-40"
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: 400, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 400, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed right-0 top-0 h-screen w-full max-w-2xl bg-slate-950 border-l border-slate-800 overflow-y-auto z-50"
          >
            {/* Header */}
            <div className="sticky top-0 border-b border-slate-800 bg-slate-950/95 backdrop-blur p-6 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-slate-100">{vendor.vendor_name}</h2>
              <Button variant="ghost" size="sm" onClick={onClose}>
                <X className="w-5 h-5" />
              </Button>
            </div>

            {/* Tabs */}
            <div className="border-b border-slate-800 px-6 sticky top-16 bg-slate-950/95">
              <div className="flex gap-8">
                {(['overview', 'performance', 'orders', 'analysis'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`py-3 px-4 text-sm font-medium capitalize border-b-2 transition-colors ${
                      activeTab === tab
                        ? 'border-blue-500 text-blue-400'
                        : 'border-transparent text-slate-400 hover:text-slate-300'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {activeTab === 'overview' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-slate-400">Vendor ID</Label>
                      <p className="text-slate-100 font-mono">{vendor.vendor_id}</p>
                    </div>
                    <div>
                      <Label className="text-slate-400">Unit Price</Label>
                      <p className="text-slate-100">{formatINR(vendor.unit_price)}</p>
                    </div>
                    <div>
                      <Label className="text-slate-400">Lead Time</Label>
                      <p className="text-slate-100">{vendor.lead_time_days} days</p>
                    </div>
                    <div>
                      <Label className="text-slate-400">Quality Rating</Label>
                      <p className="text-slate-100">⭐ {vendor.quality_rating}/5</p>
                    </div>
                    <div>
                      <Label className="text-slate-400">Contact Email</Label>
                      <p className="text-slate-100 break-all">{vendor.contact_email || 'N/A'}</p>
                    </div>
                    <div>
                      <Label className="text-slate-400">Contact Phone</Label>
                      <p className="text-slate-100">{vendor.contact_phone || 'N/A'}</p>
                    </div>
                    <div>
                      <Label className="text-slate-400">GST ID</Label>
                      <p className="text-slate-100 font-mono">{vendor.gstin || 'N/A'}</p>
                    </div>
                    <div>
                      <Label className="text-slate-400">Payment Terms</Label>
                      <p className="text-slate-100">{vendor.payment_terms}</p>
                    </div>
                  </div>

                  <div className="space-y-2 pt-4 border-t border-slate-800">
                    <div className="flex items-center justify-between">
                      <Label>Approved</Label>
                      <span className={`text-sm font-semibold ${vendor.is_approved ? 'text-green-400' : 'text-red-400'}`}>
                        {vendor.is_approved ? '✓ Yes' : '✗ No'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <Label>Preferred Vendor</Label>
                      <span className={`text-sm font-semibold ${vendor.is_preferred ? 'text-yellow-400' : 'text-slate-400'}`}>
                        {vendor.is_preferred ? '★ Preferred' : '○ Standard'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'performance' && vendor.performance && (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-900/50 rounded p-4 border border-slate-800">
                      <p className="text-slate-400 text-sm">Total Orders</p>
                      <p className="text-2xl font-bold text-slate-100">
                        {vendor.performance.total_orders || 0}
                      </p>
                    </div>
                    <div className="bg-slate-900/50 rounded p-4 border border-slate-800">
                      <p className="text-slate-400 text-sm">Total Value</p>
                      <p className="text-2xl font-bold text-slate-100">
                        {formatINR(vendor.performance.total_value || 0)}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <PerformanceGauge
                      label="On-Time Delivery Rate"
                      value={vendor.performance.on_time_rate || 0}
                    />
                    <PerformanceGauge
                      label="Quantity Match Rate"
                      value={vendor.performance.quantity_match_rate || 0}
                    />
                    <PerformanceGauge
                      label="Invoice Clean Rate"
                      value={vendor.performance.invoice_clean_rate || 0}
                    />
                    <PerformanceGauge
                      label="Overall Score"
                      value={vendor.performance.overall_score || 0}
                    />
                  </div>

                  <div className="bg-slate-900/30 rounded p-4 border border-slate-800">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-300">Risk Level</span>
                      <RiskBadge level={vendor.performance.risk_level || 'LOW'} />
                    </div>
                    <p className="text-sm text-slate-400 mt-2">
                      {vendor.performance.risk_level === 'LOW'
                        ? 'All metrics above 85% — excellent reliability'
                        : vendor.performance.risk_level === 'MEDIUM'
                          ? 'Some metrics between 70-85% — monitor performance'
                          : 'Some metrics below 70% — consider alternatives'}
                    </p>
                  </div>
                </div>
              )}

              {activeTab === 'orders' && (
                <div className="space-y-4">
                  {performanceData?.history && performanceData.history.length > 0 ? (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-slate-900/50 rounded p-4 border border-slate-800">
                          <p className="text-slate-400 text-sm">Total Orders</p>
                          <p className="text-2xl font-bold text-slate-100">
                            {performanceData.summary.total_orders}
                          </p>
                        </div>
                        <div className="bg-slate-900/50 rounded p-4 border border-slate-800">
                          <p className="text-slate-400 text-sm">Total Value</p>
                          <p className="text-2xl font-bold text-slate-100">
                            {formatINR(performanceData.summary.total_value)}
                          </p>
                        </div>
                      </div>

                      <div>
                        <Label className="text-slate-400 mb-4 block text-sm font-semibold">Recent Orders</Label>
                        <div className="space-y-2 max-h-96 overflow-y-auto">
                          {performanceData.history.slice(0, 10).map((order: any, idx: number) => (
                            <div key={idx} className="bg-slate-900/30 rounded p-3 border border-slate-800/50 text-sm">
                              <div className="flex justify-between items-start">
                                <div>
                                  <p className="text-slate-100 font-medium">Order #{idx + 1}</p>
                                  <p className="text-slate-400 text-xs mt-1">
                                    Value: {formatINR(order.order_value || 0)} • {order.recorded_at}
                                  </p>
                                </div>
                                <div className="flex gap-2">
                                  {order.delivered_on_time ? (
                                    <span className="px-2 py-1 bg-green-900/30 text-green-300 rounded text-xs">✓ On Time</span>
                                  ) : (
                                    <span className="px-2 py-1 bg-red-900/30 text-red-300 rounded text-xs">✗ Late</span>
                                  )}
                                  {order.quantity_match ? (
                                    <span className="px-2 py-1 bg-green-900/30 text-green-300 rounded text-xs">✓ Qty OK</span>
                                  ) : (
                                    <span className="px-2 py-1 bg-red-900/30 text-red-300 rounded text-xs">✗ Qty Mismatch</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-8 text-slate-400">
                      <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p>No purchase orders yet</p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'analysis' && (
                <div className="space-y-4">
                  {loading ? (
                    <div className="text-center py-8">
                      <div className="inline-block animate-spin">
                        <Shield className="w-8 h-8 text-blue-500" />
                      </div>
                      <p className="text-slate-400 mt-2">Generating insights...</p>
                    </div>
                  ) : (
                    <div className="bg-gradient-to-br from-slate-900/50 to-slate-900/20 rounded-lg p-6 border border-slate-800/50 space-y-4">
                      <div className="flex items-start gap-3">
                        <Shield className="w-5 h-5 text-blue-400 mt-1 flex-shrink-0" />
                        <div>
                          <h3 className="text-slate-100 font-semibold mb-2">AI Vendor Assessment</h3>
                          <p className="text-slate-300 leading-relaxed whitespace-pre-wrap">{aiInsight}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-3 pt-4 border-t border-slate-800">
                        <div className="text-center">
                          <p className="text-slate-400 text-xs mb-1">Risk Level</p>
                          <RiskBadge level={vendor.performance?.risk_level || 'LOW'} />
                        </div>
                        <div className="text-center">
                          <p className="text-slate-400 text-xs mb-1">Overall Score</p>
                          <p className="text-lg font-bold text-slate-100">
                            {((vendor.performance?.overall_score || 0) * 100).toFixed(0)}%
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="text-slate-400 text-xs mb-1">Status</p>
                          <span className="px-2 py-1 bg-green-900/30 text-green-300 rounded text-xs font-semibold">
                            {vendor.is_approved ? 'Approved' : 'Pending'}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// Add/Edit Vendor Modal
function VendorFormModal({
  isOpen,
  vendor,
  onClose,
  onSubmit,
}: {
  isOpen: boolean;
  vendor?: any;
  onClose: () => void;
  onSubmit: (data: any) => void;
}) {
  const [formData, setFormData] = useState({
    vendor_name: vendor?.vendor_name || '',
    category_codes: vendor?.category_codes || [],
    unit_price: vendor?.unit_price || '',
    lead_time_days: vendor?.lead_time_days || '',
    quality_rating: vendor?.quality_rating || '',
    is_preferred: vendor?.is_preferred || false,
    contact_email: vendor?.contact_email || '',
    contact_phone: vendor?.contact_phone || '',
    gstin: vendor?.gstin || '',
    payment_terms: vendor?.payment_terms || 'Net-30',
  });

  const categories = [
    'IT_HW',
    'IT_SW',
    'OFFICE',
    'FACILITIES',
    'RAW_MAT',
    'SERVICES',
    'PARTS',
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/50 z-40 flex items-center justify-center"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-slate-950 border border-slate-800 rounded-lg max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto z-50"
        >
          {/* Header */}
          <div className="sticky top-0 border-b border-slate-800 bg-slate-950/95 backdrop-blur p-6 flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-100">
              {vendor ? 'Edit Vendor' : 'Add New Vendor'}
            </h2>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-slate-300">
                  Vendor Name <span className="text-red-400">*</span>
                </Label>
                <Input
                  type="text"
                  required
                  value={formData.vendor_name}
                  onChange={(e) => setFormData({ ...formData, vendor_name: e.target.value })}
                  className="bg-slate-900 border-slate-700 text-slate-100 mt-1"
                  placeholder="Enter vendor name"
                />
              </div>

              <div>
                <Label className="text-slate-300">
                  Unit Price (₹) <span className="text-red-400">*</span>
                </Label>
                <Input
                  type="number"
                  required
                  step="0.01"
                  value={formData.unit_price}
                  onChange={(e) => setFormData({ ...formData, unit_price: parseFloat(e.target.value) })}
                  className="bg-slate-900 border-slate-700 text-slate-100 mt-1"
                  placeholder="0.00"
                />
              </div>

              <div>
                <Label className="text-slate-300">
                  Lead Time (days) <span className="text-red-400">*</span>
                </Label>
                <Input
                  type="number"
                  required
                  value={formData.lead_time_days}
                  onChange={(e) => setFormData({ ...formData, lead_time_days: parseInt(e.target.value) })}
                  className="bg-slate-900 border-slate-700 text-slate-100 mt-1"
                  placeholder="0"
                />
              </div>

              <div>
                <Label className="text-slate-300">
                  Quality Rating (0-5) <span className="text-red-400">*</span>
                </Label>
                <Input
                  type="number"
                  required
                  min="0"
                  max="5"
                  step="0.1"
                  value={formData.quality_rating}
                  onChange={(e) => setFormData({ ...formData, quality_rating: parseFloat(e.target.value) })}
                  className="bg-slate-900 border-slate-700 text-slate-100 mt-1"
                  placeholder="0.0"
                />
              </div>
            </div>

            <div>
              <Label className="text-slate-300">
                Categories <span className="text-red-400">*</span>
              </Label>
              <div className="grid grid-cols-3 gap-3 mt-2">
                {categories.map((cat) => (
                  <label key={cat} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.category_codes.includes(cat)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFormData({
                            ...formData,
                            category_codes: [...formData.category_codes, cat],
                          });
                        } else {
                          setFormData({
                            ...formData,
                            category_codes: formData.category_codes.filter((c) => c !== cat),
                          });
                        }
                      }}
                      className="w-4 h-4 rounded border-slate-600 text-blue-600"
                    />
                    <span className="text-sm text-slate-300">{cat}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-slate-300">Contact Email</Label>
                <Input
                  type="email"
                  value={formData.contact_email}
                  onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                  className="bg-slate-900 border-slate-700 text-slate-100 mt-1"
                  placeholder="vendor@example.com"
                />
              </div>

              <div>
                <Label className="text-slate-300">Contact Phone</Label>
                <Input
                  type="tel"
                  value={formData.contact_phone}
                  onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                  className="bg-slate-900 border-slate-700 text-slate-100 mt-1"
                  placeholder="+91-..."
                />
              </div>

              <div>
                <Label className="text-slate-300">GSTIN</Label>
                <Input
                  type="text"
                  value={formData.gstin}
                  onChange={(e) => setFormData({ ...formData, gstin: e.target.value })}
                  className="bg-slate-900 border-slate-700 text-slate-100 mt-1"
                  placeholder="15-digit GST ID"
                  maxLength={15}
                />
              </div>

              <div>
                <Label className="text-slate-300">Payment Terms</Label>
                <select
                  value={formData.payment_terms}
                  onChange={(e) => setFormData({ ...formData, payment_terms: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 text-slate-100 rounded px-3 py-2 mt-1"
                >
                  <option>Net-7</option>
                  <option>Net-14</option>
                  <option>Net-30</option>
                  <option>Net-45</option>
                  <option>Net-60</option>
                </select>
              </div>
            </div>

            <div className="border-t border-slate-800 pt-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.is_preferred}
                  onChange={(e) => setFormData({ ...formData, is_preferred: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-600 text-yellow-500"
                />
                <span className="text-sm text-slate-300">Mark as Preferred Vendor</span>
              </label>
            </div>

            <div className="flex gap-2 pt-4 border-t border-slate-800">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="border-slate-700 text-slate-300 hover:text-slate-100"
              >
                Cancel
              </Button>
              <Button type="submit" className="flex-1 bg-blue-700 hover:bg-blue-600">
                {vendor ? 'Update Vendor' : 'Add Vendor'}
              </Button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// Main Component
export default function VendorIntelligence() {
  const [vendors, setVendors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [showApprovedOnly, setShowApprovedOnly] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  const [selectedVendor, setSelectedVendor] = useState<any>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<any>(null);

  const fetchVendors = async () => {
    try {
      setLoading(true);
      console.log('🔄 fetchVendors called');
      
      const data = await procurementApi.vendorApi.getAll({
        approved_only: showApprovedOnly,
        search: search || undefined,
        category: categoryFilter || undefined,
      });
      console.log('📥 API response:', data);
      
      // Handle both array and object responses
      let vendorsList: any[] = [];
      const anyData = data as any;
      
      if (Array.isArray(anyData)) {
        console.log('✅ Response is array, length:', anyData.length);
        vendorsList = anyData;
      } else if (anyData && typeof anyData === 'object') {
        console.log('✅ Response is object, vendors count:', anyData.vendors?.length);
        vendorsList = anyData.vendors || [];
      } else {
        console.warn('⚠️  Unexpected response type:', typeof anyData);
      }
      
      console.log('✅ Final vendorsList:', vendorsList.length, 'vendors');
      setVendors(vendorsList);
    } catch (error) {
      console.error('❌ Vendor fetch error:', error);
      toast.error('Failed to load vendors: ' + String(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVendors();
  }, [showApprovedOnly, search, categoryFilter]);

  const handleAddVendor = async (formData: any) => {
    try {
      await procurementApi.vendorApi.create(formData);
      toast.success('Vendor added successfully');
      setIsFormOpen(false);
      fetchVendors();
    } catch (error) {
      toast.error(String(error));
    }
  };

  const handleUpdateVendor = async (formData: any) => {
    try {
      await procurementApi.vendorApi.update(editingVendor.vendor_id, formData);
      toast.success('Vendor updated successfully');
      setIsFormOpen(false);
      setEditingVendor(null);
      fetchVendors();
    } catch (error) {
      toast.error(String(error));
    }
  };

  const handleDeleteVendor = async (vendorId: string) => {
    if (!confirm('Are you sure you want to delete this vendor?')) return;
    try {
      await procurementApi.vendorApi.delete(vendorId);
      toast.success('Vendor deleted successfully');
      fetchVendors();
    } catch (error) {
      toast.error(String(error));
    }
  };

  // Summary cards
  const totalVendors = vendors.length;
  const approvedVendors = vendors.filter((v) => v.is_approved).length;
  const highRiskVendors = vendors.filter(
    (v) => v.performance?.risk_level === 'HIGH'
  ).length;
  const avgQuality = (
    vendors.reduce((sum, v) => sum + v.quality_rating, 0) / Math.max(vendors.length, 1)
  ).toFixed(2);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-1/3 bg-slate-900/40" />
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24 bg-slate-900/40" />
          ))}
        </div>
        <Skeleton className="h-96 bg-slate-900/40" />
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-slate-100">Vendor Intelligence</h1>
          <p className="text-slate-400 mt-1">Manage vendors and track performance</p>
        </div>
        <Button
          onClick={() => {
            setEditingVendor(null);
            setIsFormOpen(true);
          }}
          className="bg-blue-700 hover:bg-blue-600"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Vendor
        </Button>
      </div>

      {/* Filters */}
      <Card className="border-slate-800 bg-slate-950">
        <CardContent className="p-4 flex items-end gap-4">
          <div className="flex-1">
            <Label className="text-slate-300">Search</Label>
            <div className="relative mt-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <Input
                placeholder="Search vendors..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyUp={(e) => {
                  if (e.key === 'Enter') fetchVendors();
                }}
                className="bg-slate-900 border-slate-700 text-slate-100 pl-10"
              />
            </div>
          </div>

          <div className="w-48">
            <Label className="text-slate-300">Category</Label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 text-slate-100 rounded px-3 py-2 mt-2"
            >
              <option value="">All Categories</option>
              {['IT_HW', 'IT_SW', 'OFFICE', 'FACILITIES', 'RAW_MAT', 'SERVICES', 'PARTS'].map(
                (cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                )
              )}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showApprovedOnly}
                onChange={(e) => setShowApprovedOnly(e.target.checked)}
                className="w-4 h-4 rounded border-slate-600"
              />
              <span className="text-sm text-slate-300">Approved Only</span>
            </label>
          </div>

          <div className="flex gap-2">
            <Button
              size="sm"
              variant={viewMode === 'grid' ? 'default' : 'outline'}
              onClick={() => setViewMode('grid')}
              className={viewMode === 'grid' ? 'bg-blue-700' : 'border-slate-700'}
            >
              Grid
            </Button>
            <Button
              size="sm"
              variant={viewMode === 'table' ? 'default' : 'outline'}
              onClick={() => setViewMode('table')}
              className={viewMode === 'table' ? 'bg-blue-700' : 'border-slate-700'}
            >
              Table
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="border-slate-800 bg-slate-950">
            <CardContent className="p-4">
              <p className="text-sm text-slate-400">Total Vendors</p>
              <p className="text-2xl font-bold text-slate-100">{totalVendors}</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="border-slate-800 bg-slate-950">
            <CardContent className="p-4">
              <p className="text-sm text-slate-400">Approved</p>
              <p className="text-2xl font-bold text-green-400">{approvedVendors}</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="border-slate-800 bg-slate-950">
            <CardContent className="p-4">
              <p className="text-sm text-slate-400">High Risk</p>
              <p className="text-2xl font-bold text-red-400">{highRiskVendors}</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card className="border-slate-800 bg-slate-950">
            <CardContent className="p-4">
              <p className="text-sm text-slate-400">Avg Quality Rating</p>
              <p className="text-2xl font-bold text-slate-100">⭐ {avgQuality}/5</p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Vendors Grid/Table */}
      {vendors.length === 0 ? (
        <Alert className="border-slate-700 bg-slate-900/50">
          <AlertCircle className="w-4 h-4" />
          <AlertDescription className="text-slate-300 ml-2">
            No vendors found. Create one to get started.
          </AlertDescription>
        </Alert>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-3 gap-4">
          {vendors.map((vendor) => (
            <VendorCard
              key={vendor.vendor_id}
              vendor={vendor}
              onView={() => setSelectedVendor(vendor)}
              onEdit={() => {
                setEditingVendor(vendor);
                setIsFormOpen(true);
              }}
              onDelete={() => handleDeleteVendor(vendor.vendor_id)}
            />
          ))}
        </div>
      ) : (
        <Card className="border-slate-800 bg-slate-950 overflow-x-auto">
          <div className="w-full overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="px-4 py-3 text-left text-slate-400 font-semibold">Vendor ID</th>
                  <th className="px-4 py-3 text-left text-slate-400 font-semibold">Name</th>
                  <th className="px-4 py-3 text-right text-slate-400 font-semibold">Unit Price</th>
                  <th className="px-4 py-3 text-right text-slate-400 font-semibold">Lead Time</th>
                  <th className="px-4 py-3 text-right text-slate-400 font-semibold">Quality</th>
                  <th className="px-4 py-3 text-center text-slate-400 font-semibold">Score</th>
                  <th className="px-4 py-3 text-center text-slate-400 font-semibold">Risk</th>
                  <th className="px-4 py-3 text-center text-slate-400 font-semibold">Approved</th>
                  <th className="px-4 py-3 text-center text-slate-400 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {vendors.map((vendor) => (
                  <tr key={vendor.vendor_id} className="border-b border-slate-800 hover:bg-slate-900/50">
                    <td className="px-4 py-3 font-mono text-slate-100">{vendor.vendor_id}</td>
                    <td className="px-4 py-3 text-slate-100">{vendor.vendor_name}</td>
                    <td className="px-4 py-3 text-right text-slate-100">{formatINR(vendor.unit_price)}</td>
                    <td className="px-4 py-3 text-right text-slate-100">{vendor.lead_time_days}d</td>
                    <td className="px-4 py-3 text-right text-slate-100">⭐ {vendor.quality_rating}</td>
                    <td className="px-4 py-3 text-center">
                      {vendor.performance?.overall_score ? (
                        <span className="text-slate-100 font-semibold">
                          {vendor.performance.overall_score}%
                        </span>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {vendor.performance?.risk_level && (
                        <RiskBadge level={vendor.performance.risk_level} />
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {vendor.is_approved ? (
                        <Check className="w-4 h-4 text-green-400 mx-auto" />
                      ) : (
                        <X className="w-4 h-4 text-red-400 mx-auto" />
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex gap-2 justify-center">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setSelectedVendor(vendor)}
                          className="text-blue-400 hover:text-blue-300"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setEditingVendor(vendor);
                            setIsFormOpen(true);
                          }}
                          className="text-slate-400 hover:text-slate-300"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteVendor(vendor.vendor_id)}
                          className="text-red-400 hover:text-red-300"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Detail Drawer */}
      <VendorDetailDrawer vendor={selectedVendor} onClose={() => setSelectedVendor(null)} />

      {/* Form Modal */}
      <VendorFormModal
        isOpen={isFormOpen}
        vendor={editingVendor}
        onClose={() => {
          setIsFormOpen(false);
          setEditingVendor(null);
        }}
        onSubmit={editingVendor ? handleUpdateVendor : handleAddVendor}
      />
    </motion.div>
  );
}
