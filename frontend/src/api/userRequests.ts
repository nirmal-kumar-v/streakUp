import apiClient from './client';

export type UserRequestCategory =
  | 'FEATURE_REQUEST'
  | 'BUG_REPORT'
  | 'ACCOUNT_SUPPORT'
  | 'GENERAL_FEEDBACK'
  | 'OTHER';

export interface SubmitRequestPayload {
  category: UserRequestCategory;
  message: string;
}

export interface UserRequestResponse {
  success: boolean;
  message: string;
  request?: {
    id: string;
    userId: string;
    category: UserRequestCategory;
    message: string;
    status: string;
    createdAt: string;
  };
}

export async function submitUserRequest(data: SubmitRequestPayload): Promise<UserRequestResponse> {
  const response = await apiClient.post<UserRequestResponse>('/requests', data);
  return response.data;
}

export async function checkIfCurrentUserIsManager(): Promise<boolean> {
  try {
    const res = await apiClient.get<{ success: boolean; isManager: boolean }>('/requests/manager-check');
    return Boolean(res.data?.isManager);
  } catch {
    return false;
  }
}

export async function replyToUserRequestAsManager(
  requestId: string,
  replyMessage: string
): Promise<{ success: boolean; message: string }> {
  const res = await apiClient.post<{ success: boolean; message: string }>(
    `/requests/${requestId}/reply`,
    { replyMessage }
  );
  return res.data;
}

