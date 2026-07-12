document.addEventListener('DOMContentLoaded', async () => {
    // Auth Check
    try {
        const res = await fetch('/api/auth/me');
        const data = await res.json();
        if (!data.loggedIn) return window.location.href = '/login.html';
        document.getElementById('admin-name').textContent = data.username;
    } catch (err) {
        return window.location.href = '/login.html';
    }

    document.getElementById('logout-btn').addEventListener('click', async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        window.location.href = '/login.html';
    });

    // Navigation Logic
    const menuItems = document.querySelectorAll('.menu-item');
    const sections = document.querySelectorAll('.page-section');
    
    menuItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            menuItems.forEach(m => m.classList.remove('active'));
            item.classList.add('active');
            
            const target = item.getAttribute('data-target');
            document.getElementById('page-title').textContent = item.textContent + ' Overview';
            
            sections.forEach(s => s.classList.remove('active'));
            document.getElementById(`page-${target}`).classList.add('active');
            
            loadDataForSection(target);
        });
    });

    // Initial Load
    loadDataForSection('dashboard');
});

async function loadDataForSection(section) {
    if (section === 'dashboard') {
        fetchStats();
        fetchRecentOrders();
    } else if (section === 'orders') {
        fetchAllOrders();
    } else if (section === 'users') {
        fetchUsers();
    } else if (section === 'products') {
        fetchProducts();
    } else if (section === 'settings') {
        fetchSettings();
    }
}

// --- DASHBOARD ---
async function fetchStats() {
    try {
        const res = await fetch('/api/admin/stats');
        const stats = await res.json();
        document.getElementById('stat-users').textContent = stats.users.toLocaleString();
        document.getElementById('stat-pending').textContent = stats.pendingOrders.toLocaleString();
        document.getElementById('stat-revenue').textContent = stats.revenueToday.toLocaleString() + ' ETB';
    } catch (e) { console.error(e); }
}

async function fetchRecentOrders() {
    try {
        const res = await fetch('/api/admin/orders/recent');
        const orders = await res.json();
        const tbody = document.getElementById('recent-orders-body');
        renderOrdersTable(orders, tbody, false);
    } catch (e) { console.error(e); }
}

// --- ORDERS ---
async function fetchAllOrders() {
    try {
        const res = await fetch('/api/admin/orders');
        const orders = await res.json();
        const tbody = document.getElementById('all-orders-body');
        renderOrdersTable(orders, tbody, true);
    } catch (e) { console.error(e); }
}

function renderOrdersTable(orders, tbody, showDate) {
    tbody.innerHTML = '';
    if (orders.length === 0) {
        tbody.innerHTML = `<tr><td colspan="${showDate ? 7 : 5}" style="text-align:center;">No orders found.</td></tr>`;
        return;
    }
    orders.forEach(order => {
        let badge = '';
        if (order.status === 'pending' || order.status === 'pending_payment') badge = '<span class="status-badge status-pending">Pending</span>';
        else if (order.status === 'completed') badge = '<span class="status-badge status-completed">Completed</span>';
        else badge = `<span class="status-badge status-cancelled">${order.status}</span>`;

        let action = (order.status === 'pending' || order.status === 'pending_payment') 
            ? `<button class="btn" onclick="deliverOrder('${order.id}')">Deliver</button>` : '';

        const tr = document.createElement('tr');
        if (showDate) {
            tr.innerHTML = `<td>${order.date}</td><td>${order.displayId}</td><td>${order.customer}</td><td>${order.product}</td><td>${order.amount}</td><td>${badge}</td><td>${action}</td>`;
        } else {
            tr.innerHTML = `<td>${order.displayId}</td><td>${order.customer}</td><td>${order.product}</td><td>${badge}</td><td>${action}</td>`;
        }
        tbody.appendChild(tr);
    });
}

async function deliverOrder(id) {
    if (!confirm('Mark this order as delivered? User will be notified.')) return;
    await fetch(`/api/admin/orders/${id}/deliver`, { method: 'POST' });
    loadDataForSection(document.querySelector('.menu-item.active').getAttribute('data-target'));
}

// --- USERS ---
let allUsersData = [];
let usersCurrentPage = 1;
const usersPageSize = 10;

async function fetchUsers() {
    try {
        const res = await fetch('/api/admin/users');
        allUsersData = await res.json();
        usersCurrentPage = 1;
        renderUsersPage();
    } catch (e) { console.error(e); }
}

function renderUsersPage() {
    const tbody = document.getElementById('users-body');
    tbody.innerHTML = '';
    
    const totalPages = Math.ceil(allUsersData.length / usersPageSize) || 1;
    document.getElementById('users-page-info').textContent = `Page ${usersCurrentPage} of ${totalPages}`;
    document.getElementById('prev-users-btn').disabled = (usersCurrentPage === 1);
    document.getElementById('next-users-btn').disabled = (usersCurrentPage === totalPages);

    const startIndex = (usersCurrentPage - 1) * usersPageSize;
    const paginatedUsers = allUsersData.slice(startIndex, startIndex + usersPageSize);

    paginatedUsers.forEach(u => {
        const tr = document.createElement('tr');
        
        let telegramLink = '';
        if (u.username) {
            telegramLink = `<a href="https://t.me/${u.username}" target="_blank" style="color:var(--accent-color); text-decoration:none;">@${u.username}</a>`;
        } else {
            telegramLink = `<a href="tg://user?id=${u.telegram_id}" target="_blank" style="color:var(--accent-color); text-decoration:none;">Chat (ID: ${u.telegram_id})</a>`;
        }

        tr.innerHTML = `
            <td>${u.first_name} ${u.last_name || ''}</td>
            <td>${telegramLink}</td>
            <td>${u.telegram_id}</td>
            <td>${u.wallet_balance} ETB</td>
            <td>${u.role}</td>
            <td><button class="btn" onclick="openBalanceModal('${u.id}')">Adjust Balance</button></td>
        `;
        tbody.appendChild(tr);
    });
}

function prevUsersPage() {
    if (usersCurrentPage > 1) {
        usersCurrentPage--;
        renderUsersPage();
    }
}

function nextUsersPage() {
    const totalPages = Math.ceil(allUsersData.length / usersPageSize) || 1;
    if (usersCurrentPage < totalPages) {
        usersCurrentPage++;
        renderUsersPage();
    }
}

function openBalanceModal(id) {
    document.getElementById('bal-user-id').value = id;
    document.getElementById('bal-amount').value = '';
    document.getElementById('balance-modal').classList.add('active');
}
function closeBalanceModal() { document.getElementById('balance-modal').classList.remove('active'); }

async function saveBalance() {
    const id = document.getElementById('bal-user-id').value;
    const amount = document.getElementById('bal-amount').value;
    if (!amount) return;
    try {
        const res = await fetch(`/api/admin/users/${id}/balance`, {
            method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ amount })
        });
        if (res.ok) {
            closeBalanceModal();
            fetchUsers();
        } else alert('Failed to update balance');
    } catch (e) { alert(e); }
}

// --- PRODUCTS ---
let productsList = [];
async function fetchProducts() {
    try {
        const res = await fetch('/api/admin/products');
        productsList = await res.json();
        const tbody = document.getElementById('products-body');
        tbody.innerHTML = '';
        productsList.forEach(p => {
            const tr = document.createElement('tr');
            const status = p.is_active ? '<span style="color:var(--success)">Active</span>' : '<span style="color:var(--danger)">Inactive</span>';
            tr.innerHTML = `
                <td>${p.name}</td>
                <td>${p.price} ETB</td>
                <td>${p.stock < 0 ? 'Unlimited' : p.stock}</td>
                <td>${status}</td>
                <td>
                    <button class="btn" onclick="editProduct('${p.id}')">Edit</button>
                    <button class="btn" style="background:var(--danger); margin-left:5px;" onclick="deleteProduct('${p.id}')">Delete</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (e) { console.error(e); }
}

function openProductModal(isEdit = false, p = null) {
    const m = document.getElementById('product-modal');
    m.classList.add('active');
    if (isEdit && p) {
        document.getElementById('product-modal-title').textContent = 'Edit Product';
        document.getElementById('prod-id').value = p.id;
        document.getElementById('prod-name').value = p.name;
        document.getElementById('prod-desc').value = p.description || '';
        document.getElementById('prod-price').value = p.price;
        document.getElementById('prod-stock').value = p.stock;
        document.getElementById('prod-guide').value = p.installation_guide || '';
        document.getElementById('prod-auto').checked = p.auto_verify || false;
    } else {
        document.getElementById('product-modal-title').textContent = 'Add Product';
        document.getElementById('prod-id').value = '';
        document.getElementById('product-form').reset();
        document.getElementById('prod-auto').checked = false;
    }
}
function closeProductModal() { document.getElementById('product-modal').classList.remove('active'); }

function editProduct(id) {
    const p = productsList.find(x => x.id === id);
    if (p) openProductModal(true, p);
}

async function deleteProduct(id) {
    if (!confirm('Delete this product permanently?')) return;
    await fetch(`/api/admin/products/${id}`, { method: 'DELETE' });
    fetchProducts();
}

async function saveProduct() {
    const id = document.getElementById('prod-id').value;
    const p = {
        name: document.getElementById('prod-name').value,
        description: document.getElementById('prod-desc').value,
        price: document.getElementById('prod-price').value,
        stock: document.getElementById('prod-stock').value,
        installation_guide: document.getElementById('prod-guide').value,
        auto_verify: document.getElementById('prod-auto').checked,
        is_active: true
    };
    if (!p.name || !p.price) return alert('Name and Price required');
    
    const method = id ? 'PUT' : 'POST';
    const url = id ? `/api/admin/products/${id}` : `/api/admin/products`;
    
    await fetch(url, { method, headers: {'Content-Type':'application/json'}, body: JSON.stringify(p) });
    closeProductModal();
    fetchProducts();
}

// --- SETTINGS ---
async function fetchSettings() {
    try {
        const res = await fetch('/api/admin/settings');
        const settings = await res.json();
        
        document.getElementById('set-auto').value = settings.auto_verify_deposits || 'true';
        document.getElementById('set-maint').value = settings.maintenance_mode || 'false';
        document.getElementById('set-2fa').value = settings.admin_2fa_enabled || 'false';
        
        let banks = [];
        if (settings.payment_methods) {
            try { banks = JSON.parse(settings.payment_methods); } catch(e){}
        }
        
        const container = document.getElementById('banks-container');
        container.innerHTML = '';
        if (banks.length === 0) addBankRow();
        else banks.forEach(b => addBankRow(b.bank, b.accountName, b.accountNumber));
        
    } catch (e) { console.error(e); }
}

function addBankRow(bank = '', name = '', number = '') {
    const div = document.createElement('div');
    div.className = 'bank-row';
    div.style.cssText = 'display:flex; gap:1rem; margin-bottom:1rem; align-items:center;';
    div.innerHTML = `
        <input type="text" class="form-control bank-name" placeholder="Bank (e.g. Telebirr, CBE)" value="${bank}">
        <input type="text" class="form-control bank-acc-name" placeholder="Account Name" value="${name}">
        <input type="text" class="form-control bank-acc-num" placeholder="Account Number" value="${number}">
        <button class="btn" style="background:var(--danger); padding:0.5rem;" onclick="this.parentElement.remove()">X</button>
    `;
    document.getElementById('banks-container').appendChild(div);
}

async function saveSettings() {
    const bankRows = document.querySelectorAll('.bank-row');
    const banks = [];
    bankRows.forEach(row => {
        const bank = row.querySelector('.bank-name').value.trim();
        const accountName = row.querySelector('.bank-acc-name').value.trim();
        const accountNumber = row.querySelector('.bank-acc-num').value.trim();
        if (bank && accountName && accountNumber) {
            banks.push({ bank, accountName, accountNumber });
        }
    });

    const updates = {
        payment_methods: JSON.stringify(banks),
        auto_verify_deposits: document.getElementById('set-auto').value,
        maintenance_mode: document.getElementById('set-maint').value,
        admin_2fa_enabled: document.getElementById('set-2fa').value
    };
    await fetch('/api/admin/settings', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(updates) });
    alert('Settings saved!');
}

async function generateTelegramCode() {
    const res = await fetch('/api/admin/telegram-link', { method: 'POST' });
    const data = await res.json();
    if (data.code) {
        const div = document.getElementById('telegram-link-result');
        div.style.display = 'block';
        div.innerHTML = `Go to your Telegram Bot and send this exactly:<br><br><b>/linkadmin ${data.code} &lt;your_username&gt; &lt;your_password&gt;</b><br><br><small>This code is secure and your password will be instantly deleted by the bot.</small>`;
    }
}

document.getElementById('broadcast-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = document.getElementById('broadcast-msg').value;
    if (!msg) return;
    
    try {
        const res = await fetch('/api/admin/broadcast', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ message: msg })
        });
        const data = await res.json();
        if (data.success) {
            alert(`Broadcast sent successfully to ${data.count} users!`);
            document.getElementById('broadcast-msg').value = '';
        } else {
            alert('Failed to send broadcast: ' + data.error);
        }
    } catch (e) {
        alert('Error sending broadcast.');
    }
});
async function changePassword() {
    const oldPassword = document.getElementById('old-password').value;
    const newPassword = document.getElementById('new-password').value;

    if (!oldPassword || !newPassword) {
        alert('Please fill out both password fields.');
        return;
    }

    try {
        const res = await fetch('/api/auth/change-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ oldPassword, newPassword })
        });
        const data = await res.json();
        
        if (data.success) {
            alert('Password changed successfully!');
            document.getElementById('old-password').value = '';
            document.getElementById('new-password').value = '';
        } else {
            alert('Error: ' + data.error);
        }
    } catch (e) {
        alert('An error occurred. Please try again.');
    }
}
