// ==================== KONFIGURASI SUPABASE ====================
const SUPABASE_URL = 'https://sqqowbbgnxbspvcntgdq.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNxcW93YmJnbnhic3B2Y250Z2RxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwOTIwNTAsImV4cCI6MjA4ODY2ODA1MH0.1LubHHVmSYFDQq65RBqOznrp5z1EqiuG8eE8H2jv1bU';

// PASTI PAKAI NAMA YANG BERBEDA, JANGAN "supabase"
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ==================== STATE GLOBAL ====================
let allData = [];
let filteredData = [];
let currentFile = null;
let previewData = [];

// Chart instances
let statusChart, regionChart, topSitesChart, alertChart;

// ==================== INISIALISASI ====================
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded - memulai inisialisasi');
    loadData();
    initEventListeners();
    setInterval(() => loadData(), 300000); // Refresh setiap 5 menit
});

// ==================== EVENT LISTENERS ====================
function initEventListeners() {
    console.log('Inisialisasi event listeners');
    
    // Filter
    const regionFilter = document.getElementById('regionFilter');
    const statusFilter = document.getElementById('statusFilter');
    const refreshBtn = document.getElementById('refreshBtn');
    const uploadBtn = document.getElementById('uploadBtn');
    
    if (regionFilter) regionFilter.addEventListener('change', applyFilters);
    if (statusFilter) statusFilter.addEventListener('change', applyFilters);
    
    // Refresh button
    if (refreshBtn) {
        refreshBtn.addEventListener('click', function() {
            console.log('Refresh button clicked');
            loadData();
        });
    }
    
    // UPLOAD BUTTON
    if (uploadBtn) {
        console.log('Upload button ditemukan');
        uploadBtn.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('Upload button clicked - membuka modal');
            openModal();
        });
    } else {
        console.error('Upload button TIDAK ditemukan!');
    }
    
    // MODAL ELEMENTS - YANG DIPERBAIKI
    const closeModalBtn = document.getElementById('closeModal');  // Ganti nama
    const cancelUpload = document.getElementById('cancelUpload');
    const fileInput = document.getElementById('fileInput');
    const confirmBtn = document.getElementById('confirmUpload');
    
    // Close button - PASTI PAKAI FUNGSI closeModal()
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('Close button clicked');
            closeModal(); // Panggil fungsi global closeModal
        });
    }
    
    // Cancel button
    if (cancelUpload) {
        cancelUpload.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('Cancel button clicked');
            resetUpload();
        });
    }
    
    // File input
    if (fileInput) {
        fileInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file) handleFile(file);
        });
    }
    
    // Drag & Drop
    const dropArea = document.getElementById('dropArea');
    if (dropArea) {
        dropArea.addEventListener('dragover', function(e) {
            e.preventDefault();
            dropArea.classList.add('dragover');
        });
        
        dropArea.addEventListener('dragleave', function() {
            dropArea.classList.remove('dragover');
        });
        
        dropArea.addEventListener('drop', function(e) {
            e.preventDefault();
            dropArea.classList.remove('dragover');
            const file = e.dataTransfer.files[0];
            if (file) handleFile(file);
        });
    }
    
    // Browse button
    const browseBtn = document.querySelector('.btn-browse');
    if (browseBtn) {
        browseBtn.addEventListener('click', function(e) {
            e.preventDefault();
            document.getElementById('fileInput').click();
        });
    }
    
    // Confirm upload
    if (confirmBtn) {
        confirmBtn.addEventListener('click', function(e) {
            e.preventDefault();
            confirmUpload();
        });
    }
    
    // Click outside modal
    window.addEventListener('click', function(e) {
        const modal = document.getElementById('uploadModal');
        if (e.target === modal) closeModal();
    });
}

// ==================== FUNGSI MODAL ====================
function openModal() {
    console.log('Membuka modal upload');
    const modal = document.getElementById('uploadModal');
    if (modal) {
        modal.style.display = 'flex';
        resetUpload();
    } else {
        console.error('Modal tidak ditemukan!');
    }
}

function closeModal() {
    console.log('Menutup modal');
    const modal = document.getElementById('uploadModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

function resetUpload() {
    console.log('Reset upload');
    currentFile = null;
    previewData = [];
    
    const fileInput = document.getElementById('fileInput');
    const fileInfo = document.getElementById('fileInfo');
    const previewSection = document.getElementById('previewSection');
    const uploadArea = document.querySelector('.upload-area');
    
    if (fileInput) fileInput.value = '';
    if (fileInfo) fileInfo.innerHTML = '';
    if (previewSection) previewSection.style.display = 'none';
    if (uploadArea) uploadArea.style.display = 'block';
}

// ==================== FUNGSI LOAD DATA DARI SUPABASE ====================
async function loadData() {
    try {
        console.log('Loading data from Supabase...');
        showToast('Mengambil data...', 'info');
        
        // UBAH SINI: dari supabase menjadi supabaseClient
        const { data, error } = await supabaseClient
            .from('oss_data')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        console.log('Data loaded:', data?.length || 0, 'records');
        allData = data || [];
        filteredData = allData;
        
        updateUI();
        hideToast();
        
    } catch (error) {
        console.error('Error:', error);
        showToast('Gagal memuat data: ' + error.message, 'error');
    }
}

// ==================== UPDATE UI ====================
function updateUI() {
    // Update waktu
    const now = new Date();
    const updateTime = document.getElementById('updateTime');
    if (updateTime) {
        updateTime.innerHTML = `<i class="far fa-clock"></i> Update: ${now.toLocaleString('id-ID')}`;
    }
    
    updateStats();
    updateCharts();
    updateTable();
    populateRegionFilter();
}

function updateStats() {
    const total = filteredData.length;
    const active = filteredData.filter(s => s && s.status === 'Active').length;
    const avgUptime = total > 0 
        ? (filteredData.reduce((sum, site) => sum + (parseFloat(site?.uptime_percentage) || 0), 0) / total).toFixed(1)
        : 0;
    const totalAlerts = filteredData.reduce((sum, site) => sum + (parseInt(site?.alert_count) || 0), 0);
    
    const totalEl = document.getElementById('totalSites');
    const activeEl = document.getElementById('activeSites');
    const avgEl = document.getElementById('avgUptime');
    const alertsEl = document.getElementById('totalAlerts');
    
    if (totalEl) totalEl.innerHTML = total;
    if (activeEl) activeEl.innerHTML = active;
    if (avgEl) avgEl.innerHTML = avgUptime + '%';
    if (alertsEl) alertsEl.innerHTML = totalAlerts;
}

// ==================== FUNGSI UPLOAD ====================
function handleFile(file) {
    console.log('File selected:', file.name);
    
    if (!file.name.toLowerCase().endsWith('.csv')) {
        showToast('File harus berformat CSV', 'error');
        return;
    }
    
    currentFile = file;
    
    const fileInfo = document.getElementById('fileInfo');
    if (fileInfo) {
        fileInfo.innerHTML = `📄 ${file.name} (${(file.size/1024).toFixed(2)} KB)`;
    }
    
    // Parse CSV dengan PapaParse - sesuaikan dengan struktur CSV Anda
    Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        encoding: "UTF-8",
        complete: function(results) {
            console.log('CSV parsed:', results.data.length, 'rows');
            console.log('Sample data:', results.data[0]); // Lihat struktur kolom
            
            previewData = results.data;
            showPreview(results.data);
        },
        error: function(error) {
            console.error('Parse error:', error);
            showToast('Error membaca CSV: ' + error, 'error');
        }
    });
}

function showPreview(data) {
    const uploadArea = document.querySelector('.upload-area');
    const previewSection = document.getElementById('previewSection');
    
    if (uploadArea) uploadArea.style.display = 'none';
    if (previewSection) previewSection.style.display = 'block';
    
    const previewTable = document.querySelector('.preview-table');
    if (!previewTable || !data.length) return;
    
    const headers = Object.keys(data[0] || {});
    
    let html = '<table><thead><tr>';
    headers.forEach(h => html += `<th>${h}</th>`);
    html += '</tr></thead><tbody>';
    
    data.slice(0, 5).forEach(row => {
        html += '<tr>';
        headers.forEach(h => html += `<td>${row[h] || '-'}</td>`);
        html += '</tr>';
    });
    
    if (data.length > 5) {
        html += `<tr><td colspan="${headers.length}" class="preview-more">... dan ${data.length - 5} baris lainnya</td></tr>`;
    }
    
    html += '</tbody></table>';
    previewTable.innerHTML = html;
}

async function confirmUpload() {
    if (!previewData.length) {
        showToast('Tidak ada data untuk diupload', 'error');
        return;
    }
    
    try {
        showToast('Menyimpan data ke database...', 'info');
        
        // Mapping data CSV ke struktur tabel Supabase
        const validData = previewData.map(row => ({
            site_id: String(row['SERVICE ID'] || row['SERVICE_ID'] || row['service_id'] || ''),
            site_name: String(row['SUMMARY'] || row['summary'] || '').substring(0, 100),
            region: String(row['REGION'] || row['WITEL'] || row['region'] || 'Unknown'),
            status: mapStatus(row['STATUS'] || row['status'] || 'Unknown'),
            status_date: row['STATUS DATE'] || row['status_date'] || new Date().toISOString(),
            uptime_percentage: calculateUptime(row),
            bandwidth_usage: 0,
            last_maintenance: new Date().toISOString().split('T')[0],
            alert_count: parseInt(row['alert_count'] || 0)
        }));
        
        console.log('Valid data:', validData.length, 'records');
        
        const { data, error } = await supabaseClient
            .from('oss_data')
            .insert(validData)
            .select();
        
        if (error) throw error;
        
        showToast(`✅ Berhasil upload ${validData.length} data!`, 'success');
        closeModal();
        loadData();
        
    } catch (error) {
        console.error('Upload error:', error);
        showToast('Gagal upload: ' + error.message, 'error');
    }
}

// Fungsi bantu untuk mapping status
function mapStatus(status) {
    if (!status) return 'Unknown';
    
    const statusUpper = String(status).toUpperCase();
    if (statusUpper.includes('CLOSE') || statusUpper.includes('RESOLVE')) return 'Active';
    if (statusUpper.includes('PENDING')) return 'Maintenance';
    if (statusUpper.includes('OPEN') || statusUpper.includes('PROGRESS')) return 'Maintenance';
    return 'Unknown';
}

// Fungsi bantu hitung uptime dari TTR
function calculateUptime(row) {
    // Contoh: hitung dari TTR CUSTOMER atau TTR END TO END
    const ttr = row['TTR CUSTOMER'] || row['TTR END TO END'] || '00:00:00';
    
    // Parse format "HH:MM:SS" ke angka
    const parts = ttr.split(':');
    if (parts.length === 3) {
        const hours = parseInt(parts[0] || 0);
        const minutes = parseInt(parts[1] || 0);
        
        // Asumsi: target 4 jam (240 menit)
        const totalMinutes = hours * 60 + minutes;
        const targetMinutes = 240; // 4 jam
        
        if (totalMinutes <= targetMinutes) {
            return 100; // Sesuai SLA
        } else {
            // Kurangi 1% per 10 menit keterlambatan
            const penalty = Math.min(30, Math.floor((totalMinutes - targetMinutes) / 10));
            return Math.max(70, 100 - penalty);
        }
    }
    
    return 99.5; // Default
}

// ==================== FUNGSI CHART ====================
function updateCharts() {
    updateStatusChart();
    updateRegionChart();
    updateTopSitesChart();
    updateAlertChart();
}

function updateStatusChart() {
    const statusCount = {
        'Active': filteredData.filter(s => s && s.status === 'Active').length,
        'Maintenance': filteredData.filter(s => s && s.status === 'Maintenance').length,
        'Down': filteredData.filter(s => s && s.status === 'Down').length
    };
    
    const ctx = document.getElementById('statusChart')?.getContext('2d');
    if (!ctx) return;
    
    if (statusChart) statusChart.destroy();
    
    statusChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(statusCount),
            datasets: [{
                data: Object.values(statusCount),
                backgroundColor: ['#10b981', '#f59e0b', '#ef4444'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom' }
            }
        }
    });
}

function updateRegionChart() {
    const regionData = {};
    filteredData.forEach(site => {
        if (!site) return;
        const region = site.region || 'Unknown';
        if (!regionData[region]) {
            regionData[region] = { total: 0, count: 0 };
        }
        regionData[region].total += parseFloat(site.uptime_percentage) || 0;
        regionData[region].count++;
    });
    
    const regions = Object.keys(regionData);
    const uptimes = regions.map(r => (regionData[r].total / regionData[r].count).toFixed(1));
    
    const ctx = document.getElementById('regionChart')?.getContext('2d');
    if (!ctx) return;
    
    if (regionChart) regionChart.destroy();
    
    regionChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: regions,
            datasets: [{
                label: 'Uptime (%)',
                data: uptimes,
                backgroundColor: '#3b82f6',
                borderRadius: 5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true, max: 100 }
            }
        }
    });
}

function updateTopSitesChart() {
    const topSites = [...filteredData]
        .filter(s => s)
        .sort((a, b) => parseFloat(b.uptime_percentage) - parseFloat(a.uptime_percentage))
        .slice(0, 10);
    
    const ctx = document.getElementById('topSitesChart')?.getContext('2d');
    if (!ctx) return;
    
    if (topSitesChart) topSitesChart.destroy();
    
    topSitesChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: topSites.map(s => s?.site_name || 'Unknown'),
            datasets: [{
                label: 'Uptime %',
                data: topSites.map(s => parseFloat(s?.uptime_percentage) || 0),
                backgroundColor: '#10b981',
                borderRadius: 5
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y',
            scales: {
                x: { max: 100 }
            }
        }
    });
}

function updateAlertChart() {
    const alertRanges = {
        '0 Alerts': filteredData.filter(s => (parseInt(s?.alert_count) || 0) === 0).length,
        '1-3 Alerts': filteredData.filter(s => {
            const count = parseInt(s?.alert_count) || 0;
            return count >= 1 && count <= 3;
        }).length,
        '4+ Alerts': filteredData.filter(s => (parseInt(s?.alert_count) || 0) >= 4).length
    };
    
    const ctx = document.getElementById('alertChart')?.getContext('2d');
    if (!ctx) return;
    
    if (alertChart) alertChart.destroy();
    
    alertChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: Object.keys(alertRanges),
            datasets: [{
                data: Object.values(alertRanges),
                backgroundColor: ['#10b981', '#f59e0b', '#ef4444'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom' }
            }
        }
    });
}

// ==================== FUNGSI TABLE ====================
// ==================== FUNGSI TABLE ====================
function updateTable() {
    const tbody = document.getElementById('tableBody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (filteredData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" class="loading">Tidak ada data</td></tr>';
        return;
    }
    
    filteredData.slice(0, 20).forEach((site, index) => {
        if (!site) return;
        const row = tbody.insertRow();
        
        // Format STATUS DATE
        let statusDate = site.status_date || '-';
        if (statusDate && statusDate !== '-') {
            try {
                const date = new Date(statusDate);
                if (!isNaN(date.getTime())) {
                    statusDate = date.toLocaleString('id-ID', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                    });
                }
            } catch (e) {
                console.log('Error parsing date:', e);
            }
        }
        
        row.innerHTML = `
            <td class="text-center"><span class="badge-id">${index + 1}</span></td>
            <td><span class="status-badge status-${(site.status || 'unknown').toLowerCase()}">${site.status || '-'}</span></td>
            <td><span class="date-badge">${statusDate}</span></td>
            <td><span class="badge-id">${site.site_id || '-'}</span></td>
            <td><strong>${(site.site_name || '').substring(0, 30)}${site.site_name?.length > 30 ? '...' : ''}</strong></td>
            <td>${site.region || '-'}</td>
            <td class="text-right">${site.uptime_percentage || 0}%</td>
            <td class="text-right">${site.bandwidth_usage || 0} Mbps</td>
            <td>${site.last_maintenance || '-'}</td>
            <td class="text-center"><span class="alert-badge ${(parseInt(site.alert_count) || 0) > 0 ? 'alert-warning' : ''}">${site.alert_count || 0}</span></td>
        `;
    });
}

function populateRegionFilter() {
    const regions = [...new Set(allData.map(site => site?.region).filter(Boolean))].sort();
    const filter = document.getElementById('regionFilter');
    if (!filter) return;
    
    const currentValue = filter.value;
    filter.innerHTML = '<option value="">Semua Region</option>';
    
    regions.forEach(region => {
        const option = document.createElement('option');
        option.value = region;
        option.textContent = region;
        filter.appendChild(option);
    });
    
    if (currentValue) filter.value = currentValue;
}

function applyFilters() {
    const region = document.getElementById('regionFilter')?.value;
    const status = document.getElementById('statusFilter')?.value;
    
    filteredData = allData.filter(site => {
        if (!site) return false;
        if (region && site.region !== region) return false;
        if (status && site.status !== status) return false;
        return true;
    });
    
    updateStats();
    updateCharts();
    updateTable();
}

// ==================== TOAST NOTIFICATION ====================
function showToast(message, type = 'info') {
    console.log('Toast:', message, type);
    const toast = document.getElementById('toast');
    if (!toast) return;
    
    toast.innerHTML = message;
    toast.className = `toast show ${type}`;
    
    setTimeout(() => {
        toast.className = 'toast';
    }, 3000);
}

function hideToast() {
    const toast = document.getElementById('toast');
    if (toast) toast.className = 'toast';
}
