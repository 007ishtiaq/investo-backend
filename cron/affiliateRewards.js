// cron/affiliateRewards.js
const { processAffiliateRewards } = require("../functions/affiliateRewards");

// Calculate time until midnight
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

// Schedule the task to run at midnight every day
const scheduleAffiliateRewards = () => {
  console.log("Scheduling daily affiliate rewards task...");

  const scheduleNextRun = () => {
    const timeUntilMidnight = getTimeUntilMidnight();

    setTimeout(async () => {
      console.log("Running daily affiliate rewards task...");
      try {
        const result = await processAffiliateRewards();
        console.log("Affiliate rewards task completed:", result);
      } catch (error) {
        console.error("Error in affiliate rewards task:", error);
      }

      // Schedule next day's run
      scheduleNextRun();
    }, timeUntilMidnight);

    console.log(
      `Next affiliate rewards run scheduled in ${Math.floor(
        timeUntilMidnight / 3600000
      )} hours`
    );
  };

  // Start the scheduling loop
  scheduleNextRun();
};

module.exports = { scheduleAffiliateRewards };
