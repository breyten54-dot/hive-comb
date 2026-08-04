#!/usr/bin/env node
/**
 * Calendar sync stub for The Comb meetings strip.
 *
 * Accounts to connect:
 *   - Work Outlook: Breyten@praeto.co.za
 *   - Personal Google: Breyten54@gmail.com
 *
 * OAuth setup (NOT commitable):
 *   1. Microsoft Entra: register an app, add Calendars.Read, store client secret
 *      in ~/.eta-monitor/calendar.json under outlook.clientSecret (or env OUTLOOK_CLIENT_SECRET).
 *   2. Google Cloud: register OAuth 2.0 credentials, add Calendar API readonly scope,
 *      store client secret in ~/.eta-monitor/calendar.json under google.clientSecret
 *      (or env GOOGLE_CLIENT_SECRET).
 *   3. Run the auth flow once per provider to obtain refresh tokens; store them in the
 *      same file under outlook.refreshToken and google.refreshToken.
 *   4. NEVER commit ~/.eta-monitor/calendar.json or any .env containing secrets.
 *
 * Output: writes Comb/public/meetings.json with shape:
 *   { updatedAt, meetings: [{ id, title, start, end, source: "Work"|"Personal", url? }] }
 *
 * This stub documents the shape and writes an empty meetings file. Implement the actual
 * OAuth + fetch flows once tokens are available.
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const CONFIG_PATH = path.join(os.homedir(), '.eta-monitor', 'calendar.json');
const OUT_PATH = path.join(process.cwd(), 'public', 'meetings.json');

function loadConfig() {
  try {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    return {};
  }
}

async function fetchOutlookEvents(config) {
  // TODO: implement Microsoft Graph /calendarview using refreshToken + clientSecret.
  // Scope: https://graph.microsoft.com/Calendars.Read
  console.log('Outlook calendar sync not yet implemented. Token path:', CONFIG_PATH);
  return [];
}

async function fetchGoogleEvents(config) {
  // TODO: implement Google Calendar API using refreshToken + clientSecret.
  // Scope: https://www.googleapis.com/auth/calendar.readonly
  console.log('Google calendar sync not yet implemented. Token path:', CONFIG_PATH);
  return [];
}

async function main() {
  const config = loadConfig();
  const hasOutlook = config?.outlook?.refreshToken && config?.outlook?.clientSecret;
  const hasGoogle = config?.google?.refreshToken && config?.google?.clientSecret;

  if (!hasOutlook && !config?.outlook?.refreshToken) {
    console.log('Outlook refresh token not found. Run the OAuth flow for Breyten@praeto.co.za first.');
  }
  if (!hasGoogle && !config?.google?.refreshToken) {
    console.log('Google refresh token not found. Run the OAuth flow for Breyten54@gmail.com first.');
  }

  const work = hasOutlook ? await fetchOutlookEvents(config) : [];
  const personal = hasGoogle ? await fetchGoogleEvents(config) : [];

  const meetings = [
    ...work.map((m) => ({ ...m, source: 'Work' })),
    ...personal.map((m) => ({ ...m, source: 'Personal' })),
  ].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

  const out = { updatedAt: new Date().toISOString(), meetings };
  fs.writeFileSync(OUT_PATH, JSON.stringify(out, null, 2) + '\n', 'utf8');

  console.log(`Wrote ${meetings.length} meeting(s) to ${OUT_PATH}`);
  if (meetings.length === 0) {
    console.log('Tip: populate ~/.eta-monitor/calendar.json and rerun to pull real events.');
  }
}

main().catch((e) => {
  console.error('Calendar sync failed:', e.message || e);
  process.exit(1);
});
