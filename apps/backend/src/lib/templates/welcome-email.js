function getWelcomeEmailTemplate(name, email, password, role, adminUrl) {
  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <title>Welcome to Scan My Order</title>
    <style>
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
        background-color: #f9f9f9;
        margin: 0;
        padding: 40px 20px;
        color: #333333;
      }
      .container {
        max-width: 600px;
        margin: 0 auto;
        background-color: #ffffff;
        border-top: 4px solid #facc15; /* Yellow-400 theme */
        border-radius: 8px;
        padding: 32px;
      }
      .header {
        text-align: center;
        margin-bottom: 24px;
      }
      .header h1 {
        color: #1a1a1a;
        margin: 0;
        font-size: 24px;
      }
      .content {
        line-height: 1.6;
        font-size: 16px;
      }
      .credentials {
        background-color: #fefce8; /* Yellow-50 */
        border: 1px solid #fef08a; /* Yellow-200 */
        border-radius: 6px;
        padding: 16px;
        margin: 24px 0;
      }
      .credentials p {
        margin: 8px 0;
      }
      .credentials strong {
        color: #854d0e; /* Yellow-800 */
      }
      .button-container {
        text-align: center;
        margin: 32px 0;
      }
      .button {
        background-color: #facc15;
        color: #422006; /* Dark brown for contrast */
        text-decoration: none;
        padding: 12px 24px;
        border-radius: 6px;
        font-weight: 600;
        display: inline-block;
      }
      .footer {
        text-align: center;
        margin-top: 32px;
        font-size: 14px;
        color: #666666;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1>Welcome to Scan My Order</h1>
      </div>
      <div class="content">
        <p>Hi ${name || 'there'},</p>
        <p>An account has been created for you with the role of <strong>${role.replace('_', ' ')}</strong>.</p>
        
        <div class="credentials">
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Password:</strong> ${password}</p>
        </div>

        <p>Please log in using the button below. We highly recommend changing your password and setting up a Passkey for faster, more secure logins.</p>
        
        <div class="button-container">
          <a href="${adminUrl}" class="button">Log In to Your Account</a>
        </div>
      </div>
      <div class="footer">
        <p>&copy; ${new Date().getFullYear()} Scan My Order. All rights reserved.</p>
      </div>
    </div>
  </body>
  </html>
  `;
}

module.exports = {
  getWelcomeEmailTemplate
};
