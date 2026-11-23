import * as SecureStore from 'expo-secure-store';

const ACCESS_TOKEN_KEY =
  process.env.EXPO_PUBLIC_ACCESS_TOKEN_KEY || 'geofix_access_token';

const REFRESH_TOKEN_KEY =
  process.env.EXPO_PUBLIC_REFRESH_TOKEN_KEY || 'geofix_refresh_token';

export const secureStorage = {
  async saveTokens(accessToken, refreshToken) {
    await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken);
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
  },

  async getAccessToken() {
    return SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
  },

  async getRefreshToken() {
    return SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
  },

  async clearTokens() {
    await Promise.all([
      SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
      SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
    ]);
  },
};