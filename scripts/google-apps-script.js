/**
 * PropertySF - Google Apps Script Webhook & Sync Engine v2.1
 * ---------------------------------------------------------
 * Menyediakan sinkronisasi dua arah (Two-Way Sync):
 * 1. doPost(e) : Menerima lead baru dan mengirim notifikasi email otomatis ke Gmail Anda (100% Gratis).
 * 2. doGet(e)  : Membaca seluruh data lead dari Sheets untuk ditampilkan di Admin Registry Vercel.
 * 3. testSendEmail() : Uji coba kirim email & aktivasi izin otorisasi Google (Wajib dijalankan sekali).
 * 4. setupSheetHeaders() : Inisialisasi otomatis header kolom spreadsheet.
 */

// ==========================================
// KONFIGURASI EMAIL PENERIMA
// Masukkan alamat Gmail Anda di bawah ini:
// ==========================================
var NOTIFICATION_EMAIL = ""; // Contoh: "rezabagus@gmail.com". Jika dikosongkan, akan mencoba mendeteksi email pemilik otomatis.

function getTargetEmail() {
  if (NOTIFICATION_EMAIL && NOTIFICATION_EMAIL.trim() !== "") {
    return NOTIFICATION_EMAIL.trim();
  }
  var effective = Session.getEffectiveUser().getEmail();
  if (effective) return effective;
  var active = Session.getActiveUser().getEmail();
  if (active) return active;
  return "";
}

// 1. RECEIVE NEW LEADS & SEND EMAIL NOTIFICATION
function doPost(e) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: "Server sibuk, coba beberapa saat lagi."
    })).setMimeType(ContentService.MimeType.JSON);
  }

  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var data = JSON.parse(e.postData.contents);

    var leadId = data.leadId || ("BYR-" + Date.now().toString(36).toUpperCase());
    var timestamp = new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });

    // Format kamar tidur
    var kamarStr = "Bebas";
    if (data.preferences && data.preferences.minBedrooms) {
      kamarStr = data.preferences.minBedrooms === "Bebas" 
        ? "Bebas" 
        : data.preferences.minBedrooms + " Kamar";
    }

    // Format akses mobil
    var aksesMobilStr = "Bebas";
    if (data.preferences) {
      if (data.preferences.carAccessFlexible) {
        aksesMobilStr = "Bebas";
      } else if (data.preferences.carAccessRequired) {
        aksesMobilStr = "Wajib Mobil";
      } else {
        aksesMobilStr = "Akses Motor";
      }
    }

    // Simpan baris baru ke sheet
    sheet.appendRow([
      timestamp,
      leadId,
      data.profile.name,
      "'" + data.profile.whatsapp, // Prefix ' agar 0 di depan tidak terhapus
      data.preferences.propertyType || "Rumah Tinggal",
      data.preferences.targetCity || "Jabodetabek",
      data.preferences.targetArea || "-",
      data.financial.budgetRange || "-",
      data.financial.paymentMethod || "KPR Bank",
      data.financial.purchaseTimeline || "1 - 3 Bulan",
      kamarStr,
      aksesMobilStr,
      data.preferences.certificatePreference || "SHM Wajib",
      data.profile.notes || "-",
      "NEW"
    ]);

    // Kirim notifikasi email instan ke Gmail pemilik
    var targetEmail = getTargetEmail();
    if (targetEmail) {
      try {
        var subject = "🔥 [PropertySF Lead Baru] " + data.profile.name + " (" + (data.financial.budgetRange || "Budget Baru") + ")";
        var body = "Kriteria pembeli baru telah masuk ke PropertySF!\n\n" +
          "═══════════════════════════════════════\n" +
          "DETAIL PEMBELI:\n" +
          "• Nama         : " + data.profile.name + "\n" +
          "• WhatsApp     : " + data.profile.whatsapp + "\n" +
          "• Kebutuhan    : " + (data.preferences.propertyType || "Rumah") + " di " + (data.preferences.targetCity || "Jabodetabek") + " (" + (data.preferences.targetArea || "-") + ")\n" +
          "• Budget Max   : " + (data.financial.budgetRange || "-") + "\n" +
          "• Metode Bayar : " + (data.financial.paymentMethod || "KPR") + "\n" +
          "• Timeline     : " + (data.financial.purchaseTimeline || "Segera") + "\n" +
          "• Kamar/Akses  : " + kamarStr + " | " + aksesMobilStr + "\n" +
          "• Catatan      : " + (data.profile.notes || "-") + "\n" +
          "═══════════════════════════════════════\n\n" +
          "Buka Admin Portal:\nhttps://property-sf-lac.vercel.app/admin.html\n\n" +
          "Buka Spreadsheet:\n" + SpreadsheetApp.getActiveSpreadsheet().getUrl();

        MailApp.sendEmail(targetEmail, subject, body);
      } catch (mailErr) {
        Logger.log("Email notification error: " + mailErr.toString());
      }
    }

    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      leadId: leadId
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

// 2. READ ALL LEADS AS JSON (Two-Way Sync untuk Admin Registry)
function doGet(e) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var values = sheet.getDataRange().getValues();

    if (!values || values.length <= 1) {
      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        count: 0,
        data: []
      })).setMimeType(ContentService.MimeType.JSON);
    }

    var headers = values[0];
    var rows = [];

    for (var i = 1; i < values.length; i++) {
      var row = {};
      for (var j = 0; j < headers.length; j++) {
        var key = String(headers[j]).trim();
        row[key] = values[i][j];
      }
      rows.push(row);
    }

    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      count: rows.length,
      data: rows
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// 3. TES KIRIM EMAIL & AKTIVASI IZIN OTORISASI GOOGLE
// >> JALANKAN FUNGSI INI SEKALI DARI EDITOR APPS SCRIPT <<
function testSendEmail() {
  var email = getTargetEmail();
  if (!email) {
    throw new Error("Silakan isi variabel NOTIFICATION_EMAIL di baris 15 dengan alamat Gmail Anda.");
  }

  MailApp.sendEmail(
    email,
    "🧪 [PropertySF Test] Notifikasi Email Berhasil Diaktifkan!",
    "Halo!\n\nIzin pengiriman notifikasi email PropertySF telah aktif.\n" +
    "Setiap kali ada lead pembeli baru yang masuk via form intake, Anda akan langsung menerima email notifikasi di alamat ini (" + email + ").\n\n" +
    "Salam sukses,\nPropertySF Automation Engine"
  );

  Logger.log("Email berhasil dikirim ke: " + email);
  SpreadsheetApp.getActiveSpreadsheet().toast("Email tes berhasil dikirim ke: " + email, "Sukses!");
}

// 4. ONE-CLICK INITIALIZATION: Jalankan fungsi ini untuk setup header kolom
function setupSheetHeaders() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var headers = [
    "Timestamp",
    "ID Lead",
    "Nama Lengkap",
    "No Whatsapp",
    "Tipe Properti",
    "Kota Target",
    "Area / Patokan",
    "Budget Maksimal",
    "Metode Bayar",
    "Timeline Beli",
    "Min Kamar",
    "Akses Mobil",
    "Sertifikat",
    "Catatan Tambahan",
    "Status"
  ];

  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
  sheet.setFrozenRows(1);
  SpreadsheetApp.getActiveSpreadsheet().toast("Header PropertySF berhasil dibuat!", "Setup Sukses");
}
