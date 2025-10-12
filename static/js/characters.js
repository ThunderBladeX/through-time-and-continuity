let allCharacters = [];
let currentFilter = 'all';

// Load all characters
async function loadCharacters() {
    const grid = document.getElementById('character-grid');
    if (!grid) return;
    
    try {
        // Backend returns array directly, not wrapped in object
        const characters = await fetchAPI('/characters');
        allCharacters = characters || [];
        
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
        // Use path params, not query params, and no .html extension
        window.location.href = `/profile/${character.id}`;
    };
    
    // Use correct field names from database
    const displayName = character.name || character.full_name || 'Unknown';
    const imageSrc = character.profile_image || '/static/images/default-avatar.jpg';
    // Use the nested family name, with a fallback to the slug
    const familyName = (character.families && character.families.name) || character.family;
    
    card.innerHTML = `
        <img src="${imageSrc}" 
             alt="${displayName}" 
             class="character-card-image"
             loading="lazy"
             onerror="this.src='/static/images/default-avatar.jpg'">
        <div class="character-card-overlay">
            <h3 class="character-card-name">${displayName}</h3>
            ${character.nickname ? `
                <p class="character-card-nickname">${character.nickname}</p>
            ` : ''}
            <span class="character-card-family">${familyName || 'Other'}</span>
        </div>
    `;
    
    return card;
}

async function buildFilterBar() {
    const filterBar = document.querySelector('.filter-bar');
    if (!filterBar) return;

    try {
        const families = await fetchAPI('/families');
        const familyButtons = families.map(family => 
            `<button class="filter-btn" data-family="${family.slug}">${family.name}</button>`
        ).join('');

        filterBar.innerHTML = `
            <button class="filter-btn active" data-family="all">All</button>
            ${familyButtons}
        `;

        // Now that the buttons exist, set up their click listeners
        setupFilterListeners();
    } catch (error) {
        console.error("Failed to build filter bar:", error);
    }
}

// Setup filter buttons
function setupFilterListeners() {
    const filterButtons = document.querySelectorAll('.filter-bar .filter-btn');

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
        
        // Apply search - use correct field names
        if (query) {
            filtered = filtered.filter(char => 
                (char.full_name && char.full_name.toLowerCase().includes(query)) ||
                (char.name && char.name.toLowerCase().includes(query)) ||
                (char.nickname && char.nickname.toLowerCase().includes(query))
            );
        }
        
        renderCharacters(filtered);
    }, 300));
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    buildFilterBar();
    setupSearch();
    loadCharacters();
});
