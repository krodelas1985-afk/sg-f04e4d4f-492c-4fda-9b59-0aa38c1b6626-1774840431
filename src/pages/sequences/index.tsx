import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useUserProfile } from "@/contexts/UserProfileContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Sequence {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  steps_count: number;
  enrollment_count: number;
  created_at: string;
}

export default function SequencesPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { profile } = useUserProfile();
  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchSequences();
  }, []);

  const fetchSequences = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/sequences");
      if (!res.ok) throw new Error("Failed to fetch sequences");
      const data = await res.json();
      setSequences(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!newName.trim()) {
      toast({
        title: "Name required",
        description: "Please give the sequence a name.",
        variant: "destructive",
      });
      return;
    }
    try {
      setCreating(true);
      const body: any = { name: newName.trim() };
      if (newDescription.trim()) body.description = newDescription.trim();
      // baymo_admin must supply a client_id; reuse their profile's if present
      if (profile?.role === "baymo_admin" && profile?.client_id) {
        body.client_id = profile.client_id;
      }
      const res = await fetch("/api/sequences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to create sequence");
      }
      const created = await res.json();
      toast({ title: "Sequence created" });
      setDialogOpen(false);
      setNewName("");
      setNewDescription("");
      router.push(`/sequences/${created.id}`);
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="p-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Sequences</h1>
          <Button
            onClick={() => setDialogOpen(true)}
            className="bg-[#E8702A] hover:bg-[#E8702A]/90 text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Sequence
          </Button>
        </div>

        {loading ? (
          <div>Loading...</div>
        ) : error ? (
          <div className="text-red-500">{error}</div>
        ) : sequences.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            No sequences yet. Create your first one to get started.
          </div>
        ) : (
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-slate-500 bg-slate-50 border-b">
                  <tr>
                    <th className="px-6 py-4 font-medium">Name</th>
                    <th className="px-6 py-4 font-medium">Active</th>
                    <th className="px-6 py-4 font-medium">Steps</th>
                    <th className="px-6 py-4 font-medium">Enrolled Leads</th>
                    <th className="px-6 py-4 font-medium">Created Date</th>
                  </tr>
                </thead>
                <tbody>
                  {sequences.map((s) => (
                    <tr
                      key={s.id}
                      className="border-b hover:bg-slate-50 cursor-pointer"
                      onClick={() => router.push(`/sequences/${s.id}`)}
                    >
                      <td className="px-6 py-4 font-medium text-slate-900">
                        {s.name}
                      </td>
                      <td className="px-6 py-4">
                        {s.is_active ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-[#E8702A]/10 text-[#E8702A]">
                            <Check className="w-3 h-3 mr-1" />
                            Active
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                            Inactive
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">{s.steps_count || 0}</td>
                      <td className="px-6 py-4">{s.enrollment_count || 0}</td>
                      <td className="px-6 py-4">
                        {new Date(s.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Sequence</DialogTitle>
            <DialogDescription>
              Create a follow-up sequence. You can add steps and enrollment
              rules after it&apos;s created.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="seq-name">Name</Label>
              <Input
                id="seq-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Cold Lead Re-engagement"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="seq-description">Description</Label>
              <Textarea
                id="seq-description"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Optional — what this sequence is for"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={creating}
              className="bg-[#E8702A] hover:bg-[#E8702A]/90 text-white"
            >
              {creating ? "Creating..." : "Create Sequence"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
