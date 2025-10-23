// Counter for dynamically generated markdown editors to ensure unique IDs
let bioSectionCounter = 0;

document.addEventListener('DOMContentLoaded', () => {
    // Check for login token first, then setup page
    if (localStorage.getItem('admin_token')) {
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('dashboard').style.display = 'block';
        setupDashboard();
        handleUrlParameters(); // Handle deep links for editing
    } else {
        setupLogin();
    }

    // Setup forms regardless of login state
    setupCharacterForm();
    setupEventForm();
    setupRelationshipForm();
    setupEditRelationshipForm();
    populateFamilyDropdown();
});

// Handle direct links to edit items from profile pages
function handleUrlParameters() {
    const params = new URLSearchParams(window.location.search);
    const editType = params.get('edit');
    const id = params.get('id');

    if (!editType) return;

    switch(editType) {
        case 'character':
            if (id) {
                document.querySelector('.sidebar-btn[data-section="characters"]').click();
                editCharacter(id);
            }
            break;
        case 'event':
            if (id) {
                document.querySelector('.sidebar-btn[data-section="timeline"]').click();
                editEvent(id);
            }
            break;
        case 'relationship':
            const char1 = params.get('char1');
            const char2 = params.get('char2');
            if (char1 && char2) {
                document.querySelector('.sidebar-btn[data-section="relationships"]').click();
                editRelationship(char1, char2);
            }
            break;
    }
}

// Helper to handle API responses and show proper errors
async function handleFormSubmitResponse(response) {
    if (response.ok || (response.status >= 200 && response.status < 300)) {
        try {
            return await response.json();
        } catch (e) {
            return {}; // Handle cases with no JSON body (e.g., 204 No Content)
        }
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
            
            if (result.access_token) {
                localStorage.setItem('admin_token', result.access_token);
                document.getElementById('login-screen').style.display = 'none';
                document.getElementById('dashboard').style.display = 'block';
                setupDashboard();
            } else {
                 errorMsg.textContent = result.message || 'Invalid username or password';
            }
        } catch (error) {
            errorMsg.textContent = 'Login failed. Please try again.';
        }
    });
}

function setupDashboard() {
    const logoutBtn = document.getElementById('logout-btn');
    
    logoutBtn?.addEventListener('click', async () => {
        localStorage.removeItem('admin_token');
        location.reload();
    });
    
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
    // Load default section
    loadSection('pending');
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
                    <p>${char.family?.name || 'Unknown'} • ${char.nickname || 'No alias'}</p>
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
        const uniquePairs = new Map();
        relationships.forEach(rel => {
            const charIds = [rel.character_id, rel.related_character_id].sort();
            const pairKey = charIds.join('-');
            if (!uniquePairs.has(pairKey)) {
                uniquePairs.set(pairKey, rel);
            }
        });
        list.innerHTML = Array.from(uniquePairs.values()).map(rel => `
            <div class="admin-item">
                <div class="admin-item-info">
                    <h4>${rel.character.name} & ${rel.related_character.name}</h4>
                    <p>Type: ${rel.type} • Status: ${rel.status}</p>
                </div>
                <div class="admin-item-actions">
                    <button onclick="editRelationship(${rel.character_id}, ${rel.related_character_id})" class="btn-secondary btn-sm">Edit</button>
                    <button onclick="deleteRelationship(${rel.character_id}, ${rel.related_character_id})" class="btn-danger btn-sm">Delete</button>
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
    const familySelect = document.querySelector('#character-form select[name="family_id"]');
    if (!familySelect) return;

    try {
        const families = await fetchAPI('/families');
        familySelect.innerHTML = '<option value="">None</option>' + families.map(family => 
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
        
        const bioContainer = document.getElementById('bio-sections-container');
        bioContainer.innerHTML = '';
        bioSectionCounter = 0; // Reset counter before adding sections for editing
        if (character.bio_sections) {
            character.bio_sections.sort((a,b) => a.display_order - b.display_order);
            character.bio_sections.forEach(section => addBioSectionRow(section));
        }

        document.getElementById('character-form-title').textContent = 'Edit Character';
        openCharacterForm();
    } catch (error) {
        showNotification('Could not load character data.', 'error');
    }
}

async function deleteCharacter(id) {
    if (confirm('Are you sure you want to delete this character? This is permanent.')) {
        try {
            await fetchAPI(`/admin/characters/${id}`, { method: 'DELETE' });
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
        const charIds = event.characters?.map(c => c.id.toString()) || [];
        Array.from(charSelect.options).forEach(opt => opt.selected = charIds.includes(opt.value));
        
        // Trigger input event for markdown preview to update
        document.getElementById('event-description')?.dispatchEvent(new Event('input'));

        document.getElementById('event-form-title').textContent = 'Edit Event';
        openEventForm();
    } catch (error) {
        showNotification('Could not load event data.', 'error');
    }
}

async function deleteEvent(id) {
    if (confirm('Are you sure you want to delete this event? This is permanent.')) {
        try {
            await fetchAPI(`/admin/events/${id}`, { method: 'DELETE' });
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
    document.getElementById('bio-sections-container').innerHTML = '';
    document.getElementById('character-form-title').textContent = 'Add New Character';
    bioSectionCounter = 0; // Reset counter for the next time the form is opened
    closeModal('character-modal');
}

function openEventForm() { openModal('event-modal'); }
function closeEventForm() {
    const form = document.getElementById('event-form');
    form?.reset();
    form?.querySelector('input[name="id"]')?.remove();
    document.getElementById('event-form-title').textContent = 'Add New Event';
    // Manually trigger input on markdown fields to clear previews
    document.getElementById('event-description')?.dispatchEvent(new Event('input'));
    closeModal('event-modal');
}

function openUploadForm() { openModal('upload-modal'); }
function closeUploadForm() { closeModal('upload-modal'); }

function addBioSectionRow(section = {}) {
    const container = document.getElementById('bio-sections-container');
    const uniqueId = bioSectionCounter++; // Use counter to ensure unique IDs

    const div = document.createElement('div');
    div.className = 'form-row bio-section-row';
    
    // Create unique IDs for the markdown editor, toolbar, and preview
    const textareaId = `bio-section-content-${uniqueId}`;
    const toolbarId = `bio-section-toolbar-${uniqueId}`;
    const previewId = `bio-section-preview-${uniqueId}`;

    div.innerHTML = `
        <input type="hidden" class="bio-section-id" value="${section.id || ''}">
        <div class="form-group" style="flex: 1;">
            <label>Section Title</label>
            <input type="text" class="bio-section-title" value="${section.section_title || ''}" placeholder="e.g., Powers and Abilities">
        </div>
        <div class="form-group" style="flex-basis: 100%; width: 100%;">
            <label for="${textareaId}">Content (Markdown)</label>
            <div id="${toolbarId}" class="markdown-toolbar"></div>
            <textarea id="${textareaId}" class="bio-section-content" rows="4" placeholder="Describe the section content here...">${section.content || ''}</textarea>
            <div id="${previewId}" class="markdown-preview admin-preview"></div>
        </div>
        <button type="button" class="btn-danger btn-sm remove-bio-section-btn" title="Remove Section">×</button>
    `;
    div.querySelector('.remove-bio-section-btn').addEventListener('click', () => div.remove());
    container.appendChild(div);

    // Setup markdown editor for the new section
    if (typeof setupMarkdownToolbar === 'function' && typeof setupMarkdownPreview === 'function') {
        setupMarkdownToolbar(textareaId, toolbarId);
        setupMarkdownPreview(textareaId, previewId);
    }
}

function setupCharacterForm() {
    const form = document.getElementById('character-form');
    if (!form) return;
    document.getElementById('add-bio-section-btn')?.addEventListener('click', () => addBioSectionRow());
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(form);
        const bioSections = [];
        document.querySelectorAll('.bio-section-row').forEach((row, index) => {
            const title = row.querySelector('.bio-section-title').value;
            const content = row.querySelector('.bio-section-content').value;
            if (title.trim() && content.trim()) {
                bioSections.push({ 
                    id: row.querySelector('.bio-section-id').value || null,
                    section_title: title, 
                    content: content,
                    display_order: index 
                });
            }
        });
        formData.append('bio_sections', JSON.stringify(bioSections));
        const id = formData.get('id');
        const url = id ? `/admin/characters/${id}` : '/admin/characters';
        const method = id ? 'PUT' : 'POST';
        try {
            const result = await fetchAPI(url, {
                method,
                body: formData,
                isFormData: true
            });
            showNotification(`Character ${id ? 'updated' : 'created'} successfully!`, 'success');
            closeCharacterForm();
            loadCharactersAdmin();
        } catch (error) {
            showNotification(error.message, 'error');
        }
    });
}

async function setupEventForm() {
    const form = document.getElementById('event-form');
    if (!form) return;

    // Setup markdown editor for the event description field.
    // This assumes the HTML contains <textarea id="event-description"> and related elements.
    if (document.getElementById('event-description') && typeof setupMarkdownToolbar === 'function') {
        setupMarkdownToolbar('event-description', 'event-description-toolbar');
        setupMarkdownPreview('event-description', 'event-description-preview');
    }

    const charSelect = document.getElementById('event-characters');
    try {
        const characters = await fetchAPI('/characters');
        charSelect.innerHTML = characters.map(c => `<option value="${c.id}">${c.full_name}</option>`).join('');
    } catch (e) { console.error('Failed to load characters for event form'); }
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(form);
        const selectedIds = Array.from(charSelect.selectedOptions).map(opt => opt.value);
        formData.set('character_ids', JSON.stringify(selectedIds));
        const id = formData.get('id');
        const url = id ? `/admin/events/${id}` : '/admin/events';
        const method = id ? 'PUT' : 'POST';
        try {
            await fetchAPI(url, {
                method,
                body: formData,
                isFormData: true
            });
            showNotification(`Event ${id ? 'updated' : 'created'} successfully!`, 'success');
            closeEventForm();
            loadTimelineAdmin();
        } catch (error) {
            showNotification(error.message, 'error');
        }
    });
}

function populateForm(form, data) {
    for (const key in data) {
        const field = form.elements[key];
        if (field) {
            if (field.type === 'checkbox') field.checked = !!data[key];
            else if (field.type !== 'file') field.value = data[key] || '';
        } else if (key === 'family' && data[key]) {
            // Handle nested family object
            const familyField = form.elements['family_id'];
            if (familyField) familyField.value = data[key].slug;
        }
    }
}

function openRelationshipForm() { openModal('relationship-modal'); }
function closeRelationshipForm() { closeModal('relationship-modal'); }

async function setupRelationshipForm() {
    const form = document.getElementById('relationship-form');
    if (!form) return;
    const char1Select = form.querySelector('select[name="character_id"]');
    const char2Select = form.querySelector('select[name="related_character_id"]');
    try {
        const characters = await fetchAPI('/characters');
        const options = characters.map(c => `<option value="${c.id}">${c.full_name}</option>`).join('');
        char1Select.innerHTML = options;
        char2Select.innerHTML = options;
    } catch (e) { console.error('Failed to load characters for relationship form'); }
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(form).entries());
        if (data.character_id === data.related_character_id) {
            showNotification('A character cannot be in a relationship with themselves.', 'error');
            return;
        }
        try {
            const response = await fetchAPI('/admin/relationships', { method: 'POST', body: JSON.stringify(data) });
            showNotification('Relationship created successfully!', 'success');
            closeRelationshipForm();
            form.reset();
            loadRelationshipsAdmin();
        } catch (error) {
            showNotification(error.message, 'error');
        }
    });
}

async function deleteRelationship(char1Id, char2Id) {
    if (confirm('Are you sure you want to delete this relationship? This will remove it for both characters.')) {
        try {
            await fetchAPI(`/admin/relationships/${char1Id}/${char2Id}`, { method: 'DELETE' });
            showNotification('Relationship deleted successfully', 'success');
            loadRelationshipsAdmin();
        } catch (error) {
            showNotification('Failed to delete relationship', 'error');
        }
    }
}

async function editRelationship(char1Id, char2Id) {
    try {
        const { a_to_b, b_to_a } = await fetchAPI(`/admin/relationships/${char1Id}/${char2Id}`);
        const form = document.getElementById('edit-relationship-form');
        form.elements['character_id'].value = char1Id;
        form.elements['related_character_id'].value = char2Id;
        form.elements['character_1_name'].value = a_to_b.character.full_name;
        form.elements['character_2_name'].value = b_to_a.character.full_name;
        form.elements['type'].value = a_to_b.type;
        form.elements['status_a_to_b'].value = a_to_b.status || '';
        form.elements['status_b_to_a'].value = b_to_a.status || '';
        document.getElementById('edit-status-a-to-b-label').textContent = `${a_to_b.character.name} thinks of ${b_to_a.character.name} as a`;
        document.getElementById('edit-status-b-to-a-label').textContent = `${b_to_a.character.name} thinks of ${a_to_b.character.name} as a`;
        openModal('edit-relationship-modal');
    } catch (error) {
        showNotification('Could not load relationship data.', 'error');
    }
}

function setupEditRelationshipForm() {
    const form = document.getElementById('edit-relationship-form');
    if (!form) return;
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = Object.fromEntries(new FormData(form).entries());
        try {
            await fetchAPI('/admin/relationships', { method: 'PATCH', body: JSON.stringify(data) });
            showNotification('Relationship updated successfully!', 'success');
            closeModal('edit-relationship-modal');
            loadRelationshipsAdmin();
        } catch (error) {
            showNotification(error.message, 'error');
        }
    });
}
