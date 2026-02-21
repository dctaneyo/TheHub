export const loadingMessages = [
  "Frying up your data...",
  "Seasoning the database...",
  "Checking if the chicken crossed the road...",
  "Warming up the fryers...",
  "Counting the secret herbs and spices...",
  "Preparing your finger lickin' good data...",
  "Breading the bits and bytes...",
  "Heating up the servers...",
  "Marinating the metrics...",
  "Tossing the coleslaw of code...",
  "Mixing the mashed potatoes of data...",
  "Baking the biscuits of brilliance...",
  "Grilling the gravy of greatness...",
  "Spicing up the stats...",
  "Cooking up something special...",
  "Prepping the popcorn chicken of progress...",
  "Stirring the secret sauce...",
  "Flipping the tasks like hot cakes...",
  "Serving up fresh data...",
  "Crispy loading in progress...",
];

export function getRandomLoadingMessage(): string {
  return loadingMessages[Math.floor(Math.random() * loadingMessages.length)];
}
