import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Users, UserMinus, Shield, Loader2, Search, Mail, Calendar, Trash2, KeyRound, ShieldAlert, ShieldCheck, UserCog, UserPlus, Eye, EyeOff, Clock } from 'lucide-react';

interface AdminDashboardProps {
  onClose: () => void;
  currentUser: any;
}

export function AdminDashboard({ onClose, currentUser }: AdminDashboardProps) {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  
  // Custom Confirmation & Toast State
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'danger' | 'warning' | 'info';
    onConfirm: () => Promise<void> | void;
  } | null>(null);

  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error';
  } | null>(null);

  // Set Password Modal State
  const [passwordModal, setPasswordModal] = useState<{
    isOpen: boolean;
    userId: number | null;
    username: string;
  }>({ isOpen: false, userId: null, username: '' });
  const [adminSetPasswordValue, setAdminSetPasswordValue] = useState('');

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  };
  
  // Add User Form State
  const [newUsername, setNewUsername] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState('user');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    const token = localStorage.getItem('rawverdict_token') || sessionStorage.getItem('rawverdict_token');
    try {
      const res = await fetch('/api/admin/users', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } catch (error) {
      console.error("Failed to fetch users", error);
      showToast("Failed to fetch users", 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Adding user:', { newUsername, newEmail, newRole });
    setIsAdding(true);
    const token = localStorage.getItem('rawverdict_token') || sessionStorage.getItem('rawverdict_token');
    
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({
          username: newUsername,
          email: newEmail,
          password: newPassword,
          role: newRole
        })
      });

      if (res.ok) {
        const newUser = await res.json();
        console.log('User added successfully:', newUser);
        setUsers([...users, { ...newUser, created_at: new Date().toISOString() }]);
        setShowAddForm(false);
        setNewUsername('');
        setNewEmail('');
        setNewPassword('');
        setNewRole('user');
        showToast("User added successfully", 'success');
      } else {
        const data = await res.json();
        console.error('Failed to add user:', data);
        showToast(data.error || "Failed to add user", 'error');
      }
    } catch (error) {
      console.error("Failed to add user (network error):", error);
      showToast("Network error while adding user", 'error');
    } finally {
      setIsAdding(false);
    }
  };

  const confirmDeleteUser = (id: number) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete User',
      message: 'Are you sure you want to delete this user and all their cards? This action cannot be undone.',
      type: 'danger',
      onConfirm: () => handleDeleteUser(id)
    });
  };

  const handleDeleteUser = async (id: number) => {
    console.log('Attempting to delete user:', id);
    setDeletingId(id);
    setConfirmModal(null); // Close modal

    const token = localStorage.getItem('rawverdict_token') || sessionStorage.getItem('rawverdict_token');
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        console.log('User deleted successfully:', id);
        setUsers(users.filter(u => u.id !== id));
        showToast("User deleted successfully", 'success');
      } else {
        const data = await res.json();
        console.error('Failed to delete user:', data);
        showToast(data.error || "Failed to delete user", 'error');
      }
    } catch (error) {
      console.error("Failed to delete user (network error):", error);
      showToast("Network error while deleting user", 'error');
    } finally {
      setDeletingId(null);
    }
  };

  const confirmToggleRole = (user: any) => {
    const newRole = user.role === 'admin' ? 'user' : 'admin';
    setConfirmModal({
      isOpen: true,
      title: 'Change User Role',
      message: `Are you sure you want to change ${user.username}'s role to ${newRole}?`,
      type: 'warning',
      onConfirm: () => handleToggleRole(user, newRole)
    });
  };

  const handleToggleRole = async (user: any, newRole: string) => {
    console.log(`Attempting to toggle role for ${user.username} to ${newRole}`);
    setActionLoading(`role-${user.id}`);
    setConfirmModal(null);

    const token = localStorage.getItem('rawverdict_token') || sessionStorage.getItem('rawverdict_token');
    try {
      const res = await fetch(`/api/admin/users/${user.id}/role`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ role: newRole })
      });
      if (res.ok) {
        console.log('Role updated successfully');
        setUsers(users.map(u => u.id === user.id ? { ...u, role: newRole } : u));
        showToast(`Role updated to ${newRole}`, 'success');
      } else {
        const data = await res.json();
        console.error('Failed to update role:', data);
        showToast(data.error || "Failed to update role", 'error');
      }
    } catch (error) {
      console.error("Failed to update role (network error):", error);
      showToast("Network error while updating role", 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const confirmResetPassword = (email: string, id: number) => {
    setConfirmModal({
      isOpen: true,
      title: 'Reset Password',
      message: `Send password reset link to ${email}?`,
      type: 'info',
      onConfirm: () => handleResetPassword(email, id)
    });
  };

  const handleResetPassword = async (email: string, id: number) => {
    console.log('Attempting to reset password for:', email);
    setActionLoading(`reset-${id}`);
    setConfirmModal(null);

    try {
      const res = await fetch('/api/auth/reset-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      if (res.ok) {
        console.log('Reset request sent successfully');
        showToast("Password reset email sent", 'success');
      } else {
        const data = await res.json();
        console.error('Failed to trigger reset:', data);
        showToast(data.error || "Failed to trigger reset", 'error');
      }
    } catch (error) {
      console.error("Failed to trigger reset (network error):", error);
      showToast("Network error while triggering reset", 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleAdminSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordModal.userId) return;
    
    setActionLoading(`setpass-${passwordModal.userId}`);
    const token = localStorage.getItem('rawverdict_token') || sessionStorage.getItem('rawverdict_token');
    
    try {
      const res = await fetch(`/api/admin/users/${passwordModal.userId}/password`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ password: adminSetPasswordValue })
      });

      if (res.ok) {
        showToast("Password updated successfully", 'success');
        setPasswordModal({ isOpen: false, userId: null, username: '' });
        setAdminSetPasswordValue('');
      } else {
        const data = await res.json();
        showToast(data.error || "Failed to update password", 'error');
      }
    } catch (error) {
      console.error("Failed to update password", error);
      showToast("Network error while updating password", 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const filteredUsers = users.filter(u => 
    u.username.toLowerCase().includes(search.toLowerCase()) || 
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  const adminInList = users.find(u => u.id === currentUser.id);

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-5xl bg-slate-900 border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="p-6 border-b border-white/10 flex items-center justify-between bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/20 rounded-xl">
              <Shield className="w-6 h-6 text-indigo-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">Admin Control Panel</h2>
              <p className="text-slate-400 text-sm">Manage user accounts and system access</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setShowAddForm(!showAddForm)}
              className={`px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all ${showAddForm ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-indigo-500 text-white hover:bg-indigo-600 shadow-lg shadow-indigo-500/20'}`}
            >
              {showAddForm ? <X className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
              {showAddForm ? 'Cancel' : 'Add User'}
            </button>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-full transition-colors text-slate-400 hover:text-white"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Add User Form */}
        <AnimatePresence>
          {showAddForm && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden bg-slate-800/50 border-b border-white/10"
            >
              <form onSubmit={handleAddUser} className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Username</label>
                  <input 
                    required
                    type="text"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    placeholder="Enter username"
                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:ring-2 focus:ring-indigo-500/50 outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Email Address</label>
                  <input 
                    required
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="user@example.com"
                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:ring-2 focus:ring-indigo-500/50 outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Initial Password</label>
                  <div className="relative">
                    <input 
                      required
                      type={showNewPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:ring-2 focus:ring-indigo-500/50 outline-none pr-10"
                    />
                    <button 
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                    >
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div className="flex gap-2">
                  <div className="flex-1 space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Role</label>
                    <select 
                      value={newRole}
                      onChange={(e) => setNewRole(e.target.value)}
                      className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:ring-2 focus:ring-indigo-500/50 outline-none appearance-none"
                    >
                      <option value="user">Standard User</option>
                      <option value="admin">Administrator</option>
                    </select>
                  </div>
                  <button 
                    type="submit"
                    disabled={isAdding}
                    className="bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-sm font-bold transition-all shadow-lg shadow-indigo-500/20 h-[38px] flex items-center justify-center"
                  >
                    {isAdding ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create'}
                  </button>
                </div>
              </form>
            </motion.div>
          )}
        </AnimatePresence>

        {/* My Profile Section */}
        {adminInList && (
            <div className="px-6 pt-6 pb-2">
                <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-lg shadow-inner">
                            {adminInList.username[0].toUpperCase()}
                        </div>
                        <div>
                            <h3 className="text-white font-bold flex items-center gap-2">
                                {adminInList.username}
                                <span className="px-2 py-0.5 bg-indigo-500 text-white text-[10px] font-bold uppercase tracking-wider rounded-full">You</span>
                            </h3>
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400 mt-1">
                                <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {adminInList.email}</span>
                                <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> Joined {new Date(adminInList.created_at).toLocaleDateString()}</span>
                                {adminInList.last_login_at && (
                                  <span className="flex items-center gap-1 text-emerald-400/80"><Clock className="w-3 h-3" /> Last login: {new Date(adminInList.last_login_at).toLocaleString()}</span>
                                )}
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={() => handleResetPassword(adminInList.email, adminInList.id)}
                        disabled={actionLoading === `reset-${adminInList.id}`}
                        className="px-3 py-1.5 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 rounded-lg text-xs font-medium transition-colors flex items-center gap-2 whitespace-nowrap"
                    >
                        {actionLoading === `reset-${adminInList.id}` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <KeyRound className="w-3.5 h-3.5" />}
                        Reset My Password
                    </button>
                </div>
            </div>
        )}

        {/* Search & Stats */}
        <div className="p-6 bg-slate-800/30 flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input 
              type="text"
              placeholder="Search by username or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-900/50 border border-white/10 rounded-xl py-2 pl-10 pr-4 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
            />
          </div>
          <div className="flex items-center gap-6 text-sm text-slate-400">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-indigo-400" />
              <span>Total Users: <span className="text-white font-bold">{users.length}</span></span>
            </div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Admins: <span className="text-white font-bold">{users.filter(u => u.role === 'admin').length}</span></span>
            </div>
          </div>
        </div>

        {/* User List */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="h-64 flex flex-col items-center justify-center gap-4">
              <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
              <p className="text-slate-400">Loading user database...</p>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center gap-4 text-slate-500">
              <Users className="w-12 h-12 opacity-20" />
              <p>No users found matching your search</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {filteredUsers.map((u) => (
                <motion.div 
                  key={u.id}
                  layout
                  className={`bg-slate-800/40 border rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 group transition-all ${u.id === currentUser.id ? 'border-indigo-500/30 bg-indigo-500/5' : 'border-white/5 hover:border-white/10'}`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg shadow-inner shrink-0 ${u.role === 'admin' ? 'bg-indigo-500/20 text-indigo-400' : 'bg-slate-700 text-slate-300'}`}>
                      {u.username[0].toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white truncate">{u.username}</span>
                        {u.role === 'admin' && (
                          <span className="px-1.5 py-0.5 bg-indigo-500/20 text-indigo-400 text-[10px] font-bold uppercase tracking-wider rounded border border-indigo-500/20">Admin</span>
                        )}
                        {u.id === currentUser.id && (
                            <span className="text-xs text-slate-500">(You)</span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400 mt-1">
                        <span className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> {u.email}</span>
                        <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> Joined {new Date(u.created_at).toLocaleDateString()}</span>
                        {u.last_login_at && (
                          <span className="flex items-center gap-1.5 text-slate-500"><Clock className="w-3.5 h-3.5" /> Last active: {new Date(u.last_login_at).toLocaleString()}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <button 
                      onClick={() => handleResetPassword(u.email, u.id)}
                      disabled={actionLoading === `reset-${u.id}`}
                      className="p-2 text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 rounded-lg transition-all flex items-center gap-2 text-xs font-medium"
                      title="Trigger Password Reset Email"
                    >
                      {actionLoading === `reset-${u.id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                      <span className="hidden lg:inline">Email Reset</span>
                    </button>

                    <button 
                      onClick={() => setPasswordModal({ isOpen: true, userId: u.id, username: u.username })}
                      className="p-2 text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-all flex items-center gap-2 text-xs font-medium"
                      title="Set Password Manually"
                    >
                      <KeyRound className="w-4 h-4" />
                      <span className="hidden lg:inline">Set Pass</span>
                    </button>

                    {u.id !== currentUser.id && (
                        <button 
                        onClick={() => confirmToggleRole(u)}
                        disabled={actionLoading === `role-${u.id}`}
                        className={`p-2 rounded-lg transition-all flex items-center gap-2 text-xs font-medium ${u.role === 'admin' ? 'text-indigo-400 hover:bg-indigo-500/10' : 'text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10'}`}
                        title={u.role === 'admin' ? "Demote to User" : "Promote to Admin"}
                        >
                        {actionLoading === `role-${u.id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                        <span className="hidden lg:inline">{u.role === 'admin' ? 'Demote' : 'Make Admin'}</span>
                        </button>
                    )}

                    {u.id !== currentUser.id && (
                      <button 
                        onClick={() => handleDeleteUser(u.id)}
                        disabled={deletingId === u.id}
                        className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all flex items-center gap-2 text-xs font-medium"
                        title="Delete User Account"
                      >
                        {deletingId === u.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                        <span className="hidden lg:inline">Delete</span>
                      </button>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-900/80 border-t border-white/10 text-center text-[10px] text-slate-500 uppercase tracking-widest">
          RawVerdict Administrative Access Only • Secure Session Active
        </div>

        {/* Set Password Modal */}
        <AnimatePresence>
          {passwordModal.isOpen && (
            <div className="fixed inset-0 z-[350] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full max-w-md bg-slate-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
              >
                <div className="p-6">
                  <h3 className="text-lg font-bold text-white mb-2">Set Password for {passwordModal.username}</h3>
                  <p className="text-slate-400 text-sm mb-6">Enter a new password for this user. This will override their current password immediately.</p>
                  
                  <form onSubmit={handleAdminSetPassword}>
                    <div className="space-y-2 mb-6">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">New Password</label>
                      <input 
                        autoFocus
                        type="text"
                        value={adminSetPasswordValue}
                        onChange={(e) => setAdminSetPasswordValue(e.target.value)}
                        placeholder="Enter new password"
                        className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-indigo-500/50 outline-none"
                      />
                    </div>
                    
                    <div className="flex gap-3 justify-end">
                      <button 
                        type="button"
                        onClick={() => {
                          setPasswordModal({ isOpen: false, userId: null, username: '' });
                          setAdminSetPasswordValue('');
                        }}
                        className="px-4 py-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-xl text-sm font-medium transition-colors"
                      >
                        Cancel
                      </button>
                      <button 
                        type="submit"
                        disabled={!adminSetPasswordValue || actionLoading === `setpass-${passwordModal.userId}`}
                        className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-500/20 transition-all flex items-center gap-2"
                      >
                        {actionLoading === `setpass-${passwordModal.userId}` ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                        Set Password
                      </button>
                    </div>
                  </form>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

