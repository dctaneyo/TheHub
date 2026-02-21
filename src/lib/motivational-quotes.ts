export const motivationalQuotes = [
  { text: "Excellence is not a skill, it's an attitude.", author: "Ralph Marston" },
  { text: "The secret of getting ahead is getting started.", author: "Mark Twain" },
  { text: "Success is the sum of small efforts repeated day in and day out.", author: "Robert Collier" },
  { text: "Don't watch the clock; do what it does. Keep going.", author: "Sam Levenson" },
  { text: "The only way to do great work is to love what you do.", author: "Steve Jobs" },
  { text: "Quality is not an act, it is a habit.", author: "Aristotle" },
  { text: "Teamwork makes the dream work.", author: "John C. Maxwell" },
  { text: "Every accomplishment starts with the decision to try.", author: "Unknown" },
  { text: "Your attitude determines your direction.", author: "Unknown" },
  { text: "Small daily improvements lead to stunning results.", author: "Robin Sharma" },
  { text: "Be so good they can't ignore you.", author: "Steve Martin" },
  { text: "The harder you work, the luckier you get.", author: "Gary Player" },
  { text: "Success doesn't come from what you do occasionally, but what you do consistently.", author: "Marie Forleo" },
  { text: "Great things never come from comfort zones.", author: "Unknown" },
  { text: "The difference between ordinary and extraordinary is that little extra.", author: "Jimmy Johnson" },
  { text: "You don't have to be great to start, but you have to start to be great.", author: "Zig Ziglar" },
  { text: "A goal without a plan is just a wish.", author: "Antoine de Saint-Exupéry" },
  { text: "The best time to plant a tree was 20 years ago. The second best time is now.", author: "Chinese Proverb" },
  { text: "Do it with passion or not at all.", author: "Rosa Couchette Carey" },
  { text: "Your only limit is you.", author: "Unknown" },
];

export function getDailyQuote(): { text: string; author: string } {
  const today = new Date();
  const dayOfYear = Math.floor((today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / 86400000);
  const index = dayOfYear % motivationalQuotes.length;
  return motivationalQuotes[index];
}

export function getRandomQuote(): { text: string; author: string } {
  return motivationalQuotes[Math.floor(Math.random() * motivationalQuotes.length)];
}
