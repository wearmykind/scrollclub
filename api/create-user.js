// api/create-user.js — Vercel serverless function (Node runtime).
// Dipanggil dari halaman Pengaturan (cuma tombol "Tambah Anggota" yang muncul buat Owner)
// buat bikin akun anggota tim baru, TANPA pernah mengirim Supabase service_role key ke browser.
//
// WAJIB di-set di Vercel Project Settings > Environment Variables:
//   SUPABASE_SERVICE_ROLE_KEY  — ambil dari Supabase Dashboard > Project Settings > API > service_role
//   (secret! JANGAN pernah ditaruh di kode index.html atau dikirim ke klien)

const SUPABASE_URL = 'https://eveaesxnuaynyjjwczmd.supabase.co';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SERVICE_KEY) {
    return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY belum di-set di Vercel Environment Variables' });
  }

  const { name, email, password, callerToken } = req.body || {};
  if (!name || !email || !password || !callerToken) {
    return res.status(400).json({ error: 'Data tidak lengkap (nama/email/password/sesi)' });
  }
  if (String(password).length < 6) {
    return res.status(400).json({ error: 'Password minimal 6 karakter' });
  }

  try {
    // 1) Pastikan yang manggil endpoint ini beneran user yang lagi login (verifikasi token-nya)
    const whoRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${callerToken}` },
    });
    const whoData = await whoRes.json();
    if (!whoRes.ok || !whoData?.id) {
      return res.status(401).json({ error: 'Sesi tidak valid, coba login ulang' });
    }

    // 2) Pastikan yang manggil itu beneran Owner (baca profil dia dari tabel profiles)
    const profRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${whoData.id}&select=role`, {
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
    });
    const profData = await profRes.json();
    if (!profRes.ok || !profData?.[0] || profData[0].role !== 'owner') {
      return res.status(403).json({ error: 'Cuma Owner yang boleh menambah anggota tim' });
    }

    // 3) Buat akun baru lewat Supabase Admin API (auto-confirm, gak perlu verifikasi email)
    const createRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
      method: 'POST',
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, email_confirm: true }),
    });
    const createData = await createRes.json();
    if (!createRes.ok) {
      return res.status(400).json({ error: createData?.msg || createData?.error_description || 'Gagal membuat akun' });
    }

    // 4) Simpan profil (nama, role=team) buat akun barunya
    const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles`, {
      method: 'POST',
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ id: createData.id, name, role: 'team', team_role: null }),
    });
    if (!insertRes.ok) {
      const insertErr = await insertRes.json().catch(() => ({}));
      return res.status(400).json({ error: 'Akun dibuat tapi gagal simpan profil: ' + (insertErr?.message || 'unknown error') });
    }

    return res.status(200).json({ success: true, id: createData.id });
  } catch (err) {
    return res.status(500).json({ error: 'Server error: ' + err.message });
  }
}
