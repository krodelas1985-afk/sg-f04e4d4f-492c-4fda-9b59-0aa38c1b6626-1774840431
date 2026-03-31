import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { createClient } from "@/lib/supabase/client";
import { CheckCircle2, Calendar as CalendarIcon, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

export default function TasksPage() {
  const router = useRouter();
  const { toast } = useToast();

  // State
  const [tasks, setTasks] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Filters
  const [activeTab, setActiveTab] = useState("today");
  const [taskTypeFilter, setTaskTypeFilter] = useState<string>("all");
  const [assignedToFilter, setAssignedToFilter] = useState<string>("all");

  // Add Task Form
  const [showAddTask, setShowAddTask] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    lead_id: "",
    task_type: "",
    due_date: "",
    assigned_to: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);

  // Reschedule
  const [reschedulingTask, setReschedulingTask] = useState<string | null>(null);
  const [newDueDate, setNewDueDate] = useState<Date | undefined>(undefined);

  // Get today in Asia/Manila timezone
  const getToday = () => {
    return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });
  };

  // Fetch data on mount
  useEffect(() => {
    fetchCurrentUser();
    fetchTasks();
    fetchLeads();
    fetchProfiles();
  }, [activeTab, taskTypeFilter, assignedToFilter]);

  const fetchCurrentUser = async () => {
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id) {
        setCurrentUserId(session.user.id);
        setFormData((prev) => ({ ...prev, assigned_to: session.user.id }));
      }
    } catch (error) {
      console.error("Error fetching user:", error);
    }
  };

  const fetchTasks = async () => {
    try {
      const supabase = createClient();
      const today = getToday();

      let query = supabase
        .from("tasks")
        .select(`
          *,
          lead:leads(id, name),
          assigned_profile:profiles!tasks_assigned_to_fkey(id, full_name)
        `);

      // Apply tab filter
      if (activeTab === "today") {
        query = query.eq("due_date", today).eq("status", "pending");
      } else if (activeTab === "upcoming") {
        query = query.gt("due_date", today).eq("status", "pending");
      } else if (activeTab === "overdue") {
        query = query.lt("due_date", today).eq("status", "pending");
      } else if (activeTab === "completed") {
        query = query.eq("status", "completed");
      }

      // Apply additional filters
      if (taskTypeFilter !== "all") {
        query = query.eq("task_type", taskTypeFilter);
      }
      if (assignedToFilter !== "all") {
        query = query.eq("assigned_to", assignedToFilter);
      }

      // Sort
      if (activeTab === "completed") {
        query = query.order("updated_at", { ascending: false });
      } else {
        query = query.order("due_date", { ascending: true });
      }

      const { data, error } = await query;

      if (error) throw error;

      const tasksWithDetails = (data || []).map((task) => ({
        ...task,
        lead_name: task.lead?.name || "Unknown Lead",
        assigned_name: task.assigned_profile?.full_name || "Unassigned",
        is_overdue: task.status === "pending" && task.due_date < today,
      }));

      setTasks(tasksWithDetails);
    } catch (error) {
      console.error("Error fetching tasks:", error);
      toast({
        title: "Error",
        description: "Failed to load tasks",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchLeads = async () => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("leads")
        .select("id, name")
        .order("name", { ascending: true });

      if (error) throw error;
      setLeads(data || []);
    } catch (error) {
      console.error("Error fetching leads:", error);
    }
  };

  const fetchProfiles = async () => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name")
        .order("full_name", { ascending: true });

      if (error) throw error;
      setProfiles(data || []);
    } catch (error) {
      console.error("Error fetching profiles:", error);
    }
  };

  const handleAddTask = async () => {
    if (!formData.title || !formData.lead_id || !formData.task_type || !formData.due_date) {
      toast({
        title: "Validation Error",
        description: "Please fill all required fields",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);

    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();

      const { data, error } = await supabase
        .from("tasks")
        .insert({
          title: formData.title,
          lead_id: formData.lead_id,
          task_type: formData.task_type,
          due_date: formData.due_date,
          assigned_to: formData.assigned_to || currentUserId,
          notes: formData.notes,
          status: "pending",
          source: "manual",
          created_by: session?.user?.id,
        })
        .select(`
          *,
          lead:leads(id, name),
          assigned_profile:profiles!tasks_assigned_to_fkey(id, full_name)
        `)
        .single();

      if (error) throw error;

      // Optimistic UI update
      const newTask = {
        ...data,
        lead_name: data.lead?.name || "Unknown Lead",
        assigned_name: data.assigned_profile?.full_name || "Unassigned",
        is_overdue: false,
      };
      setTasks([newTask, ...tasks]);

      toast({
        title: "Success",
        description: "Task created successfully",
      });

      setShowAddTask(false);
      setFormData({
        title: "",
        lead_id: "",
        task_type: "",
        due_date: "",
        assigned_to: currentUserId || "",
        notes: "",
      });
    } catch (error) {
      console.error("Error creating task:", error);
      toast({
        title: "Error",
        description: "Failed to create task",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCompleteTask = async (taskId: string) => {
    try {
      const supabase = createClient();
      await supabase
        .from("tasks")
        .update({ status: "completed", updated_at: new Date().toISOString() })
        .eq("id", taskId);

      // Optimistic UI update
      setTasks(tasks.filter((t) => t.id !== taskId));

      toast({
        title: "Success",
        description: "Task marked as complete",
      });
    } catch (error) {
      console.error("Error completing task:", error);
      toast({
        title: "Error",
        description: "Failed to complete task",
        variant: "destructive",
      });
    }
  };

  const handleReschedule = async (taskId: string, newDate: Date) => {
    try {
      const supabase = createClient();
      const formattedDate = format(newDate, "yyyy-MM-dd");

      await supabase
        .from("tasks")
        .update({ due_date: formattedDate, updated_at: new Date().toISOString() })
        .eq("id", taskId);

      // Optimistic UI update
      setTasks(
        tasks.map((t) =>
          t.id === taskId ? { ...t, due_date: formattedDate } : t
        )
      );

      toast({
        title: "Success",
        description: "Task rescheduled",
      });

      setReschedulingTask(null);
      setNewDueDate(undefined);
    } catch (error) {
      console.error("Error rescheduling task:", error);
      toast({
        title: "Error",
        description: "Failed to reschedule task",
        variant: "destructive",
      });
    }
  };

  const handleLeadClick = (leadId: string) => {
    router.push(`/leads/${leadId}`);
  };

  const getStatusBadge = (task: any) => {
    if (task.is_overdue) {
      return <Badge className="bg-red-100 text-red-700 border-red-300 text-xs">Overdue</Badge>;
    }
    if (task.status === "completed") {
      return <Badge className="bg-teal-100 text-teal-700 border-teal-300 text-xs">Completed</Badge>;
    }
    return <Badge variant="outline" className="text-xs">Pending</Badge>;
  };

  const getSourceBadge = (source: string) => {
    if (source === "campaign") {
      return <Badge className="bg-[#1B3A5C] text-white text-xs">Campaign</Badge>;
    }
    if (source === "system") {
      return <Badge className="bg-[#E87722] text-white text-xs">System</Badge>;
    }
    return <Badge variant="outline" className="text-xs">Manual</Badge>;
  };

  const getEmptyMessage = () => {
    switch (activeTab) {
      case "today":
        return "No tasks due today 🎉";
      case "upcoming":
        return "No upcoming tasks";
      case "overdue":
        return "No overdue tasks 🎉";
      case "completed":
        return "No completed tasks yet";
      default:
        return "No tasks found";
    }
  };

  // Get unique task types from tasks
  const taskTypes = ["all", ...new Set(tasks.map((t) => t.task_type).filter(Boolean))];

  return (
    <DashboardLayout>
      <div className="p-6">
        {/* Page Header */}
        <div className="mb-6">
          <div className="flex items-start justify-between mb-2">
            <div>
              <h1 className="text-3xl font-bold text-[#1B3A5C]">Tasks</h1>
              <p className="text-gray-600 mt-1">Manage and track your tasks</p>
            </div>
            <Button
              onClick={() => setShowAddTask(true)}
              className="bg-[#E87722] hover:bg-[#d66a1e] text-white"
            >
              + Add Task
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-6 space-y-4">
          {/* Tab Filters */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="today">Today</TabsTrigger>
              <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
              <TabsTrigger value="overdue">Overdue</TabsTrigger>
              <TabsTrigger value="completed">Completed</TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Additional Filters */}
          <div className="flex gap-4">
            <Select value={taskTypeFilter} onValueChange={setTaskTypeFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Task Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {taskTypes
                  .filter((type) => type !== "all")
                  .map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>

            <Select value={assignedToFilter} onValueChange={setAssignedToFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Assigned To" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Assignees</SelectItem>
                {profiles.map((profile) => (
                  <SelectItem key={profile.id} value={profile.id}>
                    {profile.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Task Table */}
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-6 space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : tasks.length === 0 ? (
              <div className="p-12 text-center text-gray-500">{getEmptyMessage()}</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Title
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Lead
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Task Type
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Due Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Assigned To
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Source
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {tasks.map((task) => (
                      <tr
                        key={task.id}
                        className={cn(
                          "hover:bg-gray-50",
                          task.is_overdue && activeTab === "overdue" && "bg-red-50"
                        )}
                      >
                        <td className="px-6 py-4">
                          <div className="font-medium text-[#1B3A5C]">{task.title}</div>
                        </td>
                        <td className="px-6 py-4">
                          <button
                            onClick={() => handleLeadClick(task.lead_id)}
                            className="text-[#E87722] hover:underline"
                          >
                            {task.lead_name}
                          </button>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">{task.task_type}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {format(new Date(task.due_date), "MMM d, yyyy")}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">{task.assigned_name}</td>
                        <td className="px-6 py-4">{getSourceBadge(task.source)}</td>
                        <td className="px-6 py-4">{getStatusBadge(task)}</td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            {task.status === "pending" && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleCompleteTask(task.id)}
                                  className="text-teal-600 hover:text-teal-700 hover:bg-teal-50"
                                >
                                  <CheckCircle2 className="h-4 w-4" />
                                </Button>
                                <Popover
                                  open={reschedulingTask === task.id}
                                  onOpenChange={(open) =>
                                    setReschedulingTask(open ? task.id : null)
                                  }
                                >
                                  <PopoverTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="text-[#1B3A5C] hover:text-[#152d47] hover:bg-[#1B3A5C]/5"
                                    >
                                      <CalendarIcon className="h-4 w-4" />
                                    </Button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-auto p-0" align="end">
                                    <Calendar
                                      mode="single"
                                      selected={newDueDate}
                                      onSelect={(date) => {
                                        if (date) {
                                          handleReschedule(task.id, date);
                                        }
                                      }}
                                      disabled={(date) =>
                                        date < new Date(new Date().setHours(0, 0, 0, 0))
                                      }
                                      initialFocus
                                    />
                                  </PopoverContent>
                                </Popover>
                              </>
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

      {/* Add Task Dialog */}
      <Dialog open={showAddTask} onOpenChange={setShowAddTask}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add New Task</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="task-title">Title *</Label>
              <Input
                id="task-title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Enter task title"
              />
            </div>

            <div>
              <Label htmlFor="task-lead">Lead *</Label>
              <Select value={formData.lead_id} onValueChange={(value) => setFormData({ ...formData, lead_id: value })}>
                <SelectTrigger id="task-lead">
                  <SelectValue placeholder="Select lead" />
                </SelectTrigger>
                <SelectContent>
                  {leads.map((lead) => (
                    <SelectItem key={lead.id} value={lead.id}>
                      {lead.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="task-type">Task Type *</Label>
              <Select value={formData.task_type} onValueChange={(value) => setFormData({ ...formData, task_type: value })}>
                <SelectTrigger id="task-type">
                  <SelectValue placeholder="Select task type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Call">Call</SelectItem>
                  <SelectItem value="Email">Email</SelectItem>
                  <SelectItem value="Follow-up">Follow-up</SelectItem>
                  <SelectItem value="Meeting">Meeting</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Due Date */}
            <div>
              <Label htmlFor="due_date">Due Date *</Label>
              <input
                type="date"
                id="due_date"
                value={formData.due_date || ""}
                onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                className="w-full border rounded-md px-3 py-2 text-sm"
                min={new Date().toISOString().split("T")[0]}
              />
            </div>

            <div>
              <Label htmlFor="task-assigned">Assigned To</Label>
              <Select value={formData.assigned_to} onValueChange={(value) => setFormData({ ...formData, assigned_to: value })}>
                <SelectTrigger id="task-assigned">
                  <SelectValue placeholder="Select assignee" />
                </SelectTrigger>
                <SelectContent>
                  {currentUserId && (
                    <SelectItem value={currentUserId}>Assign to me</SelectItem>
                  )}
                  {profiles
                    .filter((p) => p.id !== currentUserId)
                    .map((profile) => (
                      <SelectItem key={profile.id} value={profile.id}>
                        {profile.full_name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="task-notes">Notes (Optional)</Label>
              <Textarea
                id="task-notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Add any additional notes..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddTask(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAddTask}
              disabled={saving || !formData.title || !formData.lead_id || !formData.task_type || !formData.due_date}
              className="bg-[#E87722] hover:bg-[#d66a1e] text-white"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Add Task"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}