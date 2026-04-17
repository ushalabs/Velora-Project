const AUTH_API_URL = process.env.EXPO_PUBLIC_PUSH_API_URL?.trim() || '';

const postAuthJson = async <TResponse>(
  endpoint: string,
  payload: Record<string, unknown>
): Promise<TResponse> => {
  if (!AUTH_API_URL) {
    throw new Error('Authentication backend is not configured.');
  }

  const response = await fetch(`${AUTH_API_URL.replace(/\/$/, '')}/api/${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data?.error || data?.message || 'Authentication request failed.');
  }

  return data as TResponse;
};

export const sendSignupVerificationCode = async (email: string) =>
  postAuthJson<{ success: boolean }>('send-signup-code', { email });

export const verifySignupCodeAndCreateAccount = async (payload: {
  email: string;
  username: string;
  password: string;
  code: string;
}) =>
  postAuthJson<{ customToken: string }>('verify-signup-code', payload);
