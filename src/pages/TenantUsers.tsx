import { useState } from "react";
import { useParams } from "react-router-dom";
import { TenantLayout } from "@/components/layout/TenantLayout";
import { useTenantUsers, useSearchUsers } from "@/hooks/useTenants";
import { useTenantPermissions } from "@/hooks/useTenantPermissions";
import { useTenant } from "@/hooks/useTenants";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, MoreVertical, UserPlus, Shield, Eye, Settings, UserMinus, Loader2 } from "lucide-react";
import type { TenantRole } from "@/lib/types";

const roleColors: Record<TenantRole, string> = {
  admin: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  manager: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  viewer: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
};

const roleIcons: Record<TenantRole, typeof Shield> = {
  admin: Shield,
  manager: Settings,
  viewer: Eye,
};

const roleDescriptions: Record<TenantRole, string> = {
  admin: "Full access - can manage users and servers",
  manager: "Can add and manage Proxmox servers",
  viewer: "Read-only access to dashboards and VMs",
};

function RoleBadge({ role }: { role: TenantRole }) {
  const Icon = roleIcons[role];
  return (
    <Badge variant="secondary" className={roleColors[role]}>
      <Icon className="h-3 w-3 mr-1" />
      {role.charAt(0).toUpperCase() + role.slice(1)}
    </Badge>
  );
}

function AddUserDialog({ tenantId }: { tenantId: string }) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<TenantRole>("viewer");
  
  const { data: searchResults, isLoading: isSearching } = useSearchUsers(tenantId, searchQuery);
  const { assignUser } = useTenantUsers(tenantId);

  const handleAssign = () => {
    if (!selectedUserId) return;
    assignUser.mutate(
      { userId: selectedUserId, role: selectedRole },
      {
        onSuccess: () => {
          setOpen(false);
          setSearchQuery("");
          setSelectedUserId(null);
          setSelectedRole("viewer");
        },
      }
    );
  };

  const selectedUser = searchResults?.find(u => u.id === selectedUserId);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <UserPlus className="h-4 w-4 mr-2" />
          Add User
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add User to Tenant</DialogTitle>
          <DialogDescription>
            Search for a user by email or name and assign them a role.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="search">Search User</Label>
            <Input
              id="search"
              placeholder="Search by email or name..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setSelectedUserId(null);
              }}
            />
            {isSearching && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Searching...
              </div>
            )}
            {searchResults && searchResults.length > 0 && !selectedUserId && (
              <div className="border rounded-md max-h-40 overflow-auto">
                {searchResults.map((user) => (
                  <button
                    key={user.id}
                    className="w-full flex items-center gap-3 p-2 hover:bg-muted text-left"
                    onClick={() => setSelectedUserId(user.id)}
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={user.avatar_url || undefined} />
                      <AvatarFallback>
                        {(user.full_name || user.email)?.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {user.full_name || user.username || "Unknown"}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
            {searchQuery.length >= 2 && !isSearching && searchResults?.length === 0 && (
              <p className="text-sm text-muted-foreground">No users found</p>
            )}
          </div>

          {selectedUser && (
            <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
              <Avatar className="h-10 w-10">
                <AvatarImage src={selectedUser.avatar_url || undefined} />
                <AvatarFallback>
                  {(selectedUser.full_name || selectedUser.email)?.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <p className="font-medium">{selectedUser.full_name || selectedUser.username || "Unknown"}</p>
                <p className="text-sm text-muted-foreground">{selectedUser.email}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedUserId(null)}
              >
                Change
              </Button>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="role">Role</Label>
            <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as TenantRole)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="viewer">
                  <div className="flex items-center gap-2">
                    <Eye className="h-4 w-4" />
                    <div>
                      <p>Viewer</p>
                      <p className="text-xs text-muted-foreground">Read-only access</p>
                    </div>
                  </div>
                </SelectItem>
                <SelectItem value="manager">
                  <div className="flex items-center gap-2">
                    <Settings className="h-4 w-4" />
                    <div>
                      <p>Manager</p>
                      <p className="text-xs text-muted-foreground">Can manage servers</p>
                    </div>
                  </div>
                </SelectItem>
                <SelectItem value="admin">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    <div>
                      <p>Admin</p>
                      <p className="text-xs text-muted-foreground">Full access</p>
                    </div>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{roleDescriptions[selectedRole]}</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleAssign} 
            disabled={!selectedUserId || assignUser.isPending}
          >
            {assignUser.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Add User
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function TenantUsers() {
  const { tenantId } = useParams<{ tenantId: string }>();
  const { data: tenant } = useTenant(tenantId);
  const { users, isLoading, updateUserRole, removeUser } = useTenantUsers(tenantId);
  const { canManageUsers } = useTenantPermissions(tenantId);
  
  const [userToRemove, setUserToRemove] = useState<{ id: string; name: string } | null>(null);

  const handleChangeRole = (userId: string, newRole: TenantRole) => {
    updateUserRole.mutate({ userId, role: newRole });
  };

  const handleRemoveUser = () => {
    if (userToRemove) {
      removeUser.mutate(userToRemove.id, {
        onSuccess: () => setUserToRemove(null),
      });
    }
  };

  return (
    <TenantLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Team Members</h1>
            <p className="text-muted-foreground">
              Manage who has access to {tenant?.name || "this tenant"}
            </p>
          </div>
          {canManageUsers && tenantId && <AddUserDialog tenantId={tenantId} />}
        </div>

        {/* Users Table */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-4 p-4 border rounded-lg">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
                <Skeleton className="h-6 w-20" />
              </div>
            ))}
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-12 border rounded-lg bg-muted/30">
            <UserPlus className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No team members yet</h3>
            <p className="text-muted-foreground mb-4">
              Add users to give them access to this tenant's resources.
            </p>
            {canManageUsers && tenantId && <AddUserDialog tenantId={tenantId} />}
          </div>
        ) : (
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Added</TableHead>
                  {canManageUsers && <TableHead className="w-12"></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((assignment) => {
                  const profile = assignment.profiles;
                  return (
                    <TableRow key={assignment.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={profile?.avatar_url || undefined} />
                            <AvatarFallback>
                              {(profile?.full_name || profile?.email)?.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium">
                            {profile?.full_name || profile?.username || "Unknown"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {profile?.email}
                      </TableCell>
                      <TableCell>
                        <RoleBadge role={assignment.role as TenantRole} />
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(assignment.created_at).toLocaleDateString()}
                      </TableCell>
                      {canManageUsers && (
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Change Role</DropdownMenuLabel>
                              <DropdownMenuItem
                                onClick={() => handleChangeRole(assignment.user_id, "admin")}
                                disabled={assignment.role === "admin"}
                              >
                                <Shield className="h-4 w-4 mr-2" />
                                Make Admin
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleChangeRole(assignment.user_id, "manager")}
                                disabled={assignment.role === "manager"}
                              >
                                <Settings className="h-4 w-4 mr-2" />
                                Make Manager
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleChangeRole(assignment.user_id, "viewer")}
                                disabled={assignment.role === "viewer"}
                              >
                                <Eye className="h-4 w-4 mr-2" />
                                Make Viewer
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => setUserToRemove({
                                  id: assignment.user_id,
                                  name: profile?.full_name || profile?.email || "this user",
                                })}
                              >
                                <UserMinus className="h-4 w-4 mr-2" />
                                Remove from Tenant
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Remove User Confirmation */}
      <AlertDialog open={!!userToRemove} onOpenChange={() => setUserToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove {userToRemove?.name} from this tenant?
              They will lose access to all resources.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveUser}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {removeUser.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TenantLayout>
  );
}
