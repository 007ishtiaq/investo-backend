const Contact = require("../models/contact");

// Handle contact form submission
exports.sendContactMessage = async (req, res) => {
  try {
    const { name, email, subject, message, attachmentUrl, attachmentName } =
      req.body;

    // Validate form data
    if (!name || !email || !subject || !message) {
      return res.status(400).json({
        error: "All fields are required",
      });
    }

    // Check for valid email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        error: "Invalid email format",
      });
    }

    // Prepare attachment info if exists
    let attachmentInfo = null;
    if (attachmentUrl) {
      attachmentInfo = {
        url: attachmentUrl,
        originalName: attachmentName || "attachment",
      };
    }

    // Create new contact record in database
    const newContact = new Contact({
      name,
      email,
      subject,
      message,
      attachment: attachmentInfo,
      status: "new",
    });

    await newContact.save();

    // Send success response
    res.json({
      success: true,
      message: "Your message has been sent successfully!",
      contactId: newContact._id,
    });
  } catch (error) {
    console.error("Contact form error:", error);
    res.status(500).json({
      error: "Error saving message",
      message: error.message,
    });
  }
};
