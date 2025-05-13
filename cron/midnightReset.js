// server/schedulers/midnightReset.js
const moment = require("moment");

// Helper function to calculate time until midnight
const getTimeUntilMidnight = () => {
  const now = new Date();
  const midnight = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
    0,
    0,
    0
  );
  return midnight.getTime() - now.getTime();
};

// Schedule the midnight reset
const scheduleMidnightReset = () => {
  const scheduleNextRun = () => {
    const timeUntilMidnight = getTimeUntilMidnight();
    setTimeout(() => {
      console.log("Midnight reset: new day has begun!");

      // Schedule the next day's reset
      scheduleNextRun();
    }, timeUntilMidnight);

    console.log(
      `Next midnight reset in ${Math.floor(timeUntilMidnight / 3600000)} hours`
    );
  };

  // Start the scheduling loop
  scheduleNextRun();
};

module.exports = { scheduleMidnightReset };
