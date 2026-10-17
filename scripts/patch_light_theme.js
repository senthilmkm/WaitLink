const fs = require('fs');
const path = require('path');

const cssPath = path.join(__dirname, '..', 'style.css');
const content = fs.readFileSync(cssPath, 'utf8');

const marker = '/* Global Light Mode Canvas */';
const splitIndex = content.indexOf(marker);

if (splitIndex === -1) {
  console.error('Marker not found!');
  process.exit(1);
}

const before = content.substring(0, splitIndex);

const newLightCss = `/* Global Light Mode Canvas */
html[data-theme="light"],
html[data-theme="light"] body {
  background-color: #f1f5f9 !important;
  color: #090d16 !important;
}

/* 1. Universal Headings & Titles Across All Pages & Modals */
html[data-theme="light"] h1,
html[data-theme="light"] h2,
html[data-theme="light"] h3,
html[data-theme="light"] h4,
html[data-theme="light"] h5,
html[data-theme="light"] h6,
html[data-theme="light"] .hero-title,
html[data-theme="light"] .hero-card h3,
html[data-theme="light"] .feature-card h3,
html[data-theme="light"] .how-it-works-card h3,
html[data-theme="light"] .step-item h4,
html[data-theme="light"] .faq-question,
html[data-theme="light"] .footer-faq-section h3,
html[data-theme="light"] .footer-col h4,
html[data-theme="light"] .footer-brand-title,
html[data-theme="light"] .section-title-center h2,
html[data-theme="light"] .section-title-center h3,
html[data-theme="light"] .card-header h3,
html[data-theme="light"] .card h3,
html[data-theme="light"] .card h2,
html[data-theme="light"] .shop-title,
html[data-theme="light"] .public-shop-name,
html[data-theme="light"] .customer-name,
html[data-theme="light"] #ticket-customer-name,
html[data-theme="light"] .modal-card h2,
html[data-theme="light"] .modal-card h3,
html[data-theme="light"] .modal-card h4,
html[data-theme="light"] .onboarding-modal-header h2,
html[data-theme="light"] .dialog-title,
html[data-theme="light"] .settings-section-title,
html[data-theme="light"] .superadmin-title,
html[data-theme="light"] .analytics-summary-title,
html[data-theme="light"] .stat-card-value,
html[data-theme="light"] .metric-value,
html[data-theme="light"] .pricing-plan-title,
html[data-theme="light"] .pricing-plan-price,
html[data-theme="light"] .topup-pack-title,
html[data-theme="light"] .topup-pack-price,
html[data-theme="light"] .staff-name-title,
html[data-theme="light"] #home-tier-title,
html[data-theme="light"] #reg-success-shop-name,
html[data-theme="light"] #audit-modal-customer-name,
html[data-theme="light"] #delete-modal-title,
html[data-theme="light"] #upgrade-proc-title,
html[data-theme="light"] #modal-t1-title,
html[data-theme="light"] #modal-t2-title,
html[data-theme="light"] #modal-t3-title,
html[data-theme="light"] #modal-t1-price,
html[data-theme="light"] #sms-stat-allowance,
html[data-theme="light"] #public-checkin-title {
  color: #090d16 !important;
  font-weight: 800 !important;
}

/* 2. Universal Paragraphs, Descriptions & Secondary Text */
html[data-theme="light"] p,
html[data-theme="light"] .hero-subtitle,
html[data-theme="light"] .hero-card p,
html[data-theme="light"] .feature-card p,
html[data-theme="light"] .how-it-works-card p,
html[data-theme="light"] .step-item p,
html[data-theme="light"] .faq-answer p,
html[data-theme="light"] .footer-tagline,
html[data-theme="light"] .public-location,
html[data-theme="light"] .queue-status-text,
html[data-theme="light"] .section-title-center p,
html[data-theme="light"] .card-body p,
html[data-theme="light"] .modal-card p,
html[data-theme="light"] .dialog-message,
html[data-theme="light"] .form-hint,
html[data-theme="light"] .metric-label,
html[data-theme="light"] .metric-caption,
html[data-theme="light"] .checkin-details-row,
html[data-theme="light"] .settings-section-desc,
html[data-theme="light"] .footer-bottom-bar,
html[data-theme="light"] .public-contact-bar {
  color: #1e293b !important;
  font-weight: 500 !important;
}

html[data-theme="light"] strong,
html[data-theme="light"] b,
html[data-theme="light"] .strong {
  color: #090d16 !important;
  font-weight: 700 !important;
}

/* 3. Universal Inline White & Muted Text Hunter (Removes Buried/Washed-Out Text) */
html[data-theme="light"] [style*="color: #fff"]:not(.btn-primary):not(.btn-accent):not(.badge-primary):not(.position-badge.next-up):not(.btn-hero-action):not(#auth-submit-btn):not(#delete-shop-confirm-submit-btn):not([style*="background: #10b981"]):not([style*="background:#10b981"]):not([style*="background: #e11d48"]):not([style*="background:#e11d48"]):not([style*="background: var(--primary)"]):not([style*="background:#6366f1"]):not([style*="background: #6366f1"]):not(.badge-pro-pill),
html[data-theme="light"] [style*="color: #ffffff"]:not(.btn-primary):not(.btn-accent):not(.badge-primary):not(.position-badge.next-up):not(.btn-hero-action):not(#auth-submit-btn):not(#delete-shop-confirm-submit-btn):not([style*="background: #10b981"]):not([style*="background:#10b981"]):not([style*="background: #e11d48"]):not([style*="background:#e11d48"]):not([style*="background: var(--primary)"]):not([style*="background:#6366f1"]):not([style*="background: #6366f1"]):not(.badge-pro-pill),
html[data-theme="light"] [style*="color: white"]:not(.btn-primary):not(.btn-accent):not(.badge-primary):not(.position-badge.next-up):not(.btn-hero-action):not(#auth-submit-btn):not(#delete-shop-confirm-submit-btn),
html[data-theme="light"] [style*="color: rgb(255, 255, 255)"]:not(.btn-primary):not(.btn-accent):not(.badge-primary):not(.position-badge.next-up):not(.btn-hero-action):not(#auth-submit-btn):not(#delete-shop-confirm-submit-btn),
html[data-theme="light"] [style*="color: rgba(255, 255, 255"]:not(.btn-primary):not(.btn-accent):not(.badge-primary):not(.position-badge.next-up):not(.btn-hero-action):not(#auth-submit-btn):not(#delete-shop-confirm-submit-btn),
html[data-theme="light"] [style*="color: rgba(255,255,255"]:not(.btn-primary):not(.btn-accent):not(.badge-primary):not(.position-badge.next-up):not(.btn-hero-action):not(#auth-submit-btn):not(#delete-shop-confirm-submit-btn),
html[data-theme="light"] [style*="color: #94a3b8"],
html[data-theme="light"] [style*="color:#94a3b8"],
html[data-theme="light"] [style*="color: #64748b"],
html[data-theme="light"] [style*="color:#64748b"],
html[data-theme="light"] [style*="color: #cbd5e1"],
html[data-theme="light"] [style*="color:#cbd5e1"],
html[data-theme="light"] [style*="color: #a0aec0"],
html[data-theme="light"] [style*="color: var(--text-muted)"],
html[data-theme="light"] [style*="color:var(--text-muted)"],
html[data-theme="light"] [style*="color: var(--text-subtle)"],
html[data-theme="light"] [style*="color:var(--text-subtle)"] {
  color: #1e293b !important;
}

/* 4. Universal Dark/Semi-Transparent Inline Box Hunter (Converts to Solid Crisp Cards) */
html[data-theme="light"] [style*="background: rgba(15, 23, 42"],
html[data-theme="light"] [style*="background: rgba(0, 0, 0"],
html[data-theme="light"] [style*="background: rgba(0,0,0"],
html[data-theme="light"] [style*="background: rgba(255, 255, 255, 0.02)"],
html[data-theme="light"] [style*="background: rgba(255, 255, 255, 0.03)"],
html[data-theme="light"] [style*="background: rgba(255, 255, 255, 0.04)"],
html[data-theme="light"] [style*="background: rgba(255, 255, 255, 0.05)"],
html[data-theme="light"] [style*="background: rgba(255, 255, 255, 0.06)"],
html[data-theme="light"] [style*="background: rgba(255, 255, 255, 0.08)"],
html[data-theme="light"] [style*="background: rgba(255,255,255,0.02)"],
html[data-theme="light"] [style*="background: rgba(255,255,255,0.03)"],
html[data-theme="light"] [style*="background: rgba(255,255,255,0.04)"],
html[data-theme="light"] [style*="background: rgba(255,255,255,0.05)"],
html[data-theme="light"] [style*="background: rgba(255,255,255,0.06)"] {
  background: #f8fafc !important;
  border: 1.5px solid #cbd5e1 !important;
  color: #090d16 !important;
}

/* 5. Cards & Section Panels (All Pages) */
html[data-theme="light"] .card,
html[data-theme="light"] .hero-card,
html[data-theme="light"] .feature-card,
html[data-theme="light"] .how-it-works-card,
html[data-theme="light"] .public-card,
html[data-theme="light"] .queue-item-card,
html[data-theme="light"] .stat-card,
html[data-theme="light"] .owner-stat-card,
html[data-theme="light"] .retention-card,
html[data-theme="light"] .card-subpanel,
html[data-theme="light"] .phone-bubble-mockup,
html[data-theme="light"] .faq-item,
html[data-theme="light"] .staff-card,
html[data-theme="light"] .terminal-card,
html[data-theme="light"] .audit-event-card {
  background: #ffffff !important;
  border: 1.5px solid #cbd5e1 !important;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05), 0 1px 3px rgba(0, 0, 0, 0.04) !important;
  color: #090d16 !important;
}

html[data-theme="light"] .card:hover,
html[data-theme="light"] .hero-card:hover,
html[data-theme="light"] .feature-card:hover,
html[data-theme="light"] .staff-card:hover,
html[data-theme="light"] .terminal-card:hover,
html[data-theme="light"] .audit-event-card:hover {
  background: #f8fafc !important;
  border-color: #0891b2 !important;
  box-shadow: 0 8px 24px rgba(8, 145, 178, 0.12) !important;
}

html[data-theme="light"] .card-header {
  border-bottom: 1.5px solid #e2e8f0 !important;
}

html[data-theme="light"] .card-footer {
  background: #f8fafc !important;
  border-top: 1.5px solid #e2e8f0 !important;
}

/* 6. Universal Modals & Overlays (All 16 Modals + Dialog System) */
html[data-theme="light"] .modal-card,
html[data-theme="light"] .audit-trail-modal-card,
html[data-theme="light"] .onboarding-modal-card,
html[data-theme="light"] .upgrade-modal-card,
html[data-theme="light"] #pricing-audit-modal .modal-card,
html[data-theme="light"] #delete-shop-modal .modal-card,
html[data-theme="light"] #settings-modal .modal-card,
html[data-theme="light"] #auth-modal .modal-card,
html[data-theme="light"] #staff-role-modal .modal-card,
html[data-theme="light"] #modal-customer-checkin .modal-card,
html[data-theme="light"] #modal-support-reply .modal-card,
html[data-theme="light"] #modal-registration-success .modal-card,
html[data-theme="light"] #modal-customer-audit-trail .modal-card,
html[data-theme="light"] #modal-sms-topup .modal-card,
html[data-theme="light"] #modal-sms-logs .modal-card,
html[data-theme="light"] #modal-admin-credit-override .modal-card,
html[data-theme="light"] #modal-carrier-segments-guide .modal-card,
html[data-theme="light"] .waitlink-dialog-card {
  background: #ffffff !important;
  color: #090d16 !important;
  border: 2px solid #cbd5e1 !important;
  box-shadow: 0 25px 70px -15px rgba(0, 0, 0, 0.28), 0 0 1px rgba(0, 0, 0, 0.1) !important;
}

html[data-theme="light"] .modal-header,
html[data-theme="light"] .onboarding-modal-header,
html[data-theme="light"] .upgrade-modal-header {
  background: #f8fafc !important;
  border-bottom: 2px solid #e2e8f0 !important;
}

html[data-theme="light"] .close-btn,
html[data-theme="light"] .modal-close-btn,
html[data-theme="light"] .dialog-close-btn {
  background: #f1f5f9 !important;
  border: 1.5px solid #cbd5e1 !important;
  color: #1e293b !important;
  font-weight: 700 !important;
}

html[data-theme="light"] .close-btn:hover,
html[data-theme="light"] .modal-close-btn:hover,
html[data-theme="light"] .dialog-close-btn:hover {
  background: #fee2e2 !important;
  color: #b91c1c !important;
  border-color: #fca5a5 !important;
}

html[data-theme="light"] .dialog-title {
  color: #090d16 !important;
  font-weight: 800 !important;
}

html[data-theme="light"] .dialog-message {
  color: #1e293b !important;
  font-weight: 500 !important;
}

html[data-theme="light"] .dialog-footer {
  background: #f8fafc !important;
  border-top: 1.5px solid #e2e8f0 !important;
}

html[data-theme="light"] .dialog-footer #dialog-btn-cancel {
  background: #f1f5f9 !important;
  color: #1e293b !important;
  border: 1.5px solid #cbd5e1 !important;
  font-weight: 700 !important;
}

/* 7. All Tabs, Navigation & Header Dropdown Menus */
html[data-theme="light"] .app-header {
  background: #ffffff !important;
  border-bottom: 2px solid #e2e8f0 !important;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.04) !important;
}

html[data-theme="light"] .brand-name {
  background: linear-gradient(135deg, #090d16 0%, #0891b2 100%) !important;
  -webkit-background-clip: text !important;
  -webkit-text-fill-color: transparent !important;
  font-weight: 800 !important;
}

html[data-theme="light"] .mode-tabs {
  background: #e2e8f0 !important;
  border: 1.5px solid #cbd5e1 !important;
}

html[data-theme="light"] .tab-btn {
  color: #334155 !important;
  font-weight: 600 !important;
}

html[data-theme="light"] .tab-btn:hover {
  color: #090d16 !important;
  background: #f1f5f9 !important;
}

html[data-theme="light"] .tab-btn.active {
  background: #ffffff !important;
  color: #0891b2 !important;
  font-weight: 800 !important;
  border: 1.5px solid #0891b2 !important;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08) !important;
}

/* Header Dropdown Menus */
html[data-theme="light"] .dropdown-menu {
  background: #ffffff !important;
  border: 1.5px solid #cbd5e1 !important;
  box-shadow: 0 12px 36px rgba(0, 0, 0, 0.15) !important;
}

html[data-theme="light"] .dropdown-user-info {
  color: #090d16 !important;
  border-bottom: 1.5px solid #e2e8f0 !important;
}

html[data-theme="light"] .dropdown-header-title {
  color: #334155 !important;
  font-weight: 800 !important;
}

html[data-theme="light"] .dropdown-section-title {
  color: #0891b2 !important;
  font-weight: 800 !important;
}

html[data-theme="light"] .dropdown-item {
  color: #090d16 !important;
  font-weight: 600 !important;
}

html[data-theme="light"] .dropdown-item:hover {
  background: #f1f5f9 !important;
  color: #0891b2 !important;
}

html[data-theme="light"] .dropdown-item.active-shop-item {
  background: #e0f2fe !important;
  color: #0369a1 !important;
  font-weight: 700 !important;
}

html[data-theme="light"] .dropdown-divider {
  background: #e2e8f0 !important;
}

html[data-theme="light"] .shop-chip-btn {
  background: #ffffff !important;
  color: #090d16 !important;
  border: 1.5px solid #cbd5e1 !important;
  font-weight: 700 !important;
}

html[data-theme="light"] .shop-chip-btn:hover {
  border-color: #0891b2 !important;
  color: #0891b2 !important;
}

html[data-theme="light"] .mobile-menu-btn {
  background: #ffffff !important;
  color: #090d16 !important;
  border: 1.5px solid #cbd5e1 !important;
}

html[data-theme="light"] .mobile-menu-btn:hover,
html[data-theme="light"] .mobile-menu-btn:focus-visible {
  background: #f1f5f9 !important;
  border-color: #0891b2 !important;
  color: #0891b2 !important;
}

/* Mobile Drawer */
html[data-theme="light"] .mobile-drawer-panel {
  background: #ffffff !important;
  border-left: 2px solid #cbd5e1 !important;
}

html[data-theme="light"] .mobile-drawer-header {
  background: #f8fafc !important;
  border-bottom: 1.5px solid #e2e8f0 !important;
}

html[data-theme="light"] .mobile-drawer-close-btn {
  background: #f1f5f9 !important;
  border: 1.5px solid #cbd5e1 !important;
  color: #1e293b !important;
}

html[data-theme="light"] .mobile-drawer-close-btn:hover {
  background: #fee2e2 !important;
  border-color: #fca5a5 !important;
  color: #b91c1c !important;
}

html[data-theme="light"] .mobile-drawer-user-card {
  background: #f8fafc !important;
  border: 1.5px solid #cbd5e1 !important;
}

html[data-theme="light"] .mobile-drawer-user-email {
  color: #090d16 !important;
  font-weight: 700 !important;
}

html[data-theme="light"] .mobile-drawer-section-title {
  color: #334155 !important;
  font-weight: 800 !important;
}

html[data-theme="light"] .mobile-drawer-nav-item {
  color: #1e293b !important;
  font-weight: 600 !important;
}

html[data-theme="light"] .mobile-drawer-nav-item:hover {
  background: #f1f5f9 !important;
  color: #0891b2 !important;
}

html[data-theme="light"] .mobile-drawer-nav-item.active {
  background: #e0f2fe !important;
  color: #0369a1 !important;
  border-color: #7dd3fc !important;
  font-weight: 700 !important;
}

/* Settings Sub-Tabs Navigation */
html[data-theme="light"] .settings-subtabs-nav {
  background: #e2e8f0 !important;
  border-bottom: 2px solid #cbd5e1 !important;
  padding: 4px 6px !important;
  border-radius: 10px !important;
}

html[data-theme="light"] .settings-subtab-btn {
  color: #334155 !important;
  font-weight: 600 !important;
  border-radius: 8px !important;
}

html[data-theme="light"] .settings-subtab-btn:hover {
  color: #090d16 !important;
  background: #f1f5f9 !important;
}

html[data-theme="light"] .settings-subtab-btn.active {
  color: #0891b2 !important;
  background: #ffffff !important;
  font-weight: 800 !important;
  border: 1.5px solid #0891b2 !important;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.06) !important;
}

/* SuperAdmin Tabs & Navigation */
html[data-theme="light"] #superpanel-pricing .card,
html[data-theme="light"] #superadmin-panel .card {
  background: #ffffff !important;
  border: 1.5px solid #cbd5e1 !important;
}

html[data-theme="light"] #policy-card-desc-a,
html[data-theme="light"] #policy-card-desc-b {
  background: #f8fafc !important;
  border: 1.5px solid #cbd5e1 !important;
  color: #1e293b !important;
}

html[data-theme="light"] #admin-policy-opt-a.btn-secondary,
html[data-theme="light"] #admin-policy-opt-b.btn-secondary {
  background: #ffffff !important;
  color: #1e293b !important;
  border: 1.5px solid #cbd5e1 !important;
  font-weight: 700 !important;
}

html[data-theme="light"] .pricing-feature-row {
  background: #f8fafc !important;
  border: 1.5px solid #cbd5e1 !important;
}

/* Auth Role Switcher Tabs */
html[data-theme="light"] #auth-role-tabs-container {
  background: #e2e8f0 !important;
  border: 1.5px solid #cbd5e1 !important;
}

html[data-theme="light"] #auth-tab-owner,
html[data-theme="light"] #auth-tab-staff {
  color: #334155 !important;
  font-weight: 600 !important;
}

html[data-theme="light"] #auth-tab-owner.active,
html[data-theme="light"] #auth-tab-staff.active {
  background: #ffffff !important;
  color: #090d16 !important;
  font-weight: 800 !important;
  border: 1.5px solid #cbd5e1 !important;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08) !important;
}

/* 8. Forms, Inputs, Selects, Radios & Checkboxes */
html[data-theme="light"] input:not([type="checkbox"]):not([type="radio"]),
html[data-theme="light"] textarea,
html[data-theme="light"] select,
html[data-theme="light"] .dialog-input,
html[data-theme="light"] #desk-customer-phone,
html[data-theme="light"] #desk-service-select,
html[data-theme="light"] #inline-customer-name,
html[data-theme="light"] #inline-customer-phone,
html[data-theme="light"] #public-customer-name,
html[data-theme="light"] #public-customer-phone,
html[data-theme="light"] #new-service-emoji,
html[data-theme="light"] #new-service-name,
html[data-theme="light"] #new-service-duration,
html[data-theme="light"] #owner-input-promo,
html[data-theme="light"] #owner-input-promo-start,
html[data-theme="light"] #owner-input-promo-end,
html[data-theme="light"] #owner-shop-search,
html[data-theme="light"] #owner-staff-filter-shop,
html[data-theme="light"] #staff-assigned-shop,
html[data-theme="light"] #onboard-plan,
html[data-theme="light"] #onboard-promo-text,
html[data-theme="light"] #onboard-promo-start,
html[data-theme="light"] #onboard-promo-end,
html[data-theme="light"] #reply-message-text,
html[data-theme="light"] #pricing-t1-desc,
html[data-theme="light"] #pricing-t2-desc,
html[data-theme="light"] #pricing-t3-desc {
  background: #ffffff !important;
  color: #090d16 !important;
  border: 1.5px solid #94a3b8 !important;
  font-weight: 600 !important;
}

html[data-theme="light"] input:focus,
html[data-theme="light"] textarea:focus,
html[data-theme="light"] select:focus,
html[data-theme="light"] .dialog-input:focus {
  border-color: #0891b2 !important;
  outline: none !important;
  box-shadow: 0 0 0 3px rgba(8, 145, 178, 0.2) !important;
}

html[data-theme="light"] input::placeholder,
html[data-theme="light"] textarea::placeholder {
  color: #64748b !important;
  font-weight: 400 !important;
}

html[data-theme="light"] input:disabled,
html[data-theme="light"] textarea:disabled {
  background: #f1f5f9 !important;
  color: #475569 !important;
  border-color: #cbd5e1 !important;
}

html[data-theme="light"] label,
html[data-theme="light"] .form-group label,
html[data-theme="light"] .dialog-input-label {
  color: #090d16 !important;
  font-weight: 700 !important;
}

html[data-theme="light"] input[type="checkbox"],
html[data-theme="light"] input[type="radio"] {
  accent-color: #0891b2 !important;
  cursor: pointer !important;
}

html[data-theme="light"] select,
html[data-theme="light"] select option,
html[data-theme="light"] .filter-select option {
  background-color: #ffffff !important;
  color: #090d16 !important;
  font-weight: 600 !important;
}

/* Slug Wizard */
html[data-theme="light"] .slug-input-wrapper {
  background: #ffffff !important;
  border: 1.5px solid #94a3b8 !important;
}

html[data-theme="light"] .slug-prefix {
  background: #f1f5f9 !important;
  color: #1e293b !important;
  border-right: 1.5px solid #cbd5e1 !important;
  font-weight: 700 !important;
}

html[data-theme="light"] .slug-input-wrapper input {
  color: #090d16 !important;
  background: #ffffff !important;
  font-weight: 600 !important;
}

/* 9. Front Desk Queue Cards & Status Badges */
html[data-theme="light"] .mode-badge-toggle {
  background: #ffffff !important;
  border: 1.5px solid #cbd5e1 !important;
  color: #1e293b !important;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08) !important;
}

html[data-theme="light"] .mode-badge-toggle:hover {
  background: #f8fafc !important;
  border-color: #0891b2 !important;
}

html[data-theme="light"] .mode-badge-toggle strong {
  color: #0891b2 !important;
}

html[data-theme="light"] .position-badge {
  background: #f1f5f9 !important;
  color: #1e293b !important;
  border: 1.5px solid #94a3b8 !important;
  font-weight: 800 !important;
}

html[data-theme="light"] .position-badge.next-up {
  background: #dcfce7 !important;
  color: #14532d !important;
  border: 1.5px solid #16a34a !important;
  box-shadow: 0 0 10px rgba(22, 163, 74, 0.25) !important;
  font-weight: 800 !important;
}

html[data-theme="light"] .queue-item-card.next-up {
  background: #f0fdf4 !important;
  border: 2px solid #22c55e !important;
  box-shadow: 0 6px 20px rgba(34, 197, 94, 0.15) !important;
}

html[data-theme="light"] .badge-service {
  background: #e0f2fe !important;
  color: #0369a1 !important;
  border: 1.5px solid #7dd3fc !important;
  font-weight: 700 !important;
}

html[data-theme="light"] .badge-late {
  background: #fef3c7 !important;
  color: #92400e !important;
  border: 1.5px solid #fcd34d !important;
  font-weight: 700 !important;
}

html[data-theme="light"] .timer-pill {
  background: #fef3c7 !important;
  color: #92400e !important;
  border: 1.5px solid #fcd34d !important;
  font-weight: 700 !important;
}

html[data-theme="light"] .customer-phone-link {
  color: #0369a1 !important;
  font-weight: 700 !important;
}

/* 10. Buttons (High-Contrast System) */
html[data-theme="light"] .btn-secondary {
  background: #ffffff !important;
  color: #090d16 !important;
  border: 1.5px solid #cbd5e1 !important;
  font-weight: 700 !important;
}

html[data-theme="light"] .btn-secondary:hover {
  background: #f1f5f9 !important;
  border-color: #0891b2 !important;
  color: #0891b2 !important;
}

html[data-theme="light"] .btn-text-sm {
  background: #f1f5f9 !important;
  color: #090d16 !important;
  border: 1.5px solid #cbd5e1 !important;
  font-weight: 700 !important;
}

html[data-theme="light"] .btn-icon {
  background: #ffffff !important;
  color: #1e293b !important;
  border: 1.5px solid #cbd5e1 !important;
}

html[data-theme="light"] .btn-create-tab {
  background: #dcfce7 !important;
  color: #15803d !important;
  border: 1.5px solid #86efac !important;
  font-weight: 700 !important;
}

html[data-theme="light"] .btn-demo-tab {
  background: #e0f2fe !important;
  color: #0369a1 !important;
  border: 1.5px solid #7dd3fc !important;
  font-weight: 700 !important;
}

html[data-theme="light"] .btn-accent-action {
  color: #15803d !important;
  font-weight: 700 !important;
}

html[data-theme="light"] .card-action-link {
  color: #0891b2 !important;
  font-weight: 700 !important;
}

/* 11. Tables & History Logs */
html[data-theme="light"] table {
  color: #090d16 !important;
}

html[data-theme="light"] table thead tr,
html[data-theme="light"] .history-table th {
  background: #e2e8f0 !important;
  color: #090d16 !important;
  font-weight: 800 !important;
  border-bottom: 2px solid #cbd5e1 !important;
}

html[data-theme="light"] table tbody tr,
html[data-theme="light"] .history-table td {
  border-bottom: 1px solid #e2e8f0 !important;
  color: #1e293b !important;
  font-weight: 500 !important;
}

html[data-theme="light"] table tbody tr:hover {
  background: #f8fafc !important;
}

/* 12. Upgrade Modal Tier Cards */
html[data-theme="light"] .upgrade-modal-card .card {
  background: #ffffff !important;
  border: 2px solid #cbd5e1 !important;
}

html[data-theme="light"] .upgrade-modal-card .tier-card-pro {
  border-color: #0891b2 !important;
  box-shadow: 0 8px 30px rgba(8, 145, 178, 0.15) !important;
}

html[data-theme="light"] .upgrade-modal-card ul li {
  color: #1e293b !important;
  font-weight: 600 !important;
}

/* 13. SMS Volume Top-Up & Twilio Cards */
html[data-theme="light"] #owner-sms-wallet-card,
html[data-theme="light"] #owner-twilio-card {
  background: #ffffff !important;
  border: 1.5px solid #cbd5e1 !important;
}

html[data-theme="light"] #twilio-gateway-accordion {
  background: #f8fafc !important;
  border: 1.5px solid #cbd5e1 !important;
}

html[data-theme="light"] #twilio-toggle-wrapper {
  background: #ecfdf5 !important;
  color: #065f46 !important;
  border: 1.5px solid #a7f3d0 !important;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05) !important;
}

/* 14. Template Tag Insertion Chips & Pills */
html[data-theme="light"] .btn-sms-tag,
html[data-theme="light"] .btn-badge {
  border-radius: 6px !important;
  font-weight: 700 !important;
}
html[data-theme="light"] button[onclick*="'{name}'"] {
  background: #dcfce7 !important;
  color: #14532d !important;
  border: 1.5px solid #86efac !important;
}
html[data-theme="light"] button[onclick*="'{shop}'"] {
  background: #e0f2fe !important;
  color: #075985 !important;
  border: 1.5px solid #7dd3fc !important;
}
html[data-theme="light"] button[onclick*="'{service}'"] {
  background: #f3e8ff !important;
  color: #6b21a8 !important;
  border: 1.5px solid #d8b4fe !important;
}
html[data-theme="light"] button[onclick*="'{link}'"] {
  background: #dbeafe !important;
  color: #1e40af !important;
  border: 1.5px solid #93c5fd !important;
}

html[data-theme="light"] #sms-encoding-badge {
  background: #dcfce7 !important;
  color: #14532d !important;
  border: 1.5px solid #86efac !important;
  font-weight: 700 !important;
}

html[data-theme="light"] #sms-char-counter {
  color: #0369a1 !important;
  font-weight: 800 !important;
}

html[data-theme="light"] .badge-pro-pill.locked {
  background: #fee2e2 !important;
  color: #991b1b !important;
  border: 1.5px solid #fca5a5 !important;
  font-weight: 700 !important;
}

html[data-theme="light"] .badge-pro-pill.unlocked {
  background: #dcfce7 !important;
  color: #14532d !important;
  border: 1.5px solid #86efac !important;
  font-weight: 700 !important;
}

html[data-theme="light"] #desk-sms-exhausted-banner {
  background: #fffbeb !important;
  border-color: #fde68a !important;
  color: #92400e !important;
}

html[data-theme="light"] #modal-active-plan-banner {
  background: #f0fdf4 !important;
  border-color: #86efac !important;
}

html[data-theme="light"] #modal-active-shop-name {
  color: #090d16 !important;
}

/* 15. Staff Cards, Terminals & Clinical Privacy */
html[data-theme="light"] .staff-shop-tag {
  color: #1e293b !important;
  background: #f1f5f9 !important;
  border: 1.5px solid #cbd5e1 !important;
  font-weight: 600 !important;
}

html[data-theme="light"] .staff-cred-box {
  background: #f8fafc !important;
  border: 1.5px solid #cbd5e1 !important;
}

html[data-theme="light"] .staff-cred-label {
  color: #334155 !important;
  font-weight: 600 !important;
}

html[data-theme="light"] .staff-cred-val {
  color: #0369a1 !important;
  font-weight: 700 !important;
}

html[data-theme="light"] .perm-pill {
  background: #dcfce7 !important;
  color: #14532d !important;
  border: 1.5px solid #86efac !important;
  font-weight: 700 !important;
}

html[data-theme="light"] .perm-pill.disabled {
  background: #f1f5f9 !important;
  color: #94a3b8 !important;
  border-color: #cbd5e1 !important;
}

html[data-theme="light"] .terminal-url-bar {
  background: #f8fafc !important;
  border: 1.5px solid #cbd5e1 !important;
}

html[data-theme="light"] .terminal-url-text {
  color: #0369a1 !important;
  font-weight: 700 !important;
}

html[data-theme="light"] .terminal-tip-box {
  background: #f0fdf4 !important;
  border: 1.5px solid #86efac !important;
  color: #14532d !important;
  font-weight: 500 !important;
}

html[data-theme="light"] #clinical-privacy-toggle-wrapper {
  background: #ede9fe !important;
  color: #4338ca !important;
  border: 1.5px solid #c4b5fd !important;
}

/* 16. Public Page Timer & Info Box */
html[data-theme="light"] .public-timer-box {
  background: #f8fafc !important;
  border: 1.5px solid #cbd5e1 !important;
}

html[data-theme="light"] .timer-label {
  color: #334155 !important;
  font-weight: 700 !important;
}

html[data-theme="light"] .timer-display {
  color: #0891b2 !important;
  text-shadow: none !important;
}

html[data-theme="light"] .public-info-box {
  background: #f8fafc !important;
  border: 1.5px solid #cbd5e1 !important;
  color: #1e293b !important;
}

html[data-theme="light"] .public-share-hint {
  background: #ffffff !important;
  border: 1.5px solid #cbd5e1 !important;
}

html[data-theme="light"] .public-header .shop-badge {
  background: #e0f2fe !important;
  color: #0369a1 !important;
  border: 1.5px solid #7dd3fc !important;
}

/* 17. Promotional & Paywall Banners */
html[data-theme="light"] .promo-banner {
  background: linear-gradient(135deg, #fdf4ff, #e0f2fe) !important;
  border: 1.5px solid #0891b2 !important;
  color: #090d16 !important;
  font-weight: 700 !important;
}

html[data-theme="light"] .pro-gated-section.locked {
  background: #f8fafc !important;
  border: 1.5px dashed #94a3b8 !important;
  box-shadow: none !important;
}

html[data-theme="light"] .pro-locked-banner {
  background: #e0f2fe !important;
  border: 1.5px solid #7dd3fc !important;
  color: #090d16 !important;
}

html[data-theme="light"] .pro-locked-banner .btn-upgrade-action {
  background: #0891b2 !important;
  color: #ffffff !important;
  font-weight: 700 !important;
}

/* 18. FAQ Accordion */
html[data-theme="light"] .faq-question {
  color: #090d16 !important;
  font-weight: 700 !important;
}

html[data-theme="light"] .faq-answer {
  background: #f8fafc !important;
  border-top: 1.5px solid #e2e8f0 !important;
}

/* 19. Stage Nav Arrows */
html[data-theme="light"] .stage-nav-btn {
  background: #ffffff !important;
  color: #090d16 !important;
  border: 1.5px solid #cbd5e1 !important;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1) !important;
}

html[data-theme="light"] .stage-nav-btn:hover {
  background: #0891b2 !important;
  color: #ffffff !important;
}
`;

fs.writeFileSync(cssPath, before + newLightCss, 'utf8');
console.log('Successfully updated style.css with ultra-high contrast Light Theme!');
