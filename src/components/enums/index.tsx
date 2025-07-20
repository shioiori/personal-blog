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
