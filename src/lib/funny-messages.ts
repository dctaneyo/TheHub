// Funny error messages, encouraging messages, and puns for The Hub

export const ERROR_MESSAGES = [
  "Oops! The chicken crossed the road... and took our data with it! 🐔",
  "Well, this is finger lickin' bad! Something went wrong.",
  "Houston, we have a problem... and it's not the gravy! 🚀",
  "Error 404: Chicken not found. Please try again!",
  "Looks like we dropped the biscuit on this one! 🥖",
  "The Colonel is not pleased... but we're fixing it! 👨‍🍳",
  "Uh oh! Looks like the fryer's acting up again! 🔥",
  "Something's not quite original recipe here... 🤔",
  "We've got a code red... and it's not the hot sauce! 🌶️",
  "Whoops! That didn't go as crispy as planned! 🍗",
];

export const ENCOURAGING_MESSAGES = [
  "You're crushing it! 💪",
  "Absolutely finger lickin' fantastic! 🌟",
  "You're on fire! (In a good way!) 🔥",
  "The Colonel would be proud! 👨‍🍳",
  "Keep up the amazing work! ⭐",
  "You're the secret ingredient to success! ✨",
  "Legendary performance! 🏆",
  "You're making it look easy! 😎",
  "Outstanding work, superstar! 🌟",
  "You're cooking with gas now! 🔥",
  "Absolutely cluckin' brilliant! 🐔",
  "You're the MVP of the day! 🏅",
];

export const TASK_COMPLETION_PUNS = [
  "Nailed it! That task is done and dusted! ✅",
  "Boom! Another one bites the crust! 🍞",
  "Task completed! You're on a roll! 🎯",
  "Fried, tried, and verified! ✨",
  "Check! That's how it's done! 💯",
  "Crushed it like a crispy coating! 🍗",
  "Task complete! You're unstoppable! 🚀",
  "Bam! That's what we call efficiency! ⚡",
  "Done deal! Moving on to greatness! 🌟",
  "Task conquered! Nothing can stop you! 💪",
  "Perfection! The Colonel approves! 👨‍🍳",
  "Completed! You're a task-tackling machine! 🤖",
];

export const STREAK_MESSAGES = [
  "You're on fire! 🔥 Keep that streak alive!",
  "Unstoppable! Your streak is legendary! ⚡",
  "Hot streak! Don't let it cool down! 🌶️",
  "Streak master! You're absolutely crushing it! 💪",
  "On a roll! This streak is finger lickin' good! 🍗",
  "Incredible! Your consistency is inspiring! ⭐",
  "Streak champion! Keep up the amazing work! 🏆",
  "Blazing! This streak is getting spicy! 🔥",
  "Phenomenal! Your dedication is unmatched! 💎",
  "Epic streak! You're making history! 📈",
];

export const ACHIEVEMENT_UNLOCKED_MESSAGES = [
  "Achievement unlocked! You're a legend! 🏆",
  "New badge earned! The Colonel is impressed! 🎖️",
  "Congratulations! You've reached new heights! 🚀",
  "Badge unlocked! You're absolutely crushing it! 💪",
  "Achievement get! You're on the path to greatness! ⭐",
  "New milestone! Keep up the fantastic work! 🌟",
  "Badge earned! Your dedication is paying off! 💎",
  "Achievement complete! You're unstoppable! ⚡",
  "Unlocked! Another step towards legendary status! 👑",
  "New achievement! You're making it look easy! 😎",
];

export const LEVEL_UP_MESSAGES = [
  "LEVEL UP! You're climbing the ranks! 📈",
  "Ding! New level unlocked! Keep going! 🔔",
  "Level up! You're getting stronger! 💪",
  "Congratulations! You've reached a new level! 🎉",
  "Leveled up! The sky's the limit! 🚀",
  "New level achieved! You're unstoppable! ⚡",
  "Level up! Your hard work is paying off! 💎",
  "Rank up! You're on your way to the top! 👑",
  "Level unlocked! Keep pushing forward! 🌟",
  "You've leveled up! Legendary status incoming! 🏆",
];

export const LOADING_MESSAGES_EXTENDED = [
  "Frying up your data... 🍗",
  "Counting the secret herbs and spices... 🌿",
  "Warming up the fryers... 🔥",
  "Checking the biscuits... 🥖",
  "Preparing the gravy... 🥣",
  "Seasoning your experience... ✨",
  "Mixing the perfect blend... 🥄",
  "Getting the bucket ready... 🪣",
  "Prepping the coleslaw... 🥗",
  "Heating up the kitchen... 👨‍🍳",
  "Breading the chicken... 🍗",
  "Stirring the pot... 🍲",
  "Flipping the drumsticks... 🔄",
  "Tossing the wings... 🍗",
  "Checking the temperature... 🌡️",
  "Assembling your order... 📦",
  "Adding the finishing touches... ✨",
  "Making it finger lickin' good... 😋",
  "Cooking up something special... 🎯",
  "Almost ready to serve... ⏰",
];

export const EMPTY_STATE_MESSAGES = {
  noTasks: "All done! Time to kick back and relax! 🎉",
  noMessages: "Inbox zero! You're a messaging master! 📬",
  noNotifications: "Peace and quiet! Enjoy the calm! 😌",
  noCompletions: "Ready to start crushing some tasks? Let's go! 💪",
  noMissed: "Perfect! No missed tasks yesterday! ⭐",
  noUpcoming: "All clear ahead! Smooth sailing! ⛵",
};

export const CELEBRATION_MESSAGES = {
  allTasksDone: [
    "🎉 ALL TASKS COMPLETE! You're a superstar!",
    "🌟 PERFECT DAY! Every task conquered!",
    "🏆 FLAWLESS VICTORY! Nothing left to do!",
    "💯 100% COMPLETE! Absolutely legendary!",
    "⚡ UNSTOPPABLE! All tasks crushed!",
  ],
  earlyCompletion: [
    "⚡ Lightning fast! Early bird gets it done!",
    "🚀 Speed demon! Completed ahead of schedule!",
    "💨 Blazing fast! You're on fire!",
    "⏰ Early finish! Efficiency at its finest!",
    "🎯 Quick draw! Task completed early!",
  ],
  perfectWeek: [
    "🔥 PERFECT WEEK! Seven days of excellence!",
    "⭐ WEEK WARRIOR! Flawless performance!",
    "💪 UNSTOPPABLE WEEK! Every day perfect!",
    "🏆 WEEKLY CHAMPION! Absolutely crushing it!",
    "✨ MAGNIFICENT WEEK! Pure dedication!",
  ],
};

// Helper functions
export function getRandomErrorMessage(): string {
  return ERROR_MESSAGES[Math.floor(Math.random() * ERROR_MESSAGES.length)];
}

export function getRandomEncouragingMessage(): string {
  return ENCOURAGING_MESSAGES[Math.floor(Math.random() * ENCOURAGING_MESSAGES.length)];
}

export function getRandomTaskCompletionPun(): string {
  return TASK_COMPLETION_PUNS[Math.floor(Math.random() * TASK_COMPLETION_PUNS.length)];
}

export function getRandomStreakMessage(): string {
  return STREAK_MESSAGES[Math.floor(Math.random() * STREAK_MESSAGES.length)];
}

export function getRandomAchievementMessage(): string {
  return ACHIEVEMENT_UNLOCKED_MESSAGES[Math.floor(Math.random() * ACHIEVEMENT_UNLOCKED_MESSAGES.length)];
}

export function getRandomLevelUpMessage(): string {
  return LEVEL_UP_MESSAGES[Math.floor(Math.random() * LEVEL_UP_MESSAGES.length)];
}

export function getRandomLoadingMessage(): string {
  return LOADING_MESSAGES_EXTENDED[Math.floor(Math.random() * LOADING_MESSAGES_EXTENDED.length)];
}

export function getCelebrationMessage(type: 'allTasksDone' | 'earlyCompletion' | 'perfectWeek'): string {
  const messages = CELEBRATION_MESSAGES[type];
  return messages[Math.floor(Math.random() * messages.length)];
}
