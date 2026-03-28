import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import * as procurementApi from '@/lib/procurementApi';

const CATEGORIES = [
  'IT Hardware',
  'IT Software',
  'Office Supplies',
  'Facilities',
  'Raw Materials',
  'Services',
  'Parts',
];

const DEPARTMENTS = ['Engineering', 'HR', 'Operations', 'Finance'];

interface FormData {
  item_name: string;
  category: string;
  quantity: string;
  unit_price: string;
  department: string;
  requester_id: string;
  required_by: string;
}

function formatCurrency(value: number): string {
  return value.toLocaleString('en-IN', { style: 'currency', currency: 'INR' });
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 300, damping: 24 }
  }
};

export default function NewProcurementRequest() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<FormData>({
    item_name: '',
    category: '',
    quantity: '',
    unit_price: '',
    department: '',
    requester_id: '',
    required_by: '',
  });

  const [errors, setErrors] = useState<Partial<FormData>>({});

  useEffect(() => {
    // Load sample data on mount
    const loadSample = async () => {
      try {
        const response = await procurementApi.getSamples();
        const cleanRun = response.samples.find((s) => s.scenario === 'clean_run');
        if (cleanRun) {
          const pr = cleanRun.purchase_request;
          setForm({
            item_name: pr.item_name,
            category: pr.category,
            quantity: pr.quantity.toString(),
            unit_price: pr.unit_price.toString(),
            department: pr.department,
            requester_id: pr.requester_id,
            required_by: pr.required_by,
          });
        }
      } catch (error) {
        console.error('Failed to load samples:', error);
      } finally {
        setLoading(false);
      }
    };

    loadSample();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name as keyof FormData]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const handleSelectChange = (name: string, value: string) => {
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name as keyof FormData]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const validate = (): boolean => {
    const newErrors: Partial<FormData> = {};

    if (!form.item_name.trim()) newErrors.item_name = 'Item name is required';
    if (!form.category) newErrors.category = 'Category is required';
    if (!form.quantity || parseInt(form.quantity) < 1) newErrors.quantity = 'Quantity must be at least 1';
    if (!form.unit_price || parseFloat(form.unit_price) <= 0) newErrors.unit_price = 'Unit price must be greater than 0';
    if (!form.department) newErrors.department = 'Department is required';
    if (!form.requester_id.trim()) newErrors.requester_id = 'Requester ID is required';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      toast.error('Please fix form errors');
      return;
    }

    setSubmitting(true);
    try {
      const response = await procurementApi.startRun({
        item_name: form.item_name,
        category: form.category,
        quantity: parseInt(form.quantity),
        unit_price: parseFloat(form.unit_price),
        department: form.department,
        requester_id: form.requester_id,
        required_by: form.required_by,
      });

      toast.success('Purchase request submitted successfully');
      navigate(`/procurement/run/${response.run_id}`, {
        state: { message: 'Pipeline Starting...' },
      });
    } catch (error) {
      toast.error(String(error));
      console.error(error);
    } finally {
      setSubmitting(false);
    }
  };

  const quantity = parseInt(form.quantity) || 0;
  const unitPrice = parseFloat(form.unit_price) || 0;
  const total = quantity * unitPrice;

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
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
          <h1 className="text-3xl font-bold text-slate-100">New Purchase Request</h1>
          <p className="text-slate-400 mt-1">Submit a new item for procurement</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form */}
        <div className="lg:col-span-2">
          <Card className="border-slate-800 bg-slate-950">
            <CardHeader>
              <CardTitle>Request Details</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Item Name */}
                <div className="space-y-2">
                  <Label htmlFor="item_name" className="text-slate-300">
                    Item Name *
                  </Label>
                  <Input
                    id="item_name"
                    name="item_name"
                    value={form.item_name}
                    onChange={handleChange}
                    placeholder="e.g., Dell Laptop 15 Pro"
                    className="bg-slate-900 border-slate-700 text-slate-100 placeholder:text-slate-600"
                  />
                  {errors.item_name && (
                    <p className="text-xs text-red-400">{errors.item_name}</p>
                  )}
                </div>

                {/* Category & Department */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="category" className="text-slate-300">
                      Category *
                    </Label>
                    <Select value={form.category} onValueChange={(val) => handleSelectChange('category', val)}>
                      <SelectTrigger className="bg-slate-900 border-slate-700 text-slate-100">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-900 border-slate-700">
                        {CATEGORIES.map((cat) => (
                          <SelectItem key={cat} value={cat}>
                            {cat}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.category && (
                      <p className="text-xs text-red-400">{errors.category}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="department" className="text-slate-300">
                      Department *
                    </Label>
                    <Select value={form.department} onValueChange={(val) => handleSelectChange('department', val)}>
                      <SelectTrigger className="bg-slate-900 border-slate-700 text-slate-100">
                        <SelectValue placeholder="Select department" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-900 border-slate-700">
                        {DEPARTMENTS.map((dept) => (
                          <SelectItem key={dept} value={dept}>
                            {dept}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.department && (
                      <p className="text-xs text-red-400">{errors.department}</p>
                    )}
                  </div>
                </div>

                {/* Quantity & Unit Price */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="quantity" className="text-slate-300">
                      Quantity *
                    </Label>
                    <Input
                      id="quantity"
                      name="quantity"
                      type="number"
                      value={form.quantity}
                      onChange={handleChange}
                      placeholder="0"
                      min="1"
                      className="bg-slate-900 border-slate-700 text-slate-100"
                    />
                    {errors.quantity && (
                      <p className="text-xs text-red-400">{errors.quantity}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="unit_price" className="text-slate-300">
                      Unit Price (₹) *
                    </Label>
                    <Input
                      id="unit_price"
                      name="unit_price"
                      type="number"
                      value={form.unit_price}
                      onChange={handleChange}
                      placeholder="0"
                      step="0.01"
                      min="0"
                      className="bg-slate-900 border-slate-700 text-slate-100"
                    />
                    {errors.unit_price && (
                      <p className="text-xs text-red-400">{errors.unit_price}</p>
                    )}
                  </div>
                </div>

                {/* Requester ID */}
                <div className="space-y-2">
                  <Label htmlFor="requester_id" className="text-slate-300">
                    Requester ID *
                  </Label>
                  <Input
                    id="requester_id"
                    name="requester_id"
                    value={form.requester_id}
                    onChange={handleChange}
                    placeholder="e.g., EMP-204"
                    className="bg-slate-900 border-slate-700 text-slate-100"
                  />
                  {errors.requester_id && (
                    <p className="text-xs text-red-400">{errors.requester_id}</p>
                  )}
                </div>

                {/* Required By */}
                <div className="space-y-2">
                  <Label htmlFor="required_by" className="text-slate-300">
                    Required By
                  </Label>
                  <Input
                    id="required_by"
                    name="required_by"
                    type="date"
                    value={form.required_by}
                    onChange={handleChange}
                    className="bg-slate-900 border-slate-700 text-slate-100"
                  />
                </div>

                {/* Submit */}
                <div className="flex gap-2 pt-4">
                  <Button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 bg-blue-700 hover:bg-blue-600"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      'Submit Request'
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigate('/procurement')}
                    className="border-slate-700 text-slate-300 hover:text-slate-100"
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Summary */}
        <div className="space-y-4">
          <Card className="border-slate-800 bg-slate-950">
            <CardHeader>
              <CardTitle className="text-base">Estimated Total</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-3xl font-bold text-blue-400">
                {formatCurrency(total)}
              </div>
              <div className="space-y-2 border-t border-slate-800 pt-3">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Quantity:</span>
                  <span className="text-slate-100 font-medium">{quantity}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Unit Price:</span>
                  <span className="text-slate-100 font-medium">
                    {formatCurrency(unitPrice)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-800 bg-slate-950">
            <CardHeader>
              <CardTitle className="text-base">What Happens Next?</CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2 text-slate-300">
              <p>✓ Budget check</p>
              <p>✓ Vendor scoring</p>
              <p>✓ PO creation</p>
              <p>✓ Goods receipt</p>
              <p>✓ Invoice matching</p>
              <p>✓ Payment scheduling</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </motion.div>
  );
}
