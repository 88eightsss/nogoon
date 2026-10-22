// Daily journal prompt, shown on the Local tab. One per day, the same all day.
export const JOURNAL_PROMPTS = [
  "What's one thing you did instead of scrolling?",
  'What were you really looking for the last time you reached for your phone?',
  'Name one thing that went right today, however small.',
  'What would you like to be doing with the time you got back?',
  'Who could you message today who would be glad to hear from you?',
  'What does your body need right now?',
  'What is one thing you are proud of this week?',
];

export const todaysPrompt = () => JOURNAL_PROMPTS[Math.floor(Date.now() / 86400000) % JOURNAL_PROMPTS.length];
