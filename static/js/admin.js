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
            const result = await fetchAPI('/api/login', {
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
            await fetchAPI('/api/logout', { method: 'POST' });
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
    list.innerHTML = '<p>No pending edits</p>';
}

async function loadCharactersAdmin() {
    const list = document.getElementById('characters-list');
    list.innerHTML = '<p>No characters yet</p>';
}

async function loadTimelineAdmin() {
    const list = document.getElementById('events-list');
    list.innerHTML = '<p>No events yet</p>';
}

async function loadRelationshipsAdmin() {
    const list = document.getElementById('relationships-admin-list');
    list.innerHTML = '<p>No relationships yet</p>';
}

async function loadGalleryAdmin() {
    const list = document.getElementById('gallery-admin-list');
    list.innerHTML = '<p>No images yet</p>';
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
