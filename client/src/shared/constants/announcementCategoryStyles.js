export const ANNOUNCEMENT_CATEGORY_TONES = {
  "Clean & Green": "green",
  "BDRRMO Advisory": "red",
  Event: "amber",
  Health: "red",
  General: "neutral",
};

export const ANNOUNCEMENT_CATEGORY_BADGES = {
  green: "border-emerald-200 bg-emerald-50 text-emerald-800",
  red: "border-red-200 bg-red-50 text-red-800",
  amber: "border-amber-200 bg-amber-50 text-amber-800",
  neutral: "border-slate-200 bg-slate-100 text-slate-700",
};

export const announcementCategoryBadge = (category) =>
  ANNOUNCEMENT_CATEGORY_BADGES[ANNOUNCEMENT_CATEGORY_TONES[category] || "neutral"];

export const announcementCategoryOptions = (categories) => categories.map((category) => ({
  value: category,
  label: category,
  tone: ANNOUNCEMENT_CATEGORY_TONES[category] || "neutral",
}));
