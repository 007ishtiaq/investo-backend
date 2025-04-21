// server/seedTasks.js
const Task = require("../models/tasks");
const mongoose = require("mongoose");
require("dotenv").config();

// Replace with your MongoDB connection string
const MONGODB_URI = process.env.DATABASE;

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
