// config/commissionRates.js
const commissionRates = {
  // Format: [userLevel][referralLevel]
  1: {
    1: { type: "fixed", value: 0.01 }, // $0.01 daily for Level 1 referrals
    2: { type: "percentage", value: 0.1 }, // 0.10% daily for Level 2 referrals
    3: { type: "percentage", value: 0.5 }, // 0.50% daily for Level 3 referrals
    4: { type: "percentage", value: 1.0 }, // 1.00% daily for Level 4 referrals
  },
  2: {
    1: { type: "fixed", value: 0.02 }, // $0.02 daily for Level 1 referrals
    2: { type: "percentage", value: 0.2 }, // 0.20% daily for Level 2 referrals
    3: { type: "percentage", value: 1.0 }, // 1.00% daily for Level 3 referrals
    4: { type: "percentage", value: 1.5 }, // 1.50% daily for Level 4 referrals
  },
  3: {
    1: { type: "fixed", value: 0.03 }, // $0.03 daily for Level 1 referrals
    2: { type: "percentage", value: 0.3 }, // 0.30% daily for Level 2 referrals
    3: { type: "percentage", value: 1.5 }, // 1.50% daily for Level 3 referrals
    4: { type: "percentage", value: 2.0 }, // 2.00% daily for Level 4 referrals
  },
  4: {
    1: { type: "fixed", value: 0.05 }, // $0.05 daily for Level 1 referrals
    2: { type: "percentage", value: 0.5 }, // 0.50% daily for Level 2 referrals
    3: { type: "percentage", value: 2.0 }, // 2.00% daily for Level 3 referrals
    4: { type: "percentage", value: 3.0 }, // 3.00% daily for Level 4 referrals
  },
};

module.exports = commissionRates;
