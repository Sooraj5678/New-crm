import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUpdateUser } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { getAuthHeaders } from "@/lib/apiClient";
import { Loader2, User, Lock, Building2, Plus, Trash2, Pencil, Check, X } from "lucide-react";
import { toast } from "sonner";

const API_BASE = (import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");
const API = `${API_BASE}/api`;
function apiGet(path: string) {
  return fetch(`${API}${path}`, { headers: { ...getAuthHeaders() } }).then(r => r.json());
}
function apiPost(path: string, body: unknown) {
  return fetch(`${API}${path}`, {
    method: "POST", headers: { "Content-Type": "application/json", ...getAuthHeaders() }, body: JSON.stringify(body),
  }).then(r => r.json());
}
function apiPatch(path: string, body: unknown) {
  return fetch(`${API}${path}`, {
    method: "PATCH", headers: { "Content-Type": "application/json", ...getAuthHeaders() }, body: JSON.stringify(body),
  }).then(r => r.json());
}
function apiDelete(path: string) {
  return fetch(`${API}${path}`, { method: "DELETE", headers: { ...getAuthHeaders() } }).then(r => r.json());
}

interface Partner { id: number; name: string; code: string | null; isActive: boolean; createdAt: string }

function PartnersSection() {
  const qc = useQueryClient();
  const [newName, setNewName] = useState("");
  const [newCode, setNewCode] = useState("");
  const [editId, setEditId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");

  const { data: partners = [], isLoading } = useQuery<Partner[]>({
    queryKey: ["partners"], queryFn: () => apiGet("/partners"),
  });

  const createMutation = useMutation({
    mutationFn: () => apiPost("/partners", { name: newName.trim(), code: newCode.trim() || null }),
    onSuccess(data) {
      if (data.error) { toast.error(data.error); return; }
      qc.invalidateQueries({ queryKey: ["partners"] });
      setNewName(""); setNewCode("");
      toast.success("Partner created");
    },
    onError() { toast.error("Failed to create partner"); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) => apiPatch(`/partners/${id}`, { name }),
    onSuccess(data) {
      if (data.error) { toast.error(data.error); return; }
      qc.invalidateQueries({ queryKey: ["partners"] });
      setEditId(null);
      toast.success("Partner updated");
    },
    onError() { toast.error("Failed to update partner"); },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) => apiPatch(`/partners/${id}`, { isActive }),
    onSuccess() { qc.invalidateQueries({ queryKey: ["partners"] }); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiDelete(`/partners/${id}`),
    onSuccess() { qc.invalidateQueries({ queryKey: ["partners"] }); toast.success("Partner deleted"); },
    onError() { toast.error("Failed to delete partner"); },
  });

  return (
    <div className="bg-card border border-card-border rounded-xl p-6">
      <h2 className="font-semibold text-foreground mb-1 flex items-center gap-2"><Building2 size={16} /> Partners</h2>
      <p className="text-xs text-muted-foreground mb-4">Manage partner organizations for lead bulk uploads</p>

      <div className="flex gap-2 mb-4">
        <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Partner name"
          className="flex-1 px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
        <input value={newCode} onChange={e => setNewCode(e.target.value)} placeholder="Code (optional)"
          className="w-32 px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
        <button onClick={() => { if (!newName.trim()) { toast.error("Name required"); return; } createMutation.mutate(); }}
          disabled={createMutation.isPending}
          className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm hover:bg-primary/90 disabled:opacity-60">
          {createMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
          Add
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-6"><Loader2 size={20} className="animate-spin text-muted-foreground" /></div>
      ) : partners.length === 0 ? (
        <div className="text-center py-8 text-sm text-muted-foreground border border-dashed border-border rounded-lg">No partners yet</div>
      ) : (
        <div className="divide-y divide-border border border-border rounded-lg overflow-hidden">
          {partners.map(p => (
            <div key={p.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/20">
              <div className={`w-2 h-2 rounded-full ${p.isActive ? "bg-green-500" : "bg-muted-foreground/40"}`} />
              {editId === p.id ? (
                <>
                  <input value={editName} onChange={e => setEditName(e.target.value)} autoFocus
                    className="flex-1 px-2 py-1 text-sm border border-input rounded bg-background focus:outline-none focus:ring-1 focus:ring-ring" />
                  <button onClick={() => updateMutation.mutate({ id: p.id, name: editName })} disabled={updateMutation.isPending}
                    className="p-1 text-green-600 hover:text-green-700"><Check size={14} /></button>
                  <button onClick={() => setEditId(null)} className="p-1 text-muted-foreground hover:text-foreground"><X size={14} /></button>
                </>
              ) : (
                <>
                  <div className="flex-1">
                    <span className="text-sm font-medium text-foreground">{p.name}</span>
                    {p.code && <span className="ml-2 text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{p.code}</span>}
                  </div>
                  <button onClick={() => toggleMutation.mutate({ id: p.id, isActive: !p.isActive })}
                    className={`text-xs px-2 py-0.5 rounded-full ${p.isActive ? "bg-green-100 dark:bg-green-950/30 text-green-700 dark:text-green-400" : "bg-muted text-muted-foreground"}`}>
                    {p.isActive ? "Active" : "Inactive"}
                  </button>
                  <button onClick={() => { setEditId(p.id); setEditName(p.name); }} className="p-1 text-muted-foreground hover:text-foreground">
                    <Pencil size={13} />
                  </button>
                  <button onClick={() => deleteMutation.mutate(p.id)} disabled={deleteMutation.isPending} className="p-1 text-destructive/70 hover:text-destructive">
                    <Trash2 size={13} />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Settings() {
  const { user, isAdmin } = useAuth();
  const [form, setForm] = useState({ name: user?.name ?? "", email: user?.email ?? "", phone: user?.phone ?? "" });
  const [pwForm, setPwForm] = useState({ password: "", confirmPassword: "" });

  const updateMutation = useUpdateUser({
    mutation: {
      onSuccess() { toast.success("Profile updated successfully"); },
      onError() { toast.error("Failed to update profile"); },
    },
  });

  const handleProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    updateMutation.mutate({ id: user.id, data: { name: form.name, email: form.email, phone: form.phone } });
  };

  const handlePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (pwForm.password !== pwForm.confirmPassword) { toast.error("Passwords don't match"); return; }
    if (pwForm.password.length < 6) { toast.error("Password must be at least 6 characters"); return; }
    if (!user) return;
    updateMutation.mutate({ id: user.id, data: { password: pwForm.password } }, {
      onSuccess() { toast.success("Password updated"); setPwForm({ password: "", confirmPassword: "" }); },
    });
  };

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">Manage your account and system configuration</p>
      </div>

      <div className="bg-card border border-card-border rounded-xl p-6">
        <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2"><User size={16} /> Profile Information</h2>
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary text-2xl font-bold">
            {user?.name?.charAt(0)?.toUpperCase()}
          </div>
          <div>
            <div className="font-semibold text-foreground">{user?.name}</div>
            <div className="text-sm text-muted-foreground capitalize">{user?.role}</div>
          </div>
        </div>
        <form onSubmit={handleProfile} className="space-y-4">
          {[
            { key: "name", label: "Full Name", type: "text" },
            { key: "email", label: "Email Address", type: "email" },
            { key: "phone", label: "Phone Number", type: "tel" },
          ].map(field => (
            <div key={field.key}>
              <label className="block text-sm font-medium text-foreground mb-1.5">{field.label}</label>
              <input
                type={field.type}
                value={form[field.key as keyof typeof form]}
                onChange={e => setForm(f => ({ ...f, [field.key]: e.target.value }))}
                className="w-full px-3.5 py-2.5 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm"
              />
            </div>
          ))}
          <button type="submit" disabled={updateMutation.isPending} className="flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-60">
            {updateMutation.isPending && <Loader2 size={14} className="animate-spin" />}
            Save Changes
          </button>
        </form>
      </div>

      <div className="bg-card border border-card-border rounded-xl p-6">
        <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2"><Lock size={16} /> Change Password</h2>
        <form onSubmit={handlePassword} className="space-y-4">
          {[
            { key: "password", label: "New Password" },
            { key: "confirmPassword", label: "Confirm Password" },
          ].map(field => (
            <div key={field.key}>
              <label className="block text-sm font-medium text-foreground mb-1.5">{field.label}</label>
              <input
                type="password"
                value={pwForm[field.key as keyof typeof pwForm]}
                onChange={e => setPwForm(f => ({ ...f, [field.key]: e.target.value }))}
                className="w-full px-3.5 py-2.5 rounded-lg border border-input bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm"
              />
            </div>
          ))}
          <button type="submit" disabled={updateMutation.isPending} className="flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-60">
            {updateMutation.isPending && <Loader2 size={14} className="animate-spin" />}
            Update Password
          </button>
        </form>
      </div>

      {isAdmin && <PartnersSection />}
    </div>
  );
}
