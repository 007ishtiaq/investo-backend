// server/schedulers/midnightReset.js
const moment = require("moment");
const UserTask = require("../models/userTask");

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

// Function to delete old user task completions
const deleteOldTaskCompletions = async () => {
  try {
    // Get start of today (midnight of current day)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    console.log("Checking for old task completions before:", today);

    // Find user tasks that were created before today
    const oldUserTasks = await UserTask.find({
      createdAt: { $lt: today },
    });

    console.log(
      `Found ${oldUserTasks.length} old user task completions to delete`
    );

    if (oldUserTasks.length > 0) {
      // Delete all user tasks created before today
      const deleteResult = await UserTask.deleteMany({
        createdAt: { $lt: today },
      });

      console.log(
        `Successfully deleted ${deleteResult.deletedCount} old user task completions`
      );
    } else {
      console.log("No old user task completions found to delete");
    }
  } catch (error) {
    console.error("Error deleting old user task completions:", error);
  }
};

// Schedule the midnight reset
const scheduleMidnightReset = () => {
  const scheduleNextRun = () => {
    const timeUntilMidnight = getTimeUntilMidnight();
    setTimeout(async () => {
      console.log("Midnight reset: new day has begun!");

      // Delete old task completions
      await deleteOldTaskCompletions();

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

module.exports = { scheduleMidnightReset, deleteOldTaskCompletions };
