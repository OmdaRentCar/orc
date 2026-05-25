import { apiJSON, api, isAuthenticated, logout } from './api.js';

const $ = (s, p = document) => p.querySelector(s);
const $$ = (s, p = document) => [...p.querySelectorAll(s)];

if (!isAuthenticated()) {
  window.location.href = '/login.html';
}

let currentPage = 'overview';
let currentCarPage = 1;
let currentBookingPage = 1;
let carSearchTerm = '';
const PER_PAGE = 10;

const adminContent = $('#adminPageContent');
const adminPageTitle = $('#adminPageTitle');
const notifPanel = $('#notifPanel');
const notifList = $('#notifList');

function showConfirmModal(message) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay active';
    overlay.style.zIndex = '6000';
    overlay.innerHTML = `
      <div class="modal confirm-modal">
        <div class="modal-header">
          <h2>Confirm</h2>
          <button class="modal-close" id="confirmClose">✕</button>
        </div>
        <div class="modal-body">
          <p style="color:var(--gunsmoke);font-size:15px;line-height:1.6;margin:0 0 28px;">${message}</p>
          <div style="display:flex;gap:12px;justify-content:flex-end;">
            <button class="btn btn-outline" id="confirmCancel">Cancel</button>
            <button class="btn btn-primary" id="confirmOk" style="background:var(--alizarin-crimson);">Delete</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    const close = () => { overlay.remove(); resolve(false); };
    overlay.querySelector('#confirmClose').addEventListener('click', close);
    overlay.querySelector('#confirmCancel').addEventListener('click', close);
    overlay.querySelector('#confirmOk').addEventListener('click', () => { overlay.remove(); resolve(true); });
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  });
}

function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  const icons = { success: '✓', error: '✕', info: 'ℹ' };
  toast.innerHTML = `<span style="font-size:14px;flex-shrink:0;opacity:0.7">${icons[type] || ''}</span><span>${message}</span>`;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

function updateNotifBadge(count) {
  const badge = $('#notifBadge');
  if (badge) badge.textContent = count || 0;
}

function renderNotifications(notifs) {
  notifList.innerHTML = '';
  if (!notifs || notifs.length === 0) {
    notifList.innerHTML = '<p style="color:var(--gunsmoke);text-align:center;padding:40px 0;">No notifications</p>';
    return;
  }
  notifs.slice(0, 20).forEach((item) => {
    const el = document.createElement('div');
    el.className = `notif-item ${item.read ? '' : 'unread'}`;
    el.style.opacity = item.read ? '0.6' : '1';
    el.innerHTML = `
      <div class="notif-title">${item.type === 'new_booking' ? '📋 ' : item.type === 'booking_approved' ? '✅ ' : item.type === 'booking_declined' ? '❌ ' : '🔔 '}${item.message}</div>
      <div class="notif-time">${new Date(item.created_at).toLocaleString()}</div>
    `;
    el.addEventListener('click', () => {
      apiJSON(`/dashboard/notifications/${item.id}/read`, { method: 'PUT' });
      el.style.opacity = '0.6';
    });
    notifList.appendChild(el);
  });
}

async function loadNotifications() {
  try {
    const notifs = await apiJSON('/dashboard/notifications');
    renderNotifications(notifs);
    const unread = notifs.filter(n => !n.read).length;
    updateNotifBadge(unread);
  } catch (e) {
    console.error('Failed to load notifications', e);
  }
}

async function renderAdminOverview() {
  try {
    const stats = await apiJSON('/dashboard');
    const bStatus = stats.bookingByStatus || [];
    const cType = stats.carsByType || [];
    const maxB = Math.max(...bStatus.map(s => s.count), 1);
    const maxC = Math.max(...cType.map(t => t.count), 1);
    const statusColors = { pending: '#eab308', approved: '#22c55e', declined: '#e72526' };

    adminContent.innerHTML = `
      <div class="stats-grid">
        <div class="stat-card"><div class="stat-icon green">🚗</div><h3>${stats.activeRentals}</h3><p>Active Rentals</p></div>
        <div class="stat-card"><div class="stat-icon blue">💰</div><h3>$${Number(stats.revenue).toLocaleString()}</h3><p>Total Revenue</p></div>
        <div class="stat-card"><div class="stat-icon red">🔧</div><h3>${stats.inMaintenance}</h3><p>In Maintenance</p></div>
        <div class="stat-card"><div class="stat-icon yellow">⏳</div><h3>${stats.pendingCount}</h3><p>Pending Approvals</p></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:24px;">
        <div class="chart-card">
          <h3>📋 Bookings by Status</h3>
          <div class="chart-bars" style="height:160px;">
            ${bStatus.map(s => `
              <div class="chart-bar-wrap">
                <span class="chart-bar-value">${s.count}</span>
                <div class="chart-bar" style="height:${(s.count / maxB) * 120}px;background:${statusColors[s.status] || '#848c88'};box-shadow:0 0 12px ${statusColors[s.status] || '#848c88'}40;"></div>
                <span class="chart-bar-label" style="text-transform:capitalize;">${s.status}</span>
              </div>
            `).join('')}
          </div>
        </div>
        <div class="chart-card">
          <h3>🚗 Cars by Type</h3>
          <div class="chart-bars" style="height:160px;">
            ${cType.map(t => `
              <div class="chart-bar-wrap">
                <span class="chart-bar-value">${t.count}</span>
                <div class="chart-bar blue" style="height:${(t.count / maxC) * 120}px;"></div>
                <span class="chart-bar-label">${t.type}</span>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
      <div class="chart-card">
        <p style="color:var(--gunsmoke);font-size:14px;">Total Cars: <strong>${stats.totalCars}</strong> | Total Bookings: <strong>${stats.totalBookings}</strong></p>
      </div>
    `;
  } catch (e) {
    adminContent.innerHTML = '<p style="color:var(--alizarin-crimson);">Failed to load dashboard. Make sure the server is running.</p>';
  }
}

function renderEditCarModal(car) {
  const isEdit = !!car;
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay active';
  overlay.id = 'editCarModal';
  overlay.innerHTML = `
    <div class="modal" style="max-width:600px;">
      <div class="modal-header">
        <h2>${isEdit ? 'Edit Car' : 'Add New Car'}</h2>
        <button class="modal-close" id="editCarClose">✕</button>
      </div>
      <div class="modal-body">
        <form id="editCarForm" enctype="multipart/form-data">
          <div class="form-row">
            <div class="form-group">
              <label>Brand</label>
              <input type="text" id="carBrand" value="${isEdit ? car.brand : ''}" required />
            </div>
            <div class="form-group">
              <label>Model</label>
              <input type="text" id="carModel" value="${isEdit ? car.model : ''}" required />
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Type</label>
              <select id="carType">
                <option value="Sports" ${isEdit && car.type === 'Sports' ? 'selected' : ''}>Sports</option>
                <option value="SUV" ${isEdit && car.type === 'SUV' ? 'selected' : ''}>SUV</option>
                <option value="Electric" ${isEdit && car.type === 'Electric' ? 'selected' : ''}>Electric</option>
              </select>
            </div>
            <div class="form-group">
              <label>Year</label>
              <input type="number" id="carYear" value="${isEdit ? car.year : '2026'}" required />
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Price ($/day)</label>
              <input type="number" id="carPrice" value="${isEdit ? car.price : '199'}" required />
            </div>
            <div class="form-group">
              <label>Seats</label>
              <input type="number" id="carSeats" value="${isEdit ? car.seats : '5'}" />
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Fuel</label>
              <select id="carFuel">
                <option value="Petrol" ${isEdit && car.fuel === 'Petrol' ? 'selected' : ''}>Petrol</option>
                <option value="Electric" ${isEdit && car.fuel === 'Electric' ? 'selected' : ''}>Electric</option>
                <option value="Hybrid" ${isEdit && car.fuel === 'Hybrid' ? 'selected' : ''}>Hybrid</option>
                <option value="Diesel" ${isEdit && car.fuel === 'Diesel' ? 'selected' : ''}>Diesel</option>
              </select>
            </div>
            <div class="form-group">
              <label>Transmission</label>
              <select id="carTransmission">
                <option value="Auto" ${isEdit && car.transmission === 'Auto' ? 'selected' : ''}>Auto</option>
                <option value="Manual" ${isEdit && car.transmission === 'Manual' ? 'selected' : ''}>Manual</option>
                <option value="PDK" ${isEdit && car.transmission === 'PDK' ? 'selected' : ''}>PDK</option>
                <option value="DCT" ${isEdit && car.transmission === 'DCT' ? 'selected' : ''}>DCT</option>
              </select>
            </div>
          </div>
          <div class="form-group">
            <label>Car Image</label>
            <div style="display:flex;gap:12px;flex-direction:column;">
              ${isEdit && car.image ? `
                <div style="position:relative;width:100%;max-width:300px;">
                  <img src="${car.image.startsWith('http') ? car.image : 'http://localhost:4000' + car.image}" alt="${car.brand}" style="width:100%;height:150px;object-fit:cover;border-radius:10px;border:1px solid rgba(255,255,255,0.08);" onerror="this.style.display='none'" />
                  <span style="position:absolute;bottom:8px;left:8px;background:rgba(0,0,0,0.7);padding:4px 10px;border-radius:6px;font-size:11px;color:var(--gunsmoke);">Current</span>
                </div>
              ` : ''}
              <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;">
                <input type="file" id="carImageFile" accept="image/*" style="flex:1;padding:10px;border-radius:8px;background:rgba(255,255,255,0.05);border:1px solid rgba(132,140,136,0.2);color:var(--black-haze);font-size:14px;" />
                <span style="color:var(--gunsmoke);font-size:12px;">Max 10MB</span>
              </div>
              <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;color:var(--gunsmoke);">
                <input type="checkbox" id="carImageClear" ${isEdit && car.image ? '' : 'style="display:none;"'} />
                Remove current image
              </label>
              <label style="font-size:12px;color:var(--gunsmoke);">Or paste an image URL:</label>
              <input type="url" id="carImageUrl" placeholder="https://..." value="${isEdit && car.image && car.image.startsWith('http') ? car.image : ''}" style="padding:10px;border-radius:8px;background:rgba(255,255,255,0.05);border:1px solid rgba(132,140,136,0.2);color:var(--black-haze);font-size:14px;" />
            </div>
          </div>
          <div class="form-group">
            <label>Description</label>
            <textarea id="carDescription" rows="3" style="width:100%;padding:12px 16px;border-radius:8px;background:rgba(255,255,255,0.05);border:1px solid rgba(132,140,136,0.2);color:var(--black-haze);font-size:14px;resize:vertical;">${isEdit ? car.description || '' : ''}</textarea>
          </div>
          <div class="form-group">
            <label>Features (comma separated)</label>
            <input type="text" id="carFeatures" value="${isEdit ? (car.features || []).join(', ') : ''}" placeholder="Autopilot, Glass Roof, etc." />
          </div>
          <div class="form-group">
            <label style="display:flex;align-items:center;gap:8px;cursor:pointer;">
              <input type="checkbox" id="carAvailable" ${isEdit ? (car.available ? 'checked' : '') : 'checked'} />
              Available for rent
            </label>
          </div>
          <button type="submit" class="submit-btn">${isEdit ? 'Update Car' : 'Add Car'}</button>
        </form>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  $('#editCarClose').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

  const fileInput = $('#carImageFile');
  const urlInput = $('#carImageUrl');
  const clearCheck = $('#carImageClear');

  fileInput?.addEventListener('change', () => {
    if (fileInput.files.length > 0) {
      urlInput.disabled = true;
      if (clearCheck) clearCheck.style.display = 'none';
    } else {
      urlInput.disabled = false;
      if (clearCheck) clearCheck.style.display = '';
    }
  });

  urlInput?.addEventListener('input', () => {
    if (urlInput.value.trim()) {
      fileInput.disabled = true;
    } else {
      fileInput.disabled = false;
    }
  });

  $('#editCarForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append('brand', $('#carBrand').value.trim());
    formData.append('model', $('#carModel').value.trim());
    formData.append('type', $('#carType').value);
    formData.append('year', parseInt($('#carYear').value));
    formData.append('price', parseFloat($('#carPrice').value));
    formData.append('seats', parseInt($('#carSeats').value) || 5);
    formData.append('fuel', $('#carFuel').value);
    formData.append('transmission', $('#carTransmission').value);
    formData.append('description', $('#carDescription').value.trim() || '');
    formData.append('features', JSON.stringify($('#carFeatures').value.split(',').map(f => f.trim()).filter(Boolean)));
    formData.append('available', $('#carAvailable').checked ? 'true' : 'false');

    if (fileInput.files.length > 0) {
      formData.append('image', fileInput.files[0]);
    } else if (urlInput.value.trim()) {
      formData.append('image', urlInput.value.trim());
    } else if (clearCheck?.checked) {
      formData.append('image', '');
    } else if (isEdit && car.image) {
      formData.append('image', car.image);
    }

    const token = localStorage.getItem('admin_token');
    const headers = { 'Authorization': `Bearer ${token}` };

    try {
      if (isEdit) {
        const res = await fetch(`http://localhost:4000/api/cars/${car.id}`, { method: 'PUT', headers, body: formData });
        if (!res.ok) throw new Error('Update failed');
        showToast('Car updated!', 'success');
      } else {
        const res = await fetch('http://localhost:4000/api/cars', { method: 'POST', headers, body: formData });
        if (!res.ok) throw new Error('Create failed');
        showToast('Car added to fleet!', 'success');
      }
      overlay.remove();
      renderAdminCars(currentCarPage);
    } catch (e) {
      showToast('Failed to save car', 'error');
    }
  });
}

async function renderAdminBookings(page = 1) {
  currentBookingPage = page;
  try {
    const allBookings = await apiJSON('/bookings');
    const totalPages = Math.ceil(allBookings.length / PER_PAGE) || 1;
    const start = (page - 1) * PER_PAGE;
    const bookings = allBookings.slice(start, start + PER_PAGE);

    adminContent.innerHTML = `
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead><tr><th>ID</th><th>Guest</th><th>Phone</th><th>Email</th><th>Car</th><th>Dates</th><th>Total</th><th>Document</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            ${bookings.map((b) => `
              <tr>
                <td>#${b.id}</td>
                <td><strong>${b.guest_name}</strong></td>
                <td>${b.phone}</td>
                <td>${b.email || '—'}</td>
                <td>${b.car_brand ? `${b.car_brand} ${b.car_model}` : 'Unknown'}</td>
                <td>${b.start_date} → ${b.end_date}</td>
                <td>$${b.total}</td>
                <td>${b.document_image ? `<a href="http://localhost:4000${b.document_image}" target="_blank" style="color:var(--alizarin-crimson);font-size:12px;">View</a>` : '—'}</td>
                <td><span class="status-badge ${b.status}">${b.status}</span></td>
                <td>
                  ${b.status === 'pending' ? `
                    <div class="admin-actions">
                      <button class="admin-btn approve" data-book-approve="${b.id}">✓ Approve</button>
                      <button class="admin-btn decline" data-book-decline="${b.id}">✕ Decline</button>
                    </div>
                  ` : `
                    <button class="admin-btn delete" data-book-delete="${b.id}" style="color:var(--alizarin-crimson);border-color:rgba(231,37,38,0.2);">Delete</button>
                  `}
                </td>
              </tr>
            `).join('')}
            ${bookings.length === 0 ? '<tr><td colspan="10" style="text-align:center;padding:40px;color:var(--gunsmoke);">No bookings found</td></tr>' : ''}
          </tbody>
        </table>
      </div>
      ${totalPages > 1 ? `
        <div style="display:flex;justify-content:center;gap:8px;margin-top:16px;">
          ${Array.from({ length: totalPages }, (_, i) => `
            <button class="admin-btn ${i + 1 === page ? 'approve' : ''}" data-book-page="${i + 1}" style="${i + 1 === page ? '' : 'background:rgba(255,255,255,0.03);color:var(--gunsmoke);'}">${i + 1}</button>
          `).join('')}
        </div>
      ` : ''}
    `;

    adminContent.querySelectorAll('[data-book-approve]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.bookApprove;
        await apiJSON(`/bookings/${id}/status`, { method: 'PUT', body: JSON.stringify({ status: 'approved' }) });
        showToast(`Booking #${id} approved!`, 'success');
        renderAdminBookings(currentBookingPage);
        loadNotifications();
      });
    });

    adminContent.querySelectorAll('[data-book-decline]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.bookDecline;
        await apiJSON(`/bookings/${id}/status`, { method: 'PUT', body: JSON.stringify({ status: 'declined' }) });
        showToast(`Booking #${id} declined.`, 'info');
        renderAdminBookings(currentBookingPage);
        loadNotifications();
      });
    });

    adminContent.querySelectorAll('[data-book-delete]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.bookDelete;
        if (await showConfirmModal('Delete this booking?')) {
          await apiJSON(`/bookings/${id}`, { method: 'DELETE' });
          showToast('Booking deleted.', 'info');
          renderAdminBookings(currentBookingPage);
        }
      });
    });

    adminContent.querySelectorAll('[data-book-page]').forEach((btn) => {
      btn.addEventListener('click', () => renderAdminBookings(parseInt(btn.dataset.bookPage)));
    });
  } catch (e) {
    adminContent.innerHTML = '<p style="color:var(--alizarin-crimson);">Failed to load bookings.</p>';
  }
}

async function renderAdminCars(page = 1) {
  currentCarPage = page;
  try {
    const allCars = await apiJSON('/cars');
    const filtered = carSearchTerm
      ? allCars.filter(c => `${c.brand} ${c.model} ${c.type}`.toLowerCase().includes(carSearchTerm.toLowerCase()))
      : allCars;
    const totalPages = Math.ceil(filtered.length / PER_PAGE) || 1;
    const start = (page - 1) * PER_PAGE;
    const cars = filtered.slice(start, start + PER_PAGE);

    adminContent.innerHTML = `
      <div style="margin-bottom:20px;display:flex;gap:12px;flex-wrap:wrap;align-items:center;">
        <button class="btn btn-primary" id="addCarBtn">+ Add New Car</button>
        <input type="text" id="carSearchInput" placeholder="🔍 Search by brand, model..." value="${carSearchTerm}" style="padding:10px 16px;border-radius:10px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);color:var(--black-haze);font-size:14px;min-width:220px;" />
      </div>
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead><tr><th>ID</th><th>Image</th><th>Car</th><th>Type</th><th>Price/day</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            ${cars.map((c) => {
              const imgSrc = c.image && c.image.startsWith('http') ? c.image : (c.image ? `http://localhost:4000${c.image}` : '');
              return `<tr>
                <td>#${c.id}</td>
                <td>${imgSrc ? `<img src="${imgSrc}" alt="${c.brand}" style="width:60px;height:40px;object-fit:cover;border-radius:6px;" onerror="this.style.display='none'" />` : '<span style="color:var(--gunsmoke);font-size:11px;">No image</span>'}</td>
                <td><strong>${c.brand} ${c.model}</strong> <span style="color:var(--gunsmoke);font-size:12px;">${c.year}</span></td>
                <td>${c.type}</td>
                <td>$${c.price}</td>
                <td><span class="status-badge ${c.available ? 'available' : 'maintenance'}">${c.available ? 'Available' : 'Maintenance'}</span></td>
                <td>
                  <div class="admin-actions">
                    <button class="admin-btn edit" data-car-edit="${c.id}">✏ Edit</button>
                    <button class="admin-btn edit" data-car-toggle="${c.id}">${c.available ? 'Set Maint' : 'Set Avail'}</button>
                    <button class="admin-btn delete" data-car-delete="${c.id}">Delete</button>
                  </div>
                </td>
              </tr>`;
            }).join('')}
            ${cars.length === 0 ? '<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--gunsmoke);">No cars found</td></tr>' : ''}
          </tbody>
        </table>
      </div>
      ${totalPages > 1 ? `
        <div style="display:flex;justify-content:center;gap:8px;margin-top:16px;">
          ${Array.from({ length: totalPages }, (_, i) => `
            <button class="admin-btn ${i + 1 === page ? 'approve' : ''}" data-car-page="${i + 1}" style="${i + 1 === page ? '' : 'background:rgba(255,255,255,0.03);color:var(--gunsmoke);'}">${i + 1}</button>
          `).join('')}
        </div>
      ` : ''}
    `;

    adminContent.querySelectorAll('[data-car-edit]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.carEdit;
        const car = allCars.find(c => c.id == id);
        if (car) renderEditCarModal(car);
      });
    });

    adminContent.querySelectorAll('[data-car-toggle]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.carToggle;
        const car = allCars.find(c => c.id == id);
        if (car) {
          await apiJSON(`/cars/${car.id}`, { method: 'PUT', body: JSON.stringify({ available: !car.available }) });
          showToast(`${car.brand} ${car.model} is now ${!car.available ? 'available' : 'in maintenance'}`, 'info');
          renderAdminCars(currentCarPage);
        }
      });
    });

    adminContent.querySelectorAll('[data-car-delete]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.carDelete;
        if (await showConfirmModal('Delete this car permanently?')) {
          await apiJSON(`/cars/${id}`, { method: 'DELETE' });
          showToast('Car removed from fleet.', 'success');
          renderAdminCars(currentCarPage);
        }
      });
    });

    $('#addCarBtn')?.addEventListener('click', () => renderEditCarModal(null));

    const searchInput = $('#carSearchInput');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        carSearchTerm = e.target.value;
        renderAdminCars(1);
      });
    }
  } catch (e) {
    adminContent.innerHTML = '<p style="color:var(--alizarin-crimson);">Failed to load cars.</p>';
  }
}

async function renderAdminHistory(page = 1) {
  try {
    const bookings = await apiJSON('/bookings');
    const completed = bookings.filter(b => b.status === 'approved' || b.status === 'declined');
    const totalPages = Math.ceil(completed.length / PER_PAGE) || 1;
    const start = (page - 1) * PER_PAGE;
    const items = completed.slice(start, start + PER_PAGE);

    adminContent.innerHTML = `
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead><tr><th>ID</th><th>Guest</th><th>Car</th><th>Period</th><th>Total</th><th>Status</th></tr></thead>
          <tbody>
            ${items.length === 0 ? '<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--gunsmoke);">No history yet</td></tr>' :
              items.map((b) => `<tr>
                <td>#${b.id}</td>
                <td>${b.guest_name}</td>
                <td>${b.car_brand ? `${b.car_brand} ${b.car_model}` : 'Unknown'}</td>
                <td>${b.start_date} → ${b.end_date}</td>
                <td>$${b.total}</td>
                <td><span class="status-badge ${b.status}">${b.status}</span></td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
      ${totalPages > 1 ? `
        <div style="display:flex;justify-content:center;gap:8px;margin-top:16px;">
          ${Array.from({ length: totalPages }, (_, i) => `
            <button class="admin-btn ${i + 1 === page ? 'approve' : ''}" data-history-page="${i + 1}" style="${i + 1 === page ? '' : 'background:rgba(255,255,255,0.03);color:var(--gunsmoke);'}">${i + 1}</button>
          `).join('')}
        </div>
      ` : ''}
    `;

    adminContent.querySelectorAll('[data-history-page]').forEach((btn) => {
      btn.addEventListener('click', () => renderAdminHistory(parseInt(btn.dataset.historyPage)));
    });
  } catch (e) {
    adminContent.innerHTML = '<p style="color:var(--alizarin-crimson);">Failed to load history.</p>';
  }
}

const user = JSON.parse(localStorage.getItem('admin_user') || '{}');

$$('[data-admin]').forEach((link) => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    $$('.admin-nav a').forEach((a) => a.classList.remove('active'));
    link.classList.add('active');

    const page = link.dataset.admin;
    currentPage = page;
    const titles = { overview: 'Dashboard Overview', bookings: 'Manage Bookings', cars: 'Manage Cars', history: 'Rental History' };
    adminPageTitle.textContent = titles[page] || 'Dashboard';

    if (page === 'overview') renderAdminOverview();
    else if (page === 'bookings') renderAdminBookings();
    else if (page === 'cars') renderAdminCars();
    else if (page === 'history') renderAdminHistory();
  });
});

$('#notifToggle').addEventListener('click', (e) => {
  e.preventDefault();
  notifPanel.classList.toggle('open');
});

$('#notifClose').addEventListener('click', () => {
  notifPanel.classList.remove('open');
});

$('#logoutBtn')?.addEventListener('click', (e) => {
  e.preventDefault();
  logout();
});

renderAdminOverview();
loadNotifications();

const now = new Date();
const dateEl = $('#adminDate');
if (dateEl) {
  dateEl.textContent = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

const socket = io('http://localhost:4000');
socket.emit('join-admin');

socket.on('booking-update', (data) => {
  showToast(data.message, data.type === 'booking_approved' ? 'success' : data.type === 'booking_declined' ? 'info' : 'info');
  loadNotifications();
  if (currentPage === 'overview') renderAdminOverview();
  else if (currentPage === 'bookings') renderAdminBookings(currentBookingPage);
  else if (currentPage === 'history') renderAdminHistory();
});
