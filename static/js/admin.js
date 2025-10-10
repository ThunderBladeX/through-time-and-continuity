// Admin dashboard functionality

document.addEventListener('DOMContentLoaded', () => {
    setupLogin();
    setupDashboard();
});

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
            // Update active state
            sidebarBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // Show corresponding section
            const section = btn.dataset.section;
            document.querySelectorAll('.admin-section').forEach(s => {
                s.classList.remove('active');
            });
            document.getElementById(`${section}-section`).classList.add('active');
            
            // Load section data
            loadSection(section);
        });
    });
}

async function loadDashboard() {
    await loadSection('pending');
}

async function loadSection(section) {
    switch(section) {
        case 'pending':
            await loadPendingEdits();
            break;
        case 'characters':
            await loadCharactersAdmin();
            break;
        case 'timeline':
            await loadTimelineAdmin();
            break;
        case 'relationships':
            await loadRelationshipsAdmin();
            break;
        case 'gallery':
            await loadGalleryAdmin();
            break;
    }
}

async function loadPendingEdits() {
    const list = document.getElementById('pending-list');
    if (!list) return;
    
    list.innerHTML = '<div class="loading-state"><div class="spinner"></div></div>';
    
    try {
        // TODO: Implement backend endpoint for pending edits
        // const edits = await fetchAPI('/admin/pending-edits');
        list.innerHTML = '<p class="empty-state">No pending edits</p>';
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
                <img src="${char.profile_image || '/static/images/default-avatar.jpg'}" 
                     alt="${char.full_name || char.name}" 
                     class="admin-item-image"
                     onerror="this.src='/static/images/default-avatar.jpg'">
                <div class="admin-item-info">
                    <h4>${char.full_name || char.name}</h4>
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
                    <p>${event.era_display || event.era} • ${formatDate(event.event_date)}</p>
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
        // TODO: Implement backend endpoint for all relationships
        // const relationships = await fetchAPI('/admin/relationships');
        list.innerHTML = '<p class="empty-state">No relationships yet</p>';
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
        // TODO: Implement backend endpoint for all gallery images
        // const images = await fetchAPI('/admin/gallery');
        list.innerHTML = '<p class="empty-state">No images yet</p>';
    } catch (error) {
        console.error('Error loading gallery:', error);
        list.innerHTML = '<p class="error-state">Failed to load gallery</p>';
    }
}

// Edit/Delete functions (to be implemented)
function editCharacter(id) {
    console.log('Edit character:', id);
    showNotification('Edit functionality coming soon', 'info');
}

function deleteCharacter(id) {
    if (confirm('Are you sure you want to delete this character?')) {
        console.log('Delete character:', id);
        showNotification('Delete functionality coming soon', 'info');
    }
}

function editEvent(id) {
    console.log('Edit event:', id);
    showNotification('Edit functionality coming soon', 'info');
}

function deleteEvent(id) {
    if (confirm('Are you sure you want to delete this event?')) {
        console.log('Delete event:', id);
        showNotification('Delete functionality coming soon', 'info');
    }
}

// Form handling functions (to be implemented)
function openCharacterForm() {
    openModal('character-modal');
}

function closeCharacterForm() {
    closeModal('character-modal');
}

function openEventForm() {
    openModal('event-modal');
}

function closeEventForm() {
    closeModal('event-modal');
}

function openUploadForm() {
    openModal('upload-modal');
}

function closeUploadForm() {
    closeModal('upload-modal');
}

function setupCharacterForm() {
    const charForm = document.getElementById('character-form');
    if (!charForm) return;

    charForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Use FormData to handle file uploads
        const formData = new FormData(charForm);
        
        try {
            const response = await fetch('/api/admin/characters', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to create character');
            }

            const newCharacter = await response.json();
            showNotification('Character created successfully!', 'success');
            closeCharacterForm();
            loadCharactersAdmin(); // Reload the list to show the new character

        } catch (error) {
            console.error('Error creating character:', error);
            showNotification(error.message, 'error');
        }
    });
}
