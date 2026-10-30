const express = require('express');
const { Resend } = require('resend');

const app = express();
app.use(express.json());

// Initialize Resend with your API key
const resend = new Resend('re_your_api_key_here');

// In-memory store for pending verifications
const pendingUsers = new Map();

// 1. Signup Route
app.post('/api/auth/signup', async (req, res) => {
    try {
        const { name, email, password } = req.body;
        const verificationToken = Math.random().toString(36).substring(2) + Date.now().toString(36);

        pendingUsers.set(verificationToken, { name, email, password, isVerified: false });

        const activationLink = `http://localhost:8158/api/auth/verify?token=${verificationToken}`;

        const { data, error } = await resend.emails.send({
            from: 'Wolf Workspace <onboarding@resend.dev>',
            to: [email],
            subject: '🐺 Verify Your Wolf Workspace Account',
            html: `
                <div style="font-family: Arial, sans-serif; background: #07111f; color: #f8fafc; padding: 30px; border-radius: 12px;">
                    <h2 style="color: #00f0ff;">Welcome to Wolf Workspace, ${name}</h2>
                    <p>Click the button below to verify your email address and activate your workspace:</p>
                    <a href="${activationLink}" style="display: inline-block; background: #00f0ff; color: #07111f; padding: 12px 24px; text-decoration: none; font-weight: bold; border-radius: 8px; margin: 20px 0;">Verify Email Address</a>
                </div>
            `
        });

        if (error) {
            return res.status(400).json({ success: false, error });
        }

        res.json({ success: true, message: 'Verification email sent!' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 2. Verification Route
app.get('/api/auth/verify', (req, res) => {
    const { token } = req.query;
    const userData = pendingUsers.get(token);

    if (userData) {
        userData.isVerified = true;
        // Save verified user permanently in a local JSON or handle client-side transition
        res.send(`
            <body style="background: #07111f; color: #f8fafc; font-family: Arial; text-align: center; padding-top: 50px;">
                <h1 style="color: #00f0ff;">✉️ Email Verified Successfully!</h1>
                <p>Your Wolf Workspace account is active.</p>
                <a href="http://localhost:8158" style="display: inline-block; background: #00f0ff; color: #07111f; padding: 12px 24px; text-decoration: none; font-weight: bold; border-radius: 8px; margin-top: 20px;">Return to Workspace Login</a>
            </body>
        `);
        pendingUsers.delete(token);
    } else {
        res.status(400).send('Invalid or expired verification link.');
    }
});

app.listen(8158, () => {
    console.log('🐺 Wolf POS & Auth Server running on port 8158');
});
