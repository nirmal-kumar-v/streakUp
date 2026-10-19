import React, { useState, useEffect, useCallback } from 'react';
import {
  fetchAdminUserRequests,
  updateAdminUserRequestStatus,
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
  Mail,
} from 'lucide-react';
import { Link } from 'react-router-dom';

interface AdminUserRequestsTabProps {
  onSelectUserForInspection: (userId: string) => void;
}

export const AdminUserRequestsTab: React.FC<AdminUserRequestsTabProps> = ({
  onSelectUserForInspection,
}) => {
  const toast = useToast();
  const [requests, setRequests] = useState<AdminUserRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

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
      }
    } catch (err: any) {
      toast.error(extractErrorMessage(err, 'Failed to update status.'));
    } finally {
      setUpdatingId(null);
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
                <div className="flex items-center gap-2">
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
                            <span>Inspect & Recover Account</span>
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
    </div>
  );
};
