const sgMail = require('@sendgrid/mail');
const logger = require('../lib/logger');

const SENDGRID_KEY = process.env.SENDGRID_API_KEY;
const FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || 'noreply@tactile.app';
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

if (SENDGRID_KEY) {
  sgMail.setApiKey(SENDGRID_KEY);
  console.log('[EMAIL] SendGrid configured');
} else {
  console.log('[EMAIL] No SendGrid key — emails will be logged to console');
}

async function send(msg, retries = 2) {
  if (!SENDGRID_KEY) {
    console.log(`[MOCK EMAIL] To: ${msg.to} | Subject: ${msg.subject}`);
    return { success: true, mock: true };
  }

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      await sgMail.send({ ...msg, from: { email: FROM_EMAIL, name: 'Tactile' } });
      console.log(`[EMAIL] Sent to ${msg.to}: ${msg.subject}`);
      return { success: true };
    } catch (err) {
      const isLastAttempt = attempt === retries;
      const status = err.code || err.response?.statusCode;

      // Don't retry 4xx errors (bad request, invalid email, etc.)
      if (status && status >= 400 && status < 500) {
        logger.error('Email send failed (not retrying):', err);
        return { success: false, error: err.message };
      }

      if (isLastAttempt) {
        logger.error(`Email send failed after ${retries + 1} attempts:`, err);
        return { success: false, error: err.message };
      }

      // Exponential backoff: 500ms, 1500ms
      const delay = 500 * Math.pow(3, attempt);
      console.log(`[EMAIL] Attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
}

function dashboardLink(path = '/dashboard') {
  return `${CLIENT_URL}${path}`;
}

async function sendBookingConfirmation({ studentEmail, studentName, teacherName, date, time, location, amount }) {
  return send({
    to: studentEmail,
    subject: `Booking Confirmed — Lesson with ${teacherName}`,
    html: `
      <div style="font-family: -apple-system, sans-serif; max-width: 500px; margin: 0 auto;">
        <h2 style="color: #e05e48;">Booking Confirmed!</h2>
        <p>Hi ${studentName},</p>
        <p>Your photography lesson is all set. Here are the details:</p>
        <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
          <tr><td style="padding: 8px 0; color: #666;">Teacher</td><td style="padding: 8px 0; font-weight: 600;">${teacherName}</td></tr>
          <tr><td style="padding: 8px 0; color: #666;">Date</td><td style="padding: 8px 0; font-weight: 600;">${date}</td></tr>
          <tr><td style="padding: 8px 0; color: #666;">Time</td><td style="padding: 8px 0; font-weight: 600;">${time}</td></tr>
          <tr><td style="padding: 8px 0; color: #666;">Location</td><td style="padding: 8px 0; font-weight: 600;">${location}</td></tr>
          <tr style="border-top: 1px solid #eee;"><td style="padding: 12px 0; color: #666;">Total Paid</td><td style="padding: 12px 0; font-weight: 700; color: #e05e48; font-size: 18px;">£${amount}</td></tr>
        </table>
        <p style="color: #666; font-size: 14px;">Your teacher will have your contact details. If you need to cancel, <a href="${dashboardLink()}" style="color: #e05e48;">log in to your dashboard</a>.</p>
        <p style="color: #999; font-size: 12px; margin-top: 24px;">— Tactile · In-person photography lessons in London</p>
      </div>
    `,
  });
}

async function sendBookingNotification({ teacherEmail, teacherName, studentName, date, time }) {
  return send({
    to: teacherEmail,
    subject: `New Booking — ${studentName} on ${date}`,
    html: `
      <div style="font-family: -apple-system, sans-serif; max-width: 500px; margin: 0 auto;">
        <h2 style="color: #e05e48;">New Booking!</h2>
        <p>Hi ${teacherName},</p>
        <p>You have a new lesson booked:</p>
        <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
          <tr><td style="padding: 8px 0; color: #666;">Student</td><td style="padding: 8px 0; font-weight: 600;">${studentName}</td></tr>
          <tr><td style="padding: 8px 0; color: #666;">Date</td><td style="padding: 8px 0; font-weight: 600;">${date}</td></tr>
          <tr><td style="padding: 8px 0; color: #666;">Time</td><td style="padding: 8px 0; font-weight: 600;">${time}</td></tr>
        </table>
        <p style="color: #666; font-size: 14px;"><a href="${dashboardLink()}" style="color: #e05e48;">Log in to your dashboard</a> to see full details and student contact info.</p>
        <p style="color: #999; font-size: 12px; margin-top: 24px;">— Tactile · In-person photography lessons in London</p>
      </div>
    `,
  });
}

async function sendCancellationEmail({ email, name, bookingDetails }) {
  return send({
    to: email,
    subject: 'Booking Cancelled — Tactile',
    html: `
      <div style="font-family: -apple-system, sans-serif; max-width: 500px; margin: 0 auto;">
        <h2 style="color: #e05e48;">Booking Cancelled</h2>
        <p>Hi ${name},</p>
        <p>Your booking on ${bookingDetails.date} at ${bookingDetails.time} has been cancelled and a refund has been processed.</p>
        <p style="color: #666; font-size: 14px;">If this wasn't expected, please get in touch.</p>
        <p style="color: #999; font-size: 12px; margin-top: 24px;">— Tactile · In-person photography lessons in London</p>
      </div>
    `,
  });
}

async function sendPasswordResetEmail({ email, name, resetUrl }) {
  return send({
    to: email,
    subject: 'Reset Your Password — Tactile',
    html: `
      <div style="font-family: -apple-system, sans-serif; max-width: 500px; margin: 0 auto;">
        <h2 style="color: #e05e48;">Password Reset</h2>
        <p>Hi ${name},</p>
        <p>We received a request to reset your password. Click the button below to choose a new one:</p>
        <div style="text-align: center; margin: 24px 0;">
          <a href="${resetUrl}" style="display: inline-block; background: #e05e48; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">Reset Password</a>
        </div>
        <p style="color: #666; font-size: 14px;">This link expires in 1 hour. If you didn't request this, you can safely ignore this email.</p>
        <p style="color: #999; font-size: 12px; margin-top: 24px;">— Tactile · In-person photography lessons in London</p>
      </div>
    `,
  });
}

async function sendBookingAcceptedEmail({ studentEmail, studentName, teacherName, date, time }) {
  return send({
    to: studentEmail,
    subject: `Lesson Confirmed — ${teacherName} accepted your booking`,
    html: `<div style="font-family: -apple-system, sans-serif; max-width: 500px; margin: 0 auto;">
      <h2 style="color: #e05e48;">Lesson Confirmed!</h2>
      <p>Hi ${studentName},</p>
      <p><strong>${teacherName}</strong> has accepted your lesson on <strong>${date}</strong> at <strong>${time}</strong>.</p>
      <p style="color: #666; font-size: 14px;">You can <a href="${dashboardLink()}" style="color: #e05e48;">message your teacher</a> to discuss meeting location and what to bring.</p>
      <p style="color: #999; font-size: 12px; margin-top: 24px;">— Tactile · In-person photography lessons in London</p>
    </div>`,
  });
}

async function sendBookingDeclinedEmail({ studentEmail, studentName, teacherName, date }) {
  return send({
    to: studentEmail,
    subject: `Booking Update — ${teacherName}`,
    html: `<div style="font-family: -apple-system, sans-serif; max-width: 500px; margin: 0 auto;">
      <h2 style="color: #e05e48;">Booking Update</h2>
      <p>Hi ${studentName},</p>
      <p>Unfortunately, <strong>${teacherName}</strong> was unable to accept your lesson on <strong>${date}</strong>. A full refund has been processed.</p>
      <p style="color: #666; font-size: 14px;">Don't worry — there are plenty of great teachers on Tactile. <a href="${dashboardLink('/search')}" style="color: #e05e48;">Find another teacher</a></p>
      <p style="color: #999; font-size: 12px; margin-top: 24px;">— Tactile · In-person photography lessons in London</p>
    </div>`,
  });
}

async function sendInquiryReceivedEmail({ teacherEmail, teacherName, studentName }) {
  return send({
    to: teacherEmail,
    subject: `New inquiry from ${studentName}`,
    html: `<div style="font-family: -apple-system, sans-serif; max-width: 500px; margin: 0 auto;">
      <h2 style="color: #e05e48;">New Inquiry</h2>
      <p>Hi ${teacherName},</p>
      <p><strong>${studentName}</strong> has sent you a message. <a href="${dashboardLink()}" style="color: #e05e48;">Log in to Tactile</a> to reply and potentially book a lesson.</p>
      <p style="color: #999; font-size: 12px; margin-top: 24px;">— Tactile · In-person photography lessons in London</p>
    </div>`,
  });
}

async function sendReviewReceivedEmail({ teacherEmail, teacherName, studentName, rating }) {
  const stars = '\u2605'.repeat(rating) + '\u2606'.repeat(5 - rating);
  return send({
    to: teacherEmail,
    subject: `New ${rating}-star review from ${studentName}`,
    html: `<div style="font-family: -apple-system, sans-serif; max-width: 500px; margin: 0 auto;">
      <h2 style="color: #e05e48;">New Review</h2>
      <p>Hi ${teacherName},</p>
      <p><strong>${studentName}</strong> left you a <span style="color: #f59e0b;">${stars}</span> review.</p>
      <p style="color: #666; font-size: 14px;"><a href="${dashboardLink()}" style="color: #e05e48;">Log in</a> to see the full review on your profile.</p>
      <p style="color: #999; font-size: 12px; margin-top: 24px;">— Tactile · In-person photography lessons in London</p>
    </div>`,
  });
}

module.exports = { sendBookingConfirmation, sendBookingNotification, sendCancellationEmail, sendPasswordResetEmail, sendBookingAcceptedEmail, sendBookingDeclinedEmail, sendInquiryReceivedEmail, sendReviewReceivedEmail };
