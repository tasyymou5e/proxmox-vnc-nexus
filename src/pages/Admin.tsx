import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { Users, Plus, Trash2, Server, Shield, ShieldCheck, ShieldOff, UserX } from "lucide-react";
import type { UserProfile, VMAssignment } from "@/lib/types";

const SUPABASE_URL = "https://lbfabewnshfjdjfosqxl.supabase.co";

interface UserWithRole extends UserProfile {
  role: "admin" | "user";
}

export default function Admin() {
  const { isAdmin } = useAuth();
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [assignments, setAssignments] = useState<VMAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [newAssignment, setNewAssignment] = useState({
    vmId: "",
    nodeName: "",
    vmName: "",
    permissions: ["view", "console"],
  });
  const [roleChangeUser, setRoleChangeUser] = useState<UserWithRole | null>(null);
  const [roleChangeLoading, setRoleChangeLoading] = useState(false);
  const [deleteUser, setDeleteUser] = useState<UserWithRole | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    if (isAdmin) {
      fetchData();
    }
  }, [isAdmin]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: profiles } = await supabase.from("profiles").select("*");
      const { data: roles } = await supabase.from("user_roles").select("*");

      const usersWithRoles: UserWithRole[] = (profiles || []).map((profile) => {
        const userRole = roles?.find((r) => r.user_id === profile.id);
        return {
          ...profile,
          role: (userRole?.role as "admin" | "user") || "user",
        };
      });

      setUsers(usersWithRoles);

      const { data: allAssignments } = await supabase
        .from("user_vm_assignments")
        .select("*");

      setAssignments(allAssignments || []);
    } catch (error) {
      console.error("Failed to fetch admin data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddAssignment = async () => {
    if (!selectedUser || !newAssignment.vmId || !newAssignment.nodeName) {
      toast({
        title: "Missing fields",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase.from("user_vm_assignments").insert({
        user_id: selectedUser,
        vm_id: parseInt(newAssignment.vmId),
        node_name: newAssignment.nodeName,
        vm_name: newAssignment.vmName || null,
        permissions: newAssignment.permissions,
      });

      if (error) throw error;

      toast({
        title: "Assignment created",
        description: "VM has been assigned to the user",
      });

      setShowAssignDialog(false);
      setNewAssignment({
        vmId: "",
        nodeName: "",
        vmName: "",
        permissions: ["view", "console"],
      });
      setSelectedUser(null);
      fetchData();
    } catch (error) {
      toast({
        title: "Failed to create assignment",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  const handleDeleteAssignment = async (assignmentId: string) => {
    try {
      const { error } = await supabase
        .from("user_vm_assignments")
        .delete()
        .eq("id", assignmentId);

      if (error) throw error;

      toast({
        title: "Assignment removed",
        description: "VM assignment has been removed",
      });

      fetchData();
    } catch (error) {
      toast({
        title: "Failed to remove assignment",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  const togglePermission = (permission: string) => {
    setNewAssignment((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(permission)
        ? prev.permissions.filter((p) => p !== permission)
        : [...prev.permissions, permission],
    }));
  };

  const handleRoleChange = async () => {
    if (!roleChangeUser) return;

    setRoleChangeLoading(true);
    try {
      const newRole = roleChangeUser.role === "admin" ? "user" : "admin";

      const { error } = await supabase
        .from("user_roles")
        .update({ role: newRole })
        .eq("user_id", roleChangeUser.id);

      if (error) throw error;

      toast({
        title: "Role updated",
        description: `${roleChangeUser.email} is now a${newRole === "admin" ? "n" : ""} ${newRole}`,
      });

      setRoleChangeUser(null);
      fetchData();
    } catch (error) {
      toast({
        title: "Failed to update role",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setRoleChangeLoading(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteUser) return;

    setDeleteLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/delete-user`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ userId: deleteUser.id }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to delete user");
      }

      toast({
        title: "User deleted",
        description: `${deleteUser.email} has been permanently deleted`,
      });

      setDeleteUser(null);
      fetchData();
    } catch (error) {
      toast({
        title: "Failed to delete user",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setDeleteLoading(false);
    }
  };

  if (!isAdmin) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <Shield className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
            <p className="text-muted-foreground">
              You don't have permission to access this page.
            </p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Admin Panel</h1>
          <p className="text-muted-foreground">
            Manage users and VM assignments
          </p>
        </div>

        {/* Users */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Users
            </CardTitle>
            <CardDescription>
              View all registered users and their roles
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.email}</TableCell>
                      <TableCell>{user.full_name || "-"}</TableCell>
                      <TableCell>
                        <Badge
                          variant={user.role === "admin" ? "default" : "secondary"}
                        >
                          {user.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {new Date(user.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant={user.role === "admin" ? "outline" : "default"}
                            size="sm"
                            onClick={() => setRoleChangeUser(user)}
                          >
                            {user.role === "admin" ? (
                              <>
                                <ShieldOff className="h-4 w-4 mr-1" />
                                Demote
                              </>
                            ) : (
                              <>
                                <ShieldCheck className="h-4 w-4 mr-1" />
                                Promote
                              </>
                            )}
                          </Button>
                          <Dialog open={showAssignDialog && selectedUser === user.id}>
                            <DialogTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedUser(user.id);
                                  setShowAssignDialog(true);
                                }}
                              >
                                <Plus className="h-4 w-4 mr-1" />
                                Assign VM
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Assign VM to User</DialogTitle>
                                <DialogDescription>
                                  Assign a virtual machine to {user.email}
                                </DialogDescription>
                              </DialogHeader>
                              <div className="space-y-4">
                                <div className="space-y-2">
                                  <Label htmlFor="vmId">VM ID</Label>
                                  <Input
                                    id="vmId"
                                    type="number"
                                    placeholder="e.g., 100"
                                    value={newAssignment.vmId}
                                    onChange={(e) =>
                                      setNewAssignment((prev) => ({
                                        ...prev,
                                        vmId: e.target.value,
                                      }))
                                    }
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor="nodeName">Node Name</Label>
                                  <Input
                                    id="nodeName"
                                    placeholder="e.g., pve1"
                                    value={newAssignment.nodeName}
                                    onChange={(e) =>
                                      setNewAssignment((prev) => ({
                                        ...prev,
                                        nodeName: e.target.value,
                                      }))
                                    }
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor="vmName">VM Name (optional)</Label>
                                  <Input
                                    id="vmName"
                                    placeholder="e.g., web-server"
                                    value={newAssignment.vmName}
                                    onChange={(e) =>
                                      setNewAssignment((prev) => ({
                                        ...prev,
                                        vmName: e.target.value,
                                      }))
                                    }
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label>Permissions</Label>
                                  <div className="flex flex-wrap gap-4">
                                    {["view", "console", "start", "stop", "restart"].map(
                                      (perm) => (
                                        <div
                                          key={perm}
                                          className="flex items-center space-x-2"
                                        >
                                          <Checkbox
                                            id={perm}
                                            checked={newAssignment.permissions.includes(
                                              perm
                                            )}
                                            onCheckedChange={() =>
                                              togglePermission(perm)
                                            }
                                          />
                                          <Label htmlFor={perm} className="capitalize">
                                            {perm}
                                          </Label>
                                        </div>
                                      )
                                    )}
                                  </div>
                                </div>
                              </div>
                              <DialogFooter>
                                <Button
                                  variant="outline"
                                  onClick={() => {
                                    setShowAssignDialog(false);
                                    setSelectedUser(null);
                                  }}
                                >
                                  Cancel
                                </Button>
                                <Button onClick={handleAddAssignment}>
                                  Assign VM
                                </Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => setDeleteUser(user)}
                          >
                            <UserX className="h-4 w-4 mr-1" />
                            Delete
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* VM Assignments */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="h-5 w-5" />
              VM Assignments
            </CardTitle>
            <CardDescription>
              View and manage VM assignments for all users
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : assignments.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No VM assignments yet. Assign VMs to users from the Users table above.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>VM ID</TableHead>
                    <TableHead>Node</TableHead>
                    <TableHead>VM Name</TableHead>
                    <TableHead>Permissions</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assignments.map((assignment) => {
                    const user = users.find((u) => u.id === assignment.user_id);
                    return (
                      <TableRow key={assignment.id}>
                        <TableCell>{user?.email || "Unknown"}</TableCell>
                        <TableCell className="font-mono">{assignment.vm_id}</TableCell>
                        <TableCell>{assignment.node_name}</TableCell>
                        <TableCell>{assignment.vm_name || "-"}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {assignment.permissions.map((perm) => (
                              <Badge key={perm} variant="outline" className="text-xs">
                                {perm}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={() => handleDeleteAssignment(assignment.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Role Change Confirmation Dialog */}
        <AlertDialog open={!!roleChangeUser} onOpenChange={(open) => !open && setRoleChangeUser(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {roleChangeUser?.role === "admin" ? "Demote to User" : "Promote to Admin"}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {roleChangeUser?.role === "admin" ? (
                  <>
                    Are you sure you want to demote <strong>{roleChangeUser?.email}</strong> from Admin to User?
                    They will lose access to the admin panel and can only manage their assigned VMs.
                  </>
                ) : (
                  <>
                    Are you sure you want to promote <strong>{roleChangeUser?.email}</strong> to Admin?
                    They will have full access to manage all users and VMs.
                  </>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={roleChangeLoading}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleRoleChange}
                disabled={roleChangeLoading}
                className={roleChangeUser?.role === "admin" ? "bg-destructive hover:bg-destructive/90" : ""}
              >
                {roleChangeLoading ? "Updating..." : roleChangeUser?.role === "admin" ? "Demote" : "Promote"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Delete User Confirmation Dialog */}
        <AlertDialog open={!!deleteUser} onOpenChange={(open) => !open && setDeleteUser(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="text-destructive">Delete User Account</AlertDialogTitle>
              <AlertDialogDescription className="space-y-2">
                <p>
                  Are you sure you want to permanently delete <strong>{deleteUser?.email}</strong>?
                </p>
                <p className="font-medium">This action will:</p>
                <ul className="list-disc list-inside text-sm space-y-1">
                  <li>Remove all VM assignments for this user</li>
                  <li>Delete all connection session history</li>
                  <li>Remove their user role and profile</li>
                  <li>Permanently delete their authentication account</li>
                </ul>
                <p className="text-destructive font-medium">This action cannot be undone.</p>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleteLoading}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteUser}
                disabled={deleteLoading}
                className="bg-destructive hover:bg-destructive/90"
              >
                {deleteLoading ? "Deleting..." : "Delete User"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
}
