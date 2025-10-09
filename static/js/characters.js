let allCharacters = [];
let currentFilter = 'all';

// Load all characters
async function loadCharacters() {
    const grid = document.getElementById('character-grid');
    if (!grid) return;
    
    try {
        const data = await fetchAPI('/characters');
        allCharacters = data.characters || [];
        
        if (allCharacters.length === 0) {
            grid.innerHTML = `
                <div class="empty-state">
                    <h3>No Characters Yet</h3>
                    <p>Check back later for character profiles.</p>
                </div>
            `;
            return;
        }
        
        renderCharacters(allCharacters);
        
    } catch (error) {
        console.error('Error loading characters:', error);
        grid.innerHTML = `
            <div class="error-state">
                <h3>Error Loading Characters</h3>
                <p>Please try again later.</p>
            </div>
        `;
    }
}

// Render character cards
function renderCharacters(characters) {
    const grid = document.getElementById('character-grid');
    grid.innerHTML = '';
    
    if (characters.length === 0) {
        grid.innerHTML = `
            <div class="empty-state">
                <h3>No Characters Found</h3>
                <p>Try a different filter.</p>
            </div>
        `;
        return;
    }
    
    characters.forEach(character => {
        const card = createCharacterCard(character);
        grid.appendChild(card);
    });
}

// Create character card
function createCharacterCard(character) {
    const card = document.createElement('div');
    card.className = 'character-card';
    card.onclick = () => {
        window.location.href = `/profile.html?id=${character.id}`;
    };
    
    card.innerHTML = `
        <img src="${character.profile_image_url}" 
             alt="${character.name}" 
             class="character-card-image"
             loading="lazy">
        <div class="character-card-overlay">
            <h3 class="character-card-name">${character.name}</h3>
            ${character.nickname ? `
                <p class="character-card-nickname">${character.nickname}</p>
            ` : ''}
            <span class="character-card-family">${character.family}</span>
        </div>
    `;
    
    return card;
}

// Setup filter buttons
function setupFilters() {
    const filterButtons = document.querySelectorAll('.filter-btn');
    
    filterButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            // Update active state
            filterButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // Get filter value
            const family = btn.dataset.family;
            currentFilter = family;
            
            // Filter and render
            filterCharacters(family);
        });
    });
}

// Filter characters by family
function filterCharacters(family) {
    if (family === 'all') {
        renderCharacters(allCharacters);
    } else {
        const filtered = allCharacters.filter(char => char.family === family);
        renderCharacters(filtered);
    }
}

// Search functionality (if added later)
function setupSearch() {
    const searchInput = document.getElementById('character-search');
    if (!searchInput) return;
    
    searchInput.addEventListener('input', debounce((e) => {
        const query = e.target.value.toLowerCase();
        
        let filtered = allCharacters;
        
        // Apply family filter
        if (currentFilter !== 'all') {
            filtered = filtered.filter(char => char.family === currentFilter);
        }
        
        // Apply search
        if (query) {
            filtered = filtered.filter(char => 
                char.name.toLowerCase().includes(query) ||
                (char.nickname && char.nickname.toLowerCase().includes(query)) ||
                (char.full_name && char.full_name.toLowerCase().includes(query))
            );
        }
        
        renderCharacters(filtered);
    }, 300));
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    setupFilters();
    setupSearch();
    loadCharacters();
});
