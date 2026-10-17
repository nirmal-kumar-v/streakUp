import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  fetchUserGroups,
  createGroup,
  joinGroup,
  Group,
} from '../api/groups';
import {
  Users,
  Plus,
  KeyRound,
  Copy,
  Check,
  ArrowRight,
  ShieldCheck,
  Crown,
  AlertCircle,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { extractErrorMessage } from '../utils/error';

export const GroupsPage: React.FC = () => {
  const [groups, setGroups] = useState<Group[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal States
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const [isJoinOpen, setIsJoinOpen] = useState(false);
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [isJoining, setIsJoining] = useState(false);

  const [feedback, setFeedback] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const showFeedback = (text: string, type: 'success' | 'error' = 'success') => {
    setFeedback({ text, type });
    setTimeout(() => setFeedback(null), 4000);
  };

  const loadGroups = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetchUserGroups();
      if (res.success) {
        setGroups(res.groups || []);
      }
    } catch (err: any) {
      setError(extractErrorMessage(err, 'Failed to load your groups.'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadGroups();
  }, []);

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createName.trim()) return;
    setIsCreating(true);
    try {
      const res = await createGroup({
        name: createName.trim(),
        description: createDescription.trim() || undefined,
      });
      if (res.success) {
        setIsCreateOpen(false);
        setCreateName('');
        setCreateDescription('');
        showFeedback(res.message || 'Group created successfully! Invite others with your join code.');
        loadGroups();
      }
    } catch (err: any) {
      showFeedback(extractErrorMessage(err, 'Failed to create group.'), 'error');
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoinGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCodeInput.trim()) return;
    setIsJoining(true);
    try {
      const res = await joinGroup(joinCodeInput.trim());
      if (res.success) {
        setIsJoinOpen(false);
        setJoinCodeInput('');
        showFeedback(res.message || 'Joined group successfully!');
        loadGroups();
      }
    } catch (err: any) {
      showFeedback(extractErrorMessage(err, 'Failed to join group. Check the join code and try again.'), 'error');
    } finally {
      setIsJoining(false);
    }
  };

  const copyJoinCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2500);
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono uppercase tracking-wider text-flame-400 font-bold px-2 py-0.5 rounded-md bg-flame-500/10 border border-flame-500/20">
              Communities & Circles
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-zinc-100 tracking-tight flex items-center gap-2.5">
            <Users className="w-7 h-7 text-flame-500" />
            <span>Groups</span>
          </h1>
          <p className="text-xs sm:text-sm text-dark-muted mt-1">
            Form study groups, join communities, and compete on dedicated streak and points leaderboards.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setIsJoinOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-dark-card hover:bg-dark-surface border border-dark-border text-zinc-200 hover:text-white rounded-xl text-xs font-bold transition-all"
          >
            <KeyRound className="w-3.5 h-3.5 text-amber-400" />
            <span>Join with Code</span>
          </button>
          <button
            onClick={() => setIsCreateOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-flame-500 hover:bg-flame-400 active:scale-95 text-zinc-950 rounded-xl text-xs font-extrabold transition-all shadow-md shadow-flame-500/20"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Create Group</span>
          </button>
        </div>
      </div>

      {/* Feedback Alert */}
      {feedback && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
            feedback.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-400" />
          ) : (
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      {error && (
        <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-semibold rounded-xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Groups List */}
      {isLoading ? (
        <div className="py-24 text-center text-xs text-dark-muted">
          <div className="inline-flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-flame-500 border-t-transparent rounded-full animate-spin" />
            Loading your groups...
          </div>
        </div>
      ) : groups.length === 0 ? (
        <div className="bg-dark-card border border-dashed border-dark-border rounded-3xl p-12 text-center max-w-lg mx-auto">
          <div className="w-16 h-16 rounded-2xl bg-flame-500/10 border border-flame-500/20 flex items-center justify-center text-flame-400 mx-auto mb-4">
            <Users className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-zinc-100">You haven't joined any groups yet</h3>
          <p className="text-xs text-dark-muted mt-1.5 max-w-sm mx-auto leading-relaxed">
            Create a custom study group for your classmates or coworkers, or join an existing group using its 6-character invitation code.
          </p>
          <div className="flex items-center justify-center gap-3 mt-6">
            <button
              onClick={() => setIsJoinOpen(true)}
              className="px-4 py-2 bg-dark-surface hover:bg-dark-hover border border-dark-border text-zinc-200 text-xs font-semibold rounded-xl"
            >
              Enter Join Code
            </button>
            <button
              onClick={() => setIsCreateOpen(true)}
              className="px-4 py-2 bg-flame-500 hover:bg-flame-400 text-zinc-950 text-xs font-extrabold rounded-xl shadow-sm"
            >
              Create a Group
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {groups.map((group) => {
            const role = group.role || group.userRole || 'MEMBER';
            const isOwner = role === 'OWNER';
            const isAdmin = role === 'ADMIN';

            return (
              <div
                key={group.id}
                className="bg-dark-card border border-dark-border hover:border-zinc-700 rounded-2xl p-5 shadow-panel transition-all flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="text-base font-bold text-zinc-100 group-hover:text-flame-400 transition-colors line-clamp-1">
                      {group.name}
                    </h3>
                    <span
                      className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border shrink-0 flex items-center gap-1 ${
                        isOwner
                          ? 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                          : isAdmin
                          ? 'bg-purple-500/15 border-purple-500/30 text-purple-300'
                          : 'bg-zinc-800 border-zinc-700 text-zinc-400'
                      }`}
                    >
                      {isOwner ? <Crown className="w-2.5 h-2.5" /> : isAdmin ? <ShieldCheck className="w-2.5 h-2.5" /> : null}
                      <span>{role}</span>
                    </span>
                  </div>

                  {group.description ? (
                    <p className="text-xs text-dark-muted line-clamp-2 min-h-[2rem]">
                      {group.description}
                    </p>
                  ) : (
                    <p className="text-xs text-dark-muted/60 italic min-h-[2rem]">
                      No description provided.
                    </p>
                  )}

                  {/* Join Code Badge with Copy */}
                  <div className="mt-4 flex items-center justify-between p-2.5 rounded-xl bg-dark-surface/60 border border-dark-border">
                    <div className="flex items-center gap-1.5 text-xs text-dark-muted">
                      <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                      <span className="text-[11px] font-medium">Join Code:</span>
                      <span className="font-mono font-bold text-zinc-200 tracking-wider">
                        {group.joinCode}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => copyJoinCode(group.joinCode)}
                      title="Copy join code"
                      className="p-1 text-zinc-400 hover:text-zinc-100 hover:bg-dark-hover rounded-lg transition-colors"
                    >
                      {copiedCode === group.joinCode ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="pt-4 mt-4 border-t border-dark-border/60 flex items-center justify-between">
                  <div className="text-xs text-dark-muted flex items-center gap-1.5 font-mono">
                    <Users className="w-3.5 h-3.5" />
                    <span>{group.memberCount} members</span>
                  </div>

                  <Link
                    to={`/groups/${group.id}`}
                    className="inline-flex items-center gap-1 text-xs font-bold text-flame-400 group-hover:text-flame-300 transition-colors font-mono"
                  >
                    <span>View Group</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CREATE GROUP MODAL */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-dark-card border border-dark-border rounded-3xl max-w-md w-full p-6 shadow-2xl relative">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-flame-500/10 border border-flame-500/30 flex items-center justify-center text-flame-400">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-zinc-100">Create New Group</h3>
                <p className="text-xs text-dark-muted">Start an accountability circle for habits & streaks</p>
              </div>
            </div>

            <form onSubmit={handleCreateGroup} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider mb-1.5">
                  Group Name <span className="text-flame-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  minLength={3}
                  maxLength={50}
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  placeholder="e.g. Daily LeetCode Grind"
                  className="w-full px-3.5 py-2.5 bg-dark-surface border border-dark-border rounded-xl text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-flame-500/80"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider mb-1.5">
                  Description <span className="text-zinc-500 text-[10px] lowercase font-normal">(optional)</span>
                </label>
                <textarea
                  rows={3}
                  maxLength={200}
                  value={createDescription}
                  onChange={(e) => setCreateDescription(e.target.value)}
                  placeholder="What is this group about? What habits are encouraged?"
                  className="w-full px-3.5 py-2.5 bg-dark-surface border border-dark-border rounded-xl text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-flame-500/80 resize-none"
                />
              </div>

              <div className="pt-3 border-t border-dark-border flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 bg-dark-surface hover:bg-dark-hover border border-dark-border text-zinc-300 rounded-xl text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!createName.trim() || isCreating}
                  className="px-5 py-2 bg-flame-500 hover:bg-flame-400 disabled:opacity-50 text-zinc-950 font-bold text-xs rounded-xl shadow-sm transition-all"
                >
                  {isCreating ? 'Creating...' : 'Create Group'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* JOIN GROUP MODAL */}
      {isJoinOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-dark-card border border-dark-border rounded-3xl max-w-sm w-full p-6 shadow-2xl relative">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <KeyRound className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-zinc-100">Join a Group</h3>
                <p className="text-xs text-dark-muted">Enter the 6-character group invite code</p>
              </div>
            </div>

            <form onSubmit={handleJoinGroup} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider mb-1.5">
                  Invite / Join Code
                </label>
                <input
                  type="text"
                  required
                  maxLength={10}
                  value={joinCodeInput}
                  onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                  placeholder="e.g. 7X9K2P"
                  className="w-full px-3.5 py-2.5 bg-dark-surface border border-dark-border rounded-xl text-base text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500 font-mono tracking-widest text-center uppercase"
                />
              </div>

              <div className="pt-3 border-t border-dark-border flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsJoinOpen(false)}
                  className="px-4 py-2 bg-dark-surface hover:bg-dark-hover border border-dark-border text-zinc-300 rounded-xl text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!joinCodeInput.trim() || isJoining}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-zinc-950 font-bold text-xs rounded-xl shadow-sm transition-all"
                >
                  {isJoining ? 'Joining...' : 'Join Group'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
