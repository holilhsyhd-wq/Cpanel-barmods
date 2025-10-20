document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('create-form');
    const resultDiv = document.getElementById('result');
    const submitBtn = document.getElementById('submit-btn');

    form.addEventListener('submit', async (e) => {
        e.preventDefault(); 

        resultDiv.innerHTML = '';
        resultDiv.className = '';
        submitBtn.disabled = true;
        submitBtn.textContent = 'Memproses...';

        const formData = {
            serverName: document.getElementById('serverName').value,
            ram: document.getElementById('ram').value,
            secretKey: document.getElementById('secretKey').value, 
            serverType: document.querySelector('input[name="serverType"]:checked').value 
        };

        try {
            // URL API-nya sekarang adalah '/api/create' sesuai struktur Vercel
            const response = await fetch('/api/create', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });

            const data = await response.json();

            if (response.ok) {
                // Sukses
                resultDiv.className = 'success';
                resultDiv.innerHTML = `
                    <h3>${data.message}</h3>
                    <p><strong>URL Panel:</strong><br> <a href="${data.panelUrl}" target="_blank">${data.panelUrl}</a></p>
                    <p><strong>Detail Login (Simpan Baik-Baik!):</strong></p>
                    <pre>Username: ${data.loginDetails.username}\nEmail: ${data.loginDetails.email}\nPassword: ${data.loginDetails.password}</pre>
                    <p><strong>Detail Server:</strong></p>
                    <pre>Nama: ${data.serverDetails.name}\nRAM: ${data.serverDetails.ram} MB</pre>
                `;
            } else {
                // Gagal
                throw new Error(data.error || 'Terjadi kesalahan');
            }

        } catch (error) {
            resultDiv.className = 'error';
            resultDiv.innerHTML = `<strong>Error:</strong> ${error.message}`;
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Buat Server';
        }
    });
});
