// ==================== KONFIGURASI SUPABASE ====================
const SUPABASE_URL = 'https://wsecorjbjkivqrxietja.supabase.co'; // GANTI!
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndzZWNvcmpiamtpdnFyeGlldGphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxMTc1MzEsImV4cCI6MjA4ODY5MzUzMX0.So3sKOR0TGt8GIhXpIFCoFhkL6bE9n6C0YzDUJKA5IE'; // GANTI!
const supabase = supabaseJs.createClient(SUPABASE_URL, SUPABASE_KEY);

// ==================== STATE GLOBAL ====================
let allData = [];
let filteredData = [];
let currentFile = null;
let previewData = [];

// Chart instances
let statusChart, regionChart, topSitesChart, alertChart;

// ==================== INISIALISASI ====================
document.addEventListener('DOMContentLoaded', () => {
    loadData();
    initEventListeners();
    setInterval(() => loadData(), 300000); // Refresh setiap 5 menit
});

// ==================== EVENT LISTENERS ====================
function initEventListeners() {
    // Filter
    document.getElementById('regionFilter').addEventListener('change', applyFilters);
    document.getElementById('statusFilter').addEventListener('change', applyFilters);
    
    // Refresh
    document.getElementById('refreshBtn').addEventListener('click', () => loadData());
    
    // Upload Modal
    document.getElementById('uploadBtn').addEventListener('click', openModal);
    document.getElementById('closeModal').addEventListener('click', closeModal);
    document.getElementById('cancelUpload').addEventListener('click', resetUpload);
    
    // File Input
    const fileInput = document.getElementById('fileInput');
    fileInput.addEventListener('change', handleFileSelect);
    
    // Drag & Drop
    const dropArea = document.getElementById('dropArea');
    dropArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropArea.classList.add('dragover');
    });
    dropArea.addEventListener('dragleave', () => {
        dropArea.classList.remove('dragover');
    });
    dropArea.addEventListener('drop', (e) => {
        e.preventDefault();
        dropArea.classList.remove('dragover');
        const file = e.dataTransfer.files[0];
        if (file) handleFile(file);
    });
    
    // Confirm Upload
    document.getElementById('confirmUpload').addEventListener('click', confirmUpload);
    
    // Click outside modal
    window.addEventListener('click', (e) => {
        const modal = document.getElementById('uploadModal');
        if (e.target === modal) closeModal();
    });
}

// ==================== FUNGSI LOAD DATA DARI SUPABASE ====================
async function loadData() {
    try {
        showToast('Mengambil data...', 'info');
        
        const { data, error } = await supabase
            .from('oss_data')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
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
    document.getElementById('updateTime').innerHTML = 
        `<i class="far fa-clock"></i> Update: ${now.toLocaleString('id-ID')}`;
    
    updateStats();
    updateCharts();
    updateTable();
    populateRegionFilter();
}

function updateStats() {
    const total = filteredData.length;
    const active = filteredData.filter(s => s.status === 'Active').length;
    const avgUptime = total > 0 
        ? (filteredData.reduce((sum, site) => sum + (parseFloat(site.uptime_percentage) || 0), 0) / total).toFixed(1)
        : 0;
    const totalAlerts = filteredData.reduce((sum, site) => sum + (parseInt(site.alert_count) || 0), 0);
    
    animateValue('totalSites', total);
    animateValue('activeSites', active);
    document.getElementById('avgUptime').innerHTML = avgUptime + '%';
    animateValue('totalAlerts', totalAlerts);
}

function animateValue(elementId, value) {
    const element = document.getElementById(elementId);
    const current = parseInt(element.innerHTML) || 0;
    const duration = 500;
    const step = (value - current) / (duration / 16);
    
    let currentVal = current;
    const timer = setInterval(() => {
        currentVal += step;
        if ((step > 0 && currentVal >= value) || (step < 0 && currentVal <= value)) {
            clearInterval(timer);
            element.innerHTML = value;
        } else {
            element.innerHTML = Math.round(currentVal);
        }
    }, 16);
}

// ==================== FUNGSI UPLOAD ====================
function openModal() {
    document.getElementById('uploadModal').style.display = 'flex';
    resetUpload();
}

function closeModal() {
    document.getElementById('uploadModal').style.display = 'none';
}

function resetUpload() {
    currentFile = null;
    previewData = [];
    document.getElementById('fileInput').value = '';
    document.getElementById('fileInfo').innerHTML = '';
    document.getElementById('previewSection').style.display = 'none';
    document.querySelector('.upload-area').style.display = 'block';
}

function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) handleFile(file);
}

function handleFile(file) {
    if (!file.name.endsWith('.csv')) {
        showToast('File harus berformat CSV', 'error');
        return;
    }
    
    currentFile = file;
    document.getElementById('fileInfo').innerHTML = `📄 ${file.name} (${(file.size/1024).toFixed(2)} KB)`;
    
    // Parse CSV
    Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
            previewData = results.data;
            showPreview(results.data);
        },
        error: (error) => {
            showToast('Error membaca CSV: ' + error, 'error');
        }
    });
}

function showPreview(data) {
    document.querySelector('.upload-area').style.display = 'none';
    document.getElementById('previewSection').style.display = 'block';
    
    const previewTable = document.querySelector('.preview-table');
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
        
        // Validasi data
        const validData = previewData.map(row => ({
            site_id: String(row.site_id || row.Site_ID || ''),
            site_name: String(row.site_name || row.Site_Name || ''),
            region: String(row.region || row.Region || ''),
            status: String(row.status || row.Status || ''),
            uptime_percentage: parseFloat(row.uptime_percentage || row.Uptime || 0),
            bandwidth_usage: parseFloat(row.bandwidth_usage || row.Bandwidth || 0),
            last_maintenance: row.last_maintenance || row.Last_Maintenance || new Date().toISOString().split('T')[0],
            alert_count: parseInt(row.alert_count || row.Alerts || 0)
        }));
        
        // Insert ke Supabase
        const { data, error } = await supabase
            .from('oss_data')
            .insert(validData)
            .select();
        
        if (error) throw error;
        
        showToast(`✅ Berhasil upload ${validData.length} data!`, 'success');
        closeModal();
        loadData(); // Reload data
        
    } catch (error) {
        console.error('Upload error:', error);
        showToast('Gagal upload: ' + error.message, 'error');
    }
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
        'Active': filteredData.filter(s => s.status === 'Active').length,
        'Maintenance': filteredData.filter(s => s.status === 'Maintenance').length,
        'Down': filteredData.filter(s => s.status === 'Down').length
    };
    
    const ctx = document.getElementById('statusChart').getContext('2d');
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
        const region = site.region || 'Unknown';
        if (!regionData[region]) {
            regionData[region] = { total: 0, count: 0 };
        }
        regionData[region].total += parseFloat(site.uptime_percentage) || 0;
        regionData[region].count++;
    });
    
    const regions = Object.keys(regionData);
    const uptimes = regions.map(r => (regionData[r].total / regionData[r].count).toFixed(1));
    
    const ctx = document.getElementById('regionChart').getContext('2d');
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
        .sort((a, b) => parseFloat(b.uptime_percentage) - parseFloat(a.uptime_percentage))
        .slice(0, 10);
    
    const ctx = document.getElementById('topSitesChart').getContext('2d');
    if (topSitesChart) topSitesChart.destroy();
    
    topSitesChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: topSites.map(s => s.site_name),
            datasets: [{
                label: 'Uptime %',
                data: topSites.map(s => parseFloat(s.uptime_percentage)),
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
        '0 Alerts': filteredData.filter(s => (parseInt(s.alert_count) || 0) === 0).length,
        '1-3 Alerts': filteredData.filter(s => {
            const count = parseInt(s.alert_count) || 0;
            return count >= 1 && count <= 3;
        }).length,
        '4+ Alerts': filteredData.filter(s => (parseInt(s.alert_count) || 0) >= 4).length
    };
    
    const ctx = document.getElementById('alertChart').getContext('2d');
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
function updateTable() {
    const tbody = document.getElementById('tableBody');
    tbody.innerHTML = '';
    
    if (filteredData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="loading">Tidak ada data</td></tr>';
        return;
    }
    
    filteredData.slice(0, 20).forEach(site => {
        const row = tbody.insertRow();
        row.innerHTML = `
            <td><span class="badge-id">${site.site_id || '-'}</span></td>
            <td><strong>${site.site_name || '-'}</strong></td>
            <td>${site.region || '-'}</td>
            <td><span class="status-badge status-${(site.status || 'unknown').toLowerCase()}">${site.status || '-'}</span></td>
            <td class="text-right">${site.uptime_percentage || 0}%</td>
            <td class="text-right">${site.bandwidth_usage || 0} Mbps</td>
            <td>${site.last_maintenance || '-'}</td>
            <td class="text-center"><span class="alert-badge ${(parseInt(site.alert_count) || 0) > 0 ? 'alert-warning' : ''}">${site.alert_count || 0}</span></td>
        `;
    });
}

function populateRegionFilter() {
    const regions = [...new Set(allData.map(site => site.region).filter(Boolean))].sort();
    const filter = document.getElementById('regionFilter');
    
    filter.innerHTML = '<option value="">Semua Region</option>';
    regions.forEach(region => {
        const option = document.createElement('option');
        option.value = region;
        option.textContent = region;
        filter.appendChild(option);
    });
}

function applyFilters() {
    const region = document.getElementById('regionFilter').value;
    const status = document.getElementById('statusFilter').value;
    
    filteredData = allData.filter(site => {
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
    const toast = document.getElementById('toast');
    toast.innerHTML = message;
    toast.className = `toast show ${type}`;
    setTimeout(() => {
        toast.className = 'toast';
    }, 3000);
}

function hideToast() {
    document.getElementById('toast').className = 'toast';
}
