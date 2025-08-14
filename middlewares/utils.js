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
  <body style="margin:0; padding:0; background-color:#f5f7fa; font-family: Arial, sans-serif; color:#333;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f5f7fa; padding: 30px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px; background:#ffffff; border-radius:8px; overflow:hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
            <tr>
              <td style="background-color:#6c5dd3; padding: 20px; text-align:center;">
                <h1 style="color:#ffffff; margin:0; font-size: 24px;">TrustyVest</h1>
              </td>
            </tr>
            <tr>
              <td style="padding: 30px;">
                <h2 style="margin-top:0; color:#333;">Your One-Time Password (OTP)</h2>
                <p style="font-size:16px; line-height:1.5; margin-bottom: 20px;">
                  Thank you for choosing <strong>TrustyVest</strong>.<br />
                  Use the OTP below to complete your sign-up process. This code will expire in <strong>15 minutes</strong>.
                </p>
                <div style="text-align:center; margin: 30px 0;">
                  <span style="display:inline-block; font-size:28px; letter-spacing:4px; background:#6c5dd3; color:#fff; padding:12px 24px; border-radius:6px; font-weight:bold;">
                    ${otpCode}
                  </span>
                </div>
                <p style="font-size:14px; color:#555;">
                  If you did not request this code, please ignore this email or contact our support team.
                </p>
              </td>
            </tr>
            <tr>
              <td style="background-color:#f0f0f0; padding: 20px; text-align:center; font-size:12px; color:#888;">
                © ${new Date().getFullYear()} TrustyVest. All rights reserved.<br />
                support@trustyvest.com
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
    <h1>Your Deposit Has Been Approved!</h1>
    <p>Hi there,</p>
    <p>We're pleased to inform you that your deposit has been successfully approved and added to your wallet.</p>
   
    <h2>[Deposit ID: ${deposit._id.toString()}] (${
    new Date(deposit.approvedAt).toISOString().split("T")[0]
  })</h2>
    
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
      <tr style="background-color: #f8f9fa;">
        <th style="padding: 12px; text-align: left; border-bottom: 2px solid #dee2e6;">Detail</th>
        <th style="padding: 12px; text-align: right; border-bottom: 2px solid #dee2e6;">Information</th>
      </tr>
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #dee2e6;"><strong>Amount:</strong></td>
        <td style="padding: 12px; text-align: right; border-bottom: 1px solid #dee2e6;">$${deposit.amount.toFixed(
          2
        )}</td>
      </tr>
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #dee2e6;"><strong>Status:</strong></td>
        <td style="padding: 12px; text-align: right; border-bottom: 1px solid #dee2e6;">Approved</td>
      </tr>
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #dee2e6;"><strong>Investment Plan:</strong></td>
        <td style="padding: 12px; text-align: right; border-bottom: 1px solid #dee2e6;">${
          plan ? plan.name : "N/A"
        }</td>
      </tr>
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #dee2e6;"><strong>Duration:</strong></td>
        <td style="padding: 12px; text-align: right; border-bottom: 1px solid #dee2e6;">${
          plan ? plan.durationInDays + " days" : "N/A"
        }</td>
      </tr>
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #dee2e6;"><strong>Expected ROI:</strong></td>
        <td style="padding: 12px; text-align: right; border-bottom: 1px solid #dee2e6;">${
          plan ? plan.returnRate + "%" : "N/A"
        }</td>
      </tr>
    </table>
    <p>Your funds have been successfully added to your wallet and your investment has been activated.</p>
    
    <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
      <p style="margin: 0;"><strong>Login to your account to track your investments and earnings.</strong></p>
    </div>
    
    <p>Thank you for investing with us. If you have any questions, please don't hesitate to contact our support team.</p>
    <hr/>
    <p>
      Best regards,<br/>
      Investo Team
    </p>
  `;
};
const depositRejectionTemplate = (deposit, adminNotes) => {
  return `
    <h1>Update on Your Deposit Request</h1>
    <p>Hi there,</p>
    <p>We're writing to inform you about the status of your recent deposit request.</p>
   
    <h2>[Deposit ID: ${deposit._id.toString()}] (${
    new Date(deposit.approvedAt).toISOString().split("T")[0]
  })</h2>
    
    <div style="background-color: #fff8f8; border-left: 4px solid #dc3545; padding: 15px; margin: 20px 0; border-radius: 4px;">
      <p style="margin: 0; color: #dc3545; font-weight: bold;">Your deposit request has not been approved at this time.</p>
    </div>
    
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
      <tr style="background-color: #f8f9fa;">
        <th style="padding: 12px; text-align: left; border-bottom: 2px solid #dee2e6;">Detail</th>
        <th style="padding: 12px; text-align: right; border-bottom: 2px solid #dee2e6;">Information</th>
      </tr>
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #dee2e6;"><strong>Amount:</strong></td>
        <td style="padding: 12px; text-align: right; border-bottom: 1px solid #dee2e6;">$${deposit.amount.toFixed(
          2
        )}</td>
      </tr>
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #dee2e6;"><strong>Status:</strong></td>
        <td style="padding: 12px; text-align: right; border-bottom: 1px solid #dee2e6; color: #dc3545;">Rejected</td>
      </tr>
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #dee2e6;"><strong>Date Reviewed:</strong></td>
        <td style="padding: 12px; text-align: right; border-bottom: 1px solid #dee2e6;">${new Date(
          deposit.approvedAt
        ).toLocaleString()}</td>
      </tr>
    </table>
    ${
      adminNotes
        ? `
    <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
      <p style="margin: 0 0 10px 0;"><strong>Additional Information:</strong></p>
      <p style="margin: 0;">${adminNotes}</p>
    </div>
    `
        : ""
    }
    <p>You can try submitting a new deposit request or contact our customer support if you need further assistance with this matter.</p>
    
    <div style="padding: 15px; border-radius: 5px; margin: 20px 0; border: 1px solid #ddd;">
      <p style="margin: 0;"><strong>What to do next?</strong></p>
      <ul style="margin-top: 10px; padding-left: 20px;">
        <li>Check if your payment details were correct</li>
        <li>Make sure your deposit meets our minimum requirements</li>
        <li>Submit a new deposit request if needed</li>
        <li>Contact our support team for assistance</li>
      </ul>
    </div>
    
    <p>Thank you for your understanding. We value your business and look forward to serving you better.</p>
    <hr/>
    <p>
      Best regards,<br/>
      Investo Team
    </p>
  `;
};

// Withdrawal approval email template
const withdrawalNotificationTemplate = (withdrawal) => {
  return `
    <h1>Your Withdrawal Has Been Processed!</h1>
    <p>Hi there,</p>
    <p>We're pleased to inform you that your withdrawal request has been approved and processed.</p>
   
    <h2>[Withdrawal ID: ${withdrawal._id.toString()}] (${
    new Date(withdrawal.processedAt).toISOString().split("T")[0]
  })</h2>
    
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
      <tr style="background-color: #f8f9fa;">
        <th style="padding: 12px; text-align: left; border-bottom: 2px solid #dee2e6;">Detail</th>
        <th style="padding: 12px; text-align: right; border-bottom: 2px solid #dee2e6;">Information</th>
      </tr>
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #dee2e6;"><strong>Amount:</strong></td>
        <td style="padding: 12px; text-align: right; border-bottom: 1px solid #dee2e6;">$${withdrawal.amount.toFixed(
          2
        )}</td>
      </tr>
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #dee2e6;"><strong>Status:</strong></td>
        <td style="padding: 12px; text-align: right; border-bottom: 1px solid #dee2e6;">Approved</td>
      </tr>
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #dee2e6;"><strong>Payment Method:</strong></td>
        <td style="padding: 12px; text-align: right; border-bottom: 1px solid #dee2e6;">${
          withdrawal.paymentMethod.charAt(0).toUpperCase() +
          withdrawal.paymentMethod.slice(1).replace("_", " ")
        }</td>
      </tr>
      ${
        withdrawal.transactionId
          ? `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #dee2e6;"><strong>Transaction ID:</strong></td>
        <td style="padding: 12px; text-align: right; border-bottom: 1px solid #dee2e6;">${withdrawal.transactionId}</td>
      </tr>
      `
          : ""
      }
    </table>
    <p>Your funds have been successfully sent to your specified withdrawal destination.</p>
    
    <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
      <p style="margin: 0;"><strong>Login to your account to view your transaction history and initiate new transactions.</strong></p>
    </div>
    
    <p>Thank you for using our platform. If you have any questions, please don't hesitate to contact our support team.</p>
    <hr/>
    <p>
      Best regards,<br/>
      Investo Team
    </p>
  `;
};

const withdrawalRejectionTemplate = (withdrawal, adminNotes) => {
  return `
    <h1>Update on Your Withdrawal Request</h1>
    <p>Hi there,</p>
    <p>We're writing to inform you that your recent withdrawal request has been reviewed and could not be processed at this time.</p>
   
    <h2>[Withdrawal ID: ${withdrawal._id.toString()}]</h2>
    
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
      <tr style="background-color: #f8f9fa;">
        <th style="padding: 12px; text-align: left; border-bottom: 2px solid #dee2e6;">Detail</th>
        <th style="padding: 12px; text-align: right; border-bottom: 2px solid #dee2e6;">Information</th>
      </tr>
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #dee2e6;"><strong>Amount:</strong></td>
        <td style="padding: 12px; text-align: right; border-bottom: 1px solid #dee2e6;">$${withdrawal.amount.toFixed(
          2
        )}</td>
      </tr>
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #dee2e6;"><strong>Status:</strong></td>
        <td style="padding: 12px; text-align: right; border-bottom: 1px solid #dee2e6;">Rejected</td>
      </tr>
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #dee2e6;"><strong>Payment Method:</strong></td>
        <td style="padding: 12px; text-align: right; border-bottom: 1px solid #dee2e6;">${
          withdrawal.paymentMethod.charAt(0).toUpperCase() +
          withdrawal.paymentMethod.slice(1).replace("_", " ")
        }</td>
      </tr>
    </table>
    
    <div style="background-color: #fff8f8; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 3px solid #dc3545;">
      <p style="margin: 0 0 10px 0;"><strong>Reason for rejection:</strong></p>
      <p style="margin: 0;">${
        adminNotes ||
        "No specific reason provided. Please contact support for more information."
      }</p>
    </div>
    
    <p>Your funds remain in your wallet and are available for future withdrawals. If you have any questions about this decision or need assistance with a new withdrawal request, please contact our support team.</p>
    <hr/>
    <p>
      Best regards,<br/>
      Investo Team
    </p>
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
