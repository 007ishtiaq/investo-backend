// functions/affiliateRewards.js
const mongoose = require("mongoose");
const commissionRates = require("../config/commissionRates");

// Helper function to calculate reward amount
const calculateRewardAmount = (
  userLevel,
  referralLevel,
  referralInvestmentAmount = 0
) => {
  const rateInfo = commissionRates[userLevel]?.[referralLevel];

  if (!rateInfo) return 0;

  if (rateInfo.type === "fixed") {
    return rateInfo.value;
  } else if (rateInfo.type === "percentage" && referralInvestmentAmount > 0) {
    return (rateInfo.value / 100) * referralInvestmentAmount;
  }

  return 0;
};

// Get all users who are referrers
const processAffiliateRewards = async () => {
  try {
    console.log("Starting daily affiliate rewards processing...");

    // Get models when the function runs, not when the file loads
    const User = mongoose.model("User");
    const Wallet = mongoose.model("Wallet");
    const Transaction = mongoose.model("Transaction");
    const AffiliateReward = mongoose.model("AffiliateReward");

    // Get all users who have at least one referral
    const referrers = await User.find({}).exec();

    let totalRewardsProcessed = 0;
    let totalUsersRewarded = 0;

    for (const referrer of referrers) {
      // Skip if user level is invalid
      if (!referrer.level || referrer.level < 1 || referrer.level > 4) {
        continue;
      }

      // Find user's wallet
      let wallet = await Wallet.findOne({ email: referrer.email });

      // Skip if user has no wallet
      if (!wallet) {
        console.log(`User ${referrer.email} has no wallet, skipping`);
        continue;
      }

      // Find first level referrals
      const directReferrals = await User.find({
        referrer: referrer._id,
      }).exec();

      if (directReferrals.length === 0) {
        continue; // No referrals, skip this user
      }

      let totalReward = 0;
      const rewards = [];

      // Process first level referrals
      for (const directReferral of directReferrals) {
        // Calculate reward based on referral's level
        const rewardAmount = calculateRewardAmount(
          referrer.level,
          directReferral.level
        );

        if (rewardAmount <= 0) continue;

        totalReward += rewardAmount;

        // Create reward record
        rewards.push({
          user: referrer._id,
          amount: rewardAmount,
          referralUser: directReferral._id,
          referralLevel: directReferral.level,
          sourceLevel: referrer.level,
          status: "pending",
        });
      }

      // Check if we have rewards to process
      if (rewards.length > 0) {
        // Save all reward records
        await AffiliateReward.insertMany(rewards);

        // Update user's wallet
        wallet.balance += totalReward;
        wallet.lastUpdated = new Date();
        await wallet.save();

        // Create transaction for the total reward
        await new Transaction({
          email: referrer.email,
          walletId: wallet._id,
          amount: totalReward,
          type: "credit",
          status: "completed",
          source: "referral",
          description: `Daily affiliate reward from ${rewards.length} team members`,
          metadata: {
            rewardDate: new Date(),
            referralCount: rewards.length,
          },
        }).save();

        // Update user's total affiliate earnings
        referrer.affiliateEarnings += totalReward;
        await referrer.save();

        totalRewardsProcessed += totalReward;
        totalUsersRewarded++;
      }
    }

    console.log(
      `Affiliate rewards processed: $${totalRewardsProcessed.toFixed(
        2
      )} for ${totalUsersRewarded} users`
    );
    return {
      success: true,
      totalRewardsProcessed,
      totalUsersRewarded,
    };
  } catch (error) {
    console.error("Error processing affiliate rewards:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};

module.exports = {
  processAffiliateRewards,
  calculateRewardAmount,
};
