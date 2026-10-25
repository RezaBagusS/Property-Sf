let currentStep = 1;
const totalSteps = 4;

const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const submitBtn = document.getElementById('submitBtn');
const progressFill = document.getElementById('progressFill');
const form = document.getElementById('buyerIntakeForm');
const successScreen = document.getElementById('successScreen');
const leadIdDisplay = document.getElementById('leadIdDisplay');

function updateStepUI() {
  // Update step panes and stepper indicators
  for (let i = 1; i <= totalSteps; i++) {
    const pane = document.getElementById(`step${i}`);
    const ind = document.getElementById(`ind${i}`);
    
    if (pane) pane.classList.toggle('active', i === currentStep);
    if (ind) {
      ind.classList.toggle('active', i === currentStep);
      ind.classList.toggle('completed', i < currentStep);
    }
  }

  // Buttons state
  prevBtn.style.visibility = currentStep === 1 ? 'hidden' : 'visible';
  if (currentStep === totalSteps) {
    nextBtn.style.display = 'none';
    submitBtn.style.display = 'inline-flex';
  } else {
    nextBtn.style.display = 'inline-flex';
    submitBtn.style.display = 'none';
  }
}

// Toggle Switch Controls (Bedrooms & Car Access)
const toggleBedrooms = document.getElementById('toggleBedrooms');
const bedroomToggleText = document.getElementById('bedroomToggleText');
const bedroomSelectorWrap = document.getElementById('bedroomSelectorWrap');
const bedroomPlaceholder = document.getElementById('bedroomPlaceholder');

if (toggleBedrooms) {
  toggleBedrooms.addEventListener('change', () => {
    const isActive = toggleBedrooms.checked;
    bedroomSelectorWrap.style.display = isActive ? 'block' : 'none';
    bedroomPlaceholder.style.display = isActive ? 'none' : 'block';
    bedroomToggleText.textContent = isActive ? 'Aktif' : 'Bebas';
    bedroomToggleText.classList.toggle('active', isActive);
  });
}

const toggleCarAccess = document.getElementById('toggleCarAccess');
const carToggleText = document.getElementById('carToggleText');
const carSelectorWrap = document.getElementById('carSelectorWrap');
const carPlaceholder = document.getElementById('carPlaceholder');

if (toggleCarAccess) {
  toggleCarAccess.addEventListener('change', () => {
    const isActive = toggleCarAccess.checked;
    carSelectorWrap.style.display = isActive ? 'block' : 'none';
    carPlaceholder.style.display = isActive ? 'none' : 'block';
    carToggleText.textContent = isActive ? 'Aktif' : 'Bebas';
    carToggleText.classList.toggle('active', isActive);
  });
}

// Property Type Suggestion Pills Logic
const propertyTypeInput = document.getElementById('propertyTypeInput');
const suggestionPillsContainer = document.getElementById('suggestionPills');

function syncPropertyTypePills(value) {
  const normalized = (value || '').trim().toLowerCase();
  const pills = document.querySelectorAll('.tag-btn');
  pills.forEach(pill => {
    const pillVal = (pill.dataset.val || pill.textContent).trim().toLowerCase();
    if (pillVal === normalized) {
      pill.classList.add('active');
    } else {
      pill.classList.remove('active');
    }
  });
}

if (suggestionPillsContainer && propertyTypeInput) {
  // Click delegation on container to ensure 100% click detection
  suggestionPillsContainer.addEventListener('click', (e) => {
    const pill = e.target.closest('.tag-btn');
    if (!pill) return;
    
    e.preventDefault();
    const chosenVal = pill.dataset.val || pill.textContent.trim();
    propertyTypeInput.value = chosenVal;
    syncPropertyTypePills(chosenVal);
    propertyTypeInput.focus();
  });

  // Sync when typing or selecting from datalist
  propertyTypeInput.addEventListener('input', (e) => {
    syncPropertyTypePills(e.target.value);
  });

  propertyTypeInput.addEventListener('change', (e) => {
    syncPropertyTypePills(e.target.value);
  });

  // Initial sync on page load
  syncPropertyTypePills(propertyTypeInput.value);
}

function validateCurrentStep() {
  if (currentStep === 1) {
    const propType = document.getElementById('propertyTypeInput');
    const city = document.getElementById('targetCity');

    if (!propType.value.trim()) {
      alert('Mohon isi atau pilih tipe properti yang Anda cari.');
      propType.focus();
      return false;
    }
    if (!city.value.trim()) {
      alert('Mohon isi kota / wilayah tujuan Anda.');
      city.focus();
      return false;
    }
  }
  return true;
}

nextBtn.addEventListener('click', () => {
  if (!validateCurrentStep()) return;
  if (currentStep < totalSteps) {
    currentStep++;
    updateStepUI();
  }
});

prevBtn.addEventListener('click', () => {
  if (currentStep > 1) {
    currentStep--;
    updateStepUI();
  }
});

// Form Submission
form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const fullName = document.getElementById('fullName').value.trim();
  const whatsapp = document.getElementById('whatsappNumber').value.trim();
  const notes = document.getElementById('buyerNotes').value.trim();

  if (!fullName || !whatsapp) {
    alert('Nama dan nomor WhatsApp wajib diisi.');
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = 'Menyimpan...';

  const selectedBudget = document.querySelector('input[name="budgetRange"]:checked');
  const payload = {
    profile: {
      name: fullName,
      whatsapp: whatsapp,
      notes: notes
    },
    preferences: {
      propertyType: document.getElementById('propertyTypeInput')?.value.trim() || 'Rumah Tinggal',
      targetCity: document.getElementById('targetCity').value.trim(),
      targetArea: document.getElementById('targetArea').value.trim(),
      minBedrooms: (toggleBedrooms && toggleBedrooms.checked)
        ? (document.querySelector('input[name="minBedrooms"]:checked')?.value || '3')
        : 'Bebas',
      carAccessRequired: (toggleCarAccess && toggleCarAccess.checked)
        ? (document.querySelector('input[name="carAccess"]:checked')?.value === 'true')
        : false,
      carAccessFlexible: !(toggleCarAccess && toggleCarAccess.checked),
      certificatePreference: document.querySelector('input[name="certPref"]:checked')?.value || 'SHM Wajib'
    },
    financial: {
      budgetRange: selectedBudget?.value || 'Rp 700 Jt - 1.2 M',
      budgetMax: Number(selectedBudget?.dataset?.max) || 1200000000,
      paymentMethod: document.querySelector('input[name="paymentMethod"]:checked')?.value || 'KPR Bank',
      purchaseTimeline: document.querySelector('input[name="purchaseTimeline"]:checked')?.value || '1 - 3 Bulan'
    }
  };

  try {
    const res = await fetch('/api/buyers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await res.json();

    if (result.success) {
      if (form) form.style.display = 'none';
      const stepper = document.querySelector('.stepper');
      if (stepper) stepper.style.display = 'none';
      const footer = document.querySelector('.form-footer');
      if (footer) footer.style.display = 'none';

      if (leadIdDisplay) leadIdDisplay.textContent = `#${result.leadId}`;
      if (successScreen) successScreen.style.display = 'block';
    } else {
      alert(result.message || 'Gagal menyimpan data.');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Kirim Kriteria Sourcing ✓';
    }
  } catch (err) {
    console.error('Submission error:', err);
    alert('Terjadi kendala saat memproses tampilan: ' + (err.message || 'Silakan coba lagi.'));
    submitBtn.disabled = false;
    submitBtn.textContent = 'Kirim Kriteria Sourcing ✓';
  }
});
