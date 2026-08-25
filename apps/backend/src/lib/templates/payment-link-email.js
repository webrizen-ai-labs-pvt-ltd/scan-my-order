function getPaymentLinkEmailTemplate(tenantName, planName, price, interval, paymentUrl) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Payment Link for Scan My Order</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: #f4f4f5; color: #18181b; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; border: 1px solid #e4e4e7; }
        .header { background-color: #facc15; padding: 32px 24px; text-align: center; }
        .header h1 { margin: 0; color: #18181b; font-size: 24px; font-weight: 700; }
        .content { padding: 32px 24px; }
        .content p { margin: 0 0 16px; line-height: 1.6; font-size: 16px; color: #3f3f46; }
        .details-box { background-color: #fafafa; border: 1px solid #e4e4e7; border-radius: 6px; padding: 16px; margin-bottom: 24px; }
        .details-box p { margin: 0 0 8px; font-size: 14px; }
        .details-box p:last-child { margin: 0; }
        .details-box strong { color: #18181b; }
        .button-container { text-align: center; margin: 32px 0; }
        .button { display: inline-block; background-color: #facc15; color: #18181b; font-weight: 600; text-decoration: none; padding: 14px 28px; border-radius: 6px; font-size: 16px; }
        .footer { padding: 24px; text-align: center; font-size: 12px; color: #71717a; border-top: 1px solid #e4e4e7; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Complete Your Subscription</h1>
        </div>
        <div class="content">
          <p>Hello <strong>${tenantName}</strong>,</p>
          <p>Your subscription plan for Scan My Order is ready for payment. Please review the details below and click the button to securely complete your payment.</p>
          
          <div class="details-box">
            <p><strong>Plan:</strong> ${planName}</p>
            <p><strong>Amount:</strong> ₹${Number(price).toFixed(2)}</p>
            <p><strong>Billing Cycle:</strong> ${interval}</p>
          </div>

          <div class="button-container">
            <a href="${paymentUrl}" class="button">Pay Now securely</a>
          </div>

          <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
          <p style="font-size: 13px; word-break: break-all; color: #52525b;">${paymentUrl}</p>
        </div>
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} Scan My Order. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

module.exports = { getPaymentLinkEmailTemplate };
