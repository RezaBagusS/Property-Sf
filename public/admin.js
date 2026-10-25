let allLeads = [];
const TOKEN_KEY = 'psf_admin_token';

// Elements
const adminLoginGate = document.getElementById('adminLoginGate');
const dashboardContent = document.getElementById('dashboardContent');
const logoutBtn = document.getElementById('logoutBtn');
const adminLoginForm = document.getElementById('adminLoginForm');
const adminPasswordInput = document.getElementById('adminPasswordInput');
const loginErrorMessage = document.getElementById('loginErrorMessage');
const loginSubmitBtn = document.getElementById('loginSubmitBtn');

function getAuthToken() {
  return sessionStorage.getItem(TOKEN_KEY) || '';
}

function getAuthHeaders() {
  const token = getAuthToken();
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
}

// Check session on load
async function checkAuthSession() {
  const token = getAuthToken();
  if (!token) {
    showLoginGate();
    return;
  }

  try {
    const res = await fetch('/api/auth/verify', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) {
      showDashboard();
      loadLeads();
    } else {
      logoutAdmin();
    }
  } catch (err) {
    logoutAdmin();
  }
}

function showLoginGate() {
  if (adminLoginGate) adminLoginGate.style.display = 'block';
  if (dashboardContent) dashboardContent.style.display = 'none';
  if (logoutBtn) logoutBtn.style.display = 'none';
  if (adminPasswordInput) {
    adminPasswordInput.value = '';
    adminPasswordInput.focus();
  }
}

function showDashboard() {
  if (adminLoginGate) adminLoginGate.style.display = 'none';
  if (dashboardContent) dashboardContent.style.display = 'block';
  if (logoutBtn) logoutBtn.style.display = 'inline-flex';
}

function logoutAdmin() {
  sessionStorage.removeItem(TOKEN_KEY);
  showLoginGate();
}

// Handle Login Form
if (adminLoginForm) {
  adminLoginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const password = adminPasswordInput.value;
    if (!password) return;

    loginSubmitBtn.disabled = true;
    loginSubmitBtn.textContent = 'Memverifikasi...';
    loginErrorMessage.style.display = 'none';

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      const data = await res.json();

      if (res.ok && data.success && data.token) {
        sessionStorage.setItem(TOKEN_KEY, data.token);
        showDashboard();
        loadLeads();
      } else {
        loginErrorMessage.style.display = 'block';
        loginErrorMessage.textContent = data.message || 'Password salah.';
        adminLoginGate.classList.add('shake-anim');
        setTimeout(() => adminLoginGate.classList.remove('shake-anim'), 400);
      }
    } catch (err) {
      loginErrorMessage.style.display = 'block';
      loginErrorMessage.textContent = 'Gagal menghubungi server.';
    } finally {
      loginSubmitBtn.disabled = false;
      loginSubmitBtn.textContent = 'Buka Portal Admin →';
    }
  });
}

// Load leads from API (Protected)
async function loadLeads() {
  try {
    const res = await fetch('/api/buyers', {
      headers: getAuthHeaders()
    });

    if (res.status === 401) {
      logoutAdmin();
      return;
    }

    const json = await res.json();
    if (json.success) {
      allLeads = json.data;
      updateStats();
      applyFilters();
    }
  } catch (err) {
    console.error('Error fetching leads:', err);
  }
}

function updateStats() {
  document.getElementById('statTotal').textContent = allLeads.length;
  
  const cashCount = allLeads.filter(l => l.financial.paymentMethod === 'Cash Keras').length;
  document.getElementById('statCash').textContent = cashCount;

  const immediateCount = allLeads.filter(l => l.financial.purchaseTimeline.includes('Bulan Ini') || l.financial.purchaseTimeline.includes('Segera')).length;
  document.getElementById('statImmediate').textContent = immediateCount;

  const highBudgetCount = allLeads.filter(l => (l.financial.budgetMax || 0) >= 1500000000).length;
  document.getElementById('statHighBudget').textContent = highBudgetCount;
}

function applyFilters() {
  const query = document.getElementById('searchCity').value.toLowerCase();
  const paymentFilter = document.getElementById('filterPayment').value;
  const statusFilter = document.getElementById('filterStatus').value;

  const filtered = allLeads.filter(lead => {
    const matchesQuery = !query || 
      lead.profile.name.toLowerCase().includes(query) ||
      lead.preferences.targetCity.toLowerCase().includes(query) ||
      (lead.preferences.targetArea && lead.preferences.targetArea.toLowerCase().includes(query)) ||
      lead.preferences.propertyType.toLowerCase().includes(query);
    
    const matchesPayment = !paymentFilter || lead.financial.paymentMethod === paymentFilter;
    const matchesStatus = !statusFilter || lead.status === statusFilter;

    return matchesQuery && matchesPayment && matchesStatus;
  });

  renderTable(filtered);
}

function renderTable(leads) {
  const tbody = document.getElementById('leadsTableBody');

  if (leads.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; color: var(--text-muted); padding: 3rem;">
          Tidak ada data pembeli yang cocok dengan filter pencarian.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = leads.map(lead => {
    // Format whatsapp link
    let cleanWa = lead.profile.whatsapp.replace(/[^0-9]/g, '');
    if (cleanWa.startsWith('0')) cleanWa = '62' + cleanWa.slice(1);
    const waMessage = encodeURIComponent(
      `Halo Bapak/Ibu ${lead.profile.name}, saya dari tim kurasi properti direct-owner. Saya melihat Anda mencari ${lead.preferences.propertyType} di ${lead.preferences.targetCity}. Kami ada unit terverifikasi yang cocok dengan kriteria Anda, apakah berkenan kami kirimkan detailnya?`
    );
    const waUrl = `https://wa.me/${cleanWa}?text=${waMessage}`;

    return `
      <tr>
        <td>
          <div style="font-weight: 700; color: var(--text-main); font-size: 0.925rem;">${lead.profile.name}</div>
          <div style="color: var(--text-muted); font-size: 0.725rem; margin-top: 2px;">Terdaftar: ${new Date(lead.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
          ${lead.profile.notes ? `<div style="font-size: 0.775rem; color: var(--text-secondary); margin-top: 5px; font-style: italic; background: var(--bg-subtle); padding: 4px 8px; border-radius: 4px; display: inline-block;">"${lead.profile.notes}"</div>` : ''}
        </td>
        <td>
          <div style="font-weight: 600; color: var(--text-main);">${lead.preferences.propertyType}</div>
          <div style="color: var(--text-secondary); font-size: 0.8rem; margin-top: 2px;">📍 ${lead.preferences.targetCity} ${lead.preferences.targetArea ? `<span style="color: var(--text-muted);">(${lead.preferences.targetArea})</span>` : ''}</div>
          <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 4px;">
            ${lead.preferences.minBedrooms === 'Bebas' ? 'Kamar Bebas' : `${lead.preferences.minBedrooms} KT`} &bull; ${lead.preferences.carAccessFlexible ? 'Akses Bebas' : (lead.preferences.carAccessRequired ? 'Akses Mobil' : 'Akses Motor')} &bull; ${lead.preferences.certificatePreference}
          </div>
        </td>
        <td>
          <div style="font-weight: 700; color: var(--text-main);">${lead.financial.budgetRange}</div>
          <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 2px;">${lead.financial.paymentMethod}</div>
        </td>
        <td>
          <span style="font-size: 0.8rem; font-weight: 500; color: var(--text-main);">${lead.financial.purchaseTimeline}</span>
        </td>
        <td>
          <select class="field-input" style="padding: 0.3rem 0.55rem; font-size: 0.75rem; font-weight: 600; width: auto;" onchange="updateLeadStatus('${lead.id}', this.value)">
            <option value="NEW" ${lead.status === 'NEW' ? 'selected' : ''}>NEW</option>
            <option value="MATCHED" ${lead.status === 'MATCHED' ? 'selected' : ''}>MATCHED</option>
            <option value="CLOSED" ${lead.status === 'CLOSED' ? 'selected' : ''}>CLOSED</option>
          </select>
        </td>
        <td>
          <a href="${waUrl}" target="_blank" class="wa-action-btn" title="Kirim lembar penawaran ke WhatsApp">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
            Hubungi
          </a>
        </td>
      </tr>
    `;
  }).join('');
}

async function updateLeadStatus(id, newStatus) {
  try {
    const res = await fetch(`/api/buyers/${id}`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify({ status: newStatus })
    });
    if (res.status === 401) {
      logoutAdmin();
      return;
    }
    const json = await res.json();
    if (json.success) {
      const idx = allLeads.findIndex(l => l.id === id);
      if (idx !== -1) allLeads[idx].status = newStatus;
    }
  } catch (err) {
    console.error('Failed to update status:', err);
  }
}

// Check session on startup
checkAuthSession();
