// Mobile auth API tester — verifies the full token lifecycle end to end.
//
// Usage (from server/ with `npx wrangler dev` running in another terminal):
//   node scripts/test-mobile-auth.mjs
//   node scripts/test-mobile-auth.mjs 09123123123 password
//   MOBILE_API_URL=http://192.168.100.208:8787/api node scripts/test-mobile-auth.mjs

const API = process.env.MOBILE_API_URL ?? "http://127.0.0.1:8787/api";
const MOBILE = process.argv[2] ?? "09369369369";
const PASSWORD = process.argv[3] ?? "password";

let passed = 0;
let failed = 0;

function check(name, ok, detail = "") {
  const icon = ok ? "PASS" : "FAIL";
  console.log(`[${icon}] ${name}${detail ? ` — ${detail}` : ""}`);
  ok ? passed++ : failed++;
}

async function call(method, path, { token, body } = {}) {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  let data = null;
  try {
    data = await response.json();
  } catch {
    // non-JSON response
  }

  return { status: response.status, data };
}

// 1. Mobile login returns the token pair.
const login = await call("POST", "/auth/mobile/login", {
  body: { mobile_number: MOBILE, password: PASSWORD },
});
check(
  "POST /auth/login returns 200",
  login.status === 200,
  `status ${login.status} ${login.data?.error ?? ""}`,
);

const { access_token: accessToken, refresh_token: refreshToken, user } = login.data ?? {};
check(
  "login response contains access_token, refresh_token, user",
  Boolean(accessToken && refreshToken && user?.id && user?.role),
  `user: ${user ? `${user.full_name} (${user.role})` : "missing"}`,
);

// 1b. Mobile login rejects roles outside resident/responder.
const adminLogin = await call("POST", "/auth/mobile/login", {
  body: { mobile_number: "09123123123", password: PASSWORD },
});
check(
  "mobile login as admin is rejected with 401",
  adminLogin.status === 401 && adminLogin.data?.error === "Invalid mobile number or password.",
  `status ${adminLogin.status} ${adminLogin.data?.error ?? ""}`,
);

// 1c. The web endpoint still allows admin.
const webAdminLogin = await call("POST", "/auth/login", {
  body: { mobile_number: "09123123123", password: PASSWORD },
});
check(
  "web login as admin still works",
  webAdminLogin.status === 200,
  `status ${webAdminLogin.status}`,
);

// 2. The access token works as a Bearer credential.
const me = await call("GET", "/auth/me", { token: accessToken });
check(
  "GET /auth/me with Bearer access_token returns 200",
  me.status === 200 && me.data?.user?.id === user?.id,
  `status ${me.status}`,
);

// 3. Refresh mints a new access token.
const refresh = await call("POST", "/auth/mobile/refresh", {
  body: { refresh_token: refreshToken },
});
check(
  "POST /auth/mobile/refresh returns 200",
  refresh.status === 200,
  `status ${refresh.status} ${refresh.data?.error ?? ""}`,
);
check(
  "refresh returns a new access_token",
  Boolean(refresh.data?.access_token) && refresh.data.access_token !== accessToken,
);
check(
  "refresh keeps the same refresh_token",
  refresh.data?.refresh_token === refreshToken,
);

// 4. The refreshed access token is accepted.
const meAfterRefresh = await call("GET", "/auth/me", { token: refresh.data?.access_token });
check(
  "GET /auth/me with refreshed access_token returns 200",
  meAfterRefresh.status === 200 && meAfterRefresh.data?.user?.id === user?.id,
  `status ${meAfterRefresh.status}`,
);

// 5. Logout revokes both tokens.
const logout = await call("POST", "/auth/mobile/logout", {
  token: refresh.data?.access_token,
  body: { refresh_token: refreshToken },
});
check(
  "POST /auth/mobile/logout returns 200",
  logout.status === 200,
  `status ${logout.status}`,
);

const meAfterLogout = await call("GET", "/auth/me", { token: refresh.data?.access_token });
check(
  "revoked access_token is rejected with 401",
  meAfterLogout.status === 401,
  `status ${meAfterLogout.status}`,
);

// 6. Refreshing with the revoked refresh token fails.
const refreshAfterLogout = await call("POST", "/auth/mobile/refresh", {
  body: { refresh_token: refreshToken },
});
check(
  "revoked refresh_token is rejected with 401",
  refreshAfterLogout.status === 401,
  `status ${refreshAfterLogout.status}`,
);

console.log(`\n${passed} passed, ${failed} failed against ${API}`);
process.exit(failed > 0 ? 1 : 0);
