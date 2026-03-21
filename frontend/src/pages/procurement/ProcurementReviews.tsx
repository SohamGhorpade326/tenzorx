import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { ReviewCard } from '@/components/procurement/ReviewCard';
import * as procurementApi from '@/lib/procurementApi';

interface ReviewActionState {
  reviewId: string | null;
  action: 'approve' | 'reject' | null;
  note: string;
  isLoading: boolean;
}

export default function ProcurementReviews() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [reviews, setReviews] = useState<procurementApi.ReviewItem[]>([]);
  const [actionState, setActionState] = useState<ReviewActionState>({
    reviewId: null,
    action: null,
    note: '',
    isLoading: false,
  });

  useEffect(() => {
    const fetchReviews = async () => {
      try {
        const response = await procurementApi.getPendingReviews();
        setReviews(response.reviews);
      } catch (error) {
        toast.error('Failed to load reviews');
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    fetchReviews();

    const interval = setInterval(fetchReviews, 60000); // Refresh every 60 seconds
    return () => clearInterval(interval);
  }, []);

  const pendingReviews = reviews.filter((r) => r.status === 'PENDING_APPROVAL');
  const resolvedReviews = reviews.filter((r) => r.status !== 'PENDING_APPROVAL');
  const pendingCount = pendingReviews.length;

  const openActionDialog = (reviewId: string, action: 'approve' | 'reject') => {
    setActionState({
      reviewId,
      action,
      note: '',
      isLoading: false,
    });
  };

  const closeActionDialog = () => {
    setActionState({
      reviewId: null,
      action: null,
      note: '',
      isLoading: false,
    });
  };

  const handleConfirmAction = async () => {
    if (!actionState.reviewId || !actionState.action) return;

    setActionState((prev) => ({ ...prev, isLoading: true }));

    try {
      const response = await procurementApi.actionReview(
        actionState.reviewId,
        actionState.action,
        actionState.note
      );

      // Check if pipeline was auto-resumed
      const pipelineResumed = (response as any)?.pipeline_resumed;
      const runStatus = (response as any)?.run_status;
      const currentStep = (response as any)?.current_step;

      if (actionState.action === 'approve') {
        if (pipelineResumed) {
          toast.success(
            `✓ Review approved & pipeline resumed!\nNow at: ${currentStep}`
          );
        } else {
          toast.success('Review approved successfully');
        }
      } else {
        toast.success('Review rejected successfully');
      }

      // Update reviews state
      setReviews((prev) =>
        prev.map((r) =>
          r.review_id === actionState.reviewId
            ? {
                ...r,
                status: actionState.action === 'approve' ? 'APPROVED' : 'REJECTED',
                resolved_at: new Date().toISOString(),
                resolution_note: actionState.note,
              }
            : r
        )
      );

      closeActionDialog();
    } catch (error) {
      toast.error(String(error));
    } finally {
      setActionState((prev) => ({ ...prev, isLoading: false }));
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/procurement')}
          className="text-slate-400 hover:text-slate-100"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-slate-100">Human Review Queue</h1>
          <p className="text-slate-400 mt-1">Manage approval requests from the procurement pipeline</p>
        </div>
      </div>

      {/* Tabs */}
      <Card className="border-slate-800 bg-slate-950">
        <Tabs defaultValue="pending" className="w-full">
          <TabsList className="w-full justify-start border-b border-slate-800 rounded-none bg-transparent p-4">
            <TabsTrigger
              value="pending"
              className="border-b-2 border-transparent data-[state=active]:border-blue-500 data-[state=active]:text-slate-100 rounded-none px-4 py-2 text-slate-400"
            >
              <span className="flex items-center gap-2">
                Pending
                {pendingCount > 0 && (
                  <span className="inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-red-100 bg-red-600 rounded-full">
                    {pendingCount}
                  </span>
                )}
              </span>
            </TabsTrigger>
            <TabsTrigger
              value="resolved"
              className="border-b-2 border-transparent data-[state=active]:border-blue-500 data-[state=active]:text-slate-100 rounded-none px-4 py-2 text-slate-400"
            >
              Resolved
            </TabsTrigger>
          </TabsList>

          {/* Pending Reviews Tab */}
          <TabsContent value="pending" className="p-4 space-y-4">
            {loading ? (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-40 bg-slate-900/40" />
                ))}
              </div>
            ) : pendingReviews.length === 0 ? (
              <div className="text-center py-12">
                <MessageSquare className="w-12 h-12 text-slate-500 mx-auto mb-4" />
                <p className="text-slate-400 mb-4">No pending reviews</p>
                <Button
                  onClick={() => navigate('/procurement')}
                  className="bg-blue-700 hover:bg-blue-600"
                >
                  Back to Dashboard
                </Button>
              </div>
            ) : (
              <div className="grid gap-4">
                {pendingReviews.map((review) => (
                  <ReviewCard
                    key={review.review_id}
                    reviewId={review.review_id}
                    runId={review.run_id}
                    agentName={review.agent_name}
                    reason={review.reason}
                    payload={review.payload}
                    status={review.status}
                    createdAt={review.created_at}
                    onApprove={() => openActionDialog(review.review_id, 'approve')}
                    onReject={() => openActionDialog(review.review_id, 'reject')}
                    onRunClick={(runId) =>
                      navigate(`/procurement/run/${runId}`)
                    }
                  />
                ))}
              </div>
            )}
          </TabsContent>

          {/* Resolved Reviews Tab */}
          <TabsContent value="resolved" className="p-4 space-y-4">
            {loading ? (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-40 bg-slate-900/40" />
                ))}
              </div>
            ) : resolvedReviews.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <p>No resolved reviews yet</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {resolvedReviews.map((review) => (
                  <div
                    key={review.review_id}
                    className="border border-slate-800 rounded-lg p-4 bg-slate-900/30"
                  >
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div>
                        <div className="font-medium text-slate-100">{review.reason}</div>
                        <p className="text-xs text-slate-500 mt-1">
                          Run:{' '}
                          <button
                            onClick={() => navigate(`/procurement/run/${review.run_id}`)}
                            className="text-blue-400 hover:text-blue-300"
                          >
                            {review.run_id.substring(0, 12)}
                          </button>
                        </p>
                      </div>
                      <div className="text-right">
                        {review.status === 'APPROVED' ? (
                          <div className="inline-flex items-center px-2 py-1 text-xs font-bold text-green-100 bg-green-600/30 rounded border border-green-700">
                            Approved
                          </div>
                        ) : (
                          <div className="inline-flex items-center px-2 py-1 text-xs font-bold text-red-100 bg-red-600/30 rounded border border-red-700">
                            Rejected
                          </div>
                        )}
                      </div>
                    </div>

                    {review.resolution_note && (
                      <div className="mt-3 p-3 bg-slate-900/50 rounded border border-slate-700">
                        <p className="text-xs text-slate-400 mb-1">Resolution Note:</p>
                        <p className="text-sm text-slate-300">{review.resolution_note}</p>
                      </div>
                    )}

                    {review.resolved_at && (
                      <p className="text-xs text-slate-500 mt-2">
                        Resolved: {new Date(review.resolved_at).toLocaleString()}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </Card>

      {/* Action Dialog */}
      <Dialog open={!!actionState.reviewId} onOpenChange={(open) => !open && closeActionDialog()}>
        <DialogContent className="border-slate-700 bg-slate-950">
          <DialogHeader>
            <DialogTitle className="text-slate-100">
              {actionState.action === 'approve' ? 'Approve' : 'Reject'} Review
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="note" className="text-slate-300">
                Optional Note
              </Label>
              <Textarea
                id="note"
                value={actionState.note}
                onChange={(e) =>
                  setActionState((prev) => ({ ...prev, note: e.target.value }))
                }
                placeholder="Add a reason for your decision (optional)"
                className="bg-slate-900 border-slate-700 text-slate-100 placeholder:text-slate-600"
                rows={4}
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={closeActionDialog}
              className="border-slate-700 text-slate-300 hover:text-slate-100"
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmAction}
              disabled={actionState.isLoading}
              className={
                actionState.action === 'approve'
                  ? 'bg-green-700 hover:bg-green-600'
                  : 'bg-red-700 hover:bg-red-600'
              }
            >
              {actionState.isLoading
                ? `${actionState.action === 'approve' ? 'Approving' : 'Rejecting'}...`
                : actionState.action === 'approve'
                  ? 'Approve'
                  : 'Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
