
import api from './api';
import axios from 'axios';
import { secureStorage } from './secureStorage';

export const login = async (mobileNumber, password) => {
  try {
    const response = await api.post('/auth/mobile/login', {
      mobile_number: mobileNumber,
      password,
    });

    console.log('LOGIN STATUS:', response.status);
    console.log('LOGIN DATA:', response.data);

    return response;
  } catch (error) {
    console.log('LOGIN API ERROR:', error.response?.data || error.message);
    throw error;
  }
};

export const getMe = () =>
  api.get('/auth/me');

export const logout = async () => {
  try {
    await api.post('/auth/mobile/logout');
  } finally {
    await secureStorage.clearTokens();
  }
};

export const registerResident = (payload) =>
  api.post('/auth/register', payload);

export const verifyRegistrationOtp = (mobileNumber, code) =>
  api.post('/auth/otp/verify-registration', {
    mobile_number: mobileNumber,
    code,
  });

// Mobile token refresh
export const refreshMobileSession = async () => {
  const refreshToken = await secureStorage.getRefreshToken();

  if (!refreshToken) {
    throw new Error('No refresh token available.');
  }

  const { data } = await axios.post(
    `${process.env.EXPO_PUBLIC_API_URL}/auth/mobile/refresh`,
    { refresh_token: refreshToken },
    { timeout: 15000 }
  );

  await secureStorage.saveTokens(
    data.access_token,
    data.refresh_token
  );

  return data;
};

export default api;
