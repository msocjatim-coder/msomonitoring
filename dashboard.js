// Konfigurasi Supabase - GANTI DENGAN PUNYA ANDA!
const SUPABASE_URL = 'https://project-anda.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ...'; // anon public key

// Inisialisasi Supabase client
const supabase = supabaseJs.createClient(SUPABASE_URL, SUPABASE_KEY);

// Variabel global untuk charts
let statusChart, regionChart, topSitesChart, alertChart;

// Data global
let allData = [];
let filteredData = [];

// Load data saat halaman dibuka
document.addEventListener('DOMContentLoaded', () => {
    loadData();
    
    // Event listeners
    document.getElementById('regionFilter').addEventListener('change', applyFilters);
    document.getElementById('statusFilter').addEventListener('change', applyFilters);
    document.getElementById('refreshBtn').addEventListener('click', () => loadData());
    
    // Auto refresh setiap 5 menit
    setInterval(() => loadData(), 300000);
});

// Fungsi utama load data dari Supabase
async function loadData() {
    try {
        document.getElementById('updateTime').innerHTML = '⏳ Mengambil data...';
        
        // Query data dari Supabase
        const { data, error } = await supabase
            .from('oss_data')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        allData = data || [];
        filteredData = allData;
        
        // Update UI
        updateStats();
        updateCharts();
        updateTable();
        populateRegionFilter();
        
        // Update waktu
        const now = new Date();
        document.getElementById('updateTime').innerHTML = `🕒 Update terakhir: ${now.toLocaleString('id-ID')}`;
        
    } catch (error) {
        console.error('Error:', error);
        document.getElementById('updateTime').innerHTML = '❌ Gagal memuat data';
        document.getElementById('tableBody').innerHTML = `<tr><td colspan="8" class="error">Error: ${error.message}</td></tr>`;
    }
}

// Update stat cards
function updateStats() {
    const total = filteredData.length;
    const active = filteredData.filter(site => site.status === 'Active').length;
    const avgUptime = total > 0 
        ? (filteredData.reduce((sum, site) => sum + (parseFloat(site.uptime_percentage) || 0), 0) / total).toFixed(1)
        : 0;
    const totalAlerts = filteredData.reduce((sum, site) => sum + (parseInt(site.alert_count) || 0), 0);
    
    document.getElementById('totalSites').innerHTML = total;
    document.getElementById('activeSites').innerHTML = active;
    document.getElementById('avgUptime').innerHTML = avgUptime + '%';
    document.getElementById('totalAlerts').innerHTML = totalAlerts;
}

// Update semua charts
function updateCharts() {
    updateStatusChart();
    updateRegionChart();
    updateTopSitesChart();
    updateAlertChart();
}

// Chart Status Distribution
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

// Chart Uptime by Region
function updateRegionChart() {
    const regionData = {};
    
    filteredData.forEach(site => {
        const region = site.region || 'Unknown';
        if (!regionData[region]) {
            regionData[region] = {
                total: 0,
                count: 0
            };
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
                y: {
                    beginAtZero: true,
                    max: 100,
                    grid: { color: '#e5e7eb' }
                }
            }
        }
    });
}

// Chart Top 10 Sites by Uptime
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
                x: {
                    max: 100,
                    grid: { color: '#e5e7eb' }
                }
            }
        }
    });
}

// Chart Alert Distribution
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

// Update tabel data
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
            <td>${site.site_id || '-'}</td>
            <td>${site.site_name || '-'}</td>
            <td>${site.region || '-'}</td>
            <td><span class="status-${(site.status || 'unknown').toLowerCase()}">${site.status || '-'}</span></td>
            <td>${site.uptime_percentage || 0}%</td>
            <td>${site.bandwidth_usage || 0} Mbps</td>
            <td>${site.last_maintenance || '-'}</td>
            <td class="alert-${(parseInt(site.alert_count) || 0) > 0 ? 'warning' : 'normal'}">${site.alert_count || 0}</td>
        `;
    });
}

// Populate region filter
function populateRegionFilter() {
    const regions = [...new Set(allData.map(site => site.region).filter(Boolean))].sort();
    const filter = document.getElementById('regionFilter');
    const currentValue = filter.value;
    
    filter.innerHTML = '<option value="">Semua Region</option>';
    regions.forEach(region => {
        const option = document.createElement('option');
        option.value = region;
        option.textContent = region;
        if (region === currentValue) option.selected = true;
        filter.appendChild(option);
    });
}

// Apply filters
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