// Admin state
let isLoggedIn = false;
let adminToken = null;
let currentSection = 'pending';

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    setupEventListeners();
});

// Check if already logged in
function checkAuth() {
    adminToken = localStorage.getItem('admin_token');
    if (adminToken) {
        verifyToken();
    } else {
        showLoginScreen();
    }
}

// Verify token with backend
async function verifyToken() {
    try {
        await fetchAPI('/auth/verify', {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        isLoggedIn = true;
        showDashboard();
        switchSection('pending'); // Load initial section
    } catch (error) {
        console.error('Token verification failed:', error);
        logout();
    }
}

// Setup all event listeners
function setupEventListeners() {
    document.getElementById('login-form')?.addEventListener('submit', handleLogin);
    document.getElementById('logout-btn')?.addEventListener('click', logout);
    document.querySelectorAll('.sidebar-btn').forEach(btn => {
        btn.addEventListener('click', () => switchSection(btn.dataset.section));
    });

    // Form submissions
    document.getElementById('character-form')?.addEventListener('submit', handleCharacterFormSubmit);
    document.getElementById('event-form')?.addEventListener('submit', handleEventFormSubmit);
    document.querySelector('#upload-form input[type="file"]')?.addEventListener('change', handleImagePreview);
}

// Handle login
async function handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const errorEl = document.getElementById('login-error');

    try {
        const data = await fetchAPI('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ username, password })
        });

        if (data.token) {
            adminToken = data.token;
            localStorage.setItem('admin_token', adminToken);
            isLoggedIn = true;
            showDashboard();
            switchSection('pending');
        }
    } catch (error) {
        console.error('Login failed:', error);
        errorEl.textContent = 'Invalid username or password';
    }
}

// Handle logout
function logout() {
    localStorage.removeItem('admin_token');
    adminToken = null;
    isLoggedIn = false;
    showLoginScreen();
}

// Show login screen
function showLoginScreen() {
    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('dashboard').style.display = 'none';
}

// Show dashboard
function showDashboard() {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('dashboard').style.display = 'block';
}

// Switch between dashboard sections
function switchSection(section) {
    currentSection = section;

    // Update active states for buttons and sections
    document.querySelectorAll('.sidebar-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.section === section);
    });
    document.querySelectorAll('.admin-section').forEach(sec => {
        sec.classList.toggle('active', sec.id === `${section}-section`);
    });

    // Load data for the selected section
    loadSectionData(section);
}

// Load data for the current section
function loadSectionData(section) {
    const sectionLoaders = {
        pending: loadPendingEdits,
        characters: loadCharactersList,
        timeline: loadEventsList,
        relationships: loadRelationshipsList,
        gallery: loadGalleryList
    };

    const load = sectionLoaders[section];
    if (load) {
        load();
    }
}

// Load pending edits
async function loadPendingEdits() {
    const list = document.getElementById('pending-list');
    try {
        const data = await fetchAPI('/admin/pending-edits');
        const edits = data.edits || [];
        updatePendingCount(edits);

        if (edits.length === 0) {
            list.innerHTML = '<p class="empty-state">No pending edits</p>';
            return;
        }
        list.innerHTML = edits.map(createPendingEditCard).join('');
    } catch (error) {
        console.error('Error loading pending edits:', error);
        list.innerHTML = '<p class="error-state">Failed to load pending edits</p>';
    }
}

function updatePendingCount(edits) {
    const badge = document.getElementById('pending-count');
    const pendingCount = edits.filter(e => e.status === 'pending').length;
    if (badge) {
        badge.textContent = pendingCount;
    }
}

function createPendingEditCard(edit) {
    return `
        <div class="pending-card" data-status="${edit.status}">
            <div class="card-header">
                <div>
                    <h3 class="card-title">${edit.edit_type} - ${edit.table_name}</h3>
                    <p class="card-meta">Submitted ${new Date(edit.submitted_at).toLocaleString()}</p>
                </div>
                <div class="card-actions">
                    ${edit.status === 'pending' ? `
                        <button class="btn-icon success" onclick="approveEdit('${edit.id}')" title="Approve">✓</button>
                        <button class="btn-icon danger" onclick="denyEdit('${edit.id}')" title="Deny">✗</button>
                    ` : `<span class="badge">${edit.status}</span>`}
                </div>
            </div>
            <div class="edit-diff">
                ${edit.old_data ? `<div class="diff-old">Old: <pre>${JSON.stringify(edit.old_data, null, 2)}</pre></div>` : ''}
                <div class="diff-new">New: <pre>${JSON.stringify(edit.new_data, null, 2)}</pre></div>
            </div>
        </div>
    `;
}

// Approve/Deny edits
async function approveEdit(editId) {
    await handleEditAction(editId, 'approve', 'approved');
}

async function denyEdit(editId) {
    await handleEditAction(editId, 'deny', 'denied');
}

async function handleEditAction(editId, action, resultState) {
    try {
        await fetchAPI(`/admin/pending-edits/${editId}/${action}`, { method: 'POST' });
        showNotification(`Edit ${resultState}`, 'success');
        loadPendingEdits();
    } catch (error) {
        console.error(`Error ${action}ing edit:`, error);
        showNotification(`Failed to ${action} edit`, 'error');
    }
}

// Load characters list
async function loadCharactersList() {
    const list = document.getElementById('characters-list');
    try {
        const data = await fetchAPI('/characters');
        const characters = data.characters || [];
        if (characters.length === 0) {
            list.innerHTML = '<p class="empty-state">No characters yet</p>';
            return;
        }
        list.innerHTML = characters.map(char => `
            <div class="admin-card">
                <h3 class="card-title">${char.name}</h3>
                <div class="card-actions">
                    <button class="btn-icon" onclick="openCharacterForm('${char.id}')">✏️</button>
                    <button class="btn-icon danger" onclick="deleteCharacter('${char.id}')">🗑️</button>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading characters:', error);
        list.innerHTML = '<p class="error-state">Failed to load characters</p>';
    }
}

// Load events list
async function loadEventsList() {
    const list = document.getElementById('events-list');
    try {
        const data = await fetchAPI('/timeline');
        const events = data.events || [];
        if (events.length === 0) {
            list.innerHTML = '<p class="empty-state">No events yet</p>';
            return;
        }
        list.innerHTML = events.map(event => `
            <div class="admin-card">
                <h3 class="card-title">${event.title}</h3>
                <p class="card-meta">${new Date(event.event_date).toLocaleDateString()}</p>
                <div class="card-actions">
                    <button class="btn-icon" onclick="openEventForm('${event.id}')">✏️</button>
                    <button class="btn-icon danger" onclick="deleteEvent('${event.id}')">🗑️</button>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading events:', error);
        list.innerHTML = '<p class="error-state">Failed to load events</p>';
    }
}

// Placeholder load functions
function loadRelationshipsList() {
    document.getElementById('relationships-admin-list').innerHTML = '<p class="empty-state">Relationships management coming soon</p>';
}

function loadGalleryList() {
    document.getElementById('gallery-admin-list').innerHTML = '<p class="empty-state">Gallery management coming soon</p>';
}

// Character form handling
async function openCharacterForm(characterId = null) {
    const form = document.getElementById('character-form');
    const title = document.getElementById('character-form-title');
    form.reset();
    delete form.dataset.characterId;

    if (characterId) {
        title.textContent = 'Edit Character';
        try {
            const data = await fetchAPI(`/characters/${characterId}`);
            const char = data.character;
            // Populate form fields
            for (const key in char) {
                if (form.elements[key]) {
                    form.elements[key].value = char[key];
                }
            }
            form.dataset.characterId = characterId;
        } catch (error) {
            console.error('Error loading character:', error);
            showNotification('Failed to load character data', 'error');
            return;
        }
    } else {
        title.textContent = 'Add New Character';
    }
    openModal('character-modal');
}

async function handleCharacterFormSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const characterId = form.dataset.characterId;
    const method = characterId ? 'PUT' : 'POST';
    const endpoint = characterId ? `/characters/${characterId}` : '/characters';

    try {
        await fetchAPI(endpoint, {
            method,
            body: new FormData(form)
        });
        showNotification(`Character ${characterId ? 'updated' : 'created'} successfully`, 'success');
        closeModal('character-modal');
        loadCharactersList();
    } catch (error) {
        console.error('Error saving character:', error);
        showNotification('Failed to save character', 'error');
    }
}

async function deleteCharacter(characterId) {
    if (!confirm('Are you sure you want to delete this character?')) return;
    try {
        await fetchAPI(`/characters/${characterId}`, { method: 'DELETE' });
        showNotification('Character deleted', 'success');
        loadCharactersList();
    } catch (error) {
        console.error('Error deleting character:', error);
        showNotification('Failed to delete character', 'error');
    }
}

// Event form handling
async function openEventForm(eventId = null) {
    // Similar implementation to openCharacterForm
    // ...
    openModal('event-modal');
}

async function handleEventFormSubmit(e) {
    // Similar implementation to handleCharacterFormSubmit
    // ...
}

async function deleteEvent(eventId) {
    if (!confirm('Are you sure you want to delete this event?')) return;
    try {
        await fetchAPI(`/timeline/${eventId}`, { method: 'DELETE' });
        showNotification('Event deleted', 'success');
        loadEventsList();
    } catch (error) {
        console.error('Error deleting event:', error);
        showNotification('Failed to delete event', 'error');
    }
}

// Modal handling
function openModal(modalId) {
    document.getElementById(modalId).style.display = 'flex';
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

// Utility functions
async function fetchAPI(endpoint, options = {}) {
    options.headers = {
        'Authorization': `Bearer ${adminToken}`,
        ...options.headers
    };
    if (options.body && !(options.body instanceof FormData)) {
        options.headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(`/api${endpoint}`, options);
    if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
    }
    return response.json();
}

function showNotification(message, type = 'info') {
    // Implementation for showing user notifications
    console.log(`[${type.toUpperCase()}] ${message}`);
}

function handleImagePreview(e) {
    const preview = document.getElementById('image-preview');
    preview.innerHTML = '';
    Array.from(e.target.files).forEach(file => {
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = document.createElement('img');
            img.src = event.target.result;
            preview.appendChild(img);
        };
        reader.readAsDataURL(file);
    });
}
