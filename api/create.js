// api/create.js

const fetch = require('node-fetch');
// Impor config non-rahasia
const config = require('../config'); 

// ==================================================================
// == FUNGSI API PTERODACTYL (Helper Functions) ==
// ==================================================================

// Fungsi ini tidak berubah, hanya parameter 'domain' dan 'apiKey'
// sekarang datang dari variabel yang aman.
async function createUser(serverName, apiKey, domain) {
    const url = `${domain}/api/application/users`;
    
    const randomString = Math.random().toString(36).substring(7);
    const email = `${serverName.toLowerCase().replace(/\s+/g, '')}@${randomString}.com`;
    const username = `${serverName.toLowerCase().replace(/\s+/g, '')}_${randomString}`;
    const password = Math.random().toString(36).slice(-10);

    const userData = {
        email: email,
        username: username,
        first_name: serverName,
        last_name: "User",
        password: password,
        root_admin: false
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`, 
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(userData)
        });
        const data = await response.json();
        if (response.status === 201) {
            return { success: true, user: data.attributes, password: password };
        } else {
            console.error("Gagal membuat user:", JSON.stringify(data.errors, null, 2));
            return { success: false, error: data.errors ? data.errors[0].detail : 'Gagal membuat pengguna baru.' };
        }
    } catch (error) {
        console.error("Error saat fetch API user:", error);
        return { success: false, error: 'Gagal terhubung ke API Pterodactyl untuk membuat pengguna.' };
    }
}

async function createServer(serverName, memory, pterodactylUserId, apiKey, domain) {
    // Gunakan config non-rahasia dari file config.js
    const pterodactyl = config.pterodactyl;
    const url = `${domain}/api/application/servers`;

    const serverData = {
        name: serverName,
        user: pterodactylUserId,
        egg: pterodactyl.eggId,
        docker_image: "ghcr.io/parkervcp/yolks:nodejs_18",
        startup: "if [[ -d .git ]]; then git pull; fi; if [[ ! -z ${NODE_PACKAGES} ]]; then /usr/local/bin/npm install ${NODE_PACKAGES}; fi; if [[ -f /home/container/package.json ]]; then /usr/local/bin/npm install; fi; {{CMD_RUN}}",
        environment: {
            USER_ID: pterodactylUserId, 
            CMD_RUN: "node index.js" 
        },
        limits: {
            memory: parseInt(memory),
            swap: 0,
            disk: pterodactyl.disk,
            io: 500,
            cpu: pterodactyl.cpu,
        },
        feature_limits: { databases: 1, allocations: 1, backups: 1 },
        deploy: {
            locations: [pterodactyl.locationId],
            dedicated_ip: false,
            port_range: []
        }
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(serverData)
        });
        const data = await response.json();
        if (response.status === 201) {
            return { success: true, data: data.attributes };
        } else {
            console.error("Error Pterodactyl API Server:", JSON.stringify(data.errors, null, 2));
            return { success: false, error: data.errors ? data.errors[0].detail : 'Gagal membuat server.' };
        }
    } catch (error) {
        console.error("Error saat fetch API Server:", error);
        return { success: false, error: 'Gagal terhubung ke Pterodactyl API untuk membuat server.' };
    }
}

// ==================================================================
// == FUNGSI UTAMA (Handler Vercel) ==
// ==================================================================
// Ini adalah fungsi utama yang akan dijalankan Vercel
module.exports = async (req, res) => {
    // 1. Hanya izinkan metode POST
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Metode tidak diizinkan.' });
    }

    try {
        // 2. Ambil data dari body request
        const { serverName, ram, secretKey, serverType } = req.body;

        // 3. Validasi Input
        if (!serverName || !ram || !secretKey || !serverType) {
            return res.status(400).json({ error: 'Semua field (Nama Server, RAM, Tipe Server, Secret Key) wajib diisi.' });
        }

        // 4. Otorisasi dan pemilihan config (MEMBACA DARI 'process.env')
        let authorized = false;
        let selectedPterodactylApiKey = null;
        let selectedDomain = null;

        // Ambil data rahasia dari Vercel Environment Variables
        const secretKeyPublic = process.env.SECRET_KEY_PUBLIC;
        const secretKeyPrivate = process.env.SECRET_KEY_PRIVATE;
        const pteroApiKeyPublic = process.env.PTERO_API_KEY_PUBLIC;
        const pteroApiKeyPrivate = process.env.PTERO_API_KEY_PRIVATE;
        const pteroDomainPublic = process.env.PTERO_DOMAIN_PUBLIC;
        const pteroDomainPrivate = process.env.PTERO_DOMAIN_PRIVATE;

        if (serverType === 'public' && secretKey === secretKeyPublic) {
            authorized = true;
            selectedPterodactylApiKey = pteroApiKeyPublic;
            selectedDomain = pteroDomainPublic;
        } else if (serverType === 'private' && secretKey === secretKeyPrivate) {
            authorized = true;
            selectedPterodactylApiKey = pteroApiKeyPrivate;
            selectedDomain = pteroDomainPrivate;
        }

        if (!authorized) {
            return res.status(401).json({ error: 'Secret Key salah atau tidak cocok dengan Tipe Server.' });
        }
        
        if (!selectedPterodactylApiKey || !selectedDomain) {
            console.error(`Otorisasi berhasil untuk ${serverType}, tapi Environment Variables tidak diatur di Vercel.`);
            return res.status(500).json({ error: 'Konfigurasi server bermasalah (Environment Variables tidak lengkap).' });
        }

        console.log(`Menerima permintaan (Tipe: ${serverType}): Nama=${serverName}, RAM=${ram}`);

        // 5. Proses Pembuatan
        const userResult = await createUser(serverName, selectedPterodactylApiKey, selectedDomain);
        if (!userResult.success) {
            return res.status(500).json({ error: `Gagal Membuat Akun Panel: ${userResult.error}` });
        }
        
        const newUser = userResult.user;
        const newUserPassword = userResult.password;
        console.log(`Berhasil membuat user: ${newUser.username}`);

        const serverResult = await createServer(serverName, ram, newUser.id, selectedPterodactylApiKey, selectedDomain);
        if (!serverResult.success) {
            return res.status(500).json({ error: `Gagal Membuat Server: ${serverResult.error}` });
        }
        
        const serverInfo = serverResult.data;
        console.log(`Berhasil membuat server: ${serverInfo.name}`);

        // 6. Kirim respon sukses
        res.status(200).json({
            success: true,
            message: "Semua Berhasil Disiapkan!",
            panelUrl: selectedDomain,
            loginDetails: {
                username: newUser.username,
                email: newUser.email,
                password: newUserPassword
            },
            serverDetails: {
                name: serverInfo.name,
                ram: serverInfo.limits.memory
            }
        });

    } catch (error) {
        console.error("Kesalahan internal:", error);
        res.status(500).json({ error: 'Terjadi kesalahan internal pada server.' });
    }
};
