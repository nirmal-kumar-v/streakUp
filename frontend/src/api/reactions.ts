import apiClient from './client';

export type EmojiType = 'FIRE' | 'STRONG' | 'CLAP' | 'CELEBRATE' | 'LIKE';
export type ReactionType = EmojiType;

export interface ReactionResponse {
  success: boolean;
  message?: string;
  completionId: string;
  counts: Record<EmojiType, number>;
  reactions?: Record<EmojiType, number>;
  userReactions: EmojiType[];
  totalCount: number;
}

export async function toggleStudyNoteReaction(completionId: string, emoji: EmojiType) {
  const res = await apiClient.post<ReactionResponse>(`/reactions/${completionId}`, { emoji });
  return res.data;
}

export async function fetchStudyNoteReactions(completionId: string) {
  const res = await apiClient.get<ReactionResponse>(`/reactions/${completionId}`);
  return res.data;
}
