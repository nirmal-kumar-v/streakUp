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
