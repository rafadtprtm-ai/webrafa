/**
 * RiseHand - Donasi Bencana Alam | Backend Google Apps Script
 *
 * CARA PAKAI:
 * 1. Buka Google Spreadsheet baru -> Extensions (Ekstensi) -> Apps Script.
 * 2. Hapus isi default, tempel seluruh kode ini, lalu Save.
 * 3. Pilih fungsi "setup" di dropdown -> klik Run -> izinkan akses (sekali saja).
 *    Ini otomatis membuat sheet "Kampanye" & "Donasi" beserta contoh data.
 * 4. Deploy -> New deployment -> Type: Web app
 *      Execute as : Me
 *      Who has access : Anyone
 *    Salin URL yang berakhiran /exec ke app.js (CONFIG.API_URL).
 * 5. Setiap kode diubah, wajib Deploy -> Manage deployments -> Edit -> New version.
 *
 * ALUR DONASI:
 * Donasi masuk ke sheet "Donasi" dengan status "Menunggu".
 * Setelah Anda cek mutasi rekening, ubah kolom Status menjadi "Terverifikasi"
 * -> dana otomatis masuk ke progres kampanye di website.
 */

var SHEET_CAMPAIGN = 'Kampanye';
var SHEET_DONATION = 'Donasi';
var CAMPAIGN_HEADERS = ['ID', 'Judul', 'Kategori', 'Lokasi', 'Deskripsi', 'Target', 'Dana Awal', 'Gambar', 'Status'];
var DONATION_HEADERS = ['Waktu', 'ID Kampanye', 'Nama', 'Kontak', 'Nominal', 'Pesan', 'Anonim', 'Status'];
var MIN_DONATION = 10000;
var MAX_DONATION = 1000000000;

/* ---------- SETUP (jalankan sekali) ---------- */
function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  var c = ss.getSheetByName(SHEET_CAMPAIGN) || ss.insertSheet(SHEET_CAMPAIGN);
  if (c.getLastRow() === 0) {
    c.appendRow(CAMPAIGN_HEADERS);
    var sample = [
      ['K001', 'Bantu Korban Banjir Bandang', 'Banjir', 'Demak, Jawa Tengah',
        'Ratusan keluarga kehilangan rumah dan perlengkapan. Dana digunakan untuk makanan siap saji, air bersih, selimut, dan obat-obatan.', 150000000, 25000000, '', 'Aktif'],
      ['K002', 'Darurat Gempa Bumi', 'Gempa', 'Cianjur, Jawa Barat',
        'Ribuan warga mengungsi di tenda darurat. Bantuan untuk tenda, logistik, layanan kesehatan, dan trauma healing anak-anak.', 250000000, 40000000, '', 'Aktif'],
      ['K003', 'Tanah Longsor di Perbukitan', 'Longsor', 'Tana Toraja, Sulawesi Selatan',
        'Akses jalan terputus dan warga terisolasi. Donasi untuk evakuasi, dapur umum, dan pembangunan hunian sementara.', 100000000, 10000000, '', 'Aktif'],
      ['K004', 'Erupsi Gunung Berapi', 'Gunung Berapi', 'Lumajang, Jawa Timur',
        'Abu vulkanik menutup permukiman. Bantuan untuk masker, air bersih, pengungsian, dan pakan ternak warga.', 120000000, 15000000, '', 'Aktif'],
      ['K005', 'Air Bersih untuk Daerah Kekeringan', 'Kekeringan', 'Gunungkidul, DI Yogyakarta',
        'Sumur warga mengering. Dana untuk pengiriman air bersih, tandon, dan sumur bor komunal.', 80000000, 5000000, '', 'Aktif'],
      ['K006', 'Pemulihan Pascabencana Gabungan', 'Lainnya', 'Seluruh Indonesia',
        'Dana siaga yang disalurkan cepat ke titik bencana baru, tanpa menunggu kampanye khusus dibuka.', 200000000, 30000000, '', 'Aktif']
    ];
    c.getRange(2, 1, sample.length, CAMPAIGN_HEADERS.length).setValues(sample);
    c.getRange('F2:G').setNumberFormat('#,##0');
  }
  styleHeader_(c, CAMPAIGN_HEADERS.length);

  var d = ss.getSheetByName(SHEET_DONATION) || ss.insertSheet(SHEET_DONATION);
  if (d.getLastRow() === 0) d.appendRow(DONATION_HEADERS);
  styleHeader_(d, DONATION_HEADERS.length);
  d.getRange('E2:E').setNumberFormat('#,##0');
  d.getRange('A2:A').setNumberFormat('@'); // waktu disimpan sebagai teks ISO
  d.getRange('D2:D').setNumberFormat('@');
  var rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['Menunggu', 'Terverifikasi', 'Ditolak'], true).build();
  d.getRange('H2:H').setDataValidation(rule);

  var def = ss.getSheetByName('Sheet1') || ss.getSheetByName('Sheet 1') || ss.getSheetByName('Lembar1');
  if (def && def.getLastRow() === 0 && ss.getSheets().length > 2) ss.deleteSheet(def);
}

function styleHeader_(sheet, cols) {
  sheet.getRange(1, 1, 1, cols).setFontWeight('bold').setBackground('#f15a29').setFontColor('#ffffff');
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, cols);
}

/* ---------- GET: ambil data untuk website ---------- */
function doGet() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var cs = ss.getSheetByName(SHEET_CAMPAIGN);
    var ds = ss.getSheetByName(SHEET_DONATION);
    if (!cs || !ds) return json_({ ok: false, error: 'Sheet belum dibuat. Jalankan fungsi setup() terlebih dahulu.' });

    var cRows = readRows_(cs);
    var dRows = readRows_(ds);

    var totals = {}, counts = {}, donors = [];
    dRows.forEach(function (r) {
      if (String(r['Status']).trim() !== 'Terverifikasi') return;
      var id = String(r['ID Kampanye']).trim();
      var amt = Number(r['Nominal']) || 0;
      totals[id] = (totals[id] || 0) + amt;
      counts[id] = (counts[id] || 0) + 1;
      var anon = r['Anonim'] === true || String(r['Anonim']).toUpperCase() === 'TRUE' || String(r['Anonim']).toLowerCase() === 'ya';
      donors.push({
        nama: anon ? 'Hamba Allah' : (String(r['Nama']).trim() || 'Donatur'),
        nominal: amt,
        pesan: String(r['Pesan'] || '').trim(),
        kampanye: id,
        waktu: toIso_(r['Waktu'])
      });
    });
    donors.sort(function (a, b) { return a.waktu < b.waktu ? 1 : -1; });

    var campaigns = cRows
      .filter(function (r) { return String(r['ID']).trim() && String(r['Status']).trim().toLowerCase() !== 'nonaktif'; })
      .map(function (r) {
        var id = String(r['ID']).trim();
        return {
          id: id,
          judul: String(r['Judul']),
          kategori: String(r['Kategori'] || 'Lainnya'),
          lokasi: String(r['Lokasi'] || ''),
          deskripsi: String(r['Deskripsi'] || ''),
          target: Number(r['Target']) || 0,
          terkumpul: (Number(r['Dana Awal']) || 0) + (totals[id] || 0),
          donatur: counts[id] || 0,
          gambar: String(r['Gambar'] || '').trim()
        };
      });

    return json_({ ok: true, campaigns: campaigns, donors: donors.slice(0, 12), updated: new Date().toISOString() });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

/* ---------- POST: terima donasi baru ---------- */
function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    var data = JSON.parse((e && e.postData && e.postData.contents) || '{}');

    var nama = clean_(data.nama, 60);
    var kontak = clean_(data.kontak, 60);
    var pesan = clean_(data.pesan, 200);
    var idK = clean_(data.kampanye, 20);
    var nominal = Math.round(Number(data.nominal));
    var anonim = data.anonim === true;

    if (!nama) return json_({ ok: false, error: 'Nama wajib diisi.' });
    if (!kontak) return json_({ ok: false, error: 'Nomor WhatsApp atau email wajib diisi.' });
    if (!isFinite(nominal) || nominal < MIN_DONATION) return json_({ ok: false, error: 'Nominal minimal Rp ' + MIN_DONATION.toLocaleString('id-ID') + '.' });
    if (nominal > MAX_DONATION) return json_({ ok: false, error: 'Nominal terlalu besar.' });

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var cs = ss.getSheetByName(SHEET_CAMPAIGN);
    var ds = ss.getSheetByName(SHEET_DONATION);
    if (!cs || !ds) return json_({ ok: false, error: 'Sheet belum dibuat. Jalankan setup().' });

    var found = readRows_(cs).some(function (r) { return String(r['ID']).trim() === idK; });
    if (!found) return json_({ ok: false, error: 'Kampanye tidak ditemukan.' });

    lock.waitLock(20000);
    ds.appendRow([new Date().toISOString(), idK, nama, kontak, nominal, pesan, anonim, 'Menunggu']);
    SpreadsheetApp.flush();
    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: 'Terjadi kesalahan: ' + err });
  } finally {
    try { lock.releaseLock(); } catch (x) {}
  }
}

/* ---------- Helper ---------- */
function readRows_(sheet) {
  var last = sheet.getLastRow();
  if (last < 2) return [];
  var values = sheet.getRange(1, 1, last, sheet.getLastColumn()).getValues();
  var head = values.shift().map(function (h) { return String(h).trim(); });
  return values.map(function (row) {
    var o = {};
    head.forEach(function (h, i) { o[h] = row[i]; });
    return o;
  });
}

function toIso_(v) {
  if (v instanceof Date) return v.toISOString();
  var d = new Date(v);
  return isNaN(d.getTime()) ? '' : d.toISOString();
}

// Hapus karakter kontrol & cegah formula injection di Spreadsheet
function clean_(v, max) {
  var s = String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return s;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
