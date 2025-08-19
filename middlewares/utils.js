const nodemailer = require("nodemailer");
const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");
const User = require("../models/user");

// Create a transporter using Mailjet's SMTP
// const transporter = nodemailer.createTransport({
//   service: "Mailjet",
//   auth: {
//     user: process.env.MAILJET_API_KEY,
//     pass: process.env.MAILJET_SECRET_KEY,
//   },
// });

const transporter = nodemailer.createTransport({
  host: "in-v3.mailjet.com", // Mailjet SMTP endpoint
  port: 2525, // or 465 for SSL
  auth: {
    user: process.env.MAILJET_API_KEY,
    pass: process.env.MAILJET_SECRET_KEY,
  },
});

const otpEmailtemplate = (otpCode) => {
  return `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Your OTP Code</title>
  </head>
  <body style="margin:0; padding:0; background-color:#f4f6fb; font-family: Arial, sans-serif; color:#333;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f4f6fb; padding: 30px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px; background:#ffffff; border-radius:10px; overflow:hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.08);">
            
            <!-- Header -->
            <tr>
              <td style="background: linear-gradient(90deg, #6c5dd3, #3f8cff); padding: 20px; text-align:center;">
                <h1 style="color:#ffffff; margin:0; font-size: 24px; font-weight:600;">TrustyVest</h1>
              </td>
            </tr>
            
            <!-- Body -->
            <tr>
              <td style="padding: 30px;">
                <h2 style="margin-top:0; color:#333; font-size:20px;">Your One-Time Password (OTP)</h2>
                <p style="font-size:16px; line-height:1.6; margin-bottom: 25px;">
                  Thank you for choosing <strong>TrustyVest</strong>.<br />
                  Use the OTP below to complete your sign-up process. This code will expire in <strong>15 minutes</strong>.
                </p>
                
                <!-- OTP Box -->
                <div style="text-align:center; margin: 35px 0;">
                  <span style="display:inline-block; font-size:28px; letter-spacing:6px; background:#6c5dd3; color:#fff; padding:14px 28px; border-radius:8px; font-weight:bold; box-shadow:0 4px 10px rgba(108,93,211,0.3);">
                    ${otpCode}
                  </span>
                </div>

                <p style="font-size:14px; color:#555; line-height:1.5;">
                  If you did not request this code, please ignore this email or contact our support team immediately.
                </p>
              </td>
            </tr>
            
            <!-- Footer -->
            <tr>
              <td style="background-color:#f8f9fa; padding: 20px; text-align:center; font-size:12px; color:#888;">
                © ${new Date().getFullYear()} TrustyVest. All rights reserved.<br />
                <a href="mailto:support@trustyvest.com" style="color:#6c5dd3; text-decoration:none;">support@trustyvest.com</a>
              </td>
            </tr>
            
          </table>
        </td>
      </tr>
    </table>
  </body>
  </html>
  `;
};

const orderReceipttemplate = (newOrder) => {
  const getTotal = () => {
    return newOrder.products.reduce((currentValue, nextValue) => {
      return currentValue + nextValue.count * nextValue.price;
    }, 0);
  };

  // Conditionally create the discount row if discount exists
  const discountRow = newOrder.paymentIntent.discounted
    ? `<tr>
     <td colspan="2">Discount:</td>
     <td style="text-align: right;">-$(${newOrder.paymentIntent.discounted.toFixed(
       2
     )})</td>
   </tr>`
    : "";

  return `<h1> Thanks for shopping with us </h1>
    <p> Hi ${newOrder.shippingto.Name}, </p>
    <p>We have finished processing your order.</p>
   
    <h2>[Order ID ${newOrder.OrderId}] (${newOrder.createdAt
    .toString()
    .substring(0, 10)})</h2>
    <table>
    <thead>
    <tr>
    <td><strong>Product</strong></td>
    <td style="text-align: center;"><strong>Quantity</strong></td>
    <td style="text-align: right;"><strong>Price</strong></td>
    </tr>
    </thead>

    <tbody>
    ${newOrder.products
      .map(
        (p) => `
      <tr>
      <td>${p.product.title}</td>
      <td style="text-align: center;">${p.count}</td>
      <td style="text-align: right;"> $${p.price.toFixed(2)}</td>
      </tr>
    `
      )
      .join("\n")}
      </tbody>
      <tfoot>
      <tr>
      <td colspan="2">Sub Total:</td>
      <td style="text-align: right;"> $${getTotal().toFixed(2)}</td>
      </tr>
      <tr>
      <td colspan="2">Tax Price:</td>
      <td style="text-align: right;"> $${"0.00"}</td>
      </tr>
      <tr>
      <td colspan="2">Shipping Charges:</td>
      <td style="text-align: right;"> $${newOrder.shippingfee.toFixed(2)}</td>
      </tr>
       ${discountRow}
      <tr>
      <td colspan="2"><strong>Total Price:</strong></td>
      <td style="text-align: right;"><strong> $${newOrder.paymentIntent.amount.toFixed(
        2
      )}</strong></td>
      </tr>
      <tr>
      <td colspan="2">Payment Method:</td>
      <td style="text-align: right;">${newOrder.paymentStatus}</td>
      </tr>
      </tfoot>
      </table>

      <h2>Shipping address</h2>
      <p>
      ${newOrder.shippingto.Name},<br/>
      ${newOrder.shippingto.Address},<br/>
      ${newOrder.shippingto.City},<br/>
      ${newOrder.shippingto.Province},<br/>
      ${newOrder.shippingto.Area}<br/>
      ${newOrder.shippingto.LandMark}<br/>
      </p>
       <p>For further details <strong>"Detailed PDF Invoice"</strong> attached.</p>
      <hr/>
      <p>
      Thanks for shopping with us.
      </p>
    `;
};

// Function to generate PDF
const generateInvoicePDF = (order) => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const pdfPath = path.join(__dirname, "invoice.pdf");
    const writeStream = fs.createWriteStream(pdfPath);

    doc.pipe(writeStream);

    // Header
    doc
      .fontSize(9)
      .fillColor("grey")
      .text(`Print Date: ${new Date().toLocaleString()}`, {
        align: "right",
      });
    doc.moveDown();

    // Add logo
    const logoPath = path.join(__dirname, "invoiceLogo.png");
    doc.image(logoPath, { fit: [200, 40] });
    doc.moveDown(3.5);

    // Company Information
    doc
      .fontSize(10)
      .fillColor("#3a4553")
      .text("Phone: 0300-1234567", 82, doc.y);
    doc.moveDown(0.3);
    doc.text("Email: Billing@Pearlytouch.com", 82, doc.y);
    doc.moveDown(2);

    // Customer Info
    // Set background color
    doc.fillColor("white").rect(50, doc.y, 200, 18).fill("#787878"); // Background color
    // Change text color and write the text
    doc
      .fillColor("white") // Set the text color
      .fontSize(11)
      .text("Bill To", 55, doc.y + 5);
    doc.moveDown();

    doc
      .fontSize(10)
      .fillColor("#3a4553")
      .text(`Name: ${order?.shippingto?.Name}`);
    doc.moveDown(0.3);
    doc.text(`Contact: ${order?.shippingto?.Contact}`);
    doc.moveDown(0.3);
    doc.text(`Email: ${order?.email}`);
    doc.moveDown(0.3);
    doc.text(
      `Address: ${order?.shippingto?.Address}, ${order?.shippingto?.Province}, ${order?.shippingto?.Area}, ${order?.shippingto?.LandMark}, ${order?.shippingto?.City}`
    );
    doc.moveDown(2);

    // Table Header
    doc
      .fillColor("white")
      .fontSize(11)
      .rect(50, doc.y, 515, 20)
      .fill("#787878");
    // Set text color to white and properly align each header column
    doc
      .fillColor("white")
      .text("Description", 55, doc.y + 5, { width: 100, align: "left" }) // Adjust x-coordinate for Description
      .text("Quantity", 350, doc.y - 13, { width: 50, align: "center" }) // Adjust x-coordinate for Quantity
      .text("Price", 425, doc.y - 12, { width: 50, align: "center" }) // Adjust x-coordinate for Price
      .text("Amount", 500, doc.y - 13, { width: 50, align: "center" }); // Adjust x-coordinate for Amount
    doc.moveDown(1);

    // Table Rows (Products)
    doc.fontSize(10).fillColor("#3a4553");
    order.products.forEach((item) => {
      doc.text(
        `[Article: ${item.product.art}] ${item.product.title} - Color: ${
          item.color
        }${item.size ? ` - Size: ${item.size}` : ""}`,
        55,
        doc.y,
        { width: 325, align: "left" }
      );
      doc.text(item.count.toString(), 325, doc.y - 11, {
        width: 100,
        align: "center",
      });
      doc.text(`${item.price.toFixed(2)}`, 400, doc.y - 12, {
        width: 100,
        align: "center",
      });
      doc.text(`${(item.price * item.count).toFixed(2)}`, 475, doc.y - 12, {
        width: 100,
        align: "center",
      });
      doc.moveDown(0.7);
    });

    // Discount (if available)
    if (order?.paymentIntent?.dispercent != null) {
      const discountText =
        order.paymentIntent.discountType === "Discount"
          ? `${order.paymentIntent.dispercent}%`
          : order.paymentIntent.discountType === "Cash"
          ? `$ ${order.paymentIntent.dispercent}`
          : "Shipping";

      doc
        .fontSize(10)
        .fillColor("#3a4553")
        .text(`Discount (${discountText} off coupon used): `, 55, doc.y, {
          width: 325,
          align: "left",
        });
      doc.text(
        `-(${order.paymentIntent.discounted.toFixed(2)})`,
        474,
        doc.y - 11,
        {
          width: 100,
          align: "center",
        }
      );

      doc.moveDown(0.7);
    }

    // Shipping Charges
    doc.fontSize(10).fillColor("#3a4553").text("Shipping Charges:", 55, doc.y, {
      width: 325,
      align: "left",
    });
    doc.text(`${order?.shippingfee.toFixed(2)}`, 475, doc.y - 11, {
      width: 100,
      align: "center",
    });

    doc.moveDown(0.7);

    // Total Amount
    doc
      .fontSize(11)
      .fillColor("white")
      .rect(50, doc.y, 515, 20)
      .fill("#787878");

    doc
      .fillColor("white")
      .text("Total Amount:", 55, doc.y + 5, { continued: true, width: 495 });
    doc.text(`$ ${order?.paymentIntent?.amount.toFixed(2)}`, {
      align: "right",
    });

    doc.moveDown(3);

    // Order Information
    // Set background color
    doc.fillColor("white").rect(50, doc.y, 200, 18).fill("#787878"); // Background color
    // Change text color and write the text
    doc
      .fillColor("white") // Set the text color
      .fontSize(11)
      .text("Order Information", 55, doc.y + 5);
    doc.moveDown();

    doc.fontSize(10).fillColor("#3a4553").text(`Order ID: ${order?.OrderId}`);
    doc.moveDown(0.3);
    doc.text(`Placed On: ${new Date(order?.createdAt).toLocaleString()}`);
    doc.moveDown(0.3);
    doc.text(`Order Status: ${order?.orderStatus}`);
    doc.moveDown(0.3);
    doc.text(`Mode of Payment: ${order?.paymentStatus}`);
    doc.moveDown(0.3);
    doc.text(`Payment Status: ${order?.isPaid ? "Paid" : "Unpaid"}`);
    doc.moveDown(3);

    // Footer
    doc
      .fontSize(10)
      .fillColor("#616161")
      .text("Thank you for shopping with us", { align: "center" });

    // Finalize PDF file
    doc.end();

    writeStream.on("finish", () => {
      resolve(pdfPath);
    });

    writeStream.on("error", (err) => {
      reject(err);
    });
  });
};

// Add this new function to your existing utils.js file

const depositNotificationTemplate = (deposit, plan) => {
  return `
  <div style="font-family: Arial, sans-serif; background-color: #f4f6fb; padding: 20px; color: #333;">
    
    <!-- Header -->
    <div style="background: linear-gradient(90deg, #6c5dd3, #3f8cff); padding: 20px; border-radius: 8px; text-align: center; color: #fff;">
      <h1 style="margin: 0; font-size: 22px;">Your Deposit Has Been Approved!</h1>
    </div>

    <!-- Body -->
    <div style="background: #fff; padding: 20px; margin-top: 20px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.08);">
      <p>Hi there,</p>
      <p>We're pleased to inform you that your deposit has been successfully approved and added to your wallet.</p>
      
      <h2 style="color: #6c5dd3; font-size: 18px; margin: 20px 0;">
        [Deposit ID: ${deposit._id.toString()}] 
        <span style="color: #3f8cff; font-size: 14px;">
          (${new Date(deposit.approvedAt).toISOString().split("T")[0]})
        </span>
      </h2>

      <!-- Deposit Details Table -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
        <tr style="background-color: #f4f6fb;">
          <th style="padding: 12px; text-align: left; border-bottom: 2px solid #6c5dd3;">Detail</th>
          <th style="padding: 12px; text-align: right; border-bottom: 2px solid #6c5dd3;">Information</th>
        </tr>
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid #ddd;"><strong>Amount:</strong></td>
          <td style="padding: 12px; text-align: right; border-bottom: 1px solid #ddd; color: #3f8cff;">
            $${deposit.amount.toFixed(2)}
          </td>
        </tr>
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid #ddd;"><strong>Status:</strong></td>
          <td style="padding: 12px; text-align: right; border-bottom: 1px solid #ddd; color: green; font-weight: bold;">
            Approved
          </td>
        </tr>
      </table>

      <p>Your funds have been successfully added to your wallet and your investment has been activated.</p>

      <!-- Highlight Box -->
      <div style="background-color: #f4f6fb; padding: 15px; border-left: 4px solid #6c5dd3; margin: 20px 0; border-radius: 5px;">
        <p style="margin: 0; font-weight: bold; color: #333;">
          Login to your account to track your investments and earnings.
        </p>
      </div>

      <!-- Button -->
      <div style="text-align: center; margin: 25px 0;">
        <a href="https://www.trustyvest.com/login" 
           style="background: linear-gradient(90deg, #6c5dd3, #3f8cff); 
                  color: #fff; padding: 12px 25px; text-decoration: none; 
                  font-weight: bold; border-radius: 6px; display: inline-block;">
          Go to Dashboard
        </a>
      </div>

      <p>Thank you for investing with us. If you have any questions, please don't hesitate to contact our support team.</p>
      <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;"/>

      <!-- Footer -->
     <p style="font-size: 14px; color: #555; text-align: center;">
        © ${new Date().getFullYear()} TrustyVest. All rights reserved.<br/>
        <a href="mailto:support@trustyvest.com" style="color:#6c5dd3; text-decoration:none;">support@trustyvest.com</a>
      </p>
    </div>
  </div>
  `;
};

const depositRejectionTemplate = (deposit, adminNotes) => {
  return `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Deposit Rejected</title>
  </head>
  <body style="margin:0; padding:0; background-color:#f5f7fa; font-family: Arial, sans-serif; color:#333;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f5f7fa; padding: 30px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px; background:#ffffff; border-radius:8px; overflow:hidden; box-shadow:0 4px 12px rgba(0,0,0,0.05);">
            
            <!-- Header -->
            <tr>
              <td style="background: linear-gradient(90deg, #6c5dd3, #3f8cff); padding: 20px; text-align:center;">
                <h1 style="color:#ffffff; margin:0; font-size: 22px;">Deposit Update</h1>
              </td>
            </tr>

            <!-- Body -->
            <tr>
              <td style="padding: 30px;">
                <h2 style="margin-top:0; color:#dc3545; font-size:20px;">Deposit Request Rejected</h2>
                <p style="font-size:16px; line-height:1.5; margin-bottom:20px;">
                  We're writing to inform you that your recent deposit request could not be approved.
                </p>

                <!-- Deposit Info -->
                <h3 style="margin: 20px 0 10px; font-size:16px; color:#333;">
                  [Deposit ID: ${deposit._id.toString()}] (${
    new Date(deposit.approvedAt).toISOString().split("T")[0]
  })
                </h3>
                
                <table style="width:100%; border-collapse:collapse; margin: 15px 0; border:1px solid #dee2e6;">
                  <tr style="background-color:#f8f9fa;">
                    <th style="padding:12px; text-align:left; border-bottom:2px solid #dee2e6;">Detail</th>
                    <th style="padding:12px; text-align:right; border-bottom:2px solid #dee2e6;">Information</th>
                  </tr>
                  <tr>
                    <td style="padding:12px; border-bottom:1px solid #dee2e6;"><strong>Amount:</strong></td>
                    <td style="padding:12px; text-align:right; border-bottom:1px solid #dee2e6;">$${deposit.amount.toFixed(
                      2
                    )}</td>
                  </tr>
                  <tr>
                    <td style="padding:12px; border-bottom:1px solid #dee2e6;"><strong>Status:</strong></td>
                    <td style="padding:12px; text-align:right; border-bottom:1px solid #dee2e6; color:#dc3545;"><strong>Rejected</strong></td>
                  </tr>
                  <tr>
                    <td style="padding:12px; border-bottom:1px solid #dee2e6;"><strong>Date Reviewed:</strong></td>
                    <td style="padding:12px; text-align:right; border-bottom:1px solid #dee2e6;">${new Date(
                      deposit.approvedAt
                    ).toLocaleString()}</td>
                  </tr>
                </table>

                ${
                  adminNotes
                    ? `
                <!-- Admin Notes -->
                <div style="background-color:#f8f9fa; padding:15px; border-radius:6px; margin:20px 0; border-left:4px solid #6c5dd3;">
                  <p style="margin:0 0 10px 0; font-weight:bold; color:#333;">Additional Information:</p>
                  <p style="margin:0; font-size:14px; color:#555;">${adminNotes}</p>
                </div>
                `
                    : ""
                }

                <!-- Next Steps -->
                <div style="padding:15px; border-radius:6px; margin:20px 0; border:1px solid #ddd; background:#fafafa;">
                  <p style="margin:0; font-weight:bold; color:#333;">What to do next?</p>
                  <ul style="margin-top:10px; padding-left:20px; font-size:14px; color:#555;">
                    <li>Check if your payment details were correct</li>
                    <li>Make sure your deposit meets our minimum requirements</li>
                    <li>Submit a new deposit request if needed</li>
                    <li>Contact our support team for assistance</li>
                  </ul>
                </div>

                <p style="font-size:15px; color:#333;">
                  Thank you for your understanding. We value your business and look forward to serving you better.
                </p>

                <p style="margin-top:30px; font-size:15px;">
                  Best regards,<br/>
                  <strong>TrustyVest Team</strong>
                </p>
              </td>
            </tr>

            <!-- Footer -->
           <p style="font-size: 14px; color: #555; text-align: center;">
        © ${new Date().getFullYear()} TrustyVest. All rights reserved.<br/>
        <a href="mailto:support@trustyvest.com" style="color:#6c5dd3; text-decoration:none;">support@trustyvest.com</a>
      </p>

          </table>
        </td>
      </tr>
    </table>
  </body>
  </html>
  `;
};

const withdrawalNotificationTemplate = (withdrawal) => {
  return `
  <div style="font-family: Arial, sans-serif; background-color: #f4f6fb; padding: 20px; color: #333;">
    
    <!-- Header -->
    <div style="background: linear-gradient(90deg, #6c5dd3, #3f8cff); padding: 20px; border-radius: 8px; text-align: center; color: #fff;">
      <h1 style="margin: 0; font-size: 22px;">Your Withdrawal Has Been Processed!</h1>
    </div>

    <!-- Body -->
    <div style="background: #fff; padding: 20px; margin-top: 20px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.08);">
      <p>Hi there,</p>
      <p>We're pleased to inform you that your withdrawal request has been approved and processed.</p>
      
      <h2 style="color: #6c5dd3; font-size: 18px; margin: 20px 0;">
        [Withdrawal ID: ${withdrawal._id.toString()}] 
        <span style="color: #3f8cff; font-size: 14px;">
          (${new Date(withdrawal.processedAt).toISOString().split("T")[0]})
        </span>
      </h2>

      <!-- Withdrawal Details Table -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
        <tr style="background-color: #f4f6fb;">
          <th style="padding: 12px; text-align: left; border-bottom: 2px solid #6c5dd3;">Detail</th>
          <th style="padding: 12px; text-align: right; border-bottom: 2px solid #6c5dd3;">Information</th>
        </tr>
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid #ddd;"><strong>Amount:</strong></td>
          <td style="padding: 12px; text-align: right; border-bottom: 1px solid #ddd; color: #3f8cff;">
            $${withdrawal.amount.toFixed(2)}
          </td>
        </tr>
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid #ddd;"><strong>Status:</strong></td>
          <td style="padding: 12px; text-align: right; border-bottom: 1px solid #ddd; color: green; font-weight: bold;">
            Approved
          </td>
        </tr>
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid #ddd;"><strong>Payment Method:</strong></td>
          <td style="padding: 12px; text-align: right; border-bottom: 1px solid #ddd; color: #6c5dd3; font-weight: bold;">
            ${
              withdrawal.paymentMethod.charAt(0).toUpperCase() +
              withdrawal.paymentMethod.slice(1).replace("_", " ")
            }
          </td>
        </tr>
        ${
          withdrawal.transactionId
            ? `
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid #ddd;"><strong>Transaction ID:</strong></td>
          <td style="padding: 12px; text-align: right; border-bottom: 1px solid #ddd; color: #3f8cff;">
            ${withdrawal.transactionId}
          </td>
        </tr>
        `
            : ""
        }
      </table>

      <p>Your funds have been successfully sent to your specified withdrawal destination.</p>

      <!-- Highlight Box -->
      <div style="background-color: #f4f6fb; padding: 15px; border-left: 4px solid #6c5dd3; margin: 20px 0; border-radius: 5px;">
        <p style="margin: 0; font-weight: bold; color: #333;">
          Login to your account to view your transaction history and initiate new transactions.
        </p>
      </div>

      <!-- Button -->
      <div style="text-align: center; margin: 25px 0;">
        <a href="https://www.trustyvest.com/login" 
           style="background: linear-gradient(90deg, #6c5dd3, #3f8cff); 
                  color: #fff; padding: 12px 25px; text-decoration: none; 
                  font-weight: bold; border-radius: 6px; display: inline-block;">
          View Transactions
        </a>
      </div>

      <p>Thank you for using our platform. If you have any questions, please don't hesitate to contact our support team.</p>
      <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;"/>

      <!-- Footer -->
     <p style="font-size: 14px; color: #555; text-align: center;">
        © ${new Date().getFullYear()} TrustyVest. All rights reserved.<br/>
        <a href="mailto:support@trustyvest.com" style="color:#6c5dd3; text-decoration:none;">support@trustyvest.com</a>
      </p>
    </div>
  </div>
  `;
};

const withdrawalRejectionTemplate = (withdrawal, adminNotes) => {
  return `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Withdrawal Rejected</title>
  </head>
  <body style="margin:0; padding:0; background-color:#f5f7fa; font-family: Arial, sans-serif; color:#333;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f5f7fa; padding: 30px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px; background:#ffffff; border-radius:8px; overflow:hidden; box-shadow:0 4px 12px rgba(0,0,0,0.05);">
            
            <!-- Header -->
            <tr>
              <td style="background: linear-gradient(90deg, #6c5dd3, #3f8cff); padding: 20px; text-align:center;">
                <h1 style="color:#ffffff; margin:0; font-size: 22px;">Withdrawal Update</h1>
              </td>
            </tr>

            <!-- Body -->
            <tr>
              <td style="padding: 30px;">
                <h2 style="margin-top:0; color:#dc3545; font-size:20px;">Withdrawal Request Rejected</h2>
                <p style="font-size:16px; line-height:1.5; margin-bottom:20px;">
                  We're writing to inform you that your recent withdrawal request could not be processed at this time.
                </p>

                <!-- Withdrawal Info -->
                <h3 style="margin: 20px 0 10px; font-size:16px; color:#333;">
                  [Withdrawal ID: ${withdrawal._id.toString()}]
                </h3>
                
                <table style="width:100%; border-collapse:collapse; margin: 15px 0; border:1px solid #dee2e6;">
                  <tr style="background-color:#f8f9fa;">
                    <th style="padding:12px; text-align:left; border-bottom:2px solid #dee2e6;">Detail</th>
                    <th style="padding:12px; text-align:right; border-bottom:2px solid #dee2e6;">Information</th>
                  </tr>
                  <tr>
                    <td style="padding:12px; border-bottom:1px solid #dee2e6;"><strong>Amount:</strong></td>
                    <td style="padding:12px; text-align:right; border-bottom:1px solid #dee2e6;">$${withdrawal.amount.toFixed(
                      2
                    )}</td>
                  </tr>
                  <tr>
                    <td style="padding:12px; border-bottom:1px solid #dee2e6;"><strong>Status:</strong></td>
                    <td style="padding:12px; text-align:right; border-bottom:1px solid #dee2e6; color:#dc3545;"><strong>Rejected</strong></td>
                  </tr>
                  <tr>
                    <td style="padding:12px; border-bottom:1px solid #dee2e6;"><strong>Payment Method:</strong></td>
                    <td style="padding:12px; text-align:right; border-bottom:1px solid #dee2e6;">
                      ${
                        withdrawal.paymentMethod.charAt(0).toUpperCase() +
                        withdrawal.paymentMethod.slice(1).replace("_", " ")
                      }
                    </td>
                  </tr>
                </table>

                <!-- Rejection Reason -->
                <div style="background-color:#fff8f8; padding:15px; border-radius:6px; margin:20px 0; border-left:4px solid #dc3545;">
                  <p style="margin:0 0 10px 0; font-weight:bold; color:#333;">Reason for rejection:</p>
                  <p style="margin:0; font-size:14px; color:#555;">
                    ${
                      adminNotes ||
                      "No specific reason provided. Please contact support for more information."
                    }
                  </p>
                </div>

                <!-- Info -->
                <p style="font-size:15px; color:#333;">
                  Your funds remain in your wallet and are available for future withdrawals.
                  If you have any questions about this decision or need assistance with a new withdrawal request, please contact our support team.
                </p>

                <p style="margin-top:30px; font-size:15px;">
                  Best regards,<br/>
                  <strong>TrustyVest Team</strong>
                </p>
              </td>
            </tr>

            <!-- Footer -->
            <p style="font-size: 14px; color: #555; text-align: center;">
        © ${new Date().getFullYear()} TrustyVest. All rights reserved.<br/>
        <a href="mailto:support@trustyvest.com" style="color:#6c5dd3; text-decoration:none;">support@trustyvest.com</a>
      </p>

          </table>
        </td>
      </tr>
    </table>
  </body>
  </html>
  `;
};

module.exports = {
  transporter,
  orderReceipttemplate,
  generateInvoicePDF,
  otpEmailtemplate,
  depositNotificationTemplate,
  depositRejectionTemplate,
  withdrawalNotificationTemplate,
  withdrawalRejectionTemplate,
};
