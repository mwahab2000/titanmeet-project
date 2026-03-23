import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Tag, Plus, Pencil, Eye, Loader2, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import {
  listDiscountCodes,
  createDiscountCode,
  updateDiscountCode,
  toggleDiscountCode,
  getDiscountRedemptions,
  type DiscountCode,
  type DiscountRedemption,
  formatDiscountSummary,
} from "@/lib/discount-api";

const PLAN_OPTIONS = [
  { id: "starter", label: "Starter" },
  { id: "professional", label: "Professional" },
  { id: "enterprise", label: "Enterprise" },
];

const INTERVAL_OPTIONS = [
  { id: "monthly", label: "Monthly" },
  { id: "annual", label: "Annual" },
];

const AdminDiscountsPage = () => {
  const { user } = useAuth();
  const [codes, setCodes] = useState<DiscountCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<DiscountCode | null>(null);
  const [redemptionsDialog, setRedemptionsDialog] = useState<{ codeId: string; code: string } | null>(null);
  const [redemptions, setRedemptions] = useState<DiscountRedemption[]>([]);
  const [loadingRedemptions, setLoadingRedemptions] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [redemptionFilter, setRedemptionFilter] = useState<"all" | "pending" | "applied">("all");

  // Form state
  const [form, setForm] = useState({
    code: "",
    description: "",
    discount_type: "percent",
    discount_value: 20,
    applicable_plans: ["starter", "professional", "enterprise"],
    applicable_intervals: ["monthly", "annual"],
    duration_type: "once",
    duration_cycles: null as number | null,
    max_redemptions: null as number | null,
    max_redemptions_per_customer: 1,
    paddle_discount_id: "",
    starts_at: "",
    expires_at: "",
  });

  const loadCodes = useCallback(async () => {
    setLoading(true);
    const { data } = await listDiscountCodes();
    setCodes(data);
    setLoading(false);
  }, []);

  useEffect(() => { loadCodes(); }, [loadCodes]);

  const resetForm = () => {
    setForm({
      code: "", description: "", discount_type: "percent", discount_value: 20,
      applicable_plans: ["starter", "professional", "enterprise"],
      applicable_intervals: ["monthly", "annual"],
      duration_type: "once", duration_cycles: null,
      max_redemptions: null, max_redemptions_per_customer: 1,
      paddle_discount_id: "", starts_at: "", expires_at: "",
    });
    setEditing(null);
  };

  const openCreate = () => { resetForm(); setDialogOpen(true); };

  const openEdit = (dc: DiscountCode) => {
    setEditing(dc);
    setForm({
      code: dc.code,
      description: dc.description || "",
      discount_type: dc.discount_type,
      discount_value: dc.discount_value,
      applicable_plans: dc.applicable_plans,
      applicable_intervals: dc.applicable_intervals,
      duration_type: dc.duration_type,
      duration_cycles: dc.duration_cycles,
      max_redemptions: dc.max_redemptions,
      max_redemptions_per_customer: dc.max_redemptions_per_customer ?? 1,
      paddle_discount_id: dc.paddle_discount_id || "",
      starts_at: dc.starts_at ? dc.starts_at.slice(0, 16) : "",
      expires_at: dc.expires_at ? dc.expires_at.slice(0, 16) : "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.code.trim()) { toast.error("Code is required"); return; }
    setSaving(true);
    try {
      const payload: any = {
        code: form.code.trim().toUpperCase(),
        description: form.description || null,
        discount_type: form.discount_type,
        discount_value: form.discount_value,
        applicable_plans: form.applicable_plans,
        applicable_intervals: form.applicable_intervals,
        duration_type: form.duration_type,
        duration_cycles: form.duration_type === "repeating" ? form.duration_cycles : null,
        max_redemptions: form.max_redemptions || null,
        max_redemptions_per_customer: form.max_redemptions_per_customer || null,
        paddle_discount_id: form.paddle_discount_id || null,
        starts_at: form.starts_at ? new Date(form.starts_at).toISOString() : null,
        expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : null,
      };

      if (editing) {
        const { error } = await updateDiscountCode(editing.id, payload);
        if (error) throw error;
        toast.success("Discount code updated");
      } else {
        payload.created_by = user?.id;
        const { error } = await createDiscountCode(payload);
        if (error) throw error;
        toast.success("Discount code created");
      }
      setDialogOpen(false);
      resetForm();
      loadCodes();
    } catch (err: any) {
      toast.error(err.message || "Failed to save discount code");
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (dc: DiscountCode) => {
    await toggleDiscountCode(dc.id, !dc.is_active);
    toast.success(dc.is_active ? "Code deactivated" : "Code activated");
    loadCodes();
  };

  const openRedemptions = async (codeId: string, code: string) => {
    setRedemptionsDialog({ codeId, code });
    setLoadingRedemptions(true);
    const { data } = await getDiscountRedemptions(codeId);
    setRedemptions(data);
    setLoadingRedemptions(false);
  };

  const copyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const togglePlan = (planId: string) => {
    setForm((f) => ({
      ...f,
      applicable_plans: f.applicable_plans.includes(planId)
        ? f.applicable_plans.filter((p) => p !== planId)
        : [...f.applicable_plans, planId],
    }));
  };

  const toggleInterval = (intId: string) => {
    setForm((f) => ({
      ...f,
      applicable_intervals: f.applicable_intervals.includes(intId)
        ? f.applicable_intervals.filter((i) => i !== intId)
        : [...f.applicable_intervals, intId],
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold flex items-center gap-2">
            <Tag className="h-7 w-7 text-primary" /> Discount Codes
          </h1>
          <p className="text-muted-foreground">Manage promotional discount codes for TitanMeet plans.</p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" /> Create Code
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-display">All Codes</CardTitle>
          <CardDescription>{codes.length} discount code{codes.length !== 1 ? "s" : ""}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Discount</TableHead>
                  <TableHead>Plans</TableHead>
                  <TableHead>Intervals</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Paddle ID</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {codes.map((dc) => (
                  <TableRow key={dc.id}>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-medium">{dc.code}</span>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => copyCode(dc.code, dc.id)}>
                          {copiedId === dc.id ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                        </Button>
                      </div>
                      {dc.description && <p className="text-xs text-muted-foreground mt-0.5">{dc.description}</p>}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm font-medium">
                        {formatDiscountSummary(dc.discount_type, dc.discount_value, dc.duration_type, dc.duration_cycles)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap">
                        {dc.applicable_plans.map((p: string) => (
                          <Badge key={p} variant="outline" className="text-[10px] capitalize">{p}</Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {dc.applicable_intervals.map((i: string) => (
                          <Badge key={i} variant="outline" className="text-[10px] capitalize">{i}</Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={dc.is_active ? "default" : "secondary"}>
                        {dc.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs font-mono text-muted-foreground">
                        {dc.paddle_discount_id || "—"}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {dc.expires_at ? new Date(dc.expires_at).toLocaleDateString() : "Never"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEdit(dc)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openRedemptions(dc.id, dc.code)}>
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        <Switch checked={dc.is_active} onCheckedChange={() => handleToggle(dc)} className="scale-75" />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {codes.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      No discount codes yet. Create one to get started.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) resetForm(); setDialogOpen(o); }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">{editing ? "Edit Discount Code" : "Create Discount Code"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Code</Label>
                <Input value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))} placeholder="EARLY20" className="font-mono uppercase" />
              </div>
              <div className="space-y-2">
                <Label>Paddle Discount ID</Label>
                <Input value={form.paddle_discount_id} onChange={(e) => setForm((f) => ({ ...f, paddle_discount_id: e.target.value }))} placeholder="dsc_..." className="font-mono text-sm" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Early adopter discount" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Discount Type</Label>
                <Select value={form.discount_type} onValueChange={(v) => setForm((f) => ({ ...f, discount_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percent">Percentage</SelectItem>
                    <SelectItem value="fixed">Fixed Amount ($)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Value</Label>
                <Input type="number" value={form.discount_value} onChange={(e) => setForm((f) => ({ ...f, discount_value: Number(e.target.value) }))} min={0} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Applicable Plans</Label>
              <div className="flex gap-3">
                {PLAN_OPTIONS.map((p) => (
                  <label key={p.id} className="flex items-center gap-1.5 text-sm">
                    <Checkbox checked={form.applicable_plans.includes(p.id)} onCheckedChange={() => togglePlan(p.id)} />
                    {p.label}
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Applicable Intervals</Label>
              <div className="flex gap-3">
                {INTERVAL_OPTIONS.map((i) => (
                  <label key={i.id} className="flex items-center gap-1.5 text-sm">
                    <Checkbox checked={form.applicable_intervals.includes(i.id)} onCheckedChange={() => toggleInterval(i.id)} />
                    {i.label}
                  </label>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Duration</Label>
                <Select value={form.duration_type} onValueChange={(v) => setForm((f) => ({ ...f, duration_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="once">Once</SelectItem>
                    <SelectItem value="repeating">Repeating</SelectItem>
                    <SelectItem value="forever">Forever</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {form.duration_type === "repeating" && (
                <div className="space-y-2">
                  <Label>Cycles</Label>
                  <Input type="number" value={form.duration_cycles ?? ""} onChange={(e) => setForm((f) => ({ ...f, duration_cycles: e.target.value ? Number(e.target.value) : null }))} min={1} />
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Max Redemptions</Label>
                <Input type="number" value={form.max_redemptions ?? ""} onChange={(e) => setForm((f) => ({ ...f, max_redemptions: e.target.value ? Number(e.target.value) : null }))} placeholder="Unlimited" min={1} />
              </div>
              <div className="space-y-2">
                <Label>Per Customer</Label>
                <Input type="number" value={form.max_redemptions_per_customer ?? ""} onChange={(e) => setForm((f) => ({ ...f, max_redemptions_per_customer: e.target.value ? Number(e.target.value) : 1 }))} min={1} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Starts At</Label>
                <Input type="datetime-local" value={form.starts_at} onChange={(e) => setForm((f) => ({ ...f, starts_at: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Expires At</Label>
                <Input type="datetime-local" value={form.expires_at} onChange={(e) => setForm((f) => ({ ...f, expires_at: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { resetForm(); setDialogOpen(false); }}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {editing ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Redemptions Dialog */}
      <Dialog open={!!redemptionsDialog} onOpenChange={(o) => { if (!o) setRedemptionsDialog(null); }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">
              Redemptions — <span className="font-mono">{redemptionsDialog?.code}</span>
            </DialogTitle>
          </DialogHeader>
          {loadingRedemptions ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : redemptions.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No redemptions yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Interval</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Transaction</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {redemptions.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-sm">{r.customer_email || r.user_id?.slice(0, 8) || "—"}</TableCell>
                    <TableCell><Badge variant="outline" className="capitalize text-xs">{r.plan_applied}</Badge></TableCell>
                    <TableCell className="text-sm capitalize">{r.billing_interval}</TableCell>
                    <TableCell>
                      <Badge variant={
                        (r as any).status === "applied" ? "default" :
                        (r as any).status === "pending" ? "secondary" :
                        "destructive"
                      } className="text-[10px]">
                        {(r as any).status || "pending"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs font-mono text-muted-foreground">
                      {r.paddle_transaction_id?.slice(0, 12) || "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(r.redeemed_at).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminDiscountsPage;
