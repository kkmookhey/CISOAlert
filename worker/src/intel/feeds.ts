export interface Feed { url: string; source: string; }
export const FEEDS: Feed[] = [
  { url: "https://www.bleepingcomputer.com/feed/", source: "BleepingComputer" },
  { url: "https://feeds.feedburner.com/TheHackersNews", source: "The Hacker News" },
  { url: "https://krebsonsecurity.com/feed/", source: "Krebs on Security" },
  { url: "https://www.darkreading.com/rss.xml", source: "Dark Reading" },
  { url: "https://www.theregister.com/security/headlines.atom", source: "The Register" },
  { url: "https://www.securityweek.com/feed/", source: "SecurityWeek" },
  { url: "https://techcrunch.com/category/artificial-intelligence/feed/", source: "TechCrunch" },
  { url: "https://venturebeat.com/category/ai/feed/", source: "VentureBeat" },
  { url: "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml", source: "The Verge" },
  { url: "https://www.technologyreview.com/topic/artificial-intelligence/feed", source: "MIT Tech Review" }
];
