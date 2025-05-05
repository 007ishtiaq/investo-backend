const nodemailer = require("nodemailer");
const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");

// Create a transporter using Mailjet's SMTP
const transporter = nodemailer.createTransport({
  service: "Mailjet",
  auth: {
    user: process.env.MAILJET_API_KEY,
    pass: process.env.MAILJET_SECRET_KEY,
  },
});

const otpEmailtemplate = (otpCode) => {
  return `
  <div style="font-family: Helvetica, Arial, sans-serif; min-width: 1000px; overflow: auto; line-height: 1.6;">
  <div style="margin: 50px auto; width: 70%; padding: 20px 0;">
    <div style="border-bottom: 1px solid #eee;">
      <a href="#" style="font-size: 1.8em; color: #6c5dd3; text-decoration: none; font-weight: 600;">Investo</a>
    </div>
    <p style="font-size: 1.1em;">Hi,</p>
    <p>Thank you for choosing Investo. Use the following OTP to complete your Sign Up procedures. The OTP is valid for 15 minutes.</p>
    <h2 style="background: #3f8cff; margin: 0 auto; width: max-content; padding: 10px; color: #fff; border-radius: 4px; text-align: center;">${otpCode}</h2>
    <p style="font-size: 0.9em;">Regards,<br />Investo</p>
    <hr style="border: none; border-top: 1px solid #eee;" />
  </div>
</div>
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
module.exports = {
  transporter,
  orderReceipttemplate,
  generateInvoicePDF,
  otpEmailtemplate,
  depositNotificationTemplate,
  depositRejectionTemplate,
};
