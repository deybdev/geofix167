
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

import {
  login as loginService,
  loginWithGoogle,
  getMe,
  logout as logoutService,
  refreshMobileSession,
} from '../services/authService';
import {
  getResponderDutyStatus,
  updateResponderDutyStatus,
} from '../services/responderDispatchService';

import { secureStorage } from '../services/secureStorage';

const AuthContext = createContext(null);

const maskMobileNumber = (mobileNumber) => {
  const digits = String(mobileNumber ?? '').replace(/\D/g, '');

  if (digits.length < 6) return '***';

  return `${digits.slice(0, 4)}*****${digits.slice(-2)}`;
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isRestoring, setIsRestoring] = useState(true);
  const [duty, setDuty] = useState({});
  const dutyRequest = useRef(null);
  const owner = user?.id;
  const role = user?.role;
  const onDuty = duty.owner === owner ? duty.confirmed ?? null : null;
  const dutyError = duty.owner === owner ? duty.error : null;
  const dutyBusy = duty.owner !== owner || !!duty.pending;

  const requestDuty = useCallback(async (value) => {
    if (!owner || dutyRequest.current) return;
    const token = {};
    dutyRequest.current = token;
    setDuty(current => ({ ...(current.owner === owner ? current : {}), owner, pending: true, error: null }));
    try {
      const confirmed = value === undefined ? await getResponderDutyStatus() : await updateResponderDutyStatus(value);
      if (dutyRequest.current === token) setDuty({ owner, confirmed });
    } catch (error) {
      if (dutyRequest.current === token) setDuty(current => ({ ...current, pending: false, retryValue: value,
        error: error.response?.data?.error || 'Duty status could not be confirmed. Please retry.' }));
    } finally {
      if (dutyRequest.current === token) dutyRequest.current = null;
    }
  }, [owner]);

  useEffect(() => {
    setDuty({});
    if (['bdrrmo', 'police', 'fire', 'tanod'].includes(String(role).toLowerCase())) void requestDuty();
    return () => { dutyRequest.current = null; };
  }, [requestDuty, role]);

  const toggleDuty = (value) => {
    if (typeof onDuty === 'boolean') return requestDuty(value ?? !onDuty);
  };
  const retryDuty = () => requestDuty(duty.retryValue);

  useEffect(() => {
    let active = true;

    const restoreSession = async () => {
      try {
        const [accessToken, refreshToken] = await Promise.all([
          secureStorage.getAccessToken(),
          secureStorage.getRefreshToken(),
        ]);

        if (!accessToken && !refreshToken) return;

        let response;
        try {
          response = await getMe();
        } catch (error) {
          if (error.response?.status !== 401 || !refreshToken) {
            if (error.response?.status === 401) {
              await secureStorage.clearTokens();
            } else {
              console.error(
                '[auth] session restore failed:',
                error.response?.data?.error || error.message,
              );
            }
            return;
          }

          await refreshMobileSession();
          response = await getMe();
        }

        const userData = response.data?.user;
        if (!userData?.id || !userData?.role) {
          await secureStorage.clearTokens();
          return;
        }

        if (active) setUser(userData);
      } catch (error) {
        if (error.response?.status === 401) {
          await secureStorage.clearTokens();
        } else {
          console.error(
            '[auth] session restore failed:',
            error.response?.data?.error || error.message,
          );
        }
      } finally {
        if (active) setIsRestoring(false);
      }
    };

    restoreSession();
    return () => {
      active = false;
    };
  }, []);

  const signIn = async (mobileNumber, password) => {
    const startedAt = Date.now();

    try {
      setLoading(true);

      // 1. Send login request
      console.log(`[auth] login attempt mobile=${maskMobileNumber(mobileNumber)}`);
      const response = await loginService(mobileNumber, password);

      // 2. Get tokens from backend
      const {
        access_token,
        refresh_token,
        user: userData,
      } = response.data;

      // 3. Validate token response
      if (!access_token || !refresh_token || !userData) {
        console.error('Login response is missing required fields.');

        console.log(
          'Response fields:',
          Object.keys(response.data || {})
        );

        return {
          success: false,
          message: 'Invalid authentication response from server.',
        };
      }

      // 4. Save tokens securely
      await secureStorage.saveTokens(
        access_token,
        refresh_token
      );

      // 5. Save authenticated user
      setUser(userData);

      console.log('========== LOGIN SUCCESS ==========');
      console.log('User:', userData.full_name);
      console.log('Role:', userData.role);
      console.log('Access token stored:', true);
      console.log('Refresh token stored:', true);
      console.log(
        `[auth] login success mobile=${maskMobileNumber(mobileNumber)} role=${userData.role} duration=${Date.now() - startedAt}ms`,
      );
      console.log('===================================');

      return {
        success: true,
        user: userData,
      };

    } catch (error) {
      console.log('========== LOGIN ERROR ==========');

      if (error.response) {
        // Backend responded with an error
        console.log('Status:', error.response.status);
        console.log(
          'Response:',
          JSON.stringify(error.response.data, null, 2)
        );
        console.log('Endpoint:', error.config?.url);
        console.log('Method:', error.config?.method?.toUpperCase());

      } else if (error.request) {
        // Request sent but no response received
        console.log('No response received from server.');
        console.log('Error:', error.message);

      } else {
        // Request setup error
        console.log('Error message:', error.message);
      }

      console.log('=================================');

      console.log(
        `[auth] login failed mobile=${maskMobileNumber(mobileNumber)} status=${error.response?.status ?? 'no-response'} duration=${Date.now() - startedAt}ms`,
      );

      return {
        success: false,
        message:
          error.response?.data?.message ||
          error.response?.data?.error ||
          (error.request
            ? 'Cannot reach the server. Check that the API is running and reachable.'
            : 'Login failed. Please try again.'),
      };

    } finally {
      setLoading(false);
    }
  };

  const signInWithGoogle = async () => {
    try {
      setLoading(true);
      const response = await loginWithGoogle();
      if (response.canceled) return { success: false, canceled: true };
      const { access_token, refresh_token, user: userData } = response.data ?? {};
      if (!access_token || !refresh_token || !userData?.id || !userData?.role) {
        return { success: false, message: 'Invalid authentication response from server.' };
      }
      await secureStorage.saveTokens(access_token, refresh_token);
      setUser(userData);
      return { success: true, user: userData };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.error || error.message || 'Google sign-in failed.',
      };
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      await logoutService();
    } catch (error) {
      console.error(
        'Logout error:',
        error.response?.data?.message || error.message
      );
    } finally {
      await secureStorage.clearTokens();
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isRestoring,
        onDuty,
        dutyError, dutyBusy, retryDuty,
        toggleDuty,
        signIn,
        signInWithGoogle,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
