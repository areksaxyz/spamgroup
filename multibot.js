console.log('Loading wppconnect...');
const wppconnect = require('@wppconnect-team/wppconnect');
const fs = require('fs');
console.log('wppconnect loaded');

// Konfigurasi session untuk 3 bot
const SESSIONS = [
  { name: 'bot1', sessionPath: './sessions/bot1_session.json' },
  { name: 'bot2', sessionPath: './sessions/bot2_session.json' },
  { name: 'bot3', sessionPath: './sessions/bot3_session.json' }
];

// Fungsi untuk memuat sesi yang tersimpan
function loadSession(sessionPath) {
  if (fs.existsSync(sessionPath)) {
    try {
      return JSON.parse(fs.readFileSync(sessionPath, 'utf8'));
    } catch (error) {
      console.error(`❌ Gagal membaca session file: ${sessionPath}`, error);
      return null;
    }
  }
  return null;
}

// Fungsi untuk menyimpan sesi saat bot terautentikasi
function saveSession(sessionPath, sessionData) {
  try {
    fs.writeFileSync(sessionPath, JSON.stringify(sessionData, null, 2));
    console.log(`✅ Session tersimpan: ${sessionPath}`);
  } catch (error) {
    console.error(`❌ Gagal menyimpan session file: ${sessionPath}`, error);
  }
}

// Fungsi untuk menyimpan data per bot
function saveData(client) {
  const state = botStates.get(client);
  try {
    const data = {
      pending_contacts: state.pending_contacts,
      created_groups: state.created_groups,
      kicked_members: state.kicked_members,
      botStats: state.botStats,
    };
    fs.writeFileSync(state.DATA_FILE, JSON.stringify(data, null, 2));
    console.log(`Data disimpan untuk session ${state.sessionName}`);
  } catch (error) {
    console.error('Gagal menyimpan data:', error);
  }
}

// Fungsi untuk log error
function logError(client, error) {
  const state = botStates.get(client);
  const errorMessage = `${new Date().toISOString()} - ${error.stack || error}\n\n`;
  fs.appendFileSync(state.ERROR_LOG_FILE, errorMessage, 'utf8');
  console.error(`❌ Error pada ${state.sessionName}:`, error);
  state.botStats.totalErrors++;
}

// Fungsi utama untuk memulai bot
async function startBots() {
  try {
    // Membuat client untuk 3 bot secara bersamaan
    const [client1, client2, client3] = await Promise.all([
      wppconnect.create({
        session: 'bot1_session', // Sesi berbeda untuk bot pertama
        // Konfigurasi lainnya
        headless: true,
        qrTimeout: 0,
        useChrome: true,
        catchQR: (qr) => {
          console.log('QR Bot 1:', qr);
        },
      }),
      wppconnect.create({
        session: 'bot2_session', // Sesi berbeda untuk bot kedua
        // Konfigurasi lainnya
        headless: true,
        qrTimeout: 0,
        useChrome: true,
        catchQR: (qr) => {
          console.log('QR Bot 2:', qr);
        },
      }),
      wppconnect.create({
        session: 'bot3_session', // Sesi berbeda untuk bot ketiga
        // Konfigurasi lainnya
        headless: true,
        qrTimeout: 0,
        useChrome: true,
        catchQR: (qr) => {
          console.log('QR Bot 3:', qr);
        },
      })
    ]);

    console.log('Bot1, Bot2, dan Bot3 berhasil dijalankan.');

    // Menyimpan sesi untuk setiap bot setelah autentikasi
    saveSession(SESSIONS[0].sessionPath, client1);
    saveSession(SESSIONS[1].sessionPath, client2);
    saveSession(SESSIONS[2].sessionPath, client3);

    // Setelah bot aktif, Anda bisa menambahkan fungsionalitas lain seperti menangani pesan masuk
  } catch (error) {
    console.error('Terjadi kesalahan saat membuat bot:', error);
  }
}

// Memulai bot
startBots();


// Global state manager
const botStates = new Map();

class BotState {
  constructor(sessionName) {
    this.sessionName = sessionName;
    this.pending_contacts = [];
    this.created_groups = 0;
    this.kicked_members = [];
    this.botStats = {
      totalGroupsCreated: 0,
      totalKicks: 0,
      totalSpamTargets: 0,
      totalMessagesSent: 0,
      totalErrors: 0,
    };
    this.DATA_FILE = `./data_${sessionName}.json`;
    this.ERROR_LOG_FILE = `./error_logs_${sessionName}.txt`;
  }
}

// Inisialisasi semua bot
SESSIONS.forEach(sessionConfig => {
  const sessionData = loadSession(sessionConfig.sessionPath);
  console.log('Session data:', sessionData); // Debugging session data

  wppconnect.create({
    session: sessionConfig.name,
    headless: false, // Nonaktifkan mode headless untuk debugging
    useChrome: false,
    autoClose: false, // Biarkan sesi tetap berjalan
    catchQR: (base64Qrimg, asciiQR) => {
      // Hanya tampilkan QR Code tanpa teks tambahan
      console.log(`${base64Qrimg}`);
    },
    puppeteerOptions: { args: ['--no-sandbox'] },
    sessionData: sessionData // Gunakan sesi yang tersimpan
  }).then(client => {
    console.log(`✅ ${sessionConfig.name} berhasil login tanpa scan QR`);

    const state = new BotState(sessionConfig.name);
    botStates.set(client, state);

    client.on('authenticated', (session) => {
      saveSession(sessionConfig.sessionPath, session);
      console.log(`✅ Session ${sessionConfig.name} tersimpan!`);
    });

    client.on('disconnected', (reason) => {
      console.log(`⚠️ ${sessionConfig.name} terputus: ${reason}`);
    });

    start(client); // Mulai bot setelah login berhasil

    setTimeout(() => {
      console.log(`🕔 ${sessionConfig.name} akan ditutup setelah 5 menit.`);
      client.close(); // Menutup bot setelah 5 menit
    }, 300000); // 300000 ms = 5 menit
  }).catch(err => {
    console.error(`❌ Gagal inisialisasi ${sessionConfig.name}:`, err);
  });
});

// Fungsi utama untuk memulai bot
async function start(client) {
  const state = botStates.get(client);
  console.log(`✅ ${state.sessionName} siap digunakan!`);

  client.onMessage(async (message) => {
    console.log('Pesan diterima:', message.body); // Log pesan yang diterima
    try {
      const sender = message.from;
      const text = message.body?.trim().toLowerCase() || '';
      console.log('Pesan setelah diproses:', text);

      if (text === 'hello') {
        await client.sendText(sender, 'Halo, saya bot!');
      } else {
        await client.sendText(sender, 'Pesan tidak dikenali.');
      }

      saveData(client); // Simpan data setiap kali menerima pesan

      if (/^(\+?62|0)\d+$/.test(text)) {
        const formattedNumber = formatPhoneNumber(text);

        if (!state.pending_contacts.includes(formattedNumber)) {
          state.pending_contacts.push(formattedNumber);
          await client.sendText(sender, `📥 Kontak tersimpan: ${state.pending_contacts.length}`);
          state.botStats.totalMessagesSent++;
        }
        return;
      }

      switch (true) {
        case text.startsWith('!spaminvitegroup'):
          const groupCount = parseInt(text.split(' ')[1]) || 1;
          await createAndInviteGroups(client, sender, groupCount);
          break;
        case text.startsWith('!listgroups'):
          await getGroupList(client, sender);
          break;
        case text.startsWith('!menu'):
          await showMenu(client, sender);
          break;
        case text.startsWith('!checklimit'):
          await checkLimit(client, sender);
          break;
        case text.startsWith('!stats'):
          await showStats(client, sender);
          break;
        case text.startsWith('!listcontacts'):
          const contactList = getPendingContacts(client);
          await client.sendText(sender, contactList);
          break;
        case text.startsWith('!addcontact'):
          await addContact(client, sender, text);
          break;
        case text.startsWith('!runtime'):
          await showRuntime(client, sender);
          break;
        case text.startsWith('!kick'):
          const groupId = message.chatId;
          const memberId = message.mentionedIds[0];
          const kickResult = await kickMember(client, groupId, memberId);
          await client.sendText(sender, kickResult);
          break;
        default:
          if (text.startsWith('!')) {
            await client.sendText(sender, "❌ Perintah tidak dikenali. Ketik !menu untuk melihat daftar perintah.");
          }
      }
    } catch (error) {
      logError(client, error);
      await client.sendText(message.from, `❌ Error: ${error.message}`);
    } finally {
      saveData(client);
    }
  });
}

// Format nomor telepon
function formatPhoneNumber(number) {
  if (number.startsWith('0')) {
    return '+62' + number.substring(1);
  }
  return number;
}

// Fungsi-fungsi pendukung lainnya
async function createAndInviteGroups(client, sender, groupCount = 1) {
  const state = botStates.get(client);
  try {
    if (state.pending_contacts.length === 0) {
      await client.sendText(sender, "❌ Tidak ada kontak yang disimpan!");
      return;
    }

    const validContacts = state.pending_contacts.map(contact => {
      try {
        return formatPhoneNumber(contact);
      } catch (error) {
        console.error(`Invalid number: ${contact}`, error);
        return null;
      }
    }).filter(c => c !== null);
    
    if (validContacts.length === 0) {
      await client.sendText(sender, "❌ Tidak ada kontak valid!");
      return;
    }

    for (let i = 0; i < groupCount; i++) {
      if (state.created_groups >= 999) {
        await client.sendText(sender, `🛑 Batas maksimal grup: 999`);
        break;
      }

      const groupName = "</> NOOB CODER HERE </>";
      const group = await client.createGroup(groupName, validContacts);
      const groupId = group.gid._serialized;

      if (fs.existsSync(state.GROUP_IMAGE_PATH)) {
        try {
          const imageBuffer = fs.readFileSync(state.GROUP_IMAGE_PATH, { encoding: 'base64' });
          const base64Image = `data:image/jpeg;base64,${imageBuffer}`;
          await client.setGroupIcon(groupId, base64Image);
          await client.sendText(sender, `✅ Foto grup berhasil diupdate!`);
        } catch (iconError) {
          console.error('Gagal update icon:', iconError);
          await client.sendText(sender, `⚠ Gagal update foto grup: ${iconError.message}`);
        }
      }
      
      state.created_groups++;
      await client.sendText(sender, `✅ Grup "${groupName}" berhasil dibuat!`);
    }
  } catch (error) {
    console.error('Error membuat grup:', error);
    await client.sendText(sender, `❌ Gagal buat grup: ${error.message}`);
    logError(client, error);
  }
}

// Fungsi lainnya (formatPhoneNumber, getGroupList, showMenu, dll) dapat disesuaikan seperti sebelumnya
// Get group list
async function getGroupList(client, sender) {
  try {
    const chats = await client.getChats();
    const groups = chats.filter(chat => chat.isGroup);

    if (groups.length === 0) {
      await client.sendText(sender, "❌ Bot belum punya grup");
      return;
    }

    let list = "📋 Daftar Grup:\n\n";
    for (const group of groups) {
      try {
        const participantsCount = group.participants ? group.participants.length : 0;
        list += `▫ ${group.name}\n🆔 ${group.id._serialized}\n👥 ${participantsCount} anggota\n\n`;
      } catch (error) {
        console.error(`Gagal baca info grup: ${group.id._serialized}`, error);
        list += `▫ Gagal membaca info grup dengan ID: ${group.id._serialized}\n\n`;
      }
    }
    

    await client.sendText(sender, list);
  } catch (error) {
    console.error('Error list grup:', error);
    await client.sendText(sender, "❌ Gagal mengambil daftar grup");
    logError(error);
  }
}
async function getGroupList(client, sender) {
    try {
      const chats = await client.getChats();
      const groups = chats.filter(chat => chat.isGroup);
  
      if (groups.length === 0) {
        await client.sendText(sender, "❌ Bot belum punya grup");
        return;
      }
  
      let list = "📋 Daftar Grup:\n\n";
      for (const group of groups) {
        try {
          // Cek apakah info grup bisa diakses langsung dari object chat
          const participantsCount = group.participants ? group.participants.length : 0;
  
          list += `▫ ${group.name}\n🆔 ${group.id._serialized}\n👥 ${participantsCount} anggota\n\n`;
        } catch (error) {
          console.error(`Gagal baca info grup: ${group.id._serialized}`, error);
          list += `▫ Gagal membaca info grup dengan ID: ${group.id._serialized}\n\n`; // Memberikan feedback jika error
        }
      }
  
      await client.sendText(sender, list);
    } catch (error) {
      console.error('Error list grup:', error);
      await client.sendText(sender, "❌ Gagal mengambil daftar grup");
    }
  }
  
async function sendCreatorVCard(client, sender) {
    try {
      const creatorNumber = '6281818266692@c.us'; // Format nomor dengan @c.us
      await client.sendContactVcard(sender, creatorNumber, 'Arga Reksapati');
  
      await client.sendText(sender, "📞 Hubungi creator melalui kontak di atas");
    } catch (error) {
      console.error('Gagal kirim vCard:', error);
      await client.sendText(sender, "❌ Gagal mengirim kontak");
    }
  }
  
// =============================================
// FUNGSI PENDUKUNG LAINNYA
// =============================================

function generateGroupName() {
  return "</> NOB CODER HERE </>";
}

async function kickMember(client, groupId, memberId) {
  try {
    if (kicked_members >= MAX_KICKS) {
      return `❌ Batas maksimal kick (${MAX_KICKS}) telah tercapai.`;
    }
    
    await client.removeParticipant(groupId, memberId);
    kicked_members++;
    botStats.totalKicks++;
    botStats.totalMessagesSent++;
    return `✅ Berhasil mengeluarkan ${memberId} (${kicked_members}/${MAX_KICKS})`;
  } catch (error) {
    logError(error);
    return `❌ Gagal mengeluarkan ${memberId}: ${error.message}`;
  }
}

function logError(error) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ERROR: ${error.message}\n${error.stack}\n\n`;
  fs.appendFile('error_log.txt', logMessage, (err) => {
    if (err) console.error("Gagal menulis log error:", err);
  });
}

function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
      pending_contacts = data.pending_contacts || [];
      created_groups = data.created_groups || 0;
      kicked_members = data.kicked_members || 0;
      botStats.totalGroupsCreated = data.botStats?.totalGroupsCreated || 0;
      botStats.totalKicks = data.botStats?.totalKicks || 0;
      botStats.totalSpamTargets = data.botStats?.totalSpamTargets || 0;
      botStats.totalMessagesSent = data.botStats?.totalMessagesSent || 0;
      botStats.totalErrors = data.botStats?.totalErrors || 0;
      console.log('✅ Data berhasil dimuat dari file.');
    } else {
      console.log('⚠ File data tidak ditemukan. Membuat data baru.');
    }
  } catch (error) {
    console.error('❌ Gagal memuat data:', error);
  }
}

const DATA_FILE = './data.json';

function saveData() {
  try {
    const data = {
      pending_contacts,
      created_groups,
      kicked_members,
      botStats,
    };
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
    console.log('✅ Data berhasil disimpan ke file.');
  } catch (error) {
    console.error('❌ Gagal menyimpan data:', error);
  }
}

// =============================================
// FUNGSI UNTUK MENU
// =============================================
async function showMenu(client, sender) {
    try {
      const helpMessage = `🌟 *Menu Bot - ${bot_info.myname}* 🌟\n\n` +
                          `*Versi:* ${bot_info.version}\n` +
                          `*Creator:* ${bot_info.creator}\n\n` +
                          `Daftar perintah yang tersedia:\n\n` +
                          `1. \`!about\`\n` +
                          `2. \`!creator\`\n` +
                          `3. \`!myname\`\n` +
                          `4. \`!status\`\n` +
                          `5. \`!speed\`\n` +
                          `6. \`!spaminvitegroup <jumlah grup>\`\n` +
                          `7. \`!runtime\`\n` +
                          `8. \`!kick\`\n` +
                          `9. \`!listgroups\`\n` +
                          `10 \`!listcontacts\`\n` +
                          `11. \`!delcontact <nomor urut>\`\n` +
                          `12. \`!restart\`\n` +
                          `13. \`!checklimit\`\n` +
                          `14. \`!stats\`\n` +
                          `15. \`!addcontact <nomor telepon>\`\n` +

                          `⚠ Gunakan bot ini dengan bijak! ⚠`;
  
      await client.sendText(sender, helpMessage); // Ganti sendMessage dengan sendText
      console.log("Menu bantuan berhasil dikirim.");
    } catch (error) {
      console.error("Error mengirim menu bantuan:", error);
      await client.sendText(sender, "❌ Gagal mengirim menu bantuan."); // Ganti sendMessage dengan sendText
    }
  }
  

async function showAbout(client, sender) {
  await client.sendText(sender, bot_info.about);
}

async function showMyName(client, sender) {
  await client.sendText(sender, `Nama bot: ${bot_info.myname}`);
}

async function showStatus(client, sender) {
  await client.sendText(sender, `Status bot: ${bot_info.status}`);
}

async function showSpeed(client, sender) {
  const startTime = Date.now();
  await client.sendText(sender, "🚀 Mengukur kecepatan respon...");
  const endTime = Date.now();
  const responseTime = endTime - startTime;
  await client.sendText(sender, `⏱ Kecepatan respon: ${responseTime}ms`);
}

async function showRuntime(client, sender) {
  const uptime = Date.now() - bot_info.start_time;
  const hours = Math.floor(uptime / 3600000);
  const minutes = Math.floor((uptime % 3600000) / 60000);
  const seconds = Math.floor((uptime % 60000) / 1000);
  await client.sendText(sender, `⏳ Waktu berjalan: ${hours} jam, ${minutes} menit, ${seconds} detik`);
}

async function checkLimit(client, sender) {
  const limitMessage = `
📊 Batas Limit Bot:
- Grup dibuat: ${created_groups}/${MAX_GROUPS}
- Anggota dikeluarkan: ${kicked_members}/${MAX_KICKS}
  `;
  await client.sendText(sender, limitMessage);
}

async function showStats(client, sender) {
  const statsMessage = `
📈 Statistik Bot:
- Total grup dibuat: ${botStats.totalGroupsCreated}
- Total anggota dikeluarkan: ${botStats.totalKicks}
- Total pesan dikirim: ${botStats.totalMessagesSent}
- Total error: ${botStats.totalErrors}
  `;
  await client.sendText(sender, statsMessage);
}

function getPendingContacts() {
  if (pending_contacts.length === 0) {
    return "❌ Tidak ada kontak yang disimpan.";
  }
  let list = "📋 Daftar Kontak:\n\n";
  pending_contacts.forEach((contact, index) => {
    list += `${index + 1}. ${contact}\n`;
  });
  return list;
}

function deletePendingContact(index) {
  if (index < 0 || index >= pending_contacts.length) {
    return "❌ Nomor urut tidak valid.";
  }
  const deletedContact = pending_contacts.splice(index, 1)[0];
  return `✅ Kontak "${deletedContact}" berhasil dihapus.`;
}

async function addContact(client, sender, text) {
  const phoneNumber = text.split(' ')[1];
  if (!phoneNumber) {
    await client.sendText(sender, "❌ Format salah. Gunakan: !addcontact <nomor>");
    return;
  }
  try {
    const formattedNumber = formatPhoneNumber(phoneNumber);
    if (!pending_contacts.includes(formattedNumber)) {
      pending_contacts.push(formattedNumber);
      await client.sendText(sender, `📥 Kontak "${formattedNumber}" berhasil ditambahkan.`);
    } else {
      await client.sendText(sender, `⚠ Kontak "${formattedNumber}" sudah ada.`);
    }
  } catch (error) {
    await client.sendText(sender, `❌ Gagal menambahkan kontak: ${error.message}`);
  }
}

// Fungsi untuk restart bot
async function restartBot(client, sender) {
  try {
    if (isRestarting) {
      await client.sendText(sender, "⚠ Bot sedang dalam proses restart, harap tunggu...");
      return;
    }

    isRestarting = true;
    await client.sendText(sender, "🔄 Memulai ulang bot...");

    // Simpan sender agar bisa dikirimi notifikasi setelah restart
    fs.writeFileSync(senderFile, JSON.stringify({ sender }), 'utf8');

    console.log("♻ Menutup sesi WhatsApp...");
    await client.close();

    console.log("♻ Bot akan dimulai ulang...");
    setTimeout(() => {
      process.exit(1); // Keluar agar PM2 otomatis restart bot
    }, 3000);

  } catch (error) {
    console.error("❌ Gagal restart bot:", error);
    isRestarting = false;
    await client.sendText(sender, "❌ Gagal memulai ulang bot.");
  }
}

// Fungsi untuk memulai bot
async function start(client) {
  console.log("✅ Bot siap digunakan!");

  // Kirim notifikasi setelah bot restart
  await notifyAfterRestart(client);

  // Handler menerima perintah
  client.onMessage(async (message) => {
    if (message.body.toLowerCase() === '!restart') {
      await restartBot(client, message.from);
    }
  });

  // Muat data bot (pastikan loadData() ada di kode kamu)
  if (typeof loadData === 'function') {
    loadData();
  }
}

// Inisialisasi WhatsApp Web
wppconnect.create({
  session: 'mySession',
  headless: true,
  useChrome: true,
  catchQR: (base64Qrimg) => {
    console.log('📌 Scan QR code berikut di WhatsApp:');
    console.log(`data:image/png;base64,${base64Qrimg}`);
  },
  statusFind: (statusSession) => {
    console.log('🔄 Status Session:', statusSession);
  },
  puppeteerOptions: {
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  }
})
.then(client => start(client))
.catch(error => console.error('❌ Error inisialisasi:', error));

async function start(client) {

  // Muat data saat bot dimulai
  loadData();

  client.onMessage(async message => {
    try {
      const sender = message.from;
      const text = message.body?.trim().toLowerCase() || '';

      // Handle nomor telepon
      if (/^(\+?62|0)\d+$/.test(text)) {
        const formattedNumber = formatPhoneNumber(text);

        if (!pending_contacts.includes(formattedNumber)) {
          pending_contacts.push(formattedNumber);
          await client.sendText(sender, `📥 Kontak tersimpan: ${pending_contacts.length}`);
          botStats.totalMessagesSent++;
        }
        return;
      }

      // Handle command
      switch (true) {
        case text.startsWith('!spaminvitegroup'):
          const groupCount = parseInt(text.split(' ')[1]) || 1;
          await createAndInviteGroups(client, sender, groupCount);
          break;
        case text.startsWith('!creator'):
          await sendCreatorVCard(client, sender);
          break;
        case text.startsWith('!listgroups'):
          await getGroupList(client, sender);
          break;
        case text.startsWith('!restart'):
          await restartBot(client, sender);
          break;
        case text.startsWith('!menu'):
          await showMenu(client, sender);
          break;
        case text.startsWith('!checklimit'):
          await checkLimit(client, sender);
          break;
        case text.startsWith('!stats'):
          await showStats(client, sender);
          break;
        case text.startsWith('!listcontacts'):
          const contactList = getPendingContacts();
          await client.sendText(sender, contactList);
          break;
        case text.startsWith('!delcontact'):
          const index = parseInt(text.split(' ')[1]) - 1;
          const deleteResult = deletePendingContact(index);
          await client.sendText(sender, deleteResult);
          break;
        case text.startsWith('!addcontact'):
          await addContact(client, sender, text);
          break;
        case text.startsWith('!runtime'):
          await showRuntime(client, sender);
          break;
        case text.startsWith('!kick'):
          const groupId = message.chatId;
          const memberId = message.mentionedIds[0];
          const kickResult = await kickMember(client, groupId, memberId);
          await client.sendText(sender, kickResult);
          break;
        case text.startsWith('!about'):
          await showAbout(client, sender);
          break;
        case text.startsWith('!myname'):
          await showMyName(client, sender);
          break;
        case text.startsWith('!status'):
          await showStatus(client, sender);
          break;
        case text.startsWith('!speed'):
          await showSpeed(client, sender);
          break;
        default:
          if (text.startsWith('!')) {
            await client.sendText(sender, "❌ Perintah tidak dikenali. Ketik !menu untuk melihat daftar perintah.");
          }
      }
    } catch (error) {
      logError(error);
      await client.sendText(message.from, `❌ Error: ${error.message}`);
    } finally {
      // Simpan data setelah setiap operasi
      saveData();
    }
  });
}