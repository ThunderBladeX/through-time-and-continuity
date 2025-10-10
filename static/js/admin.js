// Admin state
let isLoggedIn = false;
let adminToken = null;
let currentSection = 'pending';

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
        loadPendingEdits();
        
    } catch (error) {
        console.error('Token verification failed:', error);
        localStorage.removeItem('admin_token');
        showLoginScreen();
    }
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

// Handle login
document.getElementById('login-form')?.addEventListener('submit', async (e) => {
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
            loadPendingEdits();
        }
        
    } catch (error) {
        console.error('Login failed:', error);
        errorEl.textContent = 'Invalid username or password';
    }
});

// Handle logout
document.getElementById('logout-btn')?.addEventListener('click', () => {
    localStorage.removeItem('admin_token');
    adminToken = null;
    isLoggedIn = false;
    showLoginScreen();
});

// Setup section navigation
function setupSectionNav() {
    document.querySelectorAll('.sidebar-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const section = btn.dataset.section;
            switchSection(section);
        });
    });
}

// Switch between dashboard sections
function switchSection(section) {
    currentSection = section;
    
    // Update active button
    document.querySelectorAll('.sidebar-btn').forEach(btn => {
        if (btn.dataset.section === section) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    
    // Update active section
    document.querySelectorAll('.admin-section').forEach(sec => {
        sec.classList.remove('active');
    });
    
    const activeSection = document.getElementById(`${section}-section`);
    if (activeSection) activeSection.classList.add('active');
    
    // Load section data if needed
    switch(section) {
        case 'pending':
            loadPendingEdits();
            break;
        case 'characters':
            loadCharactersList();
            break;
        case 'timeline':
            loadEventsList();
            break;
        case 'relationships':
            loadRelationshipsList();
            break;
        case 'gallery':
            loadGalleryList();
            break;
    }
}

// Load pending edits
async function loadPendingEdits() {
    const list = document.getElementById('pending-list');
    
    try {
        const data = await fetchAPI('/admin/pending-edits');
        const edits = data.edits || [];
        
        // Update badge count
        const badge = document.getElementById('pending-count');
        const pendingCount = edits.filter(e => e.status === 'pending').length;
        if (badge) badge.textContent = pendingCount;
        
        if (edits.length === 0) {
            list.innerHTML = '<p class="empty-state">No pending edits</p>';
            return;
        }
        
        list.innerHTML = edits.map(edit => createPendingEditCard(edit)).join('');
        
    } catch (error) {
        console.error('Error loading pending edits:', error);
        list.innerHTML = '<p class="error-state">Failed to load pending edits</p>';
    }
}

// Create pending edit card
function createPendingEditCard(edit) {
    return `
        <div class="pending-card" data-status="${edit.status}">
            <div class="card-header">
                <div>
                    <h3 class="card-title">${edit.edit_type} - ${edit.table_name}</h3>
                    <p class="card-meta">Submitted ${formatDate(edit.submitted_at)}</p>
                </div>
                ${edit.status === 'pending' ? `
                    <div class="card-actions">
                        <button class="btn-icon success" onclick="approveEdit('${edit.id}')" title="Approve">
                            ✓
                        </button>
                        <button class="btn-icon danger" onclick="denyEdit('${edit.id}')" title="Deny">
                            ✗
                        </button>
                    </div>
                ` : `
                    <span class="badge">${edit.status}</span>
                `}
            </div>
            <div class="edit-diff">
                ${edit.old_data ? `<div class="diff-old">Old: ${JSON.stringify(edit.old_data, null, 2)}</div>` : ''}
                <div class="diff-new">New: ${JSON.stringify(edit.new_data, null, 2)}</div>
            </div>
        </div>
    `;
}

// Approve edit
async function approveEdit(editId) {
    try {
        await fetchAPI(`/admin/pending-edits/${editId}/approve`, {
            method: 'POST'
        });
        
        showNotification('Edit approved', 'success');
        loadPendingEdits();
        
    } catch (error) {
        console.error('Error approving edit:', error);
        showNotification('Failed to approve edit', 'error');
    }
}

// Deny edit
async function denyEdit(editId) {
    try {
        await fetchAPI(`/admin/pending-edits/${editId}/deny`, {
            method: 'POST'
        });
        
        showNotification('Edit denied', 'success');
        loadPendingEdits();
        
    } catch (error) {
        console.error('Error denying edit:', error);
        showNotification('Failed to deny edit', 'error');
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
                <div class="card-header">
                    <div>
                        <h3 class="card-title">${char.name}</h3>
                        <p class="card-meta">${char.family} | ${char.nickname || 'No alias'}</p>
                    </div>
                    <div class="card-actions">
                        <button class="btn-icon" onclick="editCharacter('${char.id}')" title="Edit">
                            ✏️
                        </button>
                        <button class="btn-icon danger" onclick="deleteCharacter('${char.id}')" title="Delete">
                            🗑️
                        </button>
                    </div>
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
                <div class="card-header">
                    <div>
                        <h3 class="card-title">${event.title}</h3>
                        <p class="card-meta">${formatDate(event.event_date)} | ${event.era}</p>
                    </div>
                    <div class="card-actions">
                        <button class="btn-icon" onclick="editEvent('${event.id}')" title="Edit">
                            ✏️
                        </button>
                        <button class="btn-icon danger" onclick="deleteEvent('${event.id}')" title="Delete">
                            🗑️
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
        
    } catch (error) {
        console.error('Error loading events:', error);
        list.innerHTML = '<p class="error-state">Failed to load events</p>';
    }
}

// Load relationships list
async function loadRelationshipsList() {
    const list = document.getElementById('relationships-admin-list');
    list.innerHTML = '<p class="empty-state">Relationships management coming soon</p>';
}

// Load gallery list
async function loadGalleryList() {
    const list = document.getElementById('gallery-admin-list');
    list.innerHTML = '<p class="empty-state">Gallery management coming soon</p>';
}

// Character form functions
function openCharacterForm(characterId = null) {
    openModal('character-modal');
    
    if (characterId) {
        // Load character data for editing
        loadCharacterForEdit(characterId);
    } else {
        // Reset form for new character
        document.getElementById('character-form').reset();
        document.getElementById('character-form-title').textContent = 'Add New Character';
    }
}

function closeCharacterForm() {
    closeModal('character-modal');
}

async function loadCharacterForEdit(characterId) {
    try {
        const data = await fetchAPI(`/characters/${characterId}`);
        const char = data.character;
        
        document.getElementById('character-form-title').textContent = 'Edit Character';
        
        // Populate form fields
        const form = document.getElementById('character-form');
        form.elements.name.value = char.name || '';
        form.elements.nickname.value = char.nickname || '';
        form.elements.full_name.value = char.full_name || '';
        form.elements.birthday.value = char.birthday || '';
        form.elements.family.value = char.family || '';
        form.elements.quote.value = char.quote || '';
        form.elements.color_primary.value = char.color_primary || '#3b82f6';
        form.elements.color_secondary.value = char.color_secondary || '#1d4ed8';
        form.elements.color_accent.value = char.color_accent || '#8b5cf6';
        form.elements.color_bg.value = char.color_bg || '#0a0a0a';
        
        form.dataset.characterId = characterId;
        
    } catch (error) {
        console.error('Error loading character:', error);
        showNotification('Failed to load character', 'error');
    }
}

// Handle character form submission
document.getElementById('character-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const form = e.target;
    const characterId = form.dataset.characterId;
    const formData = new FormData(form);
    
    try {
        const method = characterId ? 'PUT' : 'POST';
        const endpoint = characterId ? `/characters/${characterId}` : '/characters';
        
        await fetchAPI(endpoint, {
            method,
            body: formData
        });
        
        showNotification(`Character ${characterId ? 'updated' : 'created'} successfully`, 'success');
        closeCharacterForm();
        loadCharactersList();
        
    } catch (error) {
        console.error('Error saving character:', error);
        showNotification('Failed to save character', 'error');
    }
});

// Event form functions
function openEventForm(eventId = null) {
    openModal('event-modal');
    
    if (eventId) {
        loadEventForEdit(eventId);
    } else {
        document.getElementById('event-form').reset();
        document.getElementById('event-form-title').textContent = 'Add Timeline Event';
    }
    
    // Load characters for multi-select
    loadCharactersForSelect();
}

function closeEventForm() {
    closeModal('event-modal');
}

async function loadCharactersForSelect() {
    const container = document.getElementById('character-select');
    
    try {
        const data = await fetchAPI('/characters');
        const characters = data.characters || [];
        
        container.innerHTML = characters.map(char => `
            <div class="select-item" data-character-id="${char.id}">
                ${char.name}
            </div>
        `).join('');
        
        // Setup click handlers
        container.querySelectorAll('.select-item').forEach(item => {
            item.addEventListener('click', () => {
                item.classList.toggle('selected');
            });
        });
        
    } catch (error) {
        console.error('Error loading characters:', error);
    }
}

// Handle event form submission
document.getElementById('event-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const form = e.target;
    const eventId = form.dataset.eventId;
    const formData = new FormData(form);
    
    // Get selected characters
    const selectedCharacters = Array.from(document.querySelectorAll('.select-item.selected'))
        .map(item => item.dataset.characterId);
    
    formData.append('character_ids', JSON.stringify(selectedCharacters));
    
    try {
        const method = eventId ? 'PUT' : 'POST';
        const endpoint = eventId ? `/timeline/${eventId}` : '/timeline';
        
        await fetchAPI(endpoint, {
            method,
            body: formData
        });
        
        showNotification(`Event ${eventId ? 'updated' : 'created'} successfully`, 'success');
        closeEventForm();
        loadEventsList();
        
    } catch (error) {
        console.error('Error saving event:', error);
        showNotification('Failed to save event', 'error');
    }
});

// Upload form functions
function openUploadForm() {
    openModal('upload-modal');
    loadCharactersForUpload();
    loadEventsForUpload();
}

function closeUploadForm() {
    closeModal('upload-modal');
}

async function loadCharactersForUpload() {
    const select = document.querySelector('#upload-form select[name="character_id"]');
    
    try {
        const data = await fetchAPI('/characters');
        const characters = data.characters || [];
        
        select.innerHTML = '<option value="">Select Character</option>' +
            characters.map(char => `<option value="${char.id}">${char.name}</option>`).join('');
        
    } catch (error) {
        console.error('Error loading characters:', error);
    }
}

async function loadEventsForUpload() {
    const select = document.querySelector('#upload-form select[name="event_id"]');
    
    try {
        const data = await fetchAPI('/timeline');
        const events = data.events || [];
        
        select.innerHTML = '<option value="">None</option>' +
            events.map(event => `<option value="${event.id}">${event.title}</option>`).join('');
        
    } catch (error) {
        console.error('Error loading events:', error);
    }
}

// Image preview
document.querySelector('#upload-form input[type="file"]')?.addEventListener('change', (e) => {
    const files = e.target.files;
    const preview = document.getElementById('image-preview');
    preview.innerHTML = '';
    
    Array.from(files).forEach((file, index) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const div = document.createElement('div');
            div.className = 'preview-item';
            div.innerHTML = `
                <img src="${e.target.result}" alt="Preview ${index + 1}">
                <button type="button" class="preview-remove" onclick="removePreview(this, ${index})">×</button>
            `;
            preview.appendChild(div);
        };
        reader.readAsDataURL(file);
    });
});

function removePreview(btn, index) {
    btn.closest('.preview-item').remove();
}

// Delete functions
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

// Wrapper functions for editing
function editCharacter(id) {
    openCharacterForm(id);
}

function editEvent(id) {
    openEventForm(id);
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    setupSectionNav();
});
