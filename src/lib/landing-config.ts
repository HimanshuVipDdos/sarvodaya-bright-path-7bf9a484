export type OfflineCentre = {
  id: string;
  city: string;
  tag: string; // e.g. "Main Flagship", "Coming Soon", "Smart Lab"
  icon: string; // e.g. "📍", "🏙️", "🏛️"
  is_active: boolean;
};

export type LandingPageConfig = {
  // 1. Top Announcement Bar
  announcement_bar_enabled: boolean;
  announcement_bar_text: string;
  announcement_bar_link: string;
  announcement_bar_badge: string;

  // 2. Hero Section
  hero_badge_text: string;
  hero_headline_line1: string;
  hero_headline_highlight: string;
  hero_subtitle: string;
  hero_trust_rating: string;
  hero_trust_students: string;
  hero_trust_selections: string;
  hero_primary_btn_text: string;
  hero_primary_btn_link: string;
  hero_secondary_btn_text: string;
  hero_secondary_btn_link: string;
  hero_show_3d_model: boolean;

  // 3. Batches Showcase
  batches_section_enabled: boolean;
  batches_title: string;
  batches_subtitle: string;
  batches_categories: string[];
  batches_view_all_btn_text: string;
  batches_view_all_btn_link: string;

  // 4. Hall of Fame / Toppers Showcase
  toppers_section_enabled: boolean;
  toppers_badge: string;
  toppers_title: string;
  toppers_subtitle: string;
  toppers_bg_watermark: string;
  toppers_btn_text: string;
  toppers_btn_link: string;

  // 5. Star Faculty
  faculty_section_enabled: boolean;
  faculty_badge: string;
  faculty_title: string;
  faculty_subtitle: string;

  // 6. Offline Centres
  centres_section_enabled: boolean;
  centres_title: string;
  centres_subtitle: string;
  centres_card_title: string;
  centres_card_subtitle: string;
  centres_list: OfflineCentre[];
  centres_btn_text: string;
  centres_btn_link: string;

  // 7. Inquiry / Counseling Call
  inquiry_section_enabled: boolean;
  inquiry_title: string;
  inquiry_subtitle: string;
};

export const defaultLandingPageConfig: LandingPageConfig = {
  // 1. Top Announcement Bar
  announcement_bar_enabled: false,
  announcement_bar_text: "📢 New Offline & Online Batches Starting This Monday! Limited Seats Available.",
  announcement_bar_link: "/batches",
  announcement_bar_badge: "NEW BATCH",

  // 2. Hero Section
  hero_badge_text: "Bharat's #1 Dedicated Competitive Exam Institute",
  hero_headline_line1: "Apka Selection,",
  hero_headline_highlight: "Hamara Sankalp.",
  hero_subtitle: "Prepare with Top Kota & Delhi Faculty, Daily Interactive Live Classes, High-Yield DPPs, and All-India Rank CBT Mock Tests.",
  hero_trust_rating: "4.9/5 Rating",
  hero_trust_students: "50,000+ Students",
  hero_trust_selections: "1,200+ Selections",
  hero_primary_btn_text: "Explore Batches",
  hero_primary_btn_link: "/batches",
  hero_secondary_btn_text: "Take Free Mock Test",
  hero_secondary_btn_link: "/mock-tests",
  hero_show_3d_model: true,

  // 3. Batches Showcase
  batches_section_enabled: true,
  batches_title: "Popular Targeted Batches",
  batches_subtitle: "Choose your targeted competitive exam to view tailored, structured curriculum led by expert educators.",
  batches_categories: ["All", "UP Police", "SSC", "Banking", "Teaching", "Railway", "UPSC / UPPSC"],
  batches_view_all_btn_text: "View All Batches",
  batches_view_all_btn_link: "/batches",

  // 4. Hall of Fame / Toppers Showcase
  toppers_section_enabled: true,
  toppers_badge: "ACADEMIC EXCELLENCE",
  toppers_title: "Hall of Fame & Selections",
  toppers_subtitle: "Honoring the dedication, discipline, and outstanding ranks of our brilliant achievers.",
  toppers_bg_watermark: "TOPPERS",
  toppers_btn_text: "Explore All Selections",
  toppers_btn_link: "/results",

  // 5. Star Faculty
  faculty_section_enabled: true,
  faculty_badge: "LEARN FROM THE BEST",
  faculty_title: "Meet Our Star Faculty",
  faculty_subtitle: "Passionate subject matter experts with 10+ years of proven track record mentoring thousands of successful candidates.",

  // 6. Offline Centres
  centres_section_enabled: true,
  centres_title: "Explore Tech-Enabled Offline Centres",
  centres_subtitle: "Creating new benchmarks in classroom & hybrid learning experiences with modern smart labs.",
  centres_card_title: "Find Centre in your city",
  centres_card_subtitle: "Visit our flagship campus",
  centres_list: [
    { id: "1", city: "Kasganj (Main)", tag: "Active Flagship", icon: "📍", is_active: true },
    { id: "2", city: "Agra (Coming)", tag: "Coming Soon", icon: "🏙️", is_active: false },
    { id: "3", city: "Aligarh (Coming)", tag: "Coming Soon", icon: "🏙️", is_active: false },
    { id: "4", city: "Bareilly (Coming)", tag: "Coming Soon", icon: "🏙️", is_active: false },
  ],
  centres_btn_text: "Visit Offline Centre",
  centres_btn_link: "/contact",

  // 7. Inquiry / Counseling Call
  inquiry_section_enabled: true,
  inquiry_title: "Request a Free Career Counseling Call",
  inquiry_subtitle: "Have questions about which batch or exam path to choose? Our senior mentors will guide you.",
};

export function parseLandingPageConfig(raw: any): LandingPageConfig {
  if (!raw) return defaultLandingPageConfig;
  try {
    const data = typeof raw === "string" ? JSON.parse(raw) : raw;
    return {
      ...defaultLandingPageConfig,
      ...data,
      batches_categories: Array.isArray(data.batches_categories) && data.batches_categories.length > 0
        ? data.batches_categories
        : defaultLandingPageConfig.batches_categories,
      centres_list: Array.isArray(data.centres_list) && data.centres_list.length > 0
        ? data.centres_list
        : defaultLandingPageConfig.centres_list,
    };
  } catch {
    return defaultLandingPageConfig;
  }
}
