import * as THREE from 'three';
import { createScene, createLights, createFloor, createParticles, createCar, tryLoadFerrari } from './three/scene.js';
import { initAudio, playStartupSound, setRPM, stopEngine } from './three/engineSound.js';

const API = 'http://localhost:4000/api';

let allCars = [];

async function loadCars() {
  try {
    const res = await fetch(`${API}/cars`);
    allCars = await res.json();
    populateFilters();
    renderCars(getFilteredCars());
  } catch {
    showToast('Could not connect to server. Is the backend running?', 'error');
  }
}

/* ─── THREE.JS 3D CAR SCENE ─── */
(function initThree() {
  const container = document.getElementById('three-canvas');
  if (!container) return;

  const { scene, camera, renderer } = createScene(container);
  createLights(scene);
  createFloor(scene);
  const particles = createParticles(scene);

  window.__carModel = null;
  window.__wheels = [];

  const loadStatus = document.createElement('div');
  loadStatus.className = 'car-loading';
  container.appendChild(loadStatus);

  tryLoadFerrari(scene, (msg) => {
    loadStatus.textContent = msg;
    loadStatus.style.display = msg ? 'block' : 'none';
  }).then((result) => {
    if (result) {
      window.__carModel = result.model;
      window.__wheels = result.wheels;
    } else {
      const fallback = createCar(scene);
      window.__carModel = fallback.group;
      window.__wheels = fallback.wheels;
    }
    loadStatus.textContent = '';
    loadStatus.style.display = 'none';
  });

  let mouseX = 0;
  let targetRot = 0;
  let autoRotate = true;

  document.addEventListener('mousemove', (e) => {
    const x = (e.clientX / window.innerWidth) * 2 - 1;
    mouseX = x * 0.6;
    autoRotate = false;
    setTimeout(() => { autoRotate = true; }, 3000);
  });

  let engineRunning = false;
  let engineStartTime = 0;
  let revTime = -100;
  let idleBase = 0.12;

  function startEngine() {
    if (engineRunning) return;
    engineRunning = true;
    engineStartTime = performance.now();
    try { initAudio(); playStartupSound(() => {}); } catch (e) {}
  }

  setTimeout(startEngine, 1000);

  container.addEventListener('click', () => {
    if (!engineRunning) { startEngine(); return; }
    revTime = performance.now();
  });

  let time = 0;

  function animate() {
    requestAnimationFrame(animate);
    time += 0.016;

    const model = window.__carModel;

    if (model) {
      if (autoRotate) {
        model.rotation.y += 0.003;
      } else {
        model.rotation.y += (mouseX - model.rotation.y) * 0.03;
      }
    }

    particles.rotation.y = time * 0.008;
    particles.position.y = Math.sin(time * 0.15) * 0.05;

    if (engineRunning) {
      const elapsed = (performance.now() - engineStartTime) / 1000;
      const revElapsed = (performance.now() - revTime) / 1000;
      let target = idleBase;

      if (elapsed < 2.0) {
        const t = elapsed / 2.0;
        target = (1 - Math.pow(1 - t, 3)) * 0.85;
      } else if (elapsed > 3.0) {
        target = idleBase + Math.sin(elapsed * 3) * 0.02;
      }

      if (revElapsed < 0.8) {
        const t = revElapsed / 0.8;
        target = idleBase + (1 - Math.pow(1 - t, 2)) * 0.73;
      }

      try { setRPM(target); } catch (e) {}
    }

    for (const w of window.__wheels) w.rotation.x += 0.04;

    const breath = Math.sin(time * 0.5) * 0.03;
    camera.position.x = 4 + breath;
    camera.position.y = 2 + Math.sin(time * 0.3) * 0.02;
    camera.lookAt(0, 0.2, 0);

    renderer.render(scene, camera);
  }

  animate();

  let resizeTimeout;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    }, 100);
  });
})();

/* ─── DOM REFS ─── */
const $ = (s, p = document) => p.querySelector(s);
const $$ = (s, p = document) => [...p.querySelectorAll(s)];

const carGrid = $('#carGrid');
const modalOverlay = $('#modalOverlay');
const modalBody = $('#modalBody');
const modalTitle = $('#modalTitle');

/* ─── NAVBAR ─── */
const navbar = $('#navbar');
const mobileToggle = $('#mobileToggle');
const navLinks = $('#navLinks');

window.addEventListener('scroll', () => {
  navbar.classList.toggle('scrolled', window.scrollY > 50);
});

mobileToggle.addEventListener('click', () => {
  navLinks.classList.toggle('open');
});

$$('[data-nav]').forEach((link) => {
  link.addEventListener('click', () => navLinks.classList.remove('open'));
});

/* ─── TOAST ─── */
function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

/* ─── FILTERS ─── */
const filterBrand = $('#filterBrand');
const filterType = $('#filterType');
const filterPrice = $('#filterPrice');
const filterAvailable = $('#filterAvailable');
const filterSearch = $('#filterSearch');

async function populateFilters() {
  try {
    const [brands, types] = await Promise.all([
      fetch(`${API}/cars/brands`).then(r => r.json()),
      fetch(`${API}/cars/types`).then(r => r.json()),
    ]);
    brands.forEach((b) => {
      filterBrand.innerHTML += `<option value="${b}">${b}</option>`;
    });
    types.forEach((t) => {
      filterType.innerHTML += `<option value="${t}">${t}</option>`;
    });
  } catch {
    const brands = [...new Set(allCars.map(c => c.brand))];
    const types = [...new Set(allCars.map(c => c.type))];
    brands.forEach((b) => filterBrand.innerHTML += `<option value="${b}">${b}</option>`);
    types.forEach((t) => filterType.innerHTML += `<option value="${t}">${t}</option>`);
  }
}

function getFilteredCars() {
  return allCars.filter((car) => {
    if (filterBrand.value !== 'all' && car.brand !== filterBrand.value) return false;
    if (filterType.value !== 'all' && car.type !== filterType.value) return false;
    if (filterAvailable.value === 'available' && !car.available) return false;
    if (filterPrice.value !== 'all') {
      const [min, max] = filterPrice.value.split('-').map(Number);
      if (max) { if (car.price < min || car.price > max) return false; }
      else if (car.price < min) return false;
    }
    if (filterSearch.value) {
      const q = filterSearch.value.toLowerCase();
      if (!car.brand.toLowerCase().includes(q) && !car.model.toLowerCase().includes(q)) return false;
    }
    return true;
  });
}

/* ─── RENDER CAR GRID ─── */
function renderCars(carList) {
  carGrid.innerHTML = '';
  carList.forEach((car, i) => {
    const card = document.createElement('div');
    card.className = 'car-card';
    card.style.animationDelay = `${i * 0.06}s`;
    card.innerHTML = `
      <div class="card-image">
        <img src="${car.image}" alt="${car.brand} ${car.model}" loading="lazy" />
        <span class="card-badge ${car.available ? 'available' : 'unavailable'}">
          ${car.available ? 'Available' : 'In Service'}
        </span>
      </div>
      <div class="card-body">
        <h3>${car.brand} ${car.model}</h3>
        <div class="car-meta">
          <span>📅 ${car.year}</span>
          <span>⛽ ${car.fuel}</span>
          <span>👤 ${car.seats} seats</span>
          <span>⚙ ${car.transmission}</span>
        </div>
        <p>${car.description || ''}</p>
      </div>
      <div class="card-footer">
        <div class="price">$${car.price}<span>/day</span></div>
        <button class="book-btn" data-car-id="${car.id}">Rent Now</button>
      </div>
    `;
    card.addEventListener('click', (e) => {
      if (!e.target.closest('.book-btn')) openModal(car.id);
    });
    card.querySelector('.book-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      openModal(car.id);
    });
    carGrid.appendChild(card);
  });
}

/* ─── MODAL ─── */
function openModal(carId) {
  const car = allCars.find((c) => c.id === carId);
  if (!car) return;

  modalTitle.textContent = `${car.brand} ${car.model}`;
  modalBody.innerHTML = `
    <img class="modal-car-image" src="${car.image}" alt="${car.brand} ${car.model}" />
    <p class="modal-description">${car.description || ''}</p>
    <div class="modal-car-info">
      <div class="info-item"><label>Brand</label><span>${car.brand}</span></div>
      <div class="info-item"><label>Model</label><span>${car.model}</span></div>
      <div class="info-item"><label>Year</label><span>${car.year}</span></div>
      <div class="info-item"><label>Type</label><span>${car.type}</span></div>
      <div class="info-item"><label>Fuel</label><span>${car.fuel}</span></div>
      <div class="info-item"><label>Transmission</label><span>${car.transmission}</span></div>
      <div class="info-item"><label>Seats</label><span>${car.seats}</span></div>
      <div class="info-item"><label>Price</label><span>$${car.price}/day</span></div>
    </div>
    <div class="modal-features">
      ${(car.features || []).map((f) => `<span class="feature-tag">${f}</span>`).join('')}
    </div>
    <div id="bookedNotice" class="booked-notice" style="display:none;"></div>
    <div class="booking-form">
      <h3>Book This Car</h3>
      <div class="form-row">
        <div class="form-group">
          <label>Pick-up Date</label>
          <input type="date" id="bookingStart" required />
        </div>
        <div class="form-group">
          <label>Return Date</label>
          <input type="date" id="bookingEnd" required />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Full Name</label>
          <input type="text" id="bookingName" placeholder="Your full name" required />
        </div>
        <div class="form-group">
          <label>Telephone</label>
          <input type="tel" id="bookingPhone" placeholder="+212 6XX XX XX XX" required />
        </div>
      </div>
      <div class="form-group">
        <label>Email <span style="color:var(--gunsmoke);font-weight:400;">(optional — for confirmation)</span></label>
        <input type="email" id="bookingEmail" placeholder="your@email.com" />
      </div>
      <div class="form-group">
        <label>ID Document (CIN / Passport)</label>
        <div style="display:flex;gap:12px;align-items:center;">
          <input type="file" id="bookingDocument" accept="image/*,.pdf" style="flex:1;padding:10px;border-radius:8px;background:rgba(255,255,255,0.05);border:1px solid rgba(132,140,136,0.2);color:var(--black-haze);font-size:14px;" />
          <span style="color:var(--gunsmoke);font-size:12px;">Max 5MB</span>
        </div>
      </div>
      <div id="pricePreview" class="price-breakdown"></div>
      <button class="submit-btn" id="submitBooking">Submit Booking Request</button>
    </div>
  `;

  const start = $('#bookingStart');
  const end = $('#bookingEnd');
  const preview = $('#pricePreview');
  const bookedNotice = $('#bookedNotice');
  let bookedRanges = [];
  const today = new Date().toISOString().split('T')[0];
  start.min = today;
  end.min = today;

  fetch(`${API}/bookings/car/${car.id}`)
    .then(r => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    })
    .then(data => {
      bookedRanges = data;
      if (!bookedRanges || bookedRanges.length === 0) {
        bookedNotice.style.display = 'block';
        bookedNotice.innerHTML = `
          <div class="booked-notice-icon">📅</div>
          <div class="booked-notice-body">
            <strong>No bookings yet</strong>
            <div style="color:var(--gunsmoke);font-size:12px;margin-top:4px;">This car is available for all dates</div>
          </div>
        `;
        return;
      }
      const items = bookedRanges.map(b =>
        `<span class="booked-range">${new Date(b.start_date).toLocaleDateString()} → ${new Date(b.end_date).toLocaleDateString()}</span>`
      ).join('');
      bookedNotice.style.display = 'block';
      bookedNotice.innerHTML = `
        <div class="booked-notice-icon">📅</div>
        <div class="booked-notice-body">
          <strong>Already booked on:</strong>
          <div class="booked-ranges">${items}</div>
        </div>
      `;
    })
    .catch(err => {
      bookedNotice.style.display = 'block';
      bookedNotice.innerHTML = `
        <div class="booked-notice-icon">⚠️</div>
        <div class="booked-notice-body">
          <strong>Could not load availability</strong>
          <div style="color:var(--gunsmoke);font-size:12px;margin-top:4px;">${err.message}</div>
        </div>
      `;
    });

  function showFieldError(inputId, message) {
    const input = document.getElementById(inputId);
    if (!input) return;
    const existing = input.parentElement.querySelector('.field-error');
    if (existing) existing.remove();
    if (!message) return;
    const err = document.createElement('span');
    err.className = 'field-error';
    err.textContent = message;
    err.style.cssText = 'color:#e72526;font-size:12px;margin-top:4px;display:block;';
    input.parentElement.appendChild(err);
  }

  function clearFieldErrors() {
    document.querySelectorAll('.field-error').forEach(e => e.remove());
  }

  function validatePhone(phone) {
    return /^[\+\d\s\-\(\)]{7,20}$/.test(phone);
  }

  function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function updatePrice() {
    if (start.value && end.value) {
      const s = new Date(start.value);
      const e = new Date(end.value);
      const days = Math.max(1, Math.ceil((e - s) / (1000 * 60 * 60 * 24)));
      const total = days * car.price;
      preview.innerHTML = `
        <div class="price-row"><span>$${car.price} × ${days} day${days > 1 ? 's' : ''}</span><span>$${total}</span></div>
        <div class="price-row"><span>Insurance & Tax</span><span>Included</span></div>
        <div class="price-row total"><span>Total</span><span>$${total}</span></div>
      `;
    }
  }

  function checkDateConflict() {
    if (!start.value || !end.value || !bookedRanges.length) {
      showFieldError('bookingStart', null);
      showFieldError('bookingEnd', null);
      return;
    }
    const s = new Date(start.value);
    const e = new Date(end.value);
    const conflict = bookedRanges.find(b => s <= new Date(b.end_date) && e >= new Date(b.start_date));
    if (conflict) {
      showFieldError('bookingStart', `Already booked ${new Date(conflict.start_date).toLocaleDateString()} → ${new Date(conflict.end_date).toLocaleDateString()}. Choose different dates.`);
    } else {
      showFieldError('bookingStart', null);
      showFieldError('bookingEnd', null);
    }
  }

  start.addEventListener('change', () => { updatePrice(); checkDateConflict(); });
  end.addEventListener('change', () => { updatePrice(); checkDateConflict(); });

  document.querySelectorAll('#bookingName, #bookingPhone, #bookingEmail, #bookingStart, #bookingEnd, #bookingDocument').forEach(el => {
    el.addEventListener('input', () => showFieldError(el.id, null));
    el.addEventListener('change', () => showFieldError(el.id, null));
  });

  $('#submitBooking').addEventListener('click', async () => {
    clearFieldErrors();
    const name = $('#bookingName').value.trim();
    const phone = $('#bookingPhone').value.trim();
    const email = $('#bookingEmail').value.trim();
    const file = $('#bookingDocument').files[0];
    let valid = true;

    if (!name || name.length < 2) {
      showFieldError('bookingName', 'Please enter your full name.');
      valid = false;
    }
    if (!phone) {
      showFieldError('bookingPhone', 'Phone number is required.');
      valid = false;
    } else if (!validatePhone(phone)) {
      showFieldError('bookingPhone', 'Invalid phone format. Use international format (e.g. +2126XXXXXXXX).');
      valid = false;
    }
    if (email && !validateEmail(email)) {
      showFieldError('bookingEmail', 'Invalid email format.');
      valid = false;
    }
    if (!start.value) {
      showFieldError('bookingStart', 'Pick-up date is required.');
      valid = false;
    }
    if (!end.value) {
      showFieldError('bookingEnd', 'Return date is required.');
      valid = false;
    }
    if (start.value && end.value && new Date(end.value) < new Date(start.value)) {
      showFieldError('bookingEnd', 'Return date must be after pick-up date.');
      valid = false;
    }
    if (start.value && new Date(start.value) < new Date(today)) {
      showFieldError('bookingStart', 'Pick-up date cannot be in the past.');
      valid = false;
    }
    if (start.value && end.value && bookedRanges.length) {
      const s = new Date(start.value);
      const e = new Date(end.value);
      const conflict = bookedRanges.find(b => s <= new Date(b.end_date) && e >= new Date(b.start_date));
      if (conflict) {
        showFieldError('bookingStart', `Already booked ${new Date(conflict.start_date).toLocaleDateString()} → ${new Date(conflict.end_date).toLocaleDateString()}. Choose different dates.`);
        valid = false;
      }
    }
    if (file) {
      const maxSize = 5 * 1024 * 1024;
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
      if (file.size > maxSize) {
        showFieldError('bookingDocument', 'File too large. Max 5MB.');
        valid = false;
      } else if (!allowedTypes.includes(file.type)) {
        showFieldError('bookingDocument', 'Invalid file type. Use JPG, PNG, or PDF.');
        valid = false;
      }
    }

    if (!valid) return;

    const s = new Date(start.value);
    const e = new Date(end.value);
    const days = Math.max(1, Math.ceil((e - s) / (1000 * 60 * 60 * 24)));
    const total = days * car.price;

    const formData = new FormData();
    formData.append('car_id', car.id);
    formData.append('guest_name', name);
    formData.append('phone', phone);
    if (email) formData.append('email', email);
    formData.append('start_date', start.value);
    formData.append('end_date', end.value);
    if (file) formData.append('document', file);

    const btn = $('#submitBooking');
    btn.textContent = 'Submitting...';
    btn.disabled = true;

    try {
      const res = await fetch(`${API}/bookings/public`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('admin_token') || ''}` },
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Submission failed');
      }

      const booking = await res.json();

      modalTitle.textContent = '✅ Booking Submitted!';
      modalBody.innerHTML = `
        <div class="booking-confirm">
          <div style="text-align:center;margin-bottom:24px;">
            <div style="font-size:48px;margin-bottom:8px;">🎉</div>
            <p style="color:var(--gunsmoke);font-size:14px;">Your booking request has been received. We'll contact you at <strong>${booking.phone}</strong> to confirm.</p>
          </div>
          <div class="confirm-details">
            <div class="confirm-row"><label>Booking ID</label><span>#${booking.id}</span></div>
            <div class="confirm-row"><label>Car</label><span>${booking.car_brand} ${booking.car_model}</span></div>
            <div class="confirm-row"><label>Pick-up</label><span>${new Date(booking.start_date).toLocaleDateString()}</span></div>
            <div class="confirm-row"><label>Return</label><span>${new Date(booking.end_date).toLocaleDateString()}</span></div>
            <div class="confirm-row"><label>Guest</label><span>${booking.guest_name}</span></div>
            <div class="confirm-row"><label>Total</label><span style="color:var(--alizarin-crimson);font-weight:700;">$${booking.total}</span></div>
            <div class="confirm-row"><label>Status</label><span style="color:#fbbf24;">${booking.status}</span></div>
          </div>
          <button class="btn btn-primary" style="width:100%;margin-top:24px;justify-content:center;" id="confirmDone">Got it!</button>
        </div>`;

      modalBody.querySelector('#confirmDone').addEventListener('click', () => {
        modalOverlay.classList.remove('active');
      });
    } catch (err) {
      showToast(err.message || 'Failed to submit booking. Please try again.', 'error');
    } finally {
      btn.textContent = 'Submit Booking Request';
      btn.disabled = false;
    }
  });

  modalOverlay.classList.add('active');
}

$('#modalClose').addEventListener('click', () => {
  modalOverlay.classList.remove('active');
});

modalOverlay.addEventListener('click', (e) => {
  if (e.target === modalOverlay) modalOverlay.classList.remove('active');
});

/* ─── FILTER EVENTS ─── */
[filterBrand, filterType, filterPrice, filterAvailable, filterSearch].forEach((el) => {
  el.addEventListener('change', () => renderCars(getFilteredCars()));
  el.addEventListener('input', () => renderCars(getFilteredCars()));
});

/* ─── INIT ─── */
loadCars();
