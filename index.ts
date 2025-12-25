import { Resend } from 'resend';
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import 'dotenv/config';

const resend = new Resend(process.env.RESEND_API_KEY);
const app = express();
app.use(express.json());
app.use(cors());

mongoose.connect(process.env.DB_MONGODB_URI || 'mongodb://localhost:27017/otp_db')
  .then(() => {console.log('Kết nối đến MongoDB thành công');})
  .catch((err) => {console.error('Lỗi kết nối đến MongoDB:', err);});

//Tạo Schema cho OTP
const otpSchema = new mongoose.Schema({
  email: { type: String, required: true },
  code: { type: String, required: true },
  createdAt: { type: Date, default: Date.now, expires: 300 } // Tự động xóa sau 300 giây (5 phút)
});
const OtpModel = mongoose.model('Otp', otpSchema);

app.post('/user/send-verification-code', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Thiếu email!" });

  try {
    // Tìm mã OTP cũ của email này
    const existingRecord = await OtpModel.findOne({ email });

    if (existingRecord) {
      const now = Date.now();
      const lastSent = new Date(existingRecord.createdAt).getTime();
      const diff = (now - lastSent) / 1000; // Đổi sang giây

      if (diff < 60) {
        return res.status(429).json({ 
          error: `Vui lòng đợi ${Math.ceil(60 - diff)} giây nữa trước khi gửi lại.` 
        });
      }
    }
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    await OtpModel.deleteOne({ email });
    await OtpModel.create({ email, code: otp });

    await resend.emails.send({
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

app.post('/user/verify-email', async (req, res) => {
  const { email, otp } = req.body;
  const record = await OtpModel.findOne({ email, code: otp });
  if (record) {
    await OtpModel.deleteOne({ email }); // Dùng xong thì xóa
    res.status(200).json({ message: "Xác minh thành công!" });
  } else {
    res.status(400).json({ error: "Mã OTP sai hoặc đã hết hạn." });
  }
});

app.listen(3000, () => {
  if (!process.env.RESEND_API_KEY) {
    throw `Abort: You need to define RESEND_API_KEY in the .env file.`;
  }

  console.log('Listening on http://localhost:3000');
});
