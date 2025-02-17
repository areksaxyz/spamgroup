import dotenv from 'dotenv';
import fs from 'fs';
import crypto from 'crypto';
import { Client } from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';

// Memuat variabel dari file .env
dotenv.config();

// Cek apakah variabel lingkungan sudah terdefinisi
if (!process.env.SECRET || !process.env.WHITELIST || !process.env.OWNER_NUMBER) {
  console.error('Error: Variabel lingkungan di file .env tidak lengkap.');
  process.exit(1); // Keluar dari proses jika variabel tidak lengkap
}

console.log('SECRET:', process.env.SECRET);
console.log('Whitelist:', whitelist);
console.log('OWNER_NUMBER:', process.env.OWNER_NUMBER);
console.log('Rate limit untuk pengirim:', checkRateLimit(sender));

const secret = process.env.SECRET;
const whitelistString = process.env.WHITELIST;

// Process WHITELIST into an array
const whitelist = whitelistString ? whitelistString.split(',') : [];

// Informasi tentang bot
let pending_contacts = [];
const rateLimits = new Map();
const userLanguages = new Map(); // Untuk menyimpan preferensi bahasa pengguna

// Fungsi enkripsi
function encryptData(data) {
  const cipher = crypto.createCipheriv('aes-256-cbc',
    crypto.scryptSync(secret, 'salt', 32),
    Buffer.alloc(16, 0)
  );
  return cipher.update(data, 'utf8', 'hex') + cipher.final('hex');
}

function decryptData(encrypted) {
  const decipher = crypto.createDecipheriv('aes-256-cbc',
    crypto.scryptSync(secret, 'salt', 32),
    Buffer.alloc(16, 0)
  );
  return decipher.update(encrypted, 'hex', 'utf8') + decipher.final('utf8');
}

// Fungsi validasi nomor telepon
const indonesianOperatorPrefix = [
  '62811', '62812', '62813', '62851', '62852', '62853', '62822', '62823',
  '62821', '62828', '62838', '62831', '62832', '62833', '62858', '62859',
  '62877', '62878', '62879', '62814', '62815', '62816', '62855', '62856',
  '62857', '62817'
];

function formatPhoneNumber(phoneNumber) {
  phoneNumber = phoneNumber.replace(/\D/g, '');
  if (phoneNumber.startsWith('0')) {
    phoneNumber = '62' + phoneNumber.slice(1);
  } else if (!phoneNumber.startsWith('62')) {
    phoneNumber = '62' + phoneNumber;
  }

  const prefix = phoneNumber.substring(0, 5);
  if (!indonesianOperatorPrefix.includes(prefix)) {
    throw new Error('Nomor operator tidak valid');
  }

  if (phoneNumber.length < 11 || phoneNumber.length > 15) {
    throw new Error('Panjang nomor tidak valid');
  }

  return phoneNumber + '@c.us';
}

// Sistem Rate Limit
function checkRateLimit(sender) {
  const LIMIT = 5;
  const WINDOW = 30000;

  if (!rateLimits.has(sender)) {
    rateLimits.set(sender, []);
  }

  const now = Date.now();
  const timestamps = rateLimits.get(sender).filter(t => t > now - WINDOW);

  if (timestamps.length >= LIMIT) return false;

  timestamps.push(now);
  rateLimits.set(sender, timestamps);
  return true;
}

// Multi-language
const languages = {
  id: {
    menu: `🌟 Menu Bot 🌟\n
1. !about - Info bot
2. !creator - Kontak creator
3. !myname - Nama bot
4. !status - Status bot
5. !speed - Kecepatan respon
6. !runtime - Total runtime bot
7. !buatgrup - Buat grup otomatis
8. !listcontacts - Lihat kontak
9. !kick @user - Keluarkan member
10. !promote @user - Jadikan admin
11. !broadcast - Kirim pesan ke semua
12. !language [id/en] - Ganti bahasa
13. !spaminvitegroup - Undang anggota ke grup secara massal
14. !restart - Restart bot`,
    error: 'Terjadi kesalahan'
  },
  en: {
    menu: `🌟 Bot Menu 🌟\n
1. !about - Bot info
2. !creator - Contact creator
3. !myname - Bot name
4. !status - Bot status
5. !speed - Response speed
6. !runtime - Total runtime
7. !creategroup - Create auto group
8. !listcontacts - View contacts
9. !kick @user - Remove member
10. !promote @user - Make admin
11. !broadcast - Send to all
12. !language [id/en] - Change language
13. !spaminvitegroup - Invite members to groups in bulk
14. !restart - Restart bot`,
    error: 'An error occurred'
  }
};

// Fungsi untuk memeriksa format nomor (termasuk grup dan percakapan pribadi)
function isValidPhoneNumber(number) {
  return number.endsWith('@c.us') || number.endsWith('@g.us'); // Memeriksa nomor pribadi dan grup
}

// Fungsi admin
async function isAdmin(client, chatId, participantId) {
  try {
    const groupData = await client.getChatById(chatId);
    const isUserAdmin = groupData.participants.some(member =>
      member.id._serialized === participantId && member.isAdmin
    );
    if (participantId === process.env.OWNER_NUMBER + '@c.us' || isUserAdmin) {
      return true;
    }
    return false;
  } catch (error) {
    return false;
  }
}

// Inisialisasi client WhatsApp
const client = new Client({
  puppeteer: {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  }
});

// Generate QR Code untuk login
client.on('qr', (qr) => {
  qrcode.generate(qr, { small: true });
});

// Ketika client sudah siap
client.on('ready', () => {
    console.log('Client is ready!');
});

// Menangani pesan masuk
client.on('message', async (message) => {
  console.log('Pesan diterima:', message.body);
  console.log('Pengirim:', message.from);
  console.log('Apakah pengirim ada di whitelist?', whitelist.includes(message.from));
  
  const sender = message.from;

  try {
    // Logika bot di sini
    if (message.isGroup) {
      console.log('Pesan dari grup:', message.body);
    }

    if (!isValidPhoneNumber(sender)) {
      console.log('Nomor pengirim tidak valid:', sender);
      await client.sendMessage(sender, '❌ Nomor pengirim tidak valid.');
      return; // Stop further execution
    }

    // Check if sender is in the whitelist
    if (!whitelist.includes(sender)) {
      console.log('Pengirim tidak ada dalam whitelist');
      await client.sendMessage(sender, '❌ Anda tidak ada dalam whitelist.');
      return; // Stop further execution
    }

    // Check rate limit
    if (!checkRateLimit(sender)) {
      await client.sendMessage(sender, 'Terlalu banyak permintaan. Coba lagi nanti.');
      return; // Stop further execution
    }

    // Get user's language preference
    const lang = userLanguages.get(sender) || 'id';

    // Handle commands
    const body = message.body.toLowerCase();

    if (body === '!about') {
      const aboutMessage = lang === 'id' 
        ? '🤖 Bot ini dibuat untuk membantu Anda dalam berbagai tugas. Bot ini dikembangkan menggunakan Node.js dan library whatsapp-web.js.' 
        : '🤖 This bot is created to assist you in various tasks. It is developed using Node.js and the whatsapp-web.js library.';
      await client.sendMessage(sender, aboutMessage);
    }

    if (body === '!creator') {
      const creatorMessage = lang === 'id' 
        ? '👨‍💻 Creator bot ini adalah [Nama Creator]. Anda dapat menghubungi saya di [Email atau Nomor Telepon].' 
        : '👨‍💻 The creator of this bot is [Creator Name]. You can contact me at [Email or Phone Number].';
      client.sendMessage(sender, creatorMessage);
    }

    if (body === '!myname') {
      const botNameMessage = lang === 'id' 
        ? '🤖 Nama saya adalah [Nama Bot].' 
        : '🤖 My name is [Bot Name].';
      client.sendMessage(sender, botNameMessage);
    }

    if (body === '!status') {
      const statusMessage = lang === 'id' 
        ? '🟢 Bot sedang online dan berjalan dengan baik.' 
        : '🟢 The bot is online and running smoothly.';
      client.sendMessage(sender, statusMessage);
    }

    if (body === '!speed') {
      const startTime = Date.now();
      const speedMessage = lang === 'id' 
        ? '⏱️ Mengukur kecepatan respon...' 
        : '⏱️ Measuring response speed...';
      await client.sendMessage(sender, speedMessage);
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      const speedResultMessage = lang === 'id' 
        ? `⏱️ Kecepatan respon: ${responseTime}ms` 
        : `⏱️ Response speed: ${responseTime}ms`;
      client.sendMessage(sender, speedResultMessage);
    }

    if (body === '!runtime') {
      const uptime = process.uptime();
      const hours = Math.floor(uptime / 3600);
      const minutes = Math.floor((uptime % 3600) / 60);
      const seconds = Math.floor(uptime % 60);
      const runtimeMessage = lang === 'id' 
        ? `⏳ Bot telah berjalan selama ${hours} jam, ${minutes} menit, dan ${seconds} detik.` 
        : `⏳ The bot has been running for ${hours} hours, ${minutes} minutes, and ${seconds} seconds.`;
      client.sendMessage(sender, runtimeMessage);
    }

    // Add other commands here (like !buatgrup, !listcontacts, etc.)
    
//} //buatgrup
if (body === '!buatgrup') {
    await createAndInviteGroups(client, sender);
    }

    //listcontacts
    if (body === '!listcontacts') {
      const contacts = await client.getContacts();
      const contactList = contacts.map(contact => contact.name).join('\n');
      await client.sendMessage(sender, `📋 Kontak:\n${contactList}`);
    }

    //kick
    if (body.startsWith('!kick')) {
      const chatId = message.chatId;
      const participant = message.mentionedIds[0];
      if (await isAdmin(client, chatId, sender)) {
        await client.removeParticipant(chatId, participant);
      } else {
        await client.sendMessage(sender, '❌ Anda tidak memiliki izin untuk melakukan itu.');
      }
    }

    //promote
    if (body.startsWith('!promote')) {
      const chatId = message.chatId;
      const participant = message.mentionedIds[0];
      if (await isAdmin(client, chatId, sender)) {
        await client.promoteParticipant(chatId, participant);
      } else {
        await client.sendMessage(sender, '❌ Anda tidak memiliki izin untuk melakukan itu.');
      }
    }

    //broadcast
    if (body === '!broadcast') {
      const chatIds = await client.getAllChatIds();
      chatIds.forEach(chatId => {
        client.sendMessage(chatId, '📢 Pesan broadcast');
      });
    }

    //language
    if (body.startsWith('!language')) {
      const newLang = body.split(' ')[1];
      if (newLang === 'id' || newLang === 'en') {
        userLanguages.set(sender, newLang);
        const langMessage = newLang === 'id' 
          ? 'Bahasa telah diubah menjadi Bahasa Indonesia.' 
          : 'Language has been changed to English.';
        await client.sendMessage(sender, langMessage);
      } else {
        await client.sendMessage(sender, '❌ Invalid language. Please use `id` or `en`.');
      }
    }   

    //spaminvitegroup
    if (body === '!spaminvitegroup') {
      await createAndInviteGroups(client, sender);
    }
    

    
  } catch (error) {
    console.error('Error:', error);
    client.sendMessage(sender, '❌ Terjadi kesalahan saat memproses pesan.');
  }
});

// Fungsi untuk membuat dan mengundang grup
async function createAndInviteGroups(client, sender) {
  // Implementasi logika untuk membuat dan mengundang grup
  // Contoh
  try {
    const groupName = 'Group Baru';
    const groupDescription = 'Deskripsi grup';
    const contacts = await client.getContacts();
    const invite = await client.createGroup(groupName, contacts.slice(0, 50).map(contact => contact.id._serialized));
    await client.sendMessage(sender, '✅ Grup baru berhasil dibuat!');
  } catch (error) {
    console.log('Error dalam membuat grup:', error);
  }
}

client.initialize();
