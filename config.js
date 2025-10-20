// config.js
// Konfigurasi NON-RAHASIA.

const config = {
    pterodactyl: {
        // ID Egg yang akan digunakan (misal: 15 untuk Node.js)
        eggId: 15,
        
        // ID Lokasi (default: 1)
        locationId: 1,

        // Pengaturan server default
        disk: 5120,  // 5 GB Disk
        cpu: 100     // 100% CPU
    }
};

module.exports = config;
