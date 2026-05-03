/**
 * siteContent.js
 * ─────────────────────────────────────────────────────
 * Central data store for all static content on the BoneHard public website.
 * Imported by page views and components to keep content separate from logic.
 *
 * Sections:
 *   navItems       – Top-level navigation links
 *   authItems      – Header auth buttons (Login / Sign Up)
 *   heroContent    – Hero section data (title, CTA, video, logo)
 *   featuredWorks  – Featured video reel items
 *   showreelFilters – Filter tab labels for the show reel grid
 *   showreelItems  – Show reel portfolio grid items
 *   statsContent   – Footer data (stats, address, social links, pages)
 */

// ── Navigation ───────────────────────────────────────
/** Main navigation items rendered in the desktop nav and mobile menu */
export const navItems = [
  { label: 'Home', target: '#hero', type: 'section' },
  { label: 'Services', target: '#showreel', type: 'section' },
];

/** Auth action items rendered in the header when the user is a guest */
export const authItems = [
  { label: 'Login', target: '/login', type: 'route' },
  { label: 'Sign Up', target: '/register', type: 'route', primary: true },
];

// ── Hero Section ─────────────────────────────────────
export const heroContent = {
  id: 'hero',
  title: 'Bone Hard',
  cta: {
    label: 'Connect Us',
    target: '/connect',
    type: 'route',
  },
  backgroundVideo: '/assets/hero/hero.mp4',
  logo: '/assets/logo/new_logo.webp',
};

// ── Featured Works ────────────────────────────────────
/** Video reel items shown in the featured works carousel */
export const featuredWorks = [
  { title: 'PSI', src: '/assets/featured-works/work1.mp4', posterTone: 'stone' },
  { title: 'I Bar', src: '/assets/featured-works/work2.mp4', posterTone: 'black' },
  { title: 'Harvesting Guide', src: '/assets/featured-works/work3.mp4', posterTone: 'black' },
  { title: 'Stackable Guide', src: '/assets/featured-works/work4.mp4', posterTone: 'stone' },
];

// ── Show Reel ─────────────────────────────────────────
/** Filter categories shown above the show reel grid */
export const showreelFilters = [
  'All',
  'BH Stack Guides',
  'Prosthesis',
  'Sub-Periosteal Implants',
  'Guides',
];

/** Show reel portfolio grid items — each has a category, image, and layout hint */
export const showreelItems = [
  { title: 'Tooth Supported Guide', category: 'Guides', image: '/assets/showreel/bh-stack-guide.webp', layout: 'tooth-supported' },
  { title: 'Immediate Loading', category: 'BH Stack Guides', image: '/assets/showreel/immediate-loading.webp', layout: 'immediate-loading' },
  { title: 'Apicectomy Guide', category: 'Guides', image: '/assets/showreel/apicectomy-guide.webp', layout: 'apicectomy' },
  { title: 'Tissue Guide', category: 'Guides', image: '/assets/showreel/tooth-supported-guide.webp', layout: 'tissue-guide' },
  { title: 'Bone Guide', category: 'Guides', image: '/assets/showreel/tissue-guide.webp', layout: 'bone-guide' },
  { title: 'Zygomatic Guides', category: 'Guides', image: '/assets/showreel/zygomatic-guides.webp', layout: 'zygomatic' },
  { title: 'Crown Lengthening Guide', category: 'Guides', image: '/assets/showreel/crown-lengthening-guide.webp', layout: 'crown-lengthening' },
  { title: 'Nose Prosthesis', category: 'Prosthesis', image: '/assets/showreel/nose-prosthesis.webp', layout: 'nose-prosthesis' },
  { title: 'PSI', category: 'Sub-Periosteal Implants', image: '/assets/showreel/psi.webp', layout: 'psi' },
  { title: 'Mesh', category: 'Guides', image: '/assets/showreel/mesh.webp', layout: 'mesh' },
  { title: 'Complete Denture', category: 'Prosthesis', image: '/assets/showreel/complete-denture.webp', layout: 'complete-denture' },
  { title: 'I Bar', category: 'Prosthesis', image: '/assets/showreel/i-bar.webp', layout: 'ibar' },
];

// ── Stats & Footer ────────────────────────────────────
/** Data used by StatsFooterSection — stats counters, address, social links, and footer nav */
export const statsContent = {
  stats: [
    { value: '3+', label: 'Years' },
    { value: '2,000+', label: 'Cases' },
  ],
  address: {
    city: 'Dubai - UAE',
    mapTitle: 'BoneHard Dubai Location',
    mapEmbed: 'https://www.google.com/maps?q=Dubai,UAE&z=11&output=embed',
  },
  pages: [
    { label: 'Home', target: '#hero', type: 'section' },
    { label: 'Services', target: '#showreel', type: 'section' },
  ],
  socialAccounts: [
    { label: 'Instagram', target: '#social-coming-soon', type: 'placeholder' },
    { label: 'LinkedIn', target: '#social-coming-soon', type: 'placeholder' },
    { label: 'Email', target: '#social-coming-soon', type: 'placeholder' },
  ],
  logo: '/assets/logo/new_logo.webp',
  copyright: '© BoneHard. UAE - Dubai',
};
