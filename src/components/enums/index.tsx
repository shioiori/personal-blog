export enum Theme {
  Light = "light",
  Dark = "dark"
}

export enum Language {
  VI = "vi",
  EN = "en"
}

export const LanguagesLabel = new Map<Language, string>([
  [Language.VI, "Tiếng Việt"],
  [Language.EN, "English"]
]);

export enum ProjectStatus {
  Ongoing = "ongoing",
  Completed = "completed",
  Upcoming = "upcoming"
}

export enum ReviewStatus {
  Idle = "idle",
  Loading = "loading",
  NoWords = "no_words",
  TooFew = "too_few",
  Ready = "ready",
  RateLimited = "rate_limited",
  Error = "error",
}

export enum TooltipMode {
  Full = "full",
  NoPinyin = "no_pinyin",
  NoMeaning = "no_meaning",
  Off = "off",
}
