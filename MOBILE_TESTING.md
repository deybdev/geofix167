# GeoFix mobile testing

## Start the application

Run the backend:

```powershell
cd C:\Users\raino\OneDrive\Desktop\Projects\geofix167\server
npm run dev
```

Run the frontend in a second terminal:

```powershell
cd C:\Users\raino\OneDrive\Desktop\Projects\geofix167\client
npm run dev
```

Connect the phone and computer to the same Wi-Fi network, then open:

```text
http://192.168.43.38:5174
```

## Supported over local HTTP

- Login and manual registration
- Gmail OTP and registration email testing
- Registration status and document upload
- Responsive UI testing

## Requires HTTPS

- Reliable phone camera/barcode access
- Google OAuth on a non-localhost address

Use a secure tunnel before testing those features. Never place API keys in a tunnel command or public URL.

## Troubleshooting

- Allow Node.js through Windows Firewall on private networks if the phone cannot connect.
- Confirm both devices are on the same Wi-Fi and that mobile data/VPN is disabled temporarily.
- The Wi-Fi IP can change after reconnecting. Run `ipconfig`, then update `FRONTEND_ORIGIN` in `server/wrangler.jsonc` and this URL if needed.
