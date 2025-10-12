document.addEventListener('DOMContentLoaded', () => {
    setupLogin();
    setupDashboard();
    setupCharacterForm();
    setupEventForm();
});

// Helper to handle API responses and show proper errors
async function handleFormSubmitResponse(response, successType) {
    if (response.ok) {
        return await response.json();
    }
    // If response is not OK, try to get a meaningful error message
    const contentType = response.headers.get('content-type');
    let error;
    if (contentType && contentType.includes('application/json')) {
        const errorJson = await response.json();
        error = new Error(errorJson.error || 'An unknown error occurred.');
    } else {
        const errorText = await response.text();
        error = new Error(`Server returned an error: ${errorText.substring(0, 200)}...`);
    }
    throw error;
}

function setupLogin() {
    const loginForm = document.getElementById('login-form');
    
    loginForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        const errorMsg = document.getElementById('login-error');
        
        try {
            const result = await fetchAPI('/login', {
                method: 'POST',
                body: JSON.stringify({ username, password })
            });
            
            if (result.success) {
                document.getElementById('login-screen').style.display = 'none';
                document.getElementById('dashboard').style.display = 'block';
                loadDashboard();
            }
        } catch (error) {
            errorMsg.textContent = 'Invalid username or password';
        }
    });
}

function setupDashboard() {
    const logoutBtn = document.getElementById('logout-btn');
    
    logoutBtn?.addEventListener('click', async () => {
        try {
            await fetchAPI('/logout', { method: 'POST' });
            location.reload();
        } catch (error) {
            console.error('Logout failed:', error);
        }
    });
    
    // Setup sidebar navigation
    const sidebarBtns = document.querySelectorAll('.sidebar-btn');
    
    sidebarBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            sidebarBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            const section = btn.dataset.section;
            document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
            document.getElementById(`${section}-section`).classList.add('active');
            
            loadSection(section);
        });
    });
}

async function loadDashboard() {
    await loadSection('pending');
}

async function loadSection(section) {
    switch(section) {
        case 'pending': await loadPendingEdits(); break;
        case 'characters': await loadCharactersAdmin(); break;
        case 'timeline': await loadTimelineAdmin(); break;
        case 'relationships': await loadRelationshipsAdmin(); break;
        case 'gallery': await loadGalleryAdmin(); break;
    }
}

async function loadPendingEdits() {
    const list = document.getElementById('pending-list');
    if (!list) return;
    list.innerHTML = '<div class="loading-state"><div class="spinner"></div></div>';
    
    try {
        const edits = await fetchAPI('/admin/pending-edits');
        if (!edits || edits.length === 0) {
            list.innerHTML = '<p class="empty-state">No pending edits</p>';
            return;
        }
        list.innerHTML = edits.map(edit => `
            <div class="admin-item">
                <div class="admin-item-info">
                    <h4>Edit for ${edit.table_name} #${edit.record_id}</h4>
                    <p><strong>Field:</strong> ${edit.field_name}</p>
                    <p><strong>Old:</strong> ${edit.old_value || 'N/A'}</p>
                    <p><strong>New:</strong> ${edit.new_value}</p>
                </div>
                <div class="admin-item-actions">
                    <button onclick="approveEdit(${edit.id})" class="btn-success btn-sm">Approve</button>
                    <button onclick="denyEdit(${edit.id})" class="btn-danger btn-sm">Deny</button>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading pending edits:', error);
        list.innerHTML = '<p class="error-state">Failed to load pending edits</p>';
    }
}

async function loadCharactersAdmin() {
    const list = document.getElementById('characters-list');
    if (!list) return;
    list.innerHTML = '<div class="loading-state"><div class="spinner"></div></div>';
    
    try {
        const characters = await fetchAPI('/characters');
        if (!characters || characters.length === 0) {
            list.innerHTML = '<p class="empty-state">No characters yet</p>';
            return;
        }
        list.innerHTML = characters.map(char => `
            <div class="admin-item">
                <img src="${char.profile_image || '/static/images/default-avatar.jpg'}" alt="${char.full_name}" class="admin-item-image" onerror="this.src='/static/images/default-avatar.jpg'">
                <div class="admin-item-info">
                    <h4>${char.full_name}</h4>
                    <p>${char.family || 'Unknown'} • ${char.nickname || 'No alias'}</p>
                </div>
                <div class="admin-item-actions">
                    <button onclick="editCharacter(${char.id})" class="btn-secondary btn-sm">Edit</button>
                    <button onclick="deleteCharacter(${char.id})" class="btn-danger btn-sm">Delete</button>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading characters:', error);
        list.innerHTML = '<p class="error-state">Failed to load characters</p>';
    }
}

async function loadTimelineAdmin() {
    const list = document.getElementById('events-list');
    if (!list) return;
    list.innerHTML = '<div class="loading-state"><div class="spinner"></div></div>';
    
    try {
        const events = await fetchAPI('/events?limit=20');
        if (!events || events.length === 0) {
            list.innerHTML = '<p class="empty-state">No events yet</p>';
            return;
        }
        list.innerHTML = events.map(event => `
            <div class="admin-item">
                <div class="admin-item-info">
                    <h4>${event.title}</h4>
                    <p>${event.era_display} • ${formatDate(event.event_date)}</p>
                    <p class="text-sm">${event.summary || ''}</p>
                </div>
                <div class="admin-item-actions">
                    <button onclick="editEvent(${event.id})" class="btn-secondary btn-sm">Edit</button>
                    <button onclick="deleteEvent(${event.id})" class="btn-danger btn-sm">Delete</button>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading events:', error);
        list.innerHTML = '<p class="error-state">Failed to load events</p>';
    }
}

async function loadRelationshipsAdmin() {
    const list = document.getElementById('relationships-admin-list');
    if (!list) return;
    list.innerHTML = '<div class="loading-state"><div class="spinner"></div></div>';
    
    try {
        const relationships = await fetchAPI('/admin/relationships');
        if (!relationships || relationships.length === 0) {
            list.innerHTML = '<p class="empty-state">No relationships yet</p>';
            return;
        }
        list.innerHTML = relationships.map(rel => `
            <div class="admin-item">
                <div class="admin-item-info">
                    <h4>${rel.character.full_name} & ${rel.related_character.full_name}</h4>
                    <p>Type: ${rel.type} • Status: ${rel.status}</p>
                </div>
                <div class="admin-item-actions">
                    <button class="btn-secondary btn-sm disabled" disabled>Edit</button>
                    <button class="btn-danger btn-sm disabled" disabled>Delete</button>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading relationships:', error);
        list.innerHTML = '<p class="error-state">Failed to load relationships</p>';
    }
}

async function loadGalleryAdmin() {
    const list = document.getElementById('gallery-admin-list');
    if (!list) return;
    list.innerHTML = '<div class="loading-state"><div class="spinner"></div></div>';
    
    try {
        const images = await fetchAPI('/admin/gallery');
        if (!images || images.length === 0) {
            list.innerHTML = '<p class="empty-state">No images yet</p>';
            return;
        }
        list.innerHTML = images.map(img => `
            <div class="admin-item">
                <img src="${img.image_url}" alt="${img.alt_text}" class="admin-item-image">
                <div class="admin-item-info">
                    <h4>${img.alt_text || 'Untitled'}</h4>
                    <p>Character: ${img.character.full_name || 'Unknown'}</p>
                </div>
                <div class="admin-item-actions">
                    <button class="btn-secondary btn-sm disabled" disabled>Edit</button>
                    <button class="btn-danger btn-sm disabled" disabled>Delete</button>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading gallery:', error);
        list.innerHTML = '<p class="error-state">Failed to load gallery</p>';
    }
}

async function populateFamilyDropdown() {
    const familySelect = document.querySelector('#character-form select[name="family"]');
    if (!familySelect) return;

    try {
        const families = await fetchAPI('/families');
        familySelect.innerHTML = families.map(family => 
            `<option value="${family.slug}">${family.name}</option>`
        ).join('');
    } catch (error) {
        console.error('Failed to load families for dropdown:', error);
        familySelect.innerHTML = '<option value="">Error loading families</option>';
    }
}

// Edit/Delete/Approve/Deny functions
async function editCharacter(id) {
    try {
        const character = await fetchAPI(`/characters/${id}`);
        const form = document.getElementById('character-form');
        form.querySelector('input[name="id"]')?.remove();
        form.insertAdjacentHTML('beforeend', `<input type="hidden" name="id" value="${id}">`);
        populateForm(form, character);
        document.getElementById('character-form-title').textContent = 'Edit Character';
        openCharacterForm();
    } catch (error) {
        showNotification('Could not load character data.', 'error');
    }
}

async function deleteCharacter(id) {
    if (confirm('Are you sure you want to delete this character? This is permanent.')) {
        try {
            await fetch(`/api/admin/characters/${id}`, { method: 'DELETE' });
            showNotification('Character deleted successfully', 'success');
            loadCharactersAdmin();
        } catch (error) {
            showNotification('Failed to delete character', 'error');
        }
    }
}

async function editEvent(id) {
    try {
        const event = await fetchAPI(`/events/${id}`);
        const form = document.getElementById('event-form');
        form.querySelector('input[name="id"]')?.remove();
        form.insertAdjacentHTML('beforeend', `<input type="hidden" name="id" value="${id}">`);
        populateForm(form, event);
        
        const charSelect = document.getElementById('event-characters');
        if (event.event_characters) {
            const charIds = event.event_characters.map(ec => ec.character_id.toString());
            Array.from(charSelect.options).forEach(opt => opt.selected = charIds.includes(opt.value));
        }
        document.getElementById('event-form-title').textContent = 'Edit Event';
        openEventForm();
    } catch (error) {
        showNotification('Could not load event data.', 'error');
    }
}

async function deleteEvent(id) {
    if (confirm('Are you sure you want to delete this event? This is permanent.')) {
        try {
            await fetch(`/api/admin/events/${id}`, { method: 'DELETE' });
            showNotification('Event deleted successfully', 'success');
            loadTimelineAdmin();
        } catch (error) {
            showNotification('Failed to delete event', 'error');
        }
    }
}

async function approveEdit(id) {
    try {
        await fetchAPI(`/admin/pending-edits/${id}`, { method: 'PATCH', body: JSON.stringify({ action: 'approve' }) });
        showNotification('Edit approved', 'success');
        loadPendingEdits();
    } catch (error) {
        showNotification('Failed to approve edit', 'error');
    }
}

async function denyEdit(id) {
    try {
        await fetchAPI(`/admin/pending-edits/${id}`, { method: 'PATCH', body: JSON.stringify({ action: 'deny' }) });
        showNotification('Edit denied', 'success');
        loadPendingEdits();
    } catch (error) {
        showNotification('Failed to deny edit', 'error');
    }
}


// Form handling functions
function openCharacterForm() { openModal('character-modal'); }
function closeCharacterForm() {
    const form = document.getElementById('character-form');
    form?.reset();
    form?.querySelector('input[name="id"]')?.remove();
    document.getElementById('character-form-title').textContent = 'Add New Character';
    closeModal('character-modal');
}

function openEventForm() { openModal('event-modal'); }
function closeEventForm() {
    const form = document.getElementById('event-form');
    form?.reset();
    form?.querySelector('input[name="id"]')?.remove();
    document.getElementById('event-form-title').textContent = 'Add New Event';
    closeModal('event-modal');
}

function openUploadForm() { openModal('upload-modal'); }
function closeUploadForm() { closeModal('upload-modal'); }

function setupCharacterForm() {
    const form = document.getElementById('character-form');
    if (!form) return;
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(form);
        const id = formData.get('id');
        const url = id ? `/api/admin/characters/${id}` : '/api/admin/characters';
        const method = 'POST'; // Using POST for both create and update as per app.py

        try {
            const response = await fetch(url, { method, body: formData });
            await handleFormSubmitResponse(response); // Use the new handler
            showNotification(`Character ${id ? 'updated' : 'created'} successfully!`, 'success');
            closeCharacterForm();
            loadCharactersAdmin();
        } catch (error) {
            console.error('Character form error:', error);
            showNotification(error.message, 'error');
        }
    });
}

async function setupEventForm() {
    const form = document.getElementById('event-form');
    if (!form) return;

    const charSelect = document.getElementById('event-characters');
    try {
        const characters = await fetchAPI('/characters');
        charSelect.innerHTML = characters.map(c => `<option value="${c.id}">${c.full_name}</option>`).join('');
    } catch (e) { console.error('Failed to load characters for event form'); }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(form);
        const selectedIds = Array.from(charSelect.selectedOptions).map(opt => opt.value);
        formData.set('character_ids', selectedIds.join(','));
        const id = formData.get('id');
        const url = id ? `/api/admin/events/${id}` : '/api/admin/events';
        const method = 'POST';

        try {
            const response = await fetch(url, { method, body: formData });
            await handleFormSubmitResponse(response); // Use the new handler
            showNotification(`Event ${id ? 'updated' : 'created'} successfully!`, 'success');
            closeEventForm();
            loadTimelineAdmin();
        } catch (error) {
            console.error('Event form error:', error);
            showNotification(error.message, 'error');
        }
    });
}

// Helper to populate form fields from a data object
function populateForm(form, data) {
    for (const key in data) {
        const field = form.elements[key];
        if (field) {
            if (field.type === 'checkbox') field.checked = !!data[key];
            else if (field.type !== 'file') field.value = data[key] || '';
        }
    }
}
