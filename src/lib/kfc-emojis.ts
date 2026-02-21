// Custom KFC-themed emoji mappings
// These use standard emojis but are organized for quick KFC-specific access

export const KFC_EMOJIS = {
  food: [
    { emoji: "🍗", name: "Chicken Leg", shortcode: ":chicken:" },
    { emoji: "🍖", name: "Meat on Bone", shortcode: ":meat:" },
    { emoji: "🪣", name: "Bucket", shortcode: ":bucket:" },
    { emoji: "🍞", name: "Bread/Biscuit", shortcode: ":biscuit:" },
    { emoji: "🥤", name: "Drink", shortcode: ":drink:" },
    { emoji: "🍟", name: "Fries", shortcode: ":fries:" },
    { emoji: "🥗", name: "Coleslaw", shortcode: ":coleslaw:" },
    { emoji: "🧈", name: "Butter", shortcode: ":butter:" },
    { emoji: "🌶️", name: "Hot Sauce", shortcode: ":hot:" },
    { emoji: "🥫", name: "Gravy", shortcode: ":gravy:" },
  ],
  work: [
    { emoji: "👨‍🍳", name: "Chef", shortcode: ":chef:" },
    { emoji: "🔥", name: "Fire/Hot", shortcode: ":fire:" },
    { emoji: "✨", name: "Sparkles/Clean", shortcode: ":sparkles:" },
    { emoji: "🧹", name: "Broom", shortcode: ":broom:" },
    { emoji: "🧽", name: "Sponge", shortcode: ":sponge:" },
    { emoji: "💪", name: "Strong", shortcode: ":strong:" },
    { emoji: "⚡", name: "Fast", shortcode: ":fast:" },
    { emoji: "🎯", name: "Target/Goal", shortcode: ":target:" },
    { emoji: "✅", name: "Check/Done", shortcode: ":done:" },
    { emoji: "⏰", name: "Clock", shortcode: ":clock:" },
  ],
  celebration: [
    { emoji: "🎉", name: "Party", shortcode: ":party:" },
    { emoji: "🏆", name: "Trophy", shortcode: ":trophy:" },
    { emoji: "⭐", name: "Star", shortcode: ":star:" },
    { emoji: "🌟", name: "Glowing Star", shortcode: ":glowstar:" },
    { emoji: "👏", name: "Clap", shortcode: ":clap:" },
    { emoji: "🙌", name: "Hands Up", shortcode: ":handsup:" },
    { emoji: "💯", name: "100", shortcode: ":100:" },
    { emoji: "🔥", name: "Fire", shortcode: ":lit:" },
    { emoji: "💎", name: "Gem", shortcode: ":gem:" },
    { emoji: "👑", name: "Crown", shortcode: ":crown:" },
  ],
  reactions: [
    { emoji: "❤️", name: "Heart", shortcode: ":heart:" },
    { emoji: "😂", name: "Laughing", shortcode: ":lol:" },
    { emoji: "😍", name: "Heart Eyes", shortcode: ":hearteyes:" },
    { emoji: "🤩", name: "Star Eyes", shortcode: ":starstruck:" },
    { emoji: "😎", name: "Cool", shortcode: ":cool:" },
    { emoji: "🤔", name: "Thinking", shortcode: ":thinking:" },
    { emoji: "👍", name: "Thumbs Up", shortcode: ":thumbsup:" },
    { emoji: "👎", name: "Thumbs Down", shortcode: ":thumbsdown:" },
    { emoji: "🙏", name: "Pray/Thanks", shortcode: ":thanks:" },
    { emoji: "💪", name: "Flex", shortcode: ":flex:" },
  ],
  animals: [
    { emoji: "🐔", name: "Chicken", shortcode: ":chicken_bird:" },
    { emoji: "🐓", name: "Rooster", shortcode: ":rooster:" },
    { emoji: "🐣", name: "Hatching Chick", shortcode: ":chick:" },
    { emoji: "🐤", name: "Baby Chick", shortcode: ":babychick:" },
    { emoji: "🐥", name: "Front Chick", shortcode: ":frontchick:" },
    { emoji: "🦃", name: "Turkey", shortcode: ":turkey:" },
  ],
};

export const QUICK_REACTIONS = [
  { emoji: "❤️", name: "Love" },
  { emoji: "👍", name: "Like" },
  { emoji: "😂", name: "Funny" },
  { emoji: "🔥", name: "Fire" },
  { emoji: "👏", name: "Applause" },
  { emoji: "⭐", name: "Star" },
  { emoji: "🎉", name: "Celebrate" },
  { emoji: "💯", name: "Perfect" },
];

export const EMOJI_QUICK_REPLIES = [
  { emoji: "👍", text: "Got it!" },
  { emoji: "✅", text: "Done!" },
  { emoji: "🙏", text: "Thank you!" },
  { emoji: "👀", text: "Looking into it" },
  { emoji: "⏰", text: "On my way" },
  { emoji: "💪", text: "Will do!" },
  { emoji: "🎯", text: "Understood" },
  { emoji: "❤️", text: "Appreciate it!" },
];

// Helper to get all emojis as flat array
export function getAllKFCEmojis() {
  return [
    ...KFC_EMOJIS.food,
    ...KFC_EMOJIS.work,
    ...KFC_EMOJIS.celebration,
    ...KFC_EMOJIS.reactions,
    ...KFC_EMOJIS.animals,
  ];
}

// Helper to search emojis
export function searchKFCEmojis(query: string) {
  const all = getAllKFCEmojis();
  const lowerQuery = query.toLowerCase();
  return all.filter(e => 
    e.name.toLowerCase().includes(lowerQuery) ||
    e.shortcode.toLowerCase().includes(lowerQuery)
  );
}

// Convert shortcode to emoji
export function shortcodeToEmoji(text: string): string {
  let result = text;
  const all = getAllKFCEmojis();
  
  for (const item of all) {
    result = result.replace(new RegExp(item.shortcode, 'g'), item.emoji);
  }
  
  return result;
}
