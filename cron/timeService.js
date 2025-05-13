// server/services/timeService.js
const axios = require("axios");
const moment = require("moment-timezone");

// Pakistan timezone (UTC+5)
const TIMEZONE = "Asia/Karachi";

// Store the time offset
let internetTimeOffset = 0;
let lastSyncTime = 0;

// Multiple time API endpoints for redundancy
const TIME_APIS = [
  {
    url: "https://worldtimeapi.org/api/timezone/Asia/Karachi",
    parser: (data) => new Date(data.datetime),
  },
  {
    url: "https://www.timeapi.io/api/Time/current/zone?timeZone=Asia/Karachi",
    parser: (data) => new Date(data.dateTime),
  },
  {
    url: "https://timeapi.vercel.app/api/Time/current/zone?timeZone=Asia/Karachi",
    parser: (data) => new Date(data.dateTime),
  },
  {
    url: "http://worldclockapi.com/api/json/utc/now",
    parser: (data) => new Date(data.currentDateTime),
  },
];

// Try to sync with each time API in sequence until one succeeds
async function syncInternetTime() {
  // Only sync if more than 1 hour since last sync
  const now = Date.now();
  if (now - lastSyncTime < 3600000 && lastSyncTime !== 0) {
    return;
  }

  // Try each API in turn
  for (const api of TIME_APIS) {
    try {
      console.log(`Trying to sync time with ${api.url}...`);
      const response = await axios.get(api.url, { timeout: 5000 });
      if (response.data) {
        const internetTime = api.parser(response.data).getTime();
        internetTimeOffset = internetTime - now;
        lastSyncTime = now;

        // console.log(`Time successfully synced with ${api.url}`);
        console.log(`Internet time: ${new Date(internetTime).toISOString()}`);
        // console.log(`Time offset: ${internetTimeOffset}ms`);

        // Successfully synced, no need to try other APIs
        return;
      }
    } catch (error) {
      console.error(`Failed to sync time with ${api.url}:`, error.message);
      // Continue to the next API
    }
  }

  // If we get here, all APIs failed
  console.error("All time sync attempts failed");
}

// Get the current internet time
function getCurrentInternetTime() {
  // Return time with the calculated offset
  return new Date(Date.now() + internetTimeOffset);
}

// Get start of today in UTC+5 timezone using internet time
function getStartOfToday() {
  // Get current internet time
  const internetNow = getCurrentInternetTime();

  // Convert to Pakistan timezone start of day
  const todayInTimezone = moment(internetNow).tz(TIMEZONE).startOf("day");
  // console.log("Internet-based today date:", todayInTimezone.format());

  return todayInTimezone.toDate();
}

// Get start of tomorrow in UTC+5 timezone
function getStartOfTomorrow() {
  const internetNow = getCurrentInternetTime();
  const tomorrowInTimezone = moment(internetNow)
    .tz(TIMEZONE)
    .startOf("day")
    .add(1, "day");
  return tomorrowInTimezone.toDate();
}

// Create a function to force sync and wait for result (useful at server startup)
async function forceSyncAndWait() {
  await syncInternetTime();

  // If sync was successful, return true
  if (lastSyncTime > 0) {
    return true;
  }

  // If all APIs failed, fallback to system time with warning
  console.warn("CRITICAL WARNING: Using system time which may be incorrect");
  return false;
}

// Sync on module load
syncInternetTime();

// Set up periodic sync
setInterval(syncInternetTime, 3600000); // Every hour

module.exports = {
  syncInternetTime,
  getCurrentInternetTime,
  getStartOfToday,
  getStartOfTomorrow,
  forceSyncAndWait,
};
