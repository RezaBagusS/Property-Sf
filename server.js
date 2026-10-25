const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3500;
const DATA_FILE = path.join(__dirname, 'data', 'buyers.json');

// Configuration & Secrets
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123456';
const GOOGLE_SHEET_WEBHOOK_URL = process.env.GOOGLE_SHEET_WEBHOOK_URL || 'https://script.google.com/macros/s/AKfycbxS25sSbSna8uh6jzh6-cyXd8xV85YI6ceH6qy6mbigpfq7r-edBrc8q8f51UeotthBbg/exec';

// In-memory active session tokens
const validSessionTokens = new Set();

// Ensure data folder exists (for local file storage)
if (!fs.existsSync(path.join(__dirname, 'data'))) {
  try {
    fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true });
  } catch (e) {}
}

// Seed initial realistic data if empty (local only)
if (!fs.existsSync(DATA_FILE)) {
  const initialData = [
    {
      id: "BYR-" + Date.now().toString(36).toUpperCase() + "01",
      createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
      status: "NEW",
      profile: {
        name: "Dimas Pratama",
        whatsapp: "081288991234",
        notes: "Mencari dekat stasiun KRL atau pintu tol, untuk ditempati keluarga muda."
      },
      preferences: {
        propertyType: "Rumah Tinggal",
        targetCity: "Tangerang Selatan",
        targetArea: "BSD, Serpong, Bintaro",
        minBedrooms: "3",
        carAccessRequired: true,
        certificatePreference: "SHM Wajib"
      },
      financial: {
        budgetRange: "Rp 1.2 M - 2 M",
        budgetMax: 2000000000,
        paymentMethod: "KPR Bank",
        purchaseTimeline: "Bulan Ini (Siap DP)"
      }
    }
  ];
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(initialData, null, 2));
  } catch (e) {}
}

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Helper to read local data
function readBuyers() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf-8');
      return JSON.parse(raw);
    }
    return [];
  } catch (err) {
    return [];
  }
}

// Helper to write local data
function writeBuyers(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    // On read-only serverless platforms like Vercel, local write is ignored safely
  }
}

// Admin Authentication Middleware
function requireAdminAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  const directPassword = req.headers['x-admin-password'];

  // Check direct password header
  if (directPassword && directPassword === ADMIN_PASSWORD) {
    return next();
  }

  // Check Bearer token
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    if (validSessionTokens.has(token)) {
      return next();
    }
  }

  return res.status(401).json({
    success: false,
    message: 'Akses ditolak. Silakan masukkan password admin yang valid.'
  });
}

// =====================
// AUTH ROUTES
// =====================

// POST: Admin Login
app.post('/api/auth/login', (req, res) => {
  const { password } = req.body;

  if (!password || password !== ADMIN_PASSWORD) {
    return res.status(401).json({ success: false, message: 'Password salah. Akses ditolak.' });
  }

  const token = 'adm_' + crypto.randomBytes(24).toString('hex');
  validSessionTokens.add(token);

  res.json({
    success: true,
    message: 'Login berhasil.',
    token: token
  });
});

// GET: Verify Token
app.get('/api/auth/verify', (req, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    if (validSessionTokens.has(token)) {
      return res.json({ success: true, valid: true });
    }
  }
  res.status(401).json({ success: false, valid: false });
});

// =====================
// PUBLIC BUYER INTAKE
// =====================

// POST: Submit new buyer intake form (Public)
app.post('/api/buyers', (req, res) => {
  const { profile, preferences, financial } = req.body;

  if (!profile?.name || !profile?.whatsapp) {
    return res.status(400).json({ success: false, message: 'Nama dan nomor WhatsApp wajib diisi.' });
  }

  const newLead = {
    id: "BYR-" + Date.now().toString(36).toUpperCase(),
    createdAt: new Date().toISOString(),
    status: "NEW",
    profile: {
      name: profile.name.trim(),
      whatsapp: profile.whatsapp.trim(),
      notes: profile.notes ? profile.notes.trim() : ""
    },
    preferences: {
      propertyType: preferences?.propertyType || "Rumah Tinggal",
      targetCity: preferences?.targetCity?.trim() || "Jabodetabek",
      targetArea: preferences?.targetArea?.trim() || "-",
      minBedrooms: preferences?.minBedrooms || "3",
      carAccessRequired: Boolean(preferences?.carAccessRequired),
      carAccessFlexible: Boolean(preferences?.carAccessFlexible),
      certificatePreference: preferences?.certificatePreference || "SHM Wajib"
    },
    financial: {
      budgetRange: financial?.budgetRange || "Rp 700 Jt - 1.2 M",
      budgetMax: Number(financial?.budgetMax) || 1200000000,
      paymentMethod: financial?.paymentMethod || "KPR Bank",
      purchaseTimeline: financial?.purchaseTimeline || "1 - 3 Bulan"
    }
  };

  // Local backup
  const buyers = readBuyers();
  buyers.unshift(newLead);
  writeBuyers(buyers);

  // Sync to Google Sheets Webhook
  if (GOOGLE_SHEET_WEBHOOK_URL) {
    fetch(GOOGLE_SHEET_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(newLead)
    }).catch(err => console.error('Failed to sync to Google Sheets:', err.message));
  }

  res.status(201).json({ success: true, message: 'Data kriteria berhasil disimpan.', leadId: newLead.id });
});

// =====================
// PROTECTED ADMIN ROUTES
// =====================

// GET: All buyer leads (Protected)
app.get('/api/buyers', requireAdminAuth, async (req, res) => {
  const localBuyers = readBuyers();
  res.json({ success: true, count: localBuyers.length, data: localBuyers });
});

// PATCH: Update lead status (Protected)
app.patch('/api/buyers/:id', requireAdminAuth, (req, res) => {
  const { id } = req.params;
  const { status, adminNotes } = req.body;
  const buyers = readBuyers();
  const index = buyers.findIndex(b => b.id === id);

  if (index === -1) {
    return res.status(404).json({ success: false, message: 'Lead tidak ditemukan.' });
  }

  if (status) buyers[index].status = status;
  if (adminNotes !== undefined) buyers[index].adminNotes = adminNotes;

  writeBuyers(buyers);
  res.json({ success: true, data: buyers[index] });
});

// Start server locally
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log(`- Form Intake Publik: http://localhost:${PORT}/`);
    console.log(`- Admin Registry (Protected): http://localhost:${PORT}/admin.html`);
  });
}

// Export for Vercel Serverless
module.exports = app;
