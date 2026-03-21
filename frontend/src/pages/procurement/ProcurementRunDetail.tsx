import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Download,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Clipboard,
  PiggyBank,
  Building2,
  FileText,
  Package,
  Search,
  CreditCard,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { StatusBadge } from '@/components/procurement/StatusBadge';
import { PipelineStepper } from '@/components/procurement/PipelineStepper';
import { AuditTable } from '@/components/procurement/AuditTable';
import { StageCard, StageDetailRow } from '@/components/procurement/StageCard';
import PaymentGatewayModal from '@/components/procurement/PaymentGatewayModal';
import * as procurementApi from '@/lib/procurementApi';

function formatCurrency(value: number): string {
  return value.toLocaleString('en-IN', { style: 'currency', currency: 'INR' });
}

function formatTimestamp(isoString: string): string {
  try {
    const date = new Date(isoString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = date.toLocaleString('en-US', { month: 'short' });
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${day} ${month} ${year}, ${hours}:${minutes}`;
  } catch {
    return isoString;
  }
}

interface DeliveryFormData {
  delivered_items: string[];
  delivered_quantities: string[];
  delivery_date: string;
  delivery_note_ref: string;
}

interface InvoiceFormData {
  invoice_id: string;
  invoice_amount: string;
  invoice_items: Array<{ item_name: string; quantity: string; unit_price: string }>;
  invoice_date: string;
  vendor_bank_ref: string;
}

export default function ProcurementRunDetail() {
  const { runId } = useParams<{ runId: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [run, setRun] = useState<procurementApi.RunResponse | null>(null);
  const [auditEvents, setAuditEvents] = useState<procurementApi.AuditEvent[]>([]);
  const [submittingDelivery, setSubmittingDelivery] = useState(false);
  const [submittingInvoice, setSubmittingInvoice] = useState(false);

  const [deliveryForm, setDeliveryForm] = useState<DeliveryFormData>({
    delivered_items: [],
    delivered_quantities: [],
    delivery_date: new Date().toISOString().split('T')[0],
    delivery_note_ref: '',
  });

  const [invoiceForm, setInvoiceForm] = useState<InvoiceFormData>({
    invoice_id: '',
    invoice_amount: '',
    invoice_items: [],
    invoice_date: new Date().toISOString().split('T')[0],
    vendor_bank_ref: '',
  });

  const [formInitialized, setFormInitialized] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState<{
    transactionRef: string;
    method: string;
    paidAt: string;
  } | null>(null);

  useEffect(() => {
    if (!runId) return;

    const fetchData = async () => {
      try {
        const [runData, auditData] = await Promise.all([
          procurementApi.getRun(runId),
          procurementApi.getAuditLog(runId),
        ]);

        setRun(runData);
        setAuditEvents(auditData.events);

        // Initialize forms only once per run
        if (!formInitialized) {
          const poLineItems = ((runData.state as any)?.po?.po_document?.line_items || []) as Array<{ item_name: string; quantity: number; unit_price: number }>;
          if (poLineItems.length > 0) {
            const items = poLineItems.map(item => item.item_name);
            setDeliveryForm((prev) => ({
              ...prev,
              delivered_items: items,
              delivered_quantities: items.map(() => ''),
            }));

            setInvoiceForm((prev) => ({
              ...prev,
              invoice_items: poLineItems.map((item) => ({
                item_name: item.item_name,
                quantity: '',
                unit_price: item.unit_price.toString(),
              })),
            }));

            setFormInitialized(true);
          }
        }

        setLoading(false);
      } catch (error) {
        toast.error('Failed to load run details');
        console.error(error);
        setLoading(false);
      }
    };

    fetchData();

    const interval = setInterval(() => {
      // IMPORTANT: Don't refresh when user is filling out forms to prevent data loss
      const userFillingForms = run?.current_step === 'awaiting_delivery' || run?.current_step === 'awaiting_invoice';
      
      if (autoRefresh && !userFillingForms && run?.status !== 'COMPLETED' && run?.status !== 'FAILED') {
        fetchData();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [runId, autoRefresh, run?.status, run?.current_step]);

  const handleDeliverySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!runId) return;

    // Validate all quantities are filled in
    if (deliveryForm.delivered_quantities.some(q => !q || parseInt(q) === 0)) {
      toast.error('Please enter quantities for all items (must be greater than 0)');
      return;
    }

    setSubmittingDelivery(true);
    try {
      const po_id = ((run?.state as any)?.po?.po_id as string) || '';
      const response = await procurementApi.triggerDelivery(runId, {
        po_id,
        delivered_items: deliveryForm.delivered_items,
        delivered_quantities: deliveryForm.delivered_quantities.map((q) => parseInt(q) || 0),
        delivery_date: deliveryForm.delivery_date,
        delivery_note_ref: deliveryForm.delivery_note_ref,
      });

      toast.success('Goods receipt recorded');
      setRun(response);
      navigate('/procurement');
    } catch (error) {
      toast.error(String(error));
    } finally {
      setSubmittingDelivery(false);
    }
  };

  const handleInvoiceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!runId) return;

    setSubmittingInvoice(true);
    try {
      const po_id = ((run?.state as any)?.po?.po_id as string) || '';
      const gr_id = ((run?.state as any)?.gr?.gr_id as string) || '';
      const response = await procurementApi.triggerInvoice(runId, {
        po_id,
        gr_id,
        invoice_id: invoiceForm.invoice_id,
        invoice_amount: parseFloat(invoiceForm.invoice_amount),
        invoice_items: invoiceForm.invoice_items.map((item) => ({
          item_name: item.item_name,
          quantity: parseInt(item.quantity) || 0,
          unit_price: parseFloat(item.unit_price) || 0,
        })),
        invoice_date: invoiceForm.invoice_date,
        vendor_bank_ref: invoiceForm.vendor_bank_ref,
      });

      toast.success('Invoice submitted');
      setRun(response);
      navigate('/procurement');
    } catch (error) {
      toast.error(String(error));
    } finally {
      setSubmittingInvoice(false);
    }
  };

  const handleExportAudit = () => {
    const dataStr = JSON.stringify(auditEvents, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `audit-${runId}-${Date.now()}.json`;
    link.click();
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-1/3 bg-slate-900/40" />
        <Skeleton className="h-80 w-full bg-slate-900/40" />
      </div>
    );
  }

  if (!run) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <p className="text-slate-100 font-medium mb-4">Run not found</p>
        <Button onClick={() => navigate('/procurement')} className="bg-blue-700 hover:bg-blue-600">
          Back to Dashboard
        </Button>
      </div>
    );
  }

  const purchaseRequest = (run.state?.pr || {}) as Record<string, any>;
  const budgetData = (run.state?.budget || {}) as Record<string, any>;
  const vendorData = (run.state?.vendor || {}) as Record<string, any>;
  const poData = (run.state?.po || {}) as Record<string, any>;
  const grData = (run.state?.gr || {}) as Record<string, any>;
  const invoiceData = (run.state?.invoice_match || {}) as Record<string, any>;
  const paymentData = (run.state?.payment || {}) as Record<string, any>;

  const showDeliveryForm = run.current_step === 'awaiting_delivery';
  const showInvoiceForm = run.current_step === 'awaiting_invoice';
  const showReviewWarning = run.current_step.startsWith('pending_');

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/procurement')}
            className="text-slate-400 hover:text-slate-100"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-slate-100">
              Run {runId?.substring(0, 12)}
            </h1>
            <p className="text-slate-400 mt-1">{run.message}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`border-slate-700 ${
              autoRefresh
                ? 'bg-blue-900/30 text-blue-300'
                : 'text-slate-300 hover:text-slate-100'
            }`}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${autoRefresh ? 'animate-spin' : ''}`} />
            {autoRefresh ? 'Auto-refreshing' : 'Paused'}
          </Button>
          <StatusBadge status={run.status} />
        </div>
      </div>

      {/* Success/Failure Banners */}
      <AnimatePresence>
        {run.status === 'COMPLETED' && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <Alert className="border-green-700 bg-green-900/20">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              <AlertDescription className="text-green-300 ml-2">
                Pipeline completed successfully! All stages finished without errors.
              </AlertDescription>
            </Alert>
          </motion.div>
        )}

        {run.status === 'FAILED' && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <Alert className="border-red-700 bg-red-900/20">
              <AlertCircle className="w-4 h-4 text-red-500" />
              <AlertDescription className="text-red-300 ml-2">
                Pipeline failed. Check the audit log below for error details.
              </AlertDescription>
            </Alert>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Review Warning */}
      {showReviewWarning && (
        <Alert className="border-amber-700 bg-amber-900/20">
          <AlertCircle className="w-4 h-4 text-amber-500" />
          <AlertDescription className="text-amber-300 ml-2">
            This run is paused — awaiting human review.{' '}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/procurement/reviews')}
              className="text-amber-300 hover:text-amber-200 underline p-0 h-auto"
            >
              Go to Review Queue
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Pipeline Stepper */}
      <Card className="border-slate-800 bg-slate-950">
        <CardHeader>
          <CardTitle>Pipeline Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <PipelineStepper currentStep={run.current_step} />
        </CardContent>
      </Card>

      {/* Stage Data Cards */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-slate-100">Stage Details</h2>

        {/* Purchase Request */}
        {Object.keys(purchaseRequest).length > 0 && (
          <StageCard title="Purchase Request" icon={<Clipboard className="w-5 h-5 text-blue-400" />} color="blue">
            <StageDetailRow
              label="Item Name"
              value={purchaseRequest.item_name}
            />
            <StageDetailRow
              label="Quantity"
              value={purchaseRequest.quantity}
            />
            <StageDetailRow
              label="Unit Price"
              value={formatCurrency(purchaseRequest.unit_price)}
            />
            <StageDetailRow
              label="Total Amount"
              value={formatCurrency(
                purchaseRequest.quantity * purchaseRequest.unit_price
              )}
            />
            <StageDetailRow
              label="Department"
              value={purchaseRequest.department}
            />
            <StageDetailRow
              label="Category"
              value={purchaseRequest.category}
            />
          </StageCard>
        )}

        {/* Budget */}
        {Object.keys(budgetData).length > 0 && (
          <StageCard title="Budget Check" icon={<PiggyBank className="w-5 h-5 text-amber-400" />} color="amber">
            <StageDetailRow
              label="Status"
              value={<StatusBadge status={budgetData.budget_status} />}
            />
            <StageDetailRow
              label="Allocated Budget"
              value={formatCurrency(budgetData.allocated_budget)}
            />
            <StageDetailRow
              label="Spent So Far"
              value={formatCurrency(budgetData.spent_so_far)}
            />
            <StageDetailRow
              label="Remaining After"
              value={formatCurrency(budgetData.remaining_after)}
            />
            {budgetData.reason && (
              <StageDetailRow label="Reason" value={budgetData.reason} />
            )}
          </StageCard>
        )}

        {/* Vendor */}
        {Object.keys(vendorData).length > 0 && (
          <StageCard title="Vendor Selection" icon={<Building2 className="w-5 h-5 text-purple-400" />} color="purple">
            <StageDetailRow label="Vendor Name" value={vendorData.vendor_name} />
            <StageDetailRow label="Vendor ID" value={vendorData.vendor_id} />
            <StageDetailRow label="Score" value={`${vendorData.score}/100`} />
            <StageDetailRow
              label="Quoted Price"
              value={formatCurrency(vendorData.quoted_price_per_unit)}
            />
            <StageDetailRow label="Lead Time" value={`${vendorData.lead_time_days} days`} />
            <StageDetailRow label="Quality Rating" value={`${vendorData.quality_rating}/5`} />
            {vendorData.selection_reason && (
              <StageDetailRow
                label="Reason"
                value={<span className="italic text-slate-400">{vendorData.selection_reason}</span>}
              />
            )}
          </StageCard>
        )}

        {/* PO */}
        {Object.keys(poData).length > 0 && (
          <StageCard title="Purchase Order" icon={<FileText className="w-5 h-5 text-cyan-400" />} color="cyan">
            <StageDetailRow label="PO ID" value={poData.po_id} />
            <StageDetailRow
              label="Status"
              value={<StatusBadge status={poData.dispatch_status} />}
            />
            <StageDetailRow
              label="Dispatched At"
              value={formatTimestamp(poData.dispatched_at)}
            />
            <StageDetailRow label="Delivery Date" value={(poData.po_document as any)?.delivery_date || 'N/A'} />
            <StageDetailRow label="Payment Terms" value={(poData.po_document as any)?.payment_terms || 'N/A'} />
            <StageDetailRow
              label="Total Amount"
              value={formatCurrency((poData.po_document as any)?.total_amount || 0)}
            />
            {poData.retry_count > 0 && (
              <StageDetailRow label="Retry Count" value={poData.retry_count} />
            )}
          </StageCard>
        )}

        {/* Goods Receipt */}
        {Object.keys(grData).length > 0 && (
          <StageCard title="Goods Receipt" icon={<Package className="w-5 h-5 text-rose-400" />} color="rose">
            <StageDetailRow label="GR ID" value={grData.gr_id} />
            <StageDetailRow
              label="Match Status"
              value={<StatusBadge status={grData.match_status} />}
            />
            {grData.discrepancy_details && (
              <StageDetailRow
                label="Discrepancies"
                value={<span className="text-red-400">{grData.discrepancy_details}</span>}
              />
            )}
          </StageCard>
        )}

        {/* Invoice */}
        {Object.keys(invoiceData).length > 0 && (
          <StageCard title="Invoice Matching" icon={<Search className="w-5 h-5 text-indigo-400" />} color="indigo">
            <StageDetailRow
              label="Match Result"
              value={<StatusBadge status={invoiceData.match_result} />}
            />
            <StageDetailRow
              label="Quantity Match"
              value={(invoiceData.checks as any)?.quantity_match ? '✓' : '✗'}
            />
            <StageDetailRow label="Price Match" value={(invoiceData.checks as any)?.price_match ? '✓' : '✗'} />
            <StageDetailRow label="Total Match" value={(invoiceData.checks as any)?.total_match ? '✓' : '✗'} />
            {invoiceData.variance_amount > 0 && (
              <StageDetailRow
                label="Variance Amount"
                value={
                  <span className="text-red-400">
                    {formatCurrency(invoiceData.variance_amount)}
                  </span>
                }
              />
            )}
          </StageCard>
        )}

        {/* Payment */}
        {Object.keys(paymentData).length > 0 && (
          <>
            {paymentSuccess ? (
              // Success State
              <StageCard
                title="Payment Scheduling"
                icon={<CreditCard className="w-5 h-5 text-emerald-400" />}
                color="emerald"
              >
                <div className="space-y-6">
                  {/* Animated Checkmark */}
                  <div className="flex justify-center py-6">
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 100 }}
                    >
                      <CheckCircle2 className="w-16 h-16 text-green-400" />
                    </motion.div>
                  </div>

                  <div className="text-center">
                    <h3 className="text-2xl font-bold text-green-400">Payment Successful!</h3>
                  </div>

                  {/* Transaction Details Box */}
                  <div className="bg-slate-900/50 rounded-lg p-4 space-y-3 border border-slate-800">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-400">Transaction Ref</span>
                      <span className="font-mono text-slate-100">{paymentSuccess.transactionRef}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-400">Payment ID</span>
                      <span className="font-mono text-slate-100">{paymentData.payment_id}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-400">Amount Paid</span>
                      <span className="text-slate-100 font-semibold">
                        {formatCurrency(paymentData.scheduled_amount)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-400">Method</span>
                      <span className="text-slate-100 capitalize">
                        {paymentSuccess.method === 'netbanking' ? 'Net Banking' : paymentSuccess.method.toUpperCase()}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-400">Paid At</span>
                      <span className="text-slate-100">{paymentSuccess.paidAt}</span>
                    </div>
                  </div>

                  <div className="text-center text-xs text-slate-400">
                    ✓ Payment confirmation has been logged to audit trail
                  </div>

                  <div className="flex gap-2">
                    <Button
                      onClick={() => {
                        const auditSection = document.querySelector('[data-audit-section]');
                        auditSection?.scrollIntoView({ behavior: 'smooth' });
                      }}
                      variant="outline"
                      className="flex-1 border-slate-700 text-slate-300 hover:text-slate-100"
                    >
                      View Audit Trail
                    </Button>
                    <Button
                      onClick={() => navigate('/procurement/new')}
                      className="flex-1 bg-blue-600 hover:bg-blue-700"
                    >
                      New Purchase Request
                    </Button>
                  </div>
                </div>
              </StageCard>
            ) : (
              // Scheduled State - Show Pay Now Button
              <StageCard title="Payment Scheduling" icon={<CreditCard className="w-5 h-5 text-emerald-400" />} color="emerald">
                <div className="space-y-4">
                  <StageDetailRow label="Payment ID" value={paymentData.payment_id} />
                  <StageDetailRow
                    label="Status"
                    value={<StatusBadge status={paymentData.status} />}
                  />
                  <StageDetailRow
                    label="Invoice Amount"
                    value={formatCurrency(paymentData.invoice_amount)}
                  />
                  <StageDetailRow
                    label="Scheduled Amount"
                    value={formatCurrency(paymentData.scheduled_amount)}
                  />
                  {paymentData.early_discount_applied && (
                    <StageDetailRow
                      label="Early Discount"
                      value={
                        <span className="text-green-400">
                          {formatCurrency(paymentData.discount_amount)} saved
                        </span>
                      }
                    />
                  )}
                  <StageDetailRow label="Due Date" value={paymentData.due_date} />

                  {/* Pay Now Button */}
                  {paymentData.status === 'SCHEDULED' && (
                    <div className="mt-6">
                      <Button
                        onClick={() => setIsPaymentModalOpen(true)}
                        className="w-full py-6 text-lg font-bold bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                      >
                        Pay Now — {formatCurrency(paymentData.scheduled_amount)}
                      </Button>
                    </div>
                  )}
                </div>
              </StageCard>
            )}
          </>
        )}
      </div>

      {/* Action Forms */}
      {showDeliveryForm && (
        <Card className="border-amber-700 bg-amber-900/10">
          <CardHeader>
            <CardTitle className="text-amber-300">Record Goods Receipt</CardTitle>
            <p className="text-xs text-amber-300/70 mt-2">💡 Auto-refresh is paused while filling this form to protect your entry</p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleDeliverySubmit} className="space-y-4">
              <div className="space-y-2">
                <Label className="text-slate-300">Verify Delivered Quantities</Label>
                <p className="text-xs text-slate-400 mb-3">Enter the actual quantities received for each item from the PO</p>
                {deliveryForm.delivered_items.map((item, idx) => {
                  const poItems = ((run?.state as any)?.po?.po_document?.line_items || []) as Array<{ item_name: string; quantity: number }>;
                  const expectedQty = idx < poItems.length ? poItems[idx].quantity : 0;
                  const receivedQty = deliveryForm.delivered_quantities[idx] ? parseInt(deliveryForm.delivered_quantities[idx]) : 0;
                  const matches = receivedQty === expectedQty;

                  return (
                    <div key={idx} className={`flex items-center gap-4 p-3 rounded border ${matches && receivedQty > 0 ? 'border-green-700 bg-green-900/10' : 'border-slate-700'}`}>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-slate-200">{item}</span>
                          {!matches && receivedQty > 0 && <span className="text-xs text-red-400">Mismatch</span>}
                          {matches && receivedQty > 0 && <span className="text-xs text-green-400">✓ Match</span>}
                        </div>
                        <div className="text-xs text-slate-400 mt-1">Expected: {expectedQty} unit(s)</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min="0"
                          value={deliveryForm.delivered_quantities[idx]}
                          onChange={(e) => {
                            const newQtys = [...deliveryForm.delivered_quantities];
                            newQtys[idx] = e.target.value;
                            setDeliveryForm((prev) => ({
                              ...prev,
                              delivered_quantities: newQtys,
                            }));
                          }}
                          placeholder="0"
                          className={`bg-slate-900 ${matches && receivedQty > 0 ? 'border-green-700' : 'border-slate-700'} w-20`}
                        />
                        <span className="text-sm text-slate-400">units</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="space-y-2">
                <Label htmlFor="delivery_date" className="text-slate-300">
                  Delivery Date
                </Label>
                <Input
                  id="delivery_date"
                  type="date"
                  value={deliveryForm.delivery_date}
                  onChange={(e) =>
                    setDeliveryForm((prev) => ({
                      ...prev,
                      delivery_date: e.target.value,
                    }))
                  }
                  className="bg-slate-900 border-slate-700"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="delivery_note_ref" className="text-slate-300">
                  Delivery Note Ref
                </Label>
                <Input
                  id="delivery_note_ref"
                  value={deliveryForm.delivery_note_ref}
                  onChange={(e) =>
                    setDeliveryForm((prev) => ({
                      ...prev,
                      delivery_note_ref: e.target.value,
                    }))
                  }
                  placeholder="e.g., DN-2024-001"
                  className="bg-slate-900 border-slate-700"
                />
              </div>

              {deliveryForm.delivered_quantities.some(q => !q || parseInt(q) === 0) && (
                <Alert className="border-red-700 bg-red-900/20">
                  <AlertCircle className="w-4 h-4 text-red-500" />
                  <AlertDescription className="text-red-300 ml-2">
                    All items must have quantities greater than zero
                  </AlertDescription>
                </Alert>
              )}

              <Button
                type="submit"
                disabled={submittingDelivery || deliveryForm.delivered_quantities.some(q => !q || parseInt(q) === 0)}
                className="bg-amber-700 hover:bg-amber-600 disabled:bg-slate-700 disabled:opacity-50"
              >
                {submittingDelivery ? 'Submitting...' : 'Submit Goods Receipt'}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {showInvoiceForm && (
        <Card className="border-blue-700 bg-blue-900/10">
          <CardHeader>
            <CardTitle className="text-blue-300">Submit Vendor Invoice</CardTitle>
            <p className="text-xs text-blue-300/70 mt-2">💡 Auto-refresh is paused while filling this form to protect your entry</p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleInvoiceSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="invoice_id" className="text-slate-300">
                    Invoice ID
                  </Label>
                  <Input
                    id="invoice_id"
                    value={invoiceForm.invoice_id}
                    onChange={(e) =>
                      setInvoiceForm((prev) => ({
                        ...prev,
                        invoice_id: e.target.value,
                      }))
                    }
                    placeholder="e.g., INV-001"
                    className="bg-slate-900 border-slate-700"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="invoice_amount" className="text-slate-300">
                    Invoice Amount (₹)
                  </Label>
                  <Input
                    id="invoice_amount"
                    type="number"
                    step="0.01"
                    value={invoiceForm.invoice_amount}
                    onChange={(e) =>
                      setInvoiceForm((prev) => ({
                        ...prev,
                        invoice_amount: e.target.value,
                      }))
                    }
                    placeholder="0"
                    className="bg-slate-900 border-slate-700"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-slate-300">Invoice Items</Label>
                {invoiceForm.invoice_items.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-3 gap-2">
                    <Input
                      value={item.item_name}
                      readOnly
                      placeholder="Item"
                      className="bg-slate-900 border-slate-700 text-slate-400"
                    />
                    <Input
                      type="number"
                      min="0"
                      value={item.quantity}
                      onChange={(e) => {
                        const newItems = [...invoiceForm.invoice_items];
                        newItems[idx].quantity = e.target.value;
                        setInvoiceForm((prev) => ({
                          ...prev,
                          invoice_items: newItems,
                        }));
                      }}
                      placeholder="Qty"
                      className="bg-slate-900 border-slate-700"
                    />
                    <Input
                      type="number"
                      step="0.01"
                      value={item.unit_price}
                      onChange={(e) => {
                        const newItems = [...invoiceForm.invoice_items];
                        newItems[idx].unit_price = e.target.value;
                        setInvoiceForm((prev) => ({
                          ...prev,
                          invoice_items: newItems,
                        }));
                      }}
                      placeholder="Price"
                      className="bg-slate-900 border-slate-700"
                    />
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="invoice_date" className="text-slate-300">
                    Invoice Date
                  </Label>
                  <Input
                    id="invoice_date"
                    type="date"
                    value={invoiceForm.invoice_date}
                    onChange={(e) =>
                      setInvoiceForm((prev) => ({
                        ...prev,
                        invoice_date: e.target.value,
                      }))
                    }
                    className="bg-slate-900 border-slate-700"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="vendor_bank_ref" className="text-slate-300">
                    Vendor Bank Ref (Optional)
                  </Label>
                  <Input
                    id="vendor_bank_ref"
                    value={invoiceForm.vendor_bank_ref}
                    onChange={(e) =>
                      setInvoiceForm((prev) => ({
                        ...prev,
                        vendor_bank_ref: e.target.value,
                      }))
                    }
                    placeholder="Bank reference"
                    className="bg-slate-900 border-slate-700"
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={submittingInvoice}
                className="bg-blue-700 hover:bg-blue-600"
              >
                {submittingInvoice ? 'Submitting...' : 'Submit Invoice'}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Audit Trail */}
      <Card className="border-slate-800 bg-slate-950">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Audit Trail</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleExportAudit}
            className="text-slate-400 hover:text-slate-100"
          >
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </CardHeader>
        <CardContent>
          <div data-audit-section>
            <AuditTable events={auditEvents} />
          </div>
        </CardContent>
      </Card>

      {/* Payment Gateway Modal */}
      <PaymentGatewayModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        onPaymentSuccess={(transactionRef, method) => {
          const now = new Date();
          const paidAt = now.toLocaleDateString('en-IN', {
            year: 'numeric',
            month: 'short',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
          });
          setPaymentSuccess({ transactionRef, method, paidAt });
          setIsPaymentModalOpen(false);
          
          // Refresh audit trail after payment
          setTimeout(() => {
            if (runId) {
              procurementApi.getAuditLog(runId).then((data) => {
                setAuditEvents(data.events);
              });
            }
          }, 2000);
        }}
        payment={paymentData}
        vendor={vendorData}
        poId={poData?.po_id}
      />
    </motion.div>
  );
}
