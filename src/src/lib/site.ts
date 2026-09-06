export const SITE = {
  name: "Sarvodaya Adhyeta",
  tagline: "Premium coaching for India's top competitive exams",
  owner: "Ravindra Singh",
  phone: "+91 93540 49870",
  phoneDigits: "919354049870",
  email: "info@sarvodayaadhyeta.in",
  address: "Near Sri Ganesh Inter College, Amanpur Road, Kasganj, Uttar Pradesh, India",
  mapsQuery: "Sri Ganesh Inter College, Amanpur Road, Kasganj, Uttar Pradesh",
  whatsappMessage: "Hello Sarvodaya Adhyeta, I would like to know more about your batches.",
} as const;

export const NAV = [
  { to: "/", label: "Home" },
  { to: "/about", label: "About" },
  { to: "/courses", label: "Courses" },
  { to: "/batches", label: "Batches" },
  { to: "/faculty", label: "Faculty" },
  { to: "/results", label: "Results" },
  { to: "/gallery", label: "Gallery" },
  { to: "/current-affairs", label: "Current Affairs" },
  { to: "/free-study-material", label: "Free Study Material" },
  { to: "/notifications", label: "Notifications" },
  { to: "/contact", label: "Contact" },
] as const;

export const whatsappHref = () =>
  `https://wa.me/${SITE.phoneDigits}?text=${encodeURIComponent(SITE.whatsappMessage)}`;
export const telHref = () => `tel:${SITE.phoneDigits}`;
