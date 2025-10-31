let allCharacters = [];

async function loadCharacters() {
    const grid = document.getElementById('character-grid');
    if (!grid) return;

    try {
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

function renderCharacters(characters) {
    const grid = document.getElementById('character-grid');
    grid.innerHTML = '';

    if (characters.length === 0) {
        grid.innerHTML = `
            <div class="empty-state">
                <h3>No Characters Found</h3>
                <p>Try a different search term.</p>
            </div>
        `;
        return;
    }

    characters.forEach(character => {
        const card = createCharacterCard(character);
        grid.appendChild(card);
    });
}

function createCharacterCard(character) {
    const card = document.createElement('div');
    card.className = 'character-card';
    card.onclick = () => {
        window.location.href = `/profile/${character.id}`;
    };

    const displayName = character.name || character.full_name || 'Unknown';
    const imageSrc = character.profile_image || '/static/images/default-avatar.jpg';
    const familyName = (character.family && character.family.name) || 'Unknown';

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

function setupSearch() {
    const searchInput = document.getElementById('character-search');
    const clearBtn = document.getElementById('clear-search');

    if (!searchInput) return;

    searchInput.addEventListener('input', debounce((e) => {
        const query = e.target.value.toLowerCase().trim();

        if (clearBtn) {
            clearBtn.classList.toggle('visible', query.length > 0);
        }

        if (query) {
            const filtered = allCharacters.filter(char => 
                (char.full_name && char.full_name.toLowerCase().includes(query)) ||
                (char.name && char.name.toLowerCase().includes(query)) ||
                (char.nickname && char.nickname.toLowerCase().includes(query)) ||
                (char.family && char.family.name && char.family.name.toLowerCase().includes(query))
            );
            renderCharacters(filtered);
        } else {
            renderCharacters(allCharacters);
        }
    }, 300));

    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            searchInput.value = '';
            clearBtn.classList.remove('visible');
            renderCharacters(allCharacters);
            searchInput.focus();
        });
    }

    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            searchInput.value = '';
            if (clearBtn) clearBtn.classList.remove('visible');
            renderCharacters(allCharacters);
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    setupSearch();
    loadCharacters();
});
