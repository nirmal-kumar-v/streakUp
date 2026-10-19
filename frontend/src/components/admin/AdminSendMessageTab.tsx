import React, { useState, useEffect, useCallback } from 'react';
import {
  sendAdminMessage,
  fetchAdminMessageLogs,
  searchAdminUsers,
  AdminMessageLog,
  AdminUser,
} from '../../api/admin';
import { useToast } from '../../context/ToastContext';
import { extractErrorMessage } from '../../utils/error';
import {
  Mail,
  Send,
  Search,
  Bell,
  RefreshCw,
  User,
  CheckCircle2,
  Eye,
  Clock,
} from 'lucide-react';

export const AdminSendMessageTab: React.FC = () => {
  const toast = useToast();

  // User search & selection
  const [userQuery, setUserQuery] = useState('');
  const [userSearchResults, setUserSearchResults] = useState<AdminUser[]>([]);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);

  // Message form
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [channel, setChannel] = useState<'IN_APP' | 'EMAIL' | 'BOTH'>('IN_APP');
  const [isSending, setIsSending] = useState(false);
  const [lastDeliveryResult, setLastDeliveryResult] = useState<AdminMessageLog | null>(null);

  // Message logs history
  const [logs, setLogs] = useState<AdminMessageLog[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(true);

  const loadLogs = useCallback(async () => {
    setIsLoadingLogs(true);
    try {
      const res = await fetchAdminMessageLogs();
      if (res.success) {
        setLogs(res.logs || []);
      }
    } catch {
      // Ignore background log fetch error
    } finally {
      setIsLoadingLogs(false);
    }
  }, []);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const handleSearchUsers = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userQuery.trim()) return;

    setIsSearchingUsers(true);
    try {
      const res = await searchAdminUsers(userQuery.trim());
      if (res.success) {
        setUserSearchResults(res.users || []);
      }
    } catch (err: any) {
      toast.error(extractErrorMessage(err, 'Failed to search users.'));
    } finally {
      setIsSearchingUsers(false);
    }
  };

  const handleSelectUser = (u: AdminUser) => {
    setSelectedUser(u);
    setUserSearchResults([]);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) {
      toast.error('Please select a recipient user first.');
      return;
    }
    if (!title.trim() || !message.trim()) {
      toast.error('Both title and message are required.');
      return;
    }

    setIsSending(true);
    setLastDeliveryResult(null);

    try {
      const res = await sendAdminMessage({
        recipientUserId: selectedUser.id,
        title: title.trim(),
        message: message.trim(),
        channel,
      });

      if (res.success && res.delivery) {
        setLastDeliveryResult(res.delivery);
        toast.success('Message sent to user successfully.');
        setTitle('');
        setMessage('');
        loadLogs();
      }
    } catch (err: any) {
      toast.error(extractErrorMessage(err, 'Failed to send message.'));
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-dark-card border border-dark-border rounded-2xl p-5 shadow-panel">
        <h2 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
          <Mail className="w-4 h-4 text-flame-500" />
          <span>Admin Direct Messaging</span>
        </h2>
        <p className="text-xs text-dark-muted mt-0.5">
          Send direct in-app notifications and official emails to specific users on StreakUp.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Form Column */}
        <div className="lg:col-span-7 space-y-5">
          {/* Recipient Selection */}
          <div className="bg-dark-card border border-dark-border rounded-2xl p-5 shadow-panel space-y-4">
            <h3 className="text-xs font-bold text-zinc-200 uppercase tracking-wider flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-flame-400" />
              <span>1. Select Recipient</span>
            </h3>

            {selectedUser ? (
              <div className="flex items-center justify-between p-3.5 bg-dark-surface border border-flame-500/30 rounded-xl">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-zinc-100">{selectedUser.name}</span>
                    <span className="text-flame-400 text-xs font-mono">@{selectedUser.username}</span>
                  </div>
                  <span className="text-[11px] text-zinc-400 font-mono">{selectedUser.email}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedUser(null)}
                  className="px-2.5 py-1 text-xs text-zinc-400 hover:text-zinc-200 bg-dark-card border border-dark-border rounded-lg"
                >
                  Change User
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <form onSubmit={handleSearchUsers} className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                    <input
                      type="text"
                      value={userQuery}
                      onChange={(e) => setUserQuery(e.target.value)}
                      placeholder="Search recipient by name, @username, or email..."
                      className="w-full pl-9 pr-3 py-2 bg-dark-surface border border-dark-border rounded-xl text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-flame-500"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isSearchingUsers || !userQuery.trim()}
                    className="px-4 py-2 bg-flame-500 hover:bg-flame-400 disabled:opacity-50 text-zinc-950 font-bold text-xs rounded-xl transition-colors"
                  >
                    {isSearchingUsers ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : 'Search'}
                  </button>
                </form>

                {userSearchResults.length > 0 && (
                  <div className="max-h-48 overflow-y-auto divide-y divide-dark-border/40 rounded-xl border border-dark-border bg-dark-surface/60">
                    {userSearchResults.map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => handleSelectUser(u)}
                        className="w-full text-left p-2.5 hover:bg-dark-hover flex items-center justify-between transition-colors text-xs"
                      >
                        <div>
                          <span className="font-bold text-zinc-200 mr-2">{u.name}</span>
                          <span className="text-flame-400 font-mono">@{u.username}</span>
                        </div>
                        <span className="text-[11px] text-zinc-500">{u.email}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Message Composition */}
          <form
            onSubmit={handleSendMessage}
            className="bg-dark-card border border-dark-border rounded-2xl p-5 shadow-panel space-y-4"
          >
            <h3 className="text-xs font-bold text-zinc-200 uppercase tracking-wider flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-flame-400" />
              <span>2. Compose Message</span>
            </h3>

            {/* Delivery Channel Radio */}
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                Delivery Channel
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'IN_APP', label: 'In-App Only', icon: Bell },
                  { id: 'EMAIL', label: 'Email Only', icon: Mail },
                  { id: 'BOTH', label: 'Both Channels', icon: Send },
                ].map((c) => {
                  const Icon = c.icon;
                  const isChecked = channel === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setChannel(c.id as any)}
                      className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                        isChecked
                          ? 'bg-flame-500/15 border-flame-500 text-flame-400 shadow-sm'
                          : 'bg-dark-surface border-dark-border text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{c.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Title */}
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                Message Title / Subject
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Notice Regarding Your Streak Pause..."
                required
                maxLength={200}
                className="w-full px-3.5 py-2.5 bg-dark-surface border border-dark-border rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-flame-500 transition-colors placeholder:text-zinc-600"
              />
            </div>

            {/* Body */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-zinc-300">
                  Message Content
                </label>
                <span className="text-[11px] text-dark-muted font-mono">{message.length} chars</span>
              </div>
              <textarea
                rows={5}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Write your clear, respectful message to the user..."
                required
                maxLength={2000}
                className="w-full px-3.5 py-2.5 bg-dark-surface border border-dark-border rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-flame-500 transition-colors placeholder:text-zinc-600 resize-y"
              />
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={isSending || !selectedUser || !title.trim() || !message.trim()}
                className="px-5 py-2.5 bg-flame-500 hover:bg-flame-400 disabled:opacity-50 text-zinc-950 font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-2 active:scale-95"
              >
                {isSending ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                <span>{isSending ? 'Sending Message...' : 'Send Message'}</span>
              </button>
            </div>
          </form>
        </div>

        {/* Live Preview & Status Column */}
        <div className="lg:col-span-5 space-y-5">
          {/* Live Preview Card */}
          <div className="bg-dark-card border border-dark-border rounded-2xl p-5 shadow-panel space-y-3">
            <h3 className="text-xs font-bold text-zinc-200 uppercase tracking-wider flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5 text-flame-400" />
              <span>Recipient Preview</span>
            </h3>

            <div className="bg-dark-surface/50 border border-dark-border rounded-xl p-4 space-y-3">
              <div className="text-xs space-y-1 pb-2 border-b border-dark-border/60">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500">To:</span>
                  <span className="font-bold text-zinc-200">
                    {selectedUser ? `${selectedUser.name} (@${selectedUser.username})` : '(No user selected)'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500">Channel:</span>
                  <span className="text-flame-400 font-mono text-[11px]">{channel}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500">Subject:</span>
                  <span className="text-zinc-200 truncate max-w-[200px]">
                    {title || '(Subject title)'}
                  </span>
                </div>
              </div>

              <div>
                <span className="text-[11px] text-zinc-500 block mb-1">Message Body:</span>
                <p className="text-xs text-zinc-300 leading-relaxed whitespace-pre-wrap min-h-[60px] italic">
                  {message || 'Type message in the editor to preview how it will appear to the user...'}
                </p>
              </div>
            </div>
          </div>

          {/* Last Delivery Status Card */}
          {lastDeliveryResult && (
            <div className="bg-dark-card border border-dark-border rounded-2xl p-5 shadow-panel space-y-3 animate-fadeIn">
              <h3 className="text-xs font-bold text-zinc-200 uppercase tracking-wider flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Last Delivery Result</span>
              </h3>

              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between p-2 bg-dark-surface rounded-lg">
                  <span className="text-zinc-400 flex items-center gap-1.5">
                    <Bell className="w-3.5 h-3.5" /> In-App Notification:
                  </span>
                  <span
                    className={`font-bold font-mono ${
                      lastDeliveryResult.inAppStatus === 'SENT'
                        ? 'text-emerald-400'
                        : lastDeliveryResult.inAppStatus === 'SKIPPED'
                        ? 'text-zinc-500'
                        : 'text-rose-400'
                    }`}
                  >
                    {lastDeliveryResult.inAppStatus}
                  </span>
                </div>

                <div className="flex items-center justify-between p-2 bg-dark-surface rounded-lg">
                  <span className="text-zinc-400 flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5" /> Email Delivery:
                  </span>
                  <span
                    className={`font-bold font-mono ${
                      lastDeliveryResult.emailStatus === 'SENT'
                        ? 'text-emerald-400'
                        : lastDeliveryResult.emailStatus === 'SKIPPED'
                        ? 'text-zinc-500'
                        : 'text-amber-400'
                    }`}
                  >
                    {lastDeliveryResult.emailStatus}
                  </span>
                </div>

                {lastDeliveryResult.deliveryNote && (
                  <p className="text-[11px] text-dark-muted p-2 bg-dark-surface/30 rounded-lg">
                    Note: {lastDeliveryResult.deliveryNote}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Message Audit Log Table */}
      <div className="bg-dark-card border border-dark-border rounded-2xl p-5 shadow-panel space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-zinc-200 uppercase tracking-wider flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-flame-400" />
            <span>Recent Dispatched Messages ({logs.length})</span>
          </h3>
          <button
            onClick={loadLogs}
            disabled={isLoadingLogs}
            className="text-xs text-zinc-400 hover:text-zinc-200 flex items-center gap-1"
          >
            <RefreshCw className={`w-3 h-3 ${isLoadingLogs ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>

        {isLoadingLogs ? (
          <div className="py-8 text-center text-xs text-dark-muted">
            <RefreshCw className="w-4 h-4 animate-spin text-flame-500 mx-auto mb-1" />
            <span>Loading history...</span>
          </div>
        ) : logs.length === 0 ? (
          <p className="text-xs text-dark-muted italic text-center py-6">
            No admin messages sent yet.
          </p>
        ) : (
          <div className="divide-y divide-dark-border/50 rounded-xl border border-dark-border overflow-hidden bg-dark-surface/40">
            {logs.map((log) => (
              <div key={log.id} className="p-3.5 space-y-1.5 text-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px]">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-zinc-200">To: @{log.recipientUsername}</span>
                    <span className="text-zinc-600">•</span>
                    <span className="text-zinc-400 font-mono">{log.channel}</span>
                  </div>
                  <span className="text-zinc-500 font-mono">
                    {new Date(log.createdAt).toLocaleString()}
                  </span>
                </div>
                <div className="font-semibold text-zinc-100">{log.title}</div>
                <p className="text-zinc-400 text-[11px] line-clamp-2">{log.message}</p>
                <div className="flex items-center gap-3 text-[10px] text-zinc-500 font-mono pt-1">
                  <span>In-App: <strong className="text-zinc-300">{log.inAppStatus}</strong></span>
                  <span>Email: <strong className="text-zinc-300">{log.emailStatus}</strong></span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
