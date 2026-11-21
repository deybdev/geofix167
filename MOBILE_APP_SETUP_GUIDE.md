## 1. Install Mobile Dependencies
Navigate to the mobile directory:

```
cd mobile
npm install
```
This installs the dependencies listed in the project's `package.json`.

**Important:** Do not update or install packages unnecessarily. Keep
dependency versions consistent with the repository and coordinate
dependency changes with the team.

## 2. Configure Environment Variables
Inside the `mobile` directory, create a file named `.env`:

```
EXPO_PUBLIC_API_URL=http://YOUR_PC_IP_ADDRESS:8787/api
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=YOUR_GOOGLE_WEB_CLIENT_ID
EXPO_PUBLIC_APP_NAME=GeoFix 167
EXPO_PUBLIC_APP_ENV=development
EXPO_PUBLIC_ACCESS_TOKEN_KEY=geofix_access_token
EXPO_PUBLIC_REFRESH_TOKEN_KEY=geofix_refresh_token
```

### Find your computer's local IP address
Open PowerShell:

```
ipconfig
```
Find the **IPv4 Address** under the active Wi-Fi or Ethernet adapter.
Replace `YOUR_PC_IP_ADDRESS` with that address.

Example:

```
EXPO_PUBLIC_API_URL=http://192.168.1.208:8787/api
```
When testing on a physical phone, the phone and development computer
should be connected to the same local network.

**Security reminder:** Variables beginning with `EXPO_PUBLIC_` are
included in the app bundle and can be read by users. Never put private
API keys, passwords, database credentials, or secret tokens in them.

## 3. Start the Backend
The mobile application needs the backend API to communicate with the
database and other services.

Open a **separate terminal** and navigate to the server directory:

```
cd geofix167/server
npm install
npx wrangler dev --ip 0.0.0.0
```
The local backend normally listens on port `8787`. Keep this terminal
running while testing the mobile app.

The `--ip 0.0.0.0` option allows other devices on your local network to
reach the development server. Your computer's firewall may need to allow
the connection.

## 4. Run the Mobile Application
Open another terminal and navigate to the mobile directory:

```
cd geofix167/mobile
npx expo start
```
To clear Expo's cache when troubleshooting:

```
npx expo start --clear
```

### Option A: Physical Android phone

1. Install Expo Go on your Android phone.
2. Connect the phone and development computer to the same Wi-Fi
   network.
3. Run `npx expo start` in the mobile directory.
4. Scan the QR code using Expo Go.
5. Wait for the app to bundle and load.

For a physical phone, use your computer's LAN IPv4 address in
`EXPO_PUBLIC_API_URL`. Do not use `localhost` or `127.0.0.1` because
those addresses refer to the phone itself.

### Option B: Android emulator

1. Install and open Android Studio.
2. Create or start an Android Virtual Device (AVD).
3. Keep the emulator running.
4. Configure the API URL in `.env` as:

   ```
   EXPO_PUBLIC_API_URL=http://10.0.2.2:8787/api
   ```

5. Start Expo:

   ```
   npx expo start
   ```

6. Press `a` in the Expo terminal to open the app in the Android
   emulator.

`10.0.2.2` is the special address Android emulators use to reach the
development computer's localhost.
