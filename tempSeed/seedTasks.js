// server/seedTasks.js
const Task = require("../models/tasks");
const mongoose = require("mongoose");
require("dotenv").config();

// Replace with your MongoDB connection string
const MONGODB_URI =
  "mongodb://localhost:27017/MMIN?readPreference=primary&appname=MongoDB%20Compass&ssl=false";

const sampleTasks = [
  {
    title: "Follow us on Twitter",
    description:
      "Follow our official Twitter account to stay updated with the latest news and announcements.",
    steps: [
      "Click on the link to go to our Twitter profile",
      "Click the 'Follow' button",
      "Return here and enter your Twitter username to verify",
    ],
    reward: 0.005,
    type: "twitter_follow",
    link: "https://twitter.com/yourplatform",
    difficulty: "easy",
    estimatedTime: "2 min",
    active: true,
  },
  {
    title: "Subscribe to our YouTube channel",
    description:
      "Subscribe to our YouTube channel to access educational content and platform tutorials.",
    steps: [
      "Click on the link to go to our YouTube channel",
      "Click the 'Subscribe' button",
      "Return here and verify your subscription",
    ],
    reward: 0.008,
    type: "youtube_subscribe",
    link: "https://youtube.com/c/yourplatform",
    difficulty: "easy",
    estimatedTime: "2 min",
    active: true,
  },
  {
    title: "Join our Telegram community",
    description:
      "Join our Telegram group to connect with other investors and get real-time support.",
    steps: [
      "Click on the link to join our Telegram group",
      "Click 'Join Group'",
      "Enter your Telegram username to verify",
    ],
    reward: 0.007,
    type: "telegram_join",
    link: "https://t.me/yourplatform",
    difficulty: "easy",
    estimatedTime: "3 min",
    active: true,
  },
  {
    title: "Watch our investment strategy video",
    description:
      "Learn about effective investment strategies by watching our detailed tutorial video.",
    steps: [
      "Click on the link to watch the video",
      "Watch the complete video (at least 5 minutes)",
      "Return here to verify completion",
    ],
    reward: 0.01,
    type: "youtube_watch",
    link: "https://youtube.com/watch?v=your_video_id",
    difficulty: "medium",
    estimatedTime: "10 min",
    active: true,
  },
  {
    title: "Share our platform on Twitter",
    description:
      "Share our platform with your followers to help us grow and earn a reward.",
    steps: [
      "Click on the link to compose a tweet",
      "Add your thoughts about our platform (mention @yourplatform)",
      "Post the tweet and enter the tweet URL to verify",
    ],
    reward: 0.015,
    type: "twitter_share",
    link: "https://twitter.com/intent/tweet?text=I'm%20using%20YourPlatform%20for%20my%20investments!%20Join%20me%20at%20https://yourplatform.com%20@yourplatform",
    difficulty: "medium",
    estimatedTime: "3 min",
    active: true,
  },
  {
    title: "Complete Your Profile",
    description:
      "Fill out all the details in your profile to enhance your investment experience.",
    steps: [
      "Navigate to your profile settings",
      "Complete all required fields",
      "Save your profile changes",
    ],
    reward: 0.003,
    type: "profile",
    link: "/profile",
    difficulty: "easy",
    estimatedTime: "5 min",
    active: true,
  },
  {
    title: "Share your investment portfolio screenshot",
    description:
      "Take a screenshot of your investment portfolio in any trading app and share it with us.",
    type: "screenshot",
    difficulty: "easy",
    estimatedTime: "2 mins",
    reward: 0.015,
    steps: [
      "Open your trading app or investment platform",
      "Navigate to your portfolio overview",
      "Take a clear screenshot showing your investments",
      "Upload the screenshot here",
    ],
    note: "Your data is kept confidential and only used to verify task completion. Feel free to blur any sensitive information.",
    active: true,
    screenshotRequired: true,
    screenshotInstructions:
      "Screenshot must clearly show a portfolio overview with asset names and values visible.",
  },
  {
    title: "Verify app installation",
    description:
      "Install our mobile app and provide a screenshot of the installed app on your home screen.",
    type: "screenshot",
    difficulty: "easy",
    estimatedTime: "5 mins",
    reward: 0.01,
    externalUrl: "https://play.google.com/store/apps/details?id=com.ourapp",
    steps: [
      "Install our app from the App Store or Google Play",
      "Open the app and complete the initial setup",
      "Take a screenshot showing the app installed on your device",
      "Upload the screenshot for verification",
    ],
    note: "Make sure the app icon is clearly visible in your screenshot.",
    active: true,
    screenshotRequired: true,
    screenshotInstructions:
      "The screenshot should show our app icon on your device's home screen or app drawer.",
  },
  {
    title: "Complete a practice trade",
    description:
      "Make a practice trade on our platform and take a screenshot of the confirmed transaction.",
    type: "screenshot",
    difficulty: "medium",
    estimatedTime: "10 mins",
    reward: 0.025,
    externalUrl: "https://practice.ourinvestmentplatform.com",
    steps: [
      "Login to our practice trading platform",
      "Execute a sample trade of any cryptocurrency",
      "Take a screenshot of the transaction confirmation",
      "Upload the screenshot for verification",
    ],
    note: "This task helps you familiarize yourself with our trading interface.",
    active: true,
    screenshotRequired: true,
    screenshotInstructions:
      "Screenshot must show transaction details including asset name, amount, and confirmation status.",
  },
  {
    title: "Set price alerts for 3 cryptocurrencies",
    description:
      "Configure price alerts for at least 3 different cryptocurrencies on our platform.",
    type: "screenshot",
    difficulty: "medium",
    estimatedTime: "7 mins",
    reward: 0.02,
    steps: [
      "Navigate to the price alerts section",
      "Set up alerts for at least 3 different cryptocurrencies",
      "Take a screenshot showing all configured alerts",
      "Upload the screenshot for verification",
    ],
    active: true,
    screenshotRequired: true,
    screenshotInstructions:
      "Your screenshot should clearly show at least 3 different price alerts set up on our platform.",
  },
];

const seedTasks = async () => {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("Connected to MongoDB");

    await Task.deleteMany({});
    console.log("Cleared existing tasks");

    const result = await Task.insertMany(sampleTasks);
    console.log(`Added ${result.length} sample tasks`);

    mongoose.connection.close();
    console.log("Database connection closed");
  } catch (error) {
    console.error("Error seeding tasks:", error);
    process.exit(1);
  }
};

seedTasks();
