
import api from './api';
import axios from 'axios';
import * as AuthSession from 'expo-auth-session';
import * as Crypto from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';
import { secureStorage } from './secureStorage';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL;

const base64Url = (bytes) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

export const login = async (mobileNumber, password) => {
  try {
    const response = await api.post('/auth/mobile/login', {
      mobile_number: mobileNumber,
      password,
    });

    return response;
  } catch (error) {
    console.log('LOGIN API ERROR:', error.response?.data || error.message);
    throw error;
  }
};

export const getMe = () =>
  api.get('/auth/me');

const openGoogleAuth = async () => {
  const returnUri = AuthSession.makeRedirectUri({
    scheme: 'geofix167',
    path: 'auth',
  });
  const verifier = base64Url(await Crypto.getRandomBytesAsync(32));
  const digest = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    verifier,
    { encoding: Crypto.CryptoEncoding.BASE64 },
  );
  const challenge = digest.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const startUrl = `${API_BASE_URL}/auth/google/mobile/start?${new URLSearchParams({
    return_uri: returnUri,
    code_challenge: challenge,
  }).toString()}`;

  const result = await WebBrowser.openAuthSessionAsync(startUrl, returnUri);
  if (result.type !== 'success') return { canceled: true };

  const callback = new URL(result.url);
  const error = callback.searchParams.get('error');
  if (error) throw new Error('Google sign-in could not be completed.');
  const registrationTicket = callback.searchParams.get('registration_ticket');
  if (registrationTicket) {
    const { data } = await api.post('/auth/mobile/registration/exchange', {
      ticket: registrationTicket,
      code_verifier: verifier,
    });
    return { registration: data };
  }
  const ticket = callback.searchParams.get('ticket');
  if (!ticket) throw new Error('Google sign-in returned an invalid response.');

  const response = await api.post('/auth/mobile/google/exchange', {
    ticket,
    code_verifier: verifier,
  });
  return { response };
};

export const loginWithGoogle = async () => {
  const result = await openGoogleAuth();
  if (result.canceled) return result;
  if (result.registration) throw new Error('Complete your resident registration before signing in.');
  return result.response;
};

export const registerWithGoogle = openGoogleAuth;

export const logout = async () => {
  const refreshToken = await secureStorage.getRefreshToken();
  try {
    await api.post('/auth/mobile/logout', { refresh_token: refreshToken });
  } finally {
    await secureStorage.clearTokens();
  }
};

export const registerResident = (payload, registrationToken) =>
  api.post('/auth/register', payload, { headers: { 'X-Registration-Token': registrationToken } });

export const startRegistrationEmail = (email) =>
  api.post('/auth/mobile/registration/email/start', { email });

export const verifyRegistrationEmail = (emailToken, code) =>
  api.post('/auth/mobile/registration/email/verify', { email_token: emailToken, code });

export const getRegistrationStatus = (registrationToken) =>
  api.get('/auth/registration/status', { headers: { 'X-Registration-Token': registrationToken } });

export const uploadRegistrationDocument = async (asset, registrationToken) => {
  const fileResponse = await fetch(asset.uri);
  const fileBlob = await fileResponse.blob();
  return api.post('/auth/registration/document', fileBlob, {
    headers: {
      'Content-Type': asset.mimeType,
      'X-Registration-Token': registrationToken,
    },
    timeout: 30000,
  });
};

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
