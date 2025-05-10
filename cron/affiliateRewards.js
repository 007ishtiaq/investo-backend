// cron/affiliateRewards.js
const { processAffiliateRewards } = require("../functions/affiliateRewards");

// // Calculate time until midnight
// const getTimeUntilMidnight = () => {
//   const now = new Date();
//   const midnight = new Date(
//     now.getFullYear(),
//     now.getMonth(),
//     now.getDate() + 1,
//     0,
//     0,
//     0
//   );
//   return midnight.getTime() - now.getTime();
// };

// // Schedule the task to run at midnight every day
// const scheduleAffiliateRewards = () => {
//   console.log("Scheduling daily affiliate rewards task...");

//   const scheduleNextRun = () => {
//     const timeUntilMidnight = getTimeUntilMidnight();

//     setTimeout(async () => {
//       console.log("Running daily affiliate rewards task...");
//       try {
//         const result = await processAffiliateRewards();
//         console.log("Affiliate rewards task completed:", result);
//       } catch (error) {
//         console.error("Error in affiliate rewards task:", error);
//       }

//       // Schedule next day's run
//       scheduleNextRun();
//     }, timeUntilMidnight);

//     console.log(
//       `Next affiliate rewards run scheduled in ${Math.floor(
//         timeUntilMidnight / 3600000
//       )} hours`
//     );
//   };

//   // Start the scheduling loop
//   scheduleNextRun();
// };

// Schedule the task to run at midnight every day (normal mode)
const scheduleAffiliateRewards = () => {
  console.log("Scheduling affiliate rewards task...");
  // DEMO MODE: Run every 4 seconds instead of midnight
  const isDemoMode = true; // Set to false to revert to normal midnight schedule

  if (isDemoMode) {
    console.log("🚀 DEMO MODE: Running affiliate rewards every 4 seconds");

    // Initial run
    setTimeout(async () => {
      runAffiliateRewards();
    }, 1000); // Wait 1 second for initial run

    // Set interval for subsequent runs
    setInterval(() => {
      runAffiliateRewards();
    }, 10000); // Run every 4 seconds
  } else {
    // Normal mode - run at midnight
    const scheduleNextRun = () => {
      const timeUntilMidnight = getTimeUntilMidnight();
      setTimeout(async () => {
        runAffiliateRewards();
        // Schedule next day's run
        scheduleNextRun();
      }, timeUntilMidnight);
      console.log(
        `Next affiliate rewards run scheduled in ${Math.floor(
          timeUntilMidnight / 3600000
        )} hours`
      );
    };
    // Start the scheduling loop for normal mode
    scheduleNextRun();
  }
};
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
// Extract the reward processing into a separate function for reuse
const runAffiliateRewards = async () => {
  console.log("Running affiliate rewards task...");
  try {
    const result = await processAffiliateRewards();
    console.log("✅ Affiliate rewards task completed:", result);
  } catch (error) {
    console.error("❌ Error in affiliate rewards task:", error);
  }
};

module.exports = { scheduleAffiliateRewards };
