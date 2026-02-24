// Mock email service for MVP
// Replace with SendGrid integration when ready

async function sendBookingConfirmation({ studentEmail, studentName, teacherName, date, time, location, amount }) {
  console.log(`[MOCK EMAIL] Booking confirmation sent:`);
  console.log(`  To: ${studentEmail} (${studentName})`);
  console.log(`  Teacher: ${teacherName}`);
  console.log(`  Date: ${date} at ${time}`);
  console.log(`  Location: ${location}`);
  console.log(`  Amount: £${amount}`);
  return { success: true, messageId: `msg_mock_${Date.now()}` };
}

async function sendBookingNotification({ teacherEmail, teacherName, studentName, date, time }) {
  console.log(`[MOCK EMAIL] Booking notification sent to teacher:`);
  console.log(`  To: ${teacherEmail} (${teacherName})`);
  console.log(`  Student: ${studentName}`);
  console.log(`  Date: ${date} at ${time}`);
  return { success: true, messageId: `msg_mock_${Date.now()}` };
}

async function sendCancellationEmail({ email, name, bookingDetails }) {
  console.log(`[MOCK EMAIL] Cancellation email sent:`);
  console.log(`  To: ${email} (${name})`);
  console.log(`  Booking:`, bookingDetails);
  return { success: true, messageId: `msg_mock_${Date.now()}` };
}

module.exports = { sendBookingConfirmation, sendBookingNotification, sendCancellationEmail };
