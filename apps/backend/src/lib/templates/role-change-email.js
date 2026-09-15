const { env } = require("../../config/env");

const ROLE_DISPLAY_NAMES = {
  SUPER_ADMIN: "Super Administrator",
  TENANT_ADMIN: "Executive Tenant Administrator",
  STORE_MANAGER: "Store General Manager",
  CASHIER: "Front of House Head Cashier",
  WAITER: "Dining Service Lead / Waiter",
  KITCHEN_STAFF: "Culinary & Kitchen Operations Specialist",
  CUSTOMER: "Registered Customer"
};

const ROLE_RESPONSIBILITIES = {
  TENANT_ADMIN: [
    "Comprehensive executive administration over all store locations and digital touchpoints",
    "Staff provisioning, role delegations, and store assignment governance",
    "Brand identity management, subscription oversight, and business analytics"
  ],
  STORE_MANAGER: [
    "Full store operations management and on-premise inventory control",
    "Staff scheduling, dining table configurations, and shift supervision",
    "Daily revenue settlement, order escalation audits, and localized reporting"
  ],
  CASHIER: [
    "Point-of-Sale (POS) counter operation, billing, and bifurcation processing",
    "UPI Dynamic QR settlement, cash handling, and invoice dispatch",
    "Takeaway counter orders and dine-in payment clearance"
  ],
  WAITER: [
    "Live floor plan table management and digital dining service execution",
    "Real-time customer order taking and KDS table sync via Waiter Terminal",
    "Table bill dispatch requests and guest service fulfillment"
  ],
  KITCHEN_STAFF: [
    "Kitchen Display System (KDS) queue management and ticket preparation",
    "Live order status progression (In Prep -> Cooked -> Plated -> Ready for Dispatch)",
    "Real-time item availability status updates to the POS and digital menus"
  ]
};

function getRoleChangeEmailTemplate({
  employeeName,
  employeeEmail,
  oldRole,
  newRole,
  storeName,
  tenantName,
  actorName,
  actorRole,
  portalUrl,
  employeeId
}) {
  const oldTitle = ROLE_DISPLAY_NAMES[oldRole] || oldRole.replace(/_/g, ' ');
  const newTitle = ROLE_DISPLAY_NAMES[newRole] || newRole.replace(/_/g, ' ');
  const responsibilities = ROLE_RESPONSIBILITIES[newRole] || [
    "Execute assigned operational duties in accordance with organizational policies."
  ];

  const currentDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const refCode = `SMO-HR/${new Date().getFullYear()}/${(employeeId || 'STF').slice(-6).toUpperCase()}`;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Official Notification: Operational Role Reassignment</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background-color: #f1f5f9;
      margin: 0;
      padding: 36px 16px;
      color: #1e293b;
      -webkit-font-smoothing: antialiased;
    }
    .wrapper {
      max-width: 620px;
      margin: 0 auto;
      background-color: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05);
    }
    .top-bar {
      height: 6px;
      background: linear-gradient(90deg, #f59e0b 0%, #10b981 50%, #6366f1 100%);
    }
    .header-memo {
      padding: 28px 36px 20px 36px;
      border-bottom: 2px solid #0f172a;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }
    .brand-title {
      font-size: 20px;
      font-weight: 800;
      letter-spacing: -0.02em;
      color: #0f172a;
      margin: 0 0 4px 0;
      text-transform: uppercase;
    }
    .memo-badge {
      display: inline-block;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #475569;
      background-color: #f1f5f9;
      padding: 4px 10px;
      border-radius: 4px;
      border: 1px solid #cbd5e1;
    }
    .memo-meta {
      font-size: 12px;
      color: #64748b;
      margin-top: 4px;
      line-height: 1.4;
    }
    .content-body {
      padding: 28px 36px;
      font-size: 14px;
      line-height: 1.7;
      color: #334155;
    }
    .subject-line {
      background-color: #f8fafc;
      border-left: 4px solid #f59e0b;
      padding: 12px 16px;
      margin-bottom: 24px;
      font-weight: 700;
      font-size: 13px;
      color: #0f172a;
      letter-spacing: 0.01em;
      text-transform: uppercase;
    }
    .role-grid {
      background-color: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      margin: 22px 0;
      padding: 16px 20px;
    }
    .role-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px dashed #e2e8f0;
      font-size: 13px;
    }
    .role-row:last-child {
      border-bottom: none;
      padding-bottom: 0;
    }
    .role-row:first-child {
      padding-top: 0;
    }
    .role-label {
      color: #64748b;
      font-weight: 600;
      text-transform: uppercase;
      font-size: 11px;
      letter-spacing: 0.04em;
    }
    .role-val {
      font-weight: 700;
      color: #0f172a;
      text-align: right;
    }
    .new-role-val {
      color: #059669;
      font-weight: 800;
      font-size: 14px;
    }
    .responsibilities-box {
      margin: 20px 0;
      padding: 16px;
      background-color: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
    }
    .responsibilities-box h4 {
      margin: 0 0 10px 0;
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #475569;
    }
    .responsibilities-box ul {
      margin: 0;
      padding-left: 18px;
      color: #334155;
      font-size: 13px;
      line-height: 1.6;
    }
    .responsibilities-box li {
      margin-bottom: 6px;
    }
    .responsibilities-box li:last-child {
      margin-bottom: 0;
    }
    .btn-container {
      text-align: center;
      margin: 28px 0 16px 0;
    }
    .portal-btn {
      display: inline-block;
      background-color: #0f172a;
      color: #ffffff !important;
      text-decoration: none;
      font-weight: 700;
      font-size: 13px;
      letter-spacing: 0.02em;
      padding: 14px 28px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(15, 23, 42, 0.2);
    }
    .signoff-section {
      margin-top: 28px;
      border-top: 1px solid #f1f5f9;
      padding-top: 18px;
      font-size: 13px;
      color: #475569;
    }
    .signoff-section strong {
      color: #0f172a;
      display: block;
      margin-top: 4px;
    }
    .footer-legal {
      background-color: #f8fafc;
      border-top: 1px solid #e2e8f0;
      padding: 20px 36px;
      font-size: 11px;
      line-height: 1.6;
      color: #94a3b8;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="top-bar"></div>
    <div class="header-memo">
      <div>
        <h1 class="brand-title">${tenantName || 'Scan My Order Brand Group'}</h1>
        <div class="memo-meta">
          <strong>Internal HR & Operations Memorandum</strong><br>
          Ref: ${refCode} &bull; Date: ${currentDate}
        </div>
      </div>
      <div>
        <span class="memo-badge">Official Notice</span>
      </div>
    </div>

    <div class="content-body">
      <div class="subject-line">
        Subject: Official Internal Designation & Operational Scope Reassignment
      </div>

      <p>Dear <strong>${employeeName || 'Colleague'}</strong>,</p>

      <p>
        Please be formally notified that by order of executive management, your operational designation and organizational privileges under <strong>${tenantName || 'the Enterprise'}</strong> have been formally reclassified.
      </p>

      <div class="role-grid">
        <div class="role-row">
          <span class="role-label">Employee ID:</span>
          <span class="role-val">${employeeId || 'N/A'}</span>
        </div>
        <div class="role-row">
          <span class="role-label">Previous Designation:</span>
          <span class="role-val">${oldTitle}</span>
        </div>
        <div class="role-row">
          <span class="role-label">Revised Designation:</span>
          <span class="role-val new-role-val">${newTitle}</span>
        </div>
        <div class="role-row">
          <span class="role-label">Operating Location:</span>
          <span class="role-val">${storeName || 'Enterprise / Multi-Store'}</span>
        </div>
        <div class="role-row">
          <span class="role-label">Effective Date:</span>
          <span class="role-val">${currentDate} (Immediate)</span>
        </div>
        ${actorName ? `
        <div class="role-row">
          <span class="role-label">Authorized By:</span>
          <span class="role-val">${actorName} (${actorRole?.replace(/_/g, ' ') || 'Executive'})</span>
        </div>
        ` : ''}
      </div>

      <p>
        Your digital credentials and authorization token in the <strong>Scan My Order Operations Workspace</strong> have been updated automatically to provision access to the required terminals and interfaces aligned with this designation.
      </p>

      <div class="responsibilities-box">
        <h4>Core Operational Directives & Scope:</h4>
        <ul>
          ${responsibilities.map(item => `<li>${item}</li>`).join('')}
        </ul>
      </div>

      <p>
        You are expected to adhere strictly to organizational operating procedures, dining floor security guidelines, and data confidentiality standards commensurate with this level of access.
      </p>

      <div class="btn-container">
        <a href="${portalUrl}" class="portal-btn" target="_blank" rel="noopener noreferrer">
          Launch Operations Portal &rarr;
        </a>
      </div>

      <div class="signoff-section">
        Yours faithfully,<br>
        <strong>Executive Operations & Human Capital Administration</strong>
        <span>${tenantName || 'Scan My Order Operations'}</span>
      </div>
    </div>

    <div class="footer-legal">
      <strong>Confidentiality Notice:</strong> This electronic communication and any associated directives contain legally privileged, proprietary internal corporate data intended solely for the designated recipient. If you are not the intended recipient, please be advised that any dissemination or unauthorized retention is strictly prohibited under enterprise governance.
      <br><br>
      &copy; ${new Date().getFullYear()} ${tenantName || 'Scan My Order'}. Powered by Scan My Order OS. All rights reserved.
    </div>
  </div>
</body>
</html>
  `;
}

module.exports = {
  getRoleChangeEmailTemplate
};
