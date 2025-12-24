import { Resend } from 'resend';
import express from 'express';
import 'dotenv/config';

const resend = new Resend(process.env.RESEND_API_KEY);
const app = express();
app.use(express.json());

// Nơi lưu trữ tạm thời
const otpStore: Record<string, { code: string, expiresAt: number }> = {};

app.post('/user/send-verification-code', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Thiếu email!" });

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  otpStore[email] = {
    code: otp,
    expiresAt: Date.now() + 5 * 60 * 1000 // 5 phút
  }; // Lưu mã OTP tạm thời

  try {
    const data = await resend.emails.send({
      from: 'CMA <auth@antnv3467.id.vn>',
      to: [email],
      subject: 'Mã xác nhận của bạn',
      html: `
        <div style="font-family: sans-serif; border: 1px solid #ddd; padding: 20px;">
          <h2>Xác nhận đăng ký</h2>
          <p>Chào bạn, mã OTP để kích hoạt tài khoản của bạn là:</p>
          <h1 style="color: blue; letter-spacing: 5px;">${otp}</h1>
          <p>Mã này sẽ hết hạn sau 5 phút.</p>
        </div>
      `,
    });

    res.status(200).json({ message: "Đã gửi mã OTP thành công!" });
  } catch (error) {
    res.status(500).json({ error: "Không thể gửi email" });
  }
})

app.post('/user/verify-email', (req, res) => {
  const { email, otp } = req.body;
  const record = otpStore[email];
  if (!record) {
    return res.status(400).json({ error: "Mã OTP không tồn tại hoặc đã hết hạn." });
  }

  const isExpired = Date.now() > record.expiresAt;

  if (isExpired) {
    delete otpStore[email]; // Xóa mã đã hết hạn
    return res.status(400).json({ error: "Mã OTP đã hết hạn 5 phút." });
  }

  // Kiểm tra mã người dùng nhập với mã trong bộ nhớ
  if (record.code === otp) {
    // Nếu đúng, xóa mã OTP đó đi để không dùng lại được lần 2
    delete otpStore[email];
    res.status(200).json({ message: "Xác minh thành công! Chào mừng bạn." });
  } else {
    res.status(400).json({ error: "Mã OTP không đúng hoặc đã hết hạn." });
  }
});

app.listen(3000, () => {
  if (!process.env.RESEND_API_KEY) {
    throw `Abort: You need to define RESEND_API_KEY in the .env file.`;
  }

  console.log('Listening on http://localhost:3000');
});
