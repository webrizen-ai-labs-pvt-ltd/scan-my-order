// Single source of truth for marketing copy, links and pricing.
// Edit here — sections/pages only render what's declared below.

export const links = {
  admin: import.meta.env.VITE_ADMIN_URL || 'http://localhost:5173',
  contactEmail: import.meta.env.VITE_CONTACT_EMAIL || 'hello@scanmyorder.in',
  ecosystem: import.meta.env.VITE_ECOSYSTEM_URL || '#',
};

export const navLinks = [
  { to: '/#product', label: 'Product' },
  { to: '/#features', label: 'Features' },
  { to: '/#how-it-works', label: 'How it works' },
  { to: '/pricing', label: 'Pricing' },
  { to: '/#faq', label: 'FAQ' },
  { to: '/contact', label: 'Contact' },
];

// Tools a single subscription replaces — shown as a strip under the hero.
export const replaces = [
  'QR menu app',
  'POS terminal',
  'Kitchen display',
  'Table reservations',
  'Payment aggregator',
  'Inventory sheet',
];

export const problems = [
  {
    title: 'Four subscriptions, four invoices',
    body: 'A QR menu here, a POS there, a KDS from someone else — and none of them talk to each other.',
  },
  {
    title: 'Commission on every order',
    body: 'Aggregators sit between you and your customer and take a cut of every payment that flows through.',
  },
  {
    title: 'Blind spots between floor and kitchen',
    body: 'Orders get re-keyed, tickets get lost, and nobody knows what is actually in stock right now.',
  },
];

export const features = [
  {
    icon: 'qr',
    title: 'QR dine-in menus',
    body: 'Every table gets an unguessable QR. Guests scan, browse a live menu, add modifiers and pay — no app install.',
    colSpan: 2,
  },
  {
    icon: 'pos',
    title: 'Counter POS',
    body: 'Staff take walk-in and phone orders on the same engine, so every order lands in one queue.',
  },
  {
    icon: 'kds',
    title: 'Kitchen display',
    body: 'Tickets push to the kitchen the moment they are confirmed. No polling, no refresh button.',
  },
  {
    icon: 'floor',
    title: 'Live floor plan',
    body: 'See which tables are seated, ordering, waiting on food or ready to settle — from any device.',
    colSpan: 2,
  },
  {
    icon: 'inventory',
    title: 'Inventory & recipes',
    body: 'Link raw materials to dishes. Stock deducts when the kitchen starts cooking and items auto-hide when you run out.',
    colSpan: 2,
  },
  {
    icon: 'waiter',
    title: 'Waiter calls',
    body: 'A tap on the guest’s phone pings the floor. Rate-limited so nobody can spam your staff.',
  },
  {
    icon: 'review',
    title: 'Review gatekeeper',
    body: '4–5 star feedback is routed straight to your Google listing. Anything less stays private.',
  },
  {
    icon: 'promo',
    title: 'Promo codes',
    body: 'Flat or percentage discounts with minimum order values and expiry — validated at checkout.',
  },
  {
    icon: 'multi',
    title: 'Multi-store brands',
    body: 'One brand, many outlets. Store managers see only their location; you see everything.',
  },
];

export const steps = [
  {
    step: '01',
    title: 'Create your brand',
    body: 'Set up your name, logo and colours once. Every store you add inherits them.',
  },
  {
    step: '02',
    title: 'Add stores and menus',
    body: 'Build your menu with categories, modifiers and recipes. Invite a manager per location.',
  },
  {
    step: '03',
    title: 'Print QRs and go live',
    body: 'Export table QR codes as PDF or PNG, stick them on the tables and start taking orders.',
  },
];

export const byoak = {
  eyebrow: 'Bring your own API key',
  title: 'Keep 100% of every order.',
  body: 'Plug in your own Razorpay credentials. Payments settle directly into your account — we never touch the money, so there is no per-transaction fee to skim.',
  points: [
    'Credentials encrypted at rest with AES-256-GCM',
    'Payouts on your gateway’s schedule, not ours',
    'Switch or rotate keys without downtime',
    'Flat subscription — priced per store, not per order',
  ],
};

// Indicative pricing. Real plans are created by the platform admin;
// update these numbers to match whatever is live in the billing panel.
export const pricing = {
  currency: '₹',
  betaNote: 'Now in beta — early adopters get the platform free until public launch.',
  intervals: [
    { key: 'MONTHLY', label: 'Monthly' },
    { key: 'YEARLY', label: 'Yearly', hint: '2 months free' },
  ],
  plans: [
    {
      key: 'starter',
      name: 'Starter',
      tagline: 'For a single outlet getting off spreadsheets.',
      maxStores: 1,
      price: { MONTHLY: 1499, YEARLY: 14990 },
      cta: 'Apply for onboarding',
      features: [
        '1 store',
        'QR menus, POS and KDS',
        'Live floor plan',
        'Inventory and recipes',
        'Waiter calls and feedback',
        'Email support',
      ],
    },
    {
      key: 'growth',
      name: 'Growth',
      tagline: 'For brands running a handful of locations.',
      maxStores: 5,
      price: { MONTHLY: 1199, YEARLY: 11990 },
      perStore: true,
      highlighted: true,
      badge: 'Most popular',
      cta: 'Apply for onboarding',
      features: [
        'Up to 5 stores',
        'Everything in Starter',
        'Store-manager roles',
        'Promo codes',
        'Table reservations',
        'Priority support',
      ],
    },
    {
      key: 'franchise',
      name: 'Franchise',
      tagline: 'For chains that need a partner, not a vendor.',
      maxStores: null,
      price: null,
      cta: 'Talk to us',
      features: [
        'Unlimited stores',
        'Everything in Growth',
        'Dedicated onboarding',
        'Custom domain for menus',
        'SLA-backed support',
        'Invoicing and GST billing',
      ],
    },
  ],
};

export const faqs = [
  {
    q: 'Do my customers need to install an app?',
    a: 'No. Guests scan the QR on their table and the menu opens in their browser. Ordering and payment happen right there.',
  },
  {
    q: 'What does “bring your own API key” actually mean?',
    a: 'You connect your own Razorpay account. Card and UPI payments go straight to you, so there is no commission on orders — you only pay the flat platform subscription.',
  },
  {
    q: 'How is pricing calculated?',
    a: 'By the number of physical stores (locations) you run, not by headcount. Add as many staff, tables and menu items as you like.',
  },
  {
    q: 'Can a manager see other locations?',
    a: 'No. A store manager is scoped to their own outlet. Only the brand owner sees every store.',
  },
  {
    q: 'What happens if I stop paying?',
    a: 'Your data stays safe, but public QR menus and ordering pause until the subscription is active again.',
  },
  {
    q: 'Does it work with my existing printer or hardware?',
    a: 'The POS and kitchen display run in any modern browser — on a tablet, laptop or wall-mounted screen. No proprietary hardware required.',
  },
  {
    q: 'How do I get started?',
    a: 'Apply for onboarding. During beta we set up your brand with you, walk through the menu builder and hand you print-ready QR codes.',
  },
];

export const footerColumns = [
  {
    heading: 'Product',
    items: [
      { label: 'Features', to: '/#features' },
      { label: 'How it works', to: '/#how-it-works' },
      { label: 'Pricing', to: '/pricing' },
      { label: 'FAQ', to: '/#faq' },
    ],
  },
  {
    heading: 'Company',
    items: [
      { label: 'Contact', to: '/contact' },
      { label: 'Webrizen ecosystem', href: links.ecosystem },
      { label: 'Sign in', href: links.admin },
    ],
  },
];
