import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  fetchAdminUserRequests,
  updateAdminUserRequestStatus,
  recoverUserAccountByAdmin,
  AdminUserRequest,
} from '../../api/admin';
import { useToast } from '../../context/ToastContext';
import { extractErrorMessage } from '../../utils/error';
import {
  MessageSquare,
  Search,
  RefreshCw,
  ExternalLink,
  User,
  Filter,
  CheckCircle2,
  Clock,
  Tag,
  ShieldAlert,
  ShieldCheck,
  RotateCcw,
  KeyRound,
  Eye,
  EyeOff,
  X,
  Mail,
} from 'lucide-react';
import { Link } from 'react-router-dom';

interface AdminUserRequestsTabProps {
  onSelectUserForInspection: (userId: string) => void;
  onRequestResolved?: () => void;
}

export const AdminUserRequestsTab: React.FC<AdminUserRequestsTabProps> = ({
  onSelectUserForInspection,
  onRequestResolved,
}) => {
  const toast = useToast();
  const [requests, setRequests] = useState<AdminUserRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Direct Account Recovery Modal State
  const [recoveryTarget, setRecoveryTarget] = useState<AdminUserRequest | null>(null);
  const [sensitivePin, setSensitivePin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [isRecovering, setIsRecovering] = useState(false);

  const loadRequests = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetchAdminUserRequests({
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
        category: categoryFilter !== 'ALL' ? categoryFilter : undefined,
        search: searchQuery.trim() || undefined,
      });
      if (res.success) {
        setRequests(res.requests || []);
      }
    } catch (err: any) {
      toast.error(extractErrorMessage(err, 'Failed to fetch user requests.'));
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, categoryFilter, searchQuery, toast]);

  useEffect(() => {
    loadRequests();
  }, [statusFilter, categoryFilter]);

  // Status Counts
  const counts = useMemo(() => {
    let pending = 0;
    let underReview = 0;
    let resolved = 0;
    let recovery = 0;
    for (const r of requests) {
      if (r.status === 'PENDING') pending++;
      if (r.status === 'UNDER_REVIEW') underReview++;
      if (r.status === 'RESOLVED') resolved++;
      if (r.category === 'ACCOUNT_RECOVERY' && r.status !== 'RESOLVED') recovery++;
    }
    return { pending, underReview, resolved, recovery, total: requests.length };
  }, [requests]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadRequests();
  };

  const handleStatusChange = async (
    requestId: string,
    newStatus: 'PENDING' | 'UNDER_REVIEW' | 'RESOLVED'
  ) => {
    setUpdatingId(requestId);
    try {
      const res = await updateAdminUserRequestStatus(requestId, { status: newStatus });
      if (res.success) {
        setRequests((prev) =>
          prev.map((r) => (r.id === requestId ? { ...r, status: newStatus } : r))
        );
        toast.success(`Request status updated to ${newStatus.replace('_', ' ')}.`);
        if (onRequestResolved) onRequestResolved();
      }
    } catch (err: any) {
      toast.error(extractErrorMessage(err, 'Failed to update status.'));
    } finally {
      setUpdatingId(null);
    }
  };

  // Direct 1-Click Recovery Handler
  const handleConfirmDirectRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recoveryTarget) return;

    if (!sensitivePin.trim()) {
      toast.error('Secondary Sensitive PIN is required to authorize account recovery.');
      return;
    }

    setIsRecovering(true);
    try {
      // 1. Authorize recovery via Super Admin endpoint
      const res = await recoverUserAccountByAdmin(recoveryTarget.userId, {
        reason: `Restored via direct User Request (${recoveryTarget.id})`,
        sensitivePin: sensitivePin.trim(),
      });

      if (res.success) {
        toast.success(
          `Account @${recoveryTarget.username} restored successfully! Notification email dispatched.`
        );

        // 2. Mark this request as resolved
        try {
          await updateAdminUserRequestStatus(recoveryTarget.id, {
            status: 'RESOLVED',
            adminNotes: 'Account successfully recovered and activated by Super Admin.',
          });
        } catch {}

        setRecoveryTarget(null);
        setSensitivePin('');
        loadRequests();
        if (onRequestResolved) onRequestResolved();
      }
    } catch (err: any) {
      toast.error(extractErrorMessage(err, 'Failed to recover account. Check your PIN.'));
    } finally {
      setIsRecovering(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Clock className="w-3 h-3" /> Pending
          </span>
        );
      case 'UNDER_REVIEW':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <RefreshCw className="w-3 h-3 animate-spin" /> Under Review
          </span>
        );
      case 'RESOLVED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3 h-3" /> Resolved
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded text-xs bg-zinc-800 text-zinc-300">
            {status}
          </span>
        );
    }
  };

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'FEATURE_REQUEST':
        return 'Feature Request';
      case 'BUG_REPORT':
        return 'Bug Report';
      case 'ACCOUNT_RECOVERY':
        return 'Account Recovery';
      case 'ACCOUNT_SUPPORT':
        return 'Account Support';
      case 'GENERAL_FEEDBACK':
        return 'General Feedback';
      default:
        return 'Other';
    }
  };

  return (
    <div className="space-y-5">
      {/* Search & Filter Header */}
      <div className="bg-dark-card border border-dark-border rounded-2xl p-4 sm:p-5 shadow-panel space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-flame-500" />
              <span>User Requests & Feedback</span>
            </h2>
            <p className="text-xs text-dark-muted mt-0.5">
              Review and manage feature requests, bug reports, and user feedback.
            </p>
          </div>
          <button
            onClick={loadRequests}
            disabled={isLoading}
            className="px-3 py-1.5 bg-dark-surface hover:bg-dark-hover border border-dark-border text-zinc-300 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-colors shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>

        <div className="flex flex-col lg:flex-row gap-3">
          {/* Search Input */}
          <form onSubmit={handleSearchSubmit} className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by username, message text, email..."
              className="w-full pl-10 pr-20 py-2 bg-dark-surface border border-dark-border rounded-xl text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-flame-500"
            />
            <button
              type="submit"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 px-2.5 py-1 bg-flame-500 text-zinc-950 font-bold text-xs rounded-lg hover:bg-flame-400 transition-colors"
            >
              Search
            </button>
          </form>

          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-400 flex items-center gap-1 shrink-0">
              <Filter className="w-3.5 h-3.5" /> Status:
            </span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 bg-dark-surface border border-dark-border rounded-xl text-xs text-zinc-200 focus:outline-none focus:border-flame-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="PENDING">Pending</option>
              <option value="UNDER_REVIEW">Under Review</option>
              <option value="RESOLVED">Resolved</option>
            </select>
          </div>

          {/* Category Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-400 flex items-center gap-1 shrink-0">
              <Tag className="w-3.5 h-3.5" /> Category:
            </span>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-2 bg-dark-surface border border-dark-border rounded-xl text-xs text-zinc-200 focus:outline-none focus:border-flame-500"
            >
              <option value="ALL">All Categories</option>
              <option value="ACCOUNT_RECOVERY">Account Recovery</option>
              <option value="FEATURE_REQUEST">Feature Request</option>
              <option value="BUG_REPORT">Bug Report</option>
              <option value="ACCOUNT_SUPPORT">Account Support</option>
              <option value="GENERAL_FEEDBACK">General Feedback</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
        </div>
      </div>

      {/* Quick Summary Counts Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button
          type="button"
          onClick={() => setStatusFilter('ALL')}
          className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
            statusFilter === 'ALL' && categoryFilter === 'ALL'
              ? 'bg-dark-card border-flame-500/50 shadow-sm'
              : 'bg-dark-card/60 border-dark-border hover:border-zinc-700'
          }`}
        >
          <span className="text-[11px] text-zinc-400 block font-medium">Total Submissions</span>
          <span className="text-base font-bold text-zinc-100">{counts.total}</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setStatusFilter('PENDING');
            setCategoryFilter('ALL');
          }}
          className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
            statusFilter === 'PENDING'
              ? 'bg-amber-500/15 border-amber-500/50 shadow-sm'
              : 'bg-dark-card/60 border-dark-border hover:border-zinc-700'
          }`}
        >
          <span className="text-[11px] text-amber-400 block font-medium flex items-center gap-1">
            <Clock className="w-3 h-3" /> Pending Review
          </span>
          <span className="text-base font-bold text-amber-300">{counts.pending}</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setStatusFilter('UNDER_REVIEW');
            setCategoryFilter('ALL');
          }}
          className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
            statusFilter === 'UNDER_REVIEW'
              ? 'bg-indigo-500/15 border-indigo-500/50 shadow-sm'
              : 'bg-dark-card/60 border-dark-border hover:border-zinc-700'
          }`}
        >
          <span className="text-[11px] text-indigo-400 block font-medium flex items-center gap-1">
            <RefreshCw className="w-3 h-3" /> In Progress
          </span>
          <span className="text-base font-bold text-indigo-300">{counts.underReview}</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setCategoryFilter('ACCOUNT_RECOVERY');
            setStatusFilter('ALL');
          }}
          className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
            categoryFilter === 'ACCOUNT_RECOVERY'
              ? 'bg-rose-500/15 border-rose-500/50 shadow-sm'
              : 'bg-dark-card/60 border-dark-border hover:border-zinc-700'
          }`}
        >
          <span className="text-[11px] text-rose-400 block font-medium flex items-center gap-1">
            <ShieldAlert className="w-3 h-3" /> Account Recoveries
          </span>
          <span className="text-base font-bold text-rose-300">{counts.recovery}</span>
        </button>
      </div>

      {/* Requests List */}
      {isLoading ? (
        <div className="py-16 text-center text-xs text-dark-muted">
          <div className="inline-flex items-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-flame-500" />
            <span>Loading submissions...</span>
          </div>
        </div>
      ) : requests.length === 0 ? (
        <div className="bg-dark-card border border-dark-border rounded-2xl p-10 text-center space-y-2">
          <MessageSquare className="w-8 h-8 text-zinc-600 mx-auto" />
          <h3 className="text-sm font-bold text-zinc-300">No requests found</h3>
          <p className="text-xs text-dark-muted">
            {statusFilter !== 'ALL' || categoryFilter !== 'ALL' || searchQuery
              ? 'Try adjusting your search filters.'
              : 'Users have not submitted any feedback or requests yet.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((item) => (
            <div
              key={item.id}
              className="bg-dark-card border border-dark-border rounded-2xl p-4 sm:p-5 shadow-panel space-y-3 hover:border-zinc-700 transition-colors"
            >
              {/* Header: User Info, Category, Date, Status */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-dark-border/60">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-bold text-zinc-100">{item.name}</span>
                  <span className="text-flame-400 font-mono">@{item.username}</span>
                  <span className="text-zinc-600">•</span>
                  <span className="text-[11px] text-zinc-400">{item.email}</span>
                  <span className="text-zinc-600">•</span>
                  <span className="px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-300 font-mono text-[11px]">
                    {getCategoryLabel(item.category)}
                  </span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[11px] text-zinc-500 font-mono">
                    {new Date(item.createdAt).toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                  {getStatusBadge(item.status)}
                </div>
              </div>

              {/* Message Content */}
              <p className="text-xs text-zinc-200 leading-relaxed whitespace-pre-wrap bg-dark-surface/40 p-3 rounded-xl border border-dark-border/40">
                {item.message}
              </p>

              {/* Admin Notes if present */}
              {item.adminNotes && (
                <div className="text-[11px] text-dark-muted italic bg-dark-surface/20 p-2 rounded-lg">
                  Note: {item.adminNotes}
                </div>
              )}

              {/* Action Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                {/* Status Switcher Buttons */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-semibold text-zinc-400 mr-1">
                    Set Status:
                  </span>
                  {(['PENDING', 'UNDER_REVIEW', 'RESOLVED'] as const).map((s) => (
                    <button
                      key={s}
                      disabled={updatingId === item.id || item.status === s}
                      onClick={() => handleStatusChange(item.id, s)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                        item.status === s
                          ? 'bg-zinc-800 text-zinc-400 border border-zinc-700 cursor-default'
                          : 'bg-dark-surface hover:bg-dark-hover text-zinc-300 border border-dark-border'
                      }`}
                    >
                      {s === 'PENDING'
                        ? 'Pending'
                        : s === 'UNDER_REVIEW'
                        ? 'Under Review'
                        : 'Resolved'}
                    </button>
                  ))}
                </div>

                {/* Direct Profile, Email, and Super Admin Controls Links */}
                <div className="flex flex-wrap items-center gap-2">
                  {/* Direct 1-Click Restore & Reactivate Button for Account Recoveries */}
                  {item.category === 'ACCOUNT_RECOVERY' &&
                    item.status !== 'RESOLVED' &&
                    item.userId &&
                    item.userId !== 'PUBLIC_GUEST' && (
                      <button
                        type="button"
                        onClick={() => setRecoveryTarget(item)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-300 font-bold rounded-xl text-xs transition-colors cursor-pointer shadow-sm"
                      >
                        <RotateCcw className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Authorize & Restore Account</span>
                      </button>
                    )}

                  {item.userId && item.userId !== 'PUBLIC_GUEST' ? (
                    <>
                      <Link
                        to={`/profile/${item.username}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-dark-surface hover:bg-dark-hover border border-dark-border rounded-xl text-xs font-semibold text-zinc-300 hover:text-zinc-100 transition-colors"
                      >
                        <span>View Profile</span>
                        <ExternalLink className="w-3 h-3 text-zinc-500" />
                      </Link>
                      <button
                        onClick={() => onSelectUserForInspection(item.userId)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 border rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                          item.category === 'ACCOUNT_RECOVERY'
                            ? 'bg-rose-500/15 hover:bg-rose-500/25 border-rose-500/40 text-rose-300'
                            : 'bg-flame-500/10 hover:bg-flame-500/20 border-flame-500/30 text-flame-400 hover:text-flame-300'
                        }`}
                      >
                        {item.category === 'ACCOUNT_RECOVERY' ? (
                          <>
                            <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                            <span>Inspect in Admin</span>
                          </>
                        ) : (
                          <>
                            <User className="w-3 h-3" />
                            <span>Inspect in Admin</span>
                          </>
                        )}
                      </button>
                    </>
                  ) : (
                    <a
                      href={`mailto:${item.email}?subject=StreakUp Support: Regarding your ${getCategoryLabel(item.category)}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-dark-surface hover:bg-dark-hover border border-dark-border rounded-xl text-xs font-semibold text-zinc-300 hover:text-zinc-100 transition-colors"
                    >
                      <Mail className="w-3.5 h-3.5 text-sky-400" />
                      <span>Email Sender</span>
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 1-Click Sensitive Recovery PIN Authorization Modal */}
      {recoveryTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-dark-card border border-emerald-500/30 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-dark-border">
              <div className="flex items-center gap-2.5 text-emerald-400">
                <RotateCcw className="w-5 h-5" />
                <h3 className="text-sm font-bold text-zinc-100">
                  Authorize Account Restoration
                </h3>
              </div>
              <button
                onClick={() => {
                  setRecoveryTarget(null);
                  setSensitivePin('');
                }}
                className="p-1 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-dark-surface cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl space-y-1.5 text-xs">
              <div className="font-semibold text-emerald-300">
                Restoring Account for @{recoveryTarget.username}
              </div>
              <p className="text-zinc-300 text-[11px] leading-relaxed">
                Reactivates the user account, clears deletion flags, restores login access, sends a restoration confirmation email to <strong>{recoveryTarget.email}</strong>, and auto-resolves this request.
              </p>
            </div>

            <form onSubmit={handleConfirmDirectRecovery} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Enter 6-Digit Secondary Sensitive PIN
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                  <input
                    type={showPin ? 'text' : 'password'}
                    value={sensitivePin}
                    onChange={(e) => setSensitivePin(e.target.value)}
                    placeholder="Enter admin sensitive PIN..."
                    autoFocus
                    className="w-full pl-9 pr-10 py-2.5 bg-dark-surface border border-dark-border rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPin(!showPin)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200 cursor-pointer"
                  >
                    {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setRecoveryTarget(null);
                    setSensitivePin('');
                  }}
                  className="px-4 py-2 bg-dark-surface hover:bg-dark-hover border border-dark-border text-zinc-300 rounded-xl text-xs font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isRecovering || !sensitivePin.trim()}
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-zinc-950 font-bold rounded-xl text-xs flex items-center gap-2 shadow-lg cursor-pointer transition-all"
                >
                  {isRecovering ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <ShieldCheck className="w-4 h-4" />
                  )}
                  <span>Confirm & Restore Account</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
