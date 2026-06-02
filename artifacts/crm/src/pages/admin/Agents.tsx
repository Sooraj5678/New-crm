import { useState } from "react";
import { useListUsers, useCreateUser, useToggleBlockUser, useDeleteUser, getListUsersQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, MoreVertical, ShieldBan, Trash2, Loader2, Users } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";

export default function Agents() {
  const qc = useQueryClient();
  const { data: users, isLoading } = useListUsers();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", phone: "" });
  const [openMenu, setOpenMenu] = useState<number | null>(null);

  const createMutation = useCreateUser({
    mutation: {
      onSuccess() {
        qc.invalidateQueries({ queryKey: getListUsersQueryKey() });
        setShowCreate(false);
        setForm({ name: "", email: "", password: "", phone: "" });
        toast.success("Agent created successfully");
      },
      onError() { toast.error("Failed to create agent"); },
    },
  });

  const blockMutation = useToggleBlockUser({
    mutation: {
      onSuccess(data) {
        qc.invalidateQueries({ queryKey: getListUsersQueryKey() });
        toast.success(data.isBlocked ? "Agent blocked" : "Agent unblocked");
      },
      onError() { toast.error("Failed to update agent"); },
    },
  });

  const deleteMutation = useDeleteUser({
    mutation: {
      onSuccess() {
        qc.invalidateQueries({ queryKey: getListUsersQueryKey() });
        toast.success("Agent deleted");
      },
      onError() { toast.error("Failed to delete agent"); },
    },
  });

  const agents = users?.filter(u => u.role === "agent") ?? [];

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.password) { toast.error("Name, email, and password are required"); return; }
    createMutation.mutate({ data: { name: form.name, email: form.email, password: form.password, role: "agent", phone: form.phone } });
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Agents</h1>
          <p className="text-muted-foreground text-sm mt-1">{agents.length} agents registered</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
          <Plus size={16} /> New Agent
        </button>
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card border border-card-border rounded-xl w-full max-w-md p-6">
            <h2 className="font-bold text-foreground text-lg mb-4">Create New Agent</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              {[
                { key: "name", label: "Full Name", type: "text", placeholder: "John Doe" },
                { key: "email", label: "Email", type: "email", placeholder: "john@company.com" },
                { key: "password", label: "Password", type: "password", placeholder: "Min 8 characters" },
                { key: "phone", label: "Phone (optional)", type: "tel", placeholder: "+91 9876543210" },
              ].map(field => (
                <div key={field.key}>
                  <label className="block text-sm font-medium text-foreground mb-1.5">{field.label}</label>
                  <input
                    type={field.type}
                    value={form[field.key as keyof typeof form]}
                    onChange={e => setForm(f => ({ ...f, [field.key]: e.target.value }))}
                    placeholder={field.placeholder}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm"
                  />
                </div>
              ))}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowCreate(false)} className="flex-1 px-4 py-2.5 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors">Cancel</button>
                <button type="submit" disabled={createMutation.isPending} className="flex-1 flex items-center justify-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-60">
                  {createMutation.isPending && <Loader2 size={14} className="animate-spin" />}
                  Create Agent
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center h-64 text-muted-foreground">
          <Loader2 size={24} className="animate-spin mr-2" /> Loading...
        </div>
      ) : agents.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
          <Users size={40} className="mb-3 opacity-30" />
          <p className="font-medium">No agents yet</p>
          <p className="text-sm mt-1">Create your first agent to get started</p>
        </div>
      ) : (
        <div className="bg-card border border-card-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Name</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Email</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Phone</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Joined</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {agents.map(agent => (
                <tr key={agent.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold flex-shrink-0">
                        {agent.name?.charAt(0)?.toUpperCase()}
                      </div>
                      <span className="font-medium text-foreground">{agent.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{agent.email}</td>
                  <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">{agent.phone ?? "-"}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${agent.isBlocked ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"}`}>
                      {agent.isBlocked ? "Blocked" : "Active"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{formatDate(agent.createdAt)}</td>
                  <td className="px-4 py-3">
                    <div className="relative">
                      <button onClick={() => setOpenMenu(openMenu === agent.id ? null : agent.id)} className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground">
                        <MoreVertical size={16} />
                      </button>
                      {openMenu === agent.id && (
                        <>
                          <div className="fixed inset-0 z-10" onClick={() => setOpenMenu(null)} />
                          <div className="absolute right-0 top-8 z-20 w-44 bg-card border border-border rounded-lg shadow-lg overflow-hidden">
                            <button
                              onClick={() => { blockMutation.mutate({ id: agent.id }); setOpenMenu(null); }}
                              className="flex items-center gap-2 w-full px-3 py-2.5 text-sm hover:bg-muted transition-colors text-left"
                            >
                              <ShieldBan size={14} className={agent.isBlocked ? "text-green-500" : "text-amber-500"} />
                              {agent.isBlocked ? "Unblock Agent" : "Block Agent"}
                            </button>
                            <button
                              onClick={() => { if (confirm("Delete this agent?")) { deleteMutation.mutate({ id: agent.id }); setOpenMenu(null); } }}
                              className="flex items-center gap-2 w-full px-3 py-2.5 text-sm hover:bg-muted transition-colors text-left text-destructive"
                            >
                              <Trash2 size={14} />
                              Delete Agent
                            </button>
                          </div>
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
    </div>
  );
}
