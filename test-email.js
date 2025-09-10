
import { Resend } from 'resend';
import dotenv from 'dotenv';
dotenv.config();

const resend = new Resend(process.env.RESEND_API_KEY);

async function test() {
  const result = await resend.emails.send({
    from: 'promptpalcommunity@gmail.com',
    to: 'promptpalcommunity@gmail.com',
    subject: 'Test Email',
    html: '<p>This is a test email from Resend.</p>',
  });

  console.log(result);
}

test();
