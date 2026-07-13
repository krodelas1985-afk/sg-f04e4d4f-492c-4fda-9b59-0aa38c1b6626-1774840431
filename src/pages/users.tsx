import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { UserPlus, Mail, X } from "lucide-react";
import { cn } from "@/lib/utils";

export default function UsersPage() {
  const router = useRouter();
  const { toast } = useToast();

  // State
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddUser, setShowAddUser] = useState(false);
  const [formData, setFormData] = useState({ email: "", role: "agent" });
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [currentUserClientId, setCurrentUserClientId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Deactivation with lead handoff
  const [deactivateTarget, setDeactivateTarget] = useState<{
    userId: string;
    name: string;
    openLeads: number;
  } | null>(null);
  const [reassignTo, setReassignTo] = useState<string>("keep");
  const [deactivating, setDeactivating] = useState(false);

  // Fetch current user and enforce access control
  useEffect(() => {
    const checkAccess = async () => {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        router.push("/login");
        return;
      }

      // Get user profile with role and client_id
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("id, role, client_id")
        .eq("id", session.user.id)
        .single();

      if (error || !profile) {
        console.error("Error fetching profile:", error);
        router.push("/dashboard");
        return;
      }

      setCurrentUserId(profile.id);
      setCurrentUserRole(profile.role);
      setCurrentUserClientId(profile.client_id);

      // CRITICAL: Access control enforcement
      // Only baymo_admin and client_admin can access this page
      if (profile.role !== "baymo_admin" && profile.role !== "client_admin") {
        toast({
          title: "Access Denied",
          description: "You do not have permission to access user management",
          variant: "destructive",
        });
        router.push("/dashboard");
        return;
      }

      setLoading(false);
    };

    checkAccess();
  }, [router]);

  // Fetch users with proper client_id filtering
  const fetchUsers = async () => {
    if (!currentUserRole) return;

    try {
      const supabase = createClient();
      
      let query = supabase
        .from("profiles")
        .select("id, full_name, email, role, is_active, created_at, client_id")
        .order("created_at", { ascending: false });

      // CRITICAL: Filter by client_id for client_admin
      // baymo_admin sees all users, client_admin sees only their client's users
      if (currentUserRole === "client_admin") {
        query = query.eq("client_id", currentUserClientId);
      }

      const { data, error } = await query;

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error("Error fetching users:", error);
      toast({
        title: "Error",
        description: "Failed to load users",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    if (currentUserRole === "baymo_admin") {
      fetchUsers();
    } else if (currentUserRole === "client_admin" && currentUserClientId) {
      fetchUsers();
    }
  }, [currentUserRole, currentUserClientId]);

  // Handle role change
  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      const supabase = createClient();

      // CRITICAL: Verify user belongs to current client (except baymo_admin)
      if (currentUserRole === "client_admin") {
        const userToUpdate = users.find((u) => u.id === userId);
        if (!userToUpdate || userToUpdate.client_id !== currentUserClientId) {
          toast({
            title: "Access Denied",
            description: "You can only modify users in your organization",
            variant: "destructive",
          });
          return;
        }
      }

      const { error } = await supabase
        .from("profiles")
        .update({ role: newRole })
        .eq("id", userId);

      if (error) throw error;

      // Optimistic UI update
      setUsers(users.map((u) => (u.id === userId ? { ...u, role: newRole } : u)));

      toast({
        title: "Success",
        description: "User role updated successfully",
      });
    } catch (error) {
      console.error("Error updating role:", error);
      toast({
        title: "Error",
        description: "Failed to update user role",
        variant: "destructive",
      });
    }
  };

  // Handle toggle active status
  const handleToggleActive = async (userId: string, currentStatus: boolean) => {
    try {
      const supabase = createClient();

      // CRITICAL: Verify user belongs to current client (except baymo_admin)
      if (currentUserRole === "client_admin") {
        const userToUpdate = users.find((u) => u.id === userId);
        if (!userToUpdate || userToUpdate.client_id !== currentUserClientId) {
          toast({
            title: "Access Denied",
            description: "You can only modify users in your organization",
            variant: "destructive",
          });
          return;
        }
      }

      // Deactivating: if the user still owns open leads, ask where they should go.
      if (currentStatus) {
        const { count } = await supabase
          .from("leads")
          .select("id", { count: "exact", head: true })
          .eq("assigned_user_id", userId)
          .not("status", "in", '("Won","Lost")');

        if ((count ?? 0) > 0) {
          const target = users.find((u) => u.id === userId);
          setReassignTo("keep");
          setDeactivateTarget({
            userId,
            name: target?.full_name || target?.email || "this user",
            openLeads: count ?? 0,
          });
          return;
        }
      }

      const { error } = await supabase
        .from("profiles")
        .update({ is_active: !currentStatus })
        .eq("id", userId);

      if (error) throw error;

      // Optimistic UI update
      setUsers(users.map((u) => (u.id === userId ? { ...u, is_active: !currentStatus } : u)));

      toast({
        title: "Success",
        description: !currentStatus ? "User activated" : "User deactivated",
      });
    } catch (error) {
      console.error("Error toggling user status:", error);
      toast({
        title: "Error",
        description: "Failed to update user status",
        variant: "destructive",
      });
    }
  };

  // Deactivate a user who still owns open leads, optionally handing them over.
  const confirmDeactivate = async () => {
    if (!deactivateTarget) return;
    setDeactivating(true);
    try {
      const supabase = createClient();

      if (reassignTo !== "keep") {
        const { error: reassignError } = await supabase
          .from("leads")
          .update({ assigned_user_id: reassignTo })
          .eq("assigned_user_id", deactivateTarget.userId)
          .not("status", "in", '("Won","Lost")');
        if (reassignError) throw reassignError;
      }

      const { error } = await supabase
        .from("profiles")
        .update({ is_active: false })
        .eq("id", deactivateTarget.userId);
      if (error) throw error;

      setUsers(users.map((u) => (u.id === deactivateTarget.userId ? { ...u, is_active: false } : u)));

      const newOwner = users.find((u) => u.id === reassignTo);
      toast({
        title: "User deactivated",
        description:
          reassignTo === "keep"
            ? `${deactivateTarget.openLeads} open lead(s) remain assigned to ${deactivateTarget.name}.`
            : `${deactivateTarget.openLeads} open lead(s) reassigned to ${newOwner?.full_name || "the selected user"}.`,
      });
      setDeactivateTarget(null);
    } catch (error) {
      console.error("Error deactivating user:", error);
      toast({
        title: "Error",
        description: "Failed to deactivate user",
        variant: "destructive",
      });
    } finally {
      setDeactivating(false);
    }
  };

  // Handle resend invite
  const handleResendInvite = async (email: string, userId: string) => {
    try {
      // CRITICAL: Verify user belongs to current client (except baymo_admin)
      if (currentUserRole === "client_admin") {
        const userToUpdate = users.find((u) => u.id === userId);
        if (!userToUpdate || userToUpdate.client_id !== currentUserClientId) {
          toast({
            title: "Access Denied",
            description: "You can only resend invites for users in your organization",
            variant: "destructive",
          });
          return;
        }
      }

      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();

      const response = await fetch("/api/admin/users/resend", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error);
      }

      toast({
        title: "Success",
        description: `Invitation resent to ${email}`,
      });
    } catch (error) {
      console.error("Error resending invite:", error);
      toast({
        title: "Error",
        description: "Failed to resend invitation",
        variant: "destructive",
      });
    }
  };

  // Handle add user
  const handleAddUser = async () => {
    if (!formData.email || !formData.role) {
      toast({
        title: "Validation Error",
        description: "Please fill all required fields",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);

    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();

      // Call API route to invite user
      const response = await fetch("/api/admin/users/invite", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          email: formData.email,
          role: formData.role,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to invite user");
      }

      toast({
        title: "Success",
        description: `Invitation sent to ${formData.email}`,
      });

      setShowAddUser(false);
      setFormData({ email: "", role: "agent" });
      fetchUsers();
    } catch (error: any) {
      console.error("Error inviting user:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to invite user",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Get role badge color
  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "client_admin":
        return "bg-primary text-white";
      case "manager":
        return "bg-brand-orange text-white";
      case "agent":
        return "bg-teal-600 text-white";
      case "viewer":
        return "bg-gray-500 text-white";
      default:
        return "bg-gray-500 text-white";
    }
  };

  // Format role display name
  const formatRoleDisplay = (role: string) => {
    return role
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  if (!loading && !currentUserRole) {
    return null; // Redirect handled in useEffect
  }

  return (
    <DashboardLayout>
      <div className="p-6">
        {/* Page Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-primary">Users</h1>
            <p className="text-gray-600 mt-1">Manage your team members and their roles</p>
          </div>
          {currentUserRole === "client_admin" && (
            <Button
              onClick={() => setShowAddUser(true)}
              className="bg-brand-orange hover:bg-brand-orange-dark text-white"
            >
              <UserPlus className="h-4 w-4 mr-2" />
              Add User
            </Button>
          )}
        </div>

        {/* Users Table */}
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-6 space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : users.length === 0 ? (
              <div className="p-12 text-center text-gray-500">No users found</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Email
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Role
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Created
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {users.map((user) => (
                      <tr key={user.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="font-medium text-primary">
                            {user.full_name || "N/A"}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-gray-600">{user.email}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {currentUserRole === "client_admin" ? (
                            <Select
                              value={user.role}
                              onValueChange={(value) => handleRoleChange(user.id, value)}
                            >
                              <SelectTrigger className="w-[140px] h-8">
                                <SelectValue>
                                  <Badge className={cn("text-xs", getRoleBadgeColor(user.role))}>
                                    {formatRoleDisplay(user.role)}
                                  </Badge>
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="client_admin">Client Admin</SelectItem>
                                <SelectItem value="manager">Manager</SelectItem>
                                <SelectItem value="agent">Agent</SelectItem>
                                <SelectItem value="viewer">Viewer</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            <Badge className={cn("text-xs", getRoleBadgeColor(user.role))}>
                              {formatRoleDisplay(user.role)}
                            </Badge>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-xs",
                              user.is_active
                                ? "bg-green-100 text-green-700 border-green-300"
                                : "bg-gray-100 text-gray-700 border-gray-300"
                            )}
                          >
                            {user.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                          {new Date(user.created_at).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            {/* Toggle Active/Inactive */}
                            {user.id !== currentUserId && currentUserRole === "client_admin" && (
                              <div className="flex items-center gap-2">
                                <Label htmlFor={`active-${user.id}`} className="text-xs text-gray-600">
                                  {user.is_active ? "Active" : "Inactive"}
                                </Label>
                                <Switch
                                  id={`active-${user.id}`}
                                  checked={user.is_active}
                                  onCheckedChange={() => handleToggleActive(user.id, user.is_active)}
                                />
                              </div>
                            )}

                            {/* Resend Invite (if user hasn't accepted) */}
                            {currentUserRole === "client_admin" && !user.last_sign_in_at && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleResendInvite(user.email, user.id)}
                              >
                                <Mail className="h-4 w-4 mr-1" />
                                Resend Invite
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add User Dialog */}
      <Dialog open={showAddUser} onOpenChange={setShowAddUser}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New User</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="user@example.com"
              />
            </div>
            <div>
              <Label htmlFor="role">Role *</Label>
              <Select value={formData.role} onValueChange={(value: any) => setFormData({ ...formData, role: value })}>
                <SelectTrigger id="role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="client_admin">Client Admin</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="agent">Agent</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddUser(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAddUser}
              disabled={submitting}
              className="bg-brand-orange hover:bg-brand-orange-dark text-white"
            >
              {submitting ? "Sending..." : "Send Invitation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deactivate user — open-lead handoff */}
      <Dialog open={!!deactivateTarget} onOpenChange={(open) => !open && setDeactivateTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deactivate {deactivateTarget?.name}?</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              {deactivateTarget?.name} still has{" "}
              <span className="font-semibold">{deactivateTarget?.openLeads} open lead(s)</span>{" "}
              assigned. They will also be removed from the auto-assignment rotation. What
              should happen to their leads?
            </p>
            <div>
              <Label>Hand leads over to</Label>
              <Select value={reassignTo} onValueChange={setReassignTo}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="keep">Keep assigned to {deactivateTarget?.name}</SelectItem>
                  {users
                    .filter(
                      (u) =>
                        u.id !== deactivateTarget?.userId &&
                        u.is_active &&
                        u.role !== "baymo_admin"
                    )
                    .map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.full_name || u.email}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeactivateTarget(null)} disabled={deactivating}>
              Cancel
            </Button>
            <Button
              onClick={confirmDeactivate}
              disabled={deactivating}
              className="bg-brand-orange hover:bg-brand-orange-dark text-white"
            >
              {deactivating ? "Deactivating..." : "Deactivate User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}