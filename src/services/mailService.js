import nodemailer from "nodemailer";

async function configureNodemailer() {
  let transporter;
  try {
    transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT,
      secure: process.env.EMAIL_PORT === "465",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
  } catch (error) {
    throw new Error("Failed to create Ethereal test account");
  }
  return transporter;
}

async function sendEmail(user, menu, pdfBuffer) {
  if (!user || !menu || !pdfBuffer) {
    throw new Error("Missing required parameters to send email");
  }
  const transporter = await configureNodemailer();
  const mailOptions = {
    from: `"Your App Name" <${
      process.env.EMAIL_FROM || "noreply@example.com"
    }>`,
    to: user.email,
    subject: `Menu Analysis Report for ${menu.name}`,
    text: `Hi ${user.name},\n\nPlease find your requested analysis report for the menu "${menu.name}" attached.\n\nBest Regards,\nYour App Team`,
    attachments: [
      {
        filename: `analysis_report_${menu.name.replace(
          /\s+/g,
          "_"
        )}_${Date.now()}.pdf`,
        content: pdfBuffer,
        contentType: "application/pdf",
      },
    ],
  };
  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent:", info.response);
  } catch (error) {
    console.error("Error sending email:", error);
    throw new Error("Failed to send email");
  }
}

export { sendEmail };
