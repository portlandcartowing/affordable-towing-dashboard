// One-shot script to generate a Google Ads API refresh token.
// Run: node scripts/get-google-ads-refresh-token.mjs
//
// Reads GOOGLE_ADS_CLIENT_ID and GOOGLE_ADS_CLIENT_SECRET from .env.local,
// opens the consent URL in your browser, catches the redirect on
// http://localhost:3456, exchanges the code for a refresh token, and prints it.

import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { exec } from "node:child_process";
import { URL } from "node:url";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const CLIENT_ID = env.GOOGLE_ADS_CLIENT_ID;
const CLIENT_SECRET = env.GOOGLE_ADS_CLIENT_SECRET;
const REDIRECT_URI = "http://localhost:3456";
const SCOPE = "https://www.googleapis.com/auth/adwords";

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error("Missing GOOGLE_ADS_CLIENT_ID or GOOGLE_ADS_CLIENT_SECRET in .env.local");
  process.exit(1);
}

const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
authUrl.searchParams.set("client_id", CLIENT_ID);
authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
authUrl.searchParams.set("response_type", "code");
authUrl.searchParams.set("scope", SCOPE);
authUrl.searchParams.set("access_type", "offline");
authUrl.searchParams.set("prompt", "consent");

const server = createServer(async (req, res) => {
  const url = new URL(req.url, REDIRECT_URI);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  if (error) {
    res.end(`Error: ${error}`);
    console.error("Auth error:", error);
    server.close();
    process.exit(1);
  }
  if (!code) {
    res.end("Waiting for code...");
    return;
  }

  res.end("Got the code. You can close this tab.");

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
      grant_type: "authorization_code",
    }),
  });

  const data = await tokenRes.json();

  if (!data.refresh_token) {
    console.error("No refresh_token returned. Response:", data);
    server.close();
    process.exit(1);
  }

  console.log("\n========================================");
  console.log("REFRESH TOKEN (paste into .env.local as GOOGLE_ADS_REFRESH_TOKEN):");
  console.log(data.refresh_token);
  console.log("========================================\n");
  server.close();
  process.exit(0);
});

server.listen(3456, () => {
  console.log("Listening on", REDIRECT_URI);
  console.log("Opening browser to:\n", authUrl.toString(), "\n");
  const cmd =
    process.platform === "win32"
      ? `start "" "${authUrl.toString()}"`
      : process.platform === "darwin"
      ? `open "${authUrl.toString()}"`
      : `xdg-open "${authUrl.toString()}"`;
  exec(cmd);
});
