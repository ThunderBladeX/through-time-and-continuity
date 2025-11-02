import * as THREE from 'three';

const pathParts = window.location.pathname.split('/');
const characterId = pathParts[pathParts.length - 1];
let currentCharacter = null;
let lenis = null;

document.addEventListener('DOMContentLoaded', async () => {

    initSmoothScroll();

    init3DBackground();

    await loadCharacter();

    setupNavigation();
    setupModals();
    setupScrollAnimations();

    if (localStorage.getItem('admin_token')) {
        document.getElementById('admin-edit-btn').style.display = 'flex';
        document.getElementById('admin-edit-btn').onclick = () => {
            window.location.href = `/admin?edit=character&id=${characterId}`;
        };
    }
});

function initSmoothScroll() {
    lenis = new Lenis({
        duration: 1.2,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        orientation: 'vertical',
        gestureOrientation: 'vertical',
        smoothWheel: true,
        wheelMultiplier: 1,
        smoothTouch: false,
        touchMultiplier: 2,
        infinite: false,
    });

    function raf(time) {
        lenis.raf(time);
        requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);

    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => {
        lenis.raf(time * 1000);
    });
    gsap.ticker.lagSmoothing(0);
}

function init3DBackground() {
    const canvas = document.getElementById('bg-canvas');
    if (!canvas) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });

    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    camera.position.z = 5;

    const particlesGeometry = new THREE.BufferGeometry();
    const particlesCount = 2000;
    const posArray = new Float32Array(particlesCount * 3);

    for (let i = 0; i < particlesCount * 3; i++) {
        posArray[i] = (Math.random() - 0.5) * 15;
    }

    particlesGeometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));

    const particlesMaterial = new THREE.PointsMaterial({
        size: 0.02,
        color: 0x3b82f6,
        transparent: true,
        opacity: 0.6,
        blending: THREE.AdditiveBlending,
    });

    const particlesMesh = new THREE.Points(particlesGeometry, particlesMaterial);
    scene.add(particlesMesh);

    const geometry = new THREE.IcosahedronGeometry(1, 0);
    const material = new THREE.MeshBasicMaterial({
        color: 0x3b82f6,
        wireframe: true,
        transparent: true,
        opacity: 0.1,
    });
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    let mouseX = 0;
    let mouseY = 0;
    document.addEventListener('mousemove', (e) => {
        mouseX = (e.clientX / window.innerWidth) * 2 - 1;
        mouseY = -(e.clientY / window.innerHeight) * 2 + 1;
    });

    function animate() {
        requestAnimationFrame(animate);

        particlesMesh.rotation.y += 0.0005;
        particlesMesh.rotation.x += 0.0003;

        mesh.rotation.x += 0.001;
        mesh.rotation.y += 0.002;

        camera.position.x = mouseX * 0.5;
        camera.position.y = mouseY * 0.5;

        renderer.render(scene, camera);
    }
    animate();

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
}

async function loadCharacter() {
    if (!characterId || isNaN(characterId)) {
        window.location.href = '/characters';
        return;
    }

    try {
        currentCharacter = await fetchAPI(`/characters/${characterId}`);

        const name = currentCharacter.name || 'Unknown';
        document.title = `${name} - Periaphe`;

        loadHeroSection();

        loadIdentitySection();

        loadBioSections();

        applyCharacterTheme();

    } catch (error) {
        console.error('Error loading character:', error);
        showNotification('Failed to load character', 'error');
        setTimeout(() => window.location.href = '/characters', 2000);
    }
}

function loadHeroSection() {
    const heroImage = document.getElementById('hero-image');
    const heroName = document.getElementById('hero-name');
    const heroQuote = document.getElementById('hero-quote');

    const imageSrc = currentCharacter.profile_image || '/static/images/default-avatar.jpg';
    heroImage.src = imageSrc;
    heroImage.alt = currentCharacter.name || 'Character';

    heroImage.onerror = function() {
        console.log('Hero image failed to load, using default');
        this.src = '/static/images/default-avatar.jpg';

        this.onerror = function() {
            console.log('Default image also failed, using gradient');
            this.style.display = 'none';
            document.querySelector('.hero-image-wrapper').style.background = 
                'linear-gradient(135deg, #1a1a1a 0%, #3b82f6 100%)';
        };
    };

    heroName.textContent = currentCharacter.name || 'Unknown Character';

    if (currentCharacter.quote && currentCharacter.quote.trim()) {
        heroQuote.textContent = `"${currentCharacter.quote}"`;
        heroQuote.style.display = 'block';
    } else {
        heroQuote.style.display = 'none';
    }

    heroImage.onload = function() {
        gsap.to('.hero-image-wrapper', {
            yPercent: 20,
            ease: 'none',
            scrollTrigger: {
                trigger: '.hero-section',
                start: 'top top',
                end: 'bottom top',
                scrub: true,
            }
        });
    };

    if (heroImage.complete) {
        heroImage.onload();
    }
}

function loadIdentitySection() {
    const identityGrid = document.getElementById('identity-grid');
    const familyName = (currentCharacter.family && currentCharacter.family.name) || 'Unknown';

    const identityItems = [
        { label: 'Full Name', value: currentCharacter.full_name },
        { label: 'Alias', value: currentCharacter.nickname },
        { label: 'Birthday', value: currentCharacter.birthday ? formatDate(currentCharacter.birthday) : null },
        { label: 'Family', value: familyName }
    ].filter(item => item.value);

    identityGrid.innerHTML = identityItems.map(item => `
        <div class="info-item">
            <span class="info-label">${item.label}</span>
            <span class="info-value">${item.value}</span>
        </div>
    `).join('');
}

function loadBioSections() {
    const bioContainer = document.getElementById('bio-sections');
    const sections = currentCharacter.bio_sections || [];

    if (sections.length === 0) {
        bioContainer.innerHTML = '<p class="empty-state">No additional information available.</p>';
        return;
    }

    sections.sort((a, b) => a.display_order - b.display_order);

    bioContainer.innerHTML = sections.map(section => `
        <div class="bio-section glass-card" data-section-id="${section.id}">
            <h2 class="section-title">${section.section_title}</h2>
            <div class="bio-content">
                ${parseMarkdown(section.content)}
            </div>
        </div>
    `).join('');
}

function setupNavigation() {
    const navItems = document.querySelectorAll('.nav-item');

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const tabName = item.dataset.tab;
            switchTab(tabName);
        });
    });
}

function switchTab(tabName) {

    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.tab === tabName);
    });

    document.querySelectorAll('.tab-panel').forEach(panel => {
        panel.classList.remove('active');
    });

    const activePanel = document.getElementById(`${tabName}-tab`);
    if (activePanel) {
        activePanel.classList.add('active');

        if (!activePanel.dataset.loaded) {
            loadTabContent(tabName);
            activePanel.dataset.loaded = 'true';
        }
    }

    lenis.scrollTo('.content-area', { offset: -100, duration: 0.8 });
}

async function loadTabContent(tabName) {
    try {
        switch(tabName) {
            case 'timeline':
                await loadTimeline();
                break;
            case 'relationships':
                await loadRelationships();
                break;
            case 'love-interests':
                await loadLoveInterests();
                break;
            case 'gallery':
                await loadGallery();
                break;
        }
    } catch (error) {
        console.error(`Error loading ${tabName}:`, error);
        showNotification(`Failed to load ${tabName}`, 'error');
    }
}

async function loadTimeline() {
    const container = document.getElementById('timeline-container');

    try {
        const events = await fetchAPI(`/characters/${characterId}/timeline`);

        if (!events || events.length === 0) {
            container.innerHTML = '<p class="empty-state">No timeline events yet.</p>';
            return;
        }

        events.sort((a, b) => new Date(b.event_date) - new Date(a.event_date));

        container.innerHTML = events.map(event => `
            <div class="timeline-item" data-event-id="${event.id}">
                <div class="timeline-card">
                    <div class="timeline-header">
                        <span class="era-badge">${event.era_display || event.era}</span>
                        <time class="timeline-date">${formatDate(event.event_date)}</time>
                    </div>
                    <h3 class="timeline-title">${event.title}</h3>
                    <p class="timeline-summary">${event.summary || ''}</p>
                </div>
            </div>
        `).join('');

        document.querySelectorAll('.timeline-card').forEach(card => {
            card.addEventListener('click', () => {
                const eventId = card.closest('.timeline-item').dataset.eventId;
                openEventModal(eventId);
            });
        });

        gsap.utils.toArray('.timeline-item').forEach(item => {
            gsap.to(item, {
                opacity: 1,
                x: 0,
                duration: 0.8,
                scrollTrigger: {
                    trigger: item,
                    start: 'top 85%',
                    toggleClass: 'visible',
                }
            });
        });

    } catch (error) {
        container.innerHTML = '<p class="error-state">Failed to load timeline.</p>';
        throw error;
    }
}

async function loadRelationships() {
    const container = document.getElementById('relationships-grid');

    try {
        const relationships = await fetchAPI(`/characters/${characterId}/relationships`);

        if (!relationships || relationships.length === 0) {
            container.innerHTML = '<p class="empty-state">No relationships defined yet.</p>';
            return;
        }

        container.innerHTML = relationships.map(rel => `
            <div class="relationship-card" onclick="window.location.href='/profile/${rel.related_character_id}'">
                <img src="${rel.related_character_image || '/static/images/default-avatar.jpg'}" 
                     alt="${rel.related_character_name}"
                     class="relationship-avatar"
                     onerror="this.src='/static/images/default-avatar.jpg'">
                <div class="relationship-info">
                    <div class="relationship-name">${rel.related_character_name || 'Unknown'}</div>
                    <div class="relationship-status">${rel.status || ''}</div>
                </div>
            </div>
        `).join('');

    } catch (error) {
        container.innerHTML = '<p class="error-state">Failed to load relationships.</p>';
        throw error;
    }
}

async function loadLoveInterests() {
    const container = document.getElementById('love-interests-content');

    try {
        const interests = await fetchAPI(`/characters/${characterId}/love-interests`);

        if (!interests || interests.length === 0) {
            container.innerHTML = '<p class="empty-state">No love interests defined yet.</p>';
            return;
        }

        const grouped = interests.reduce((acc, item) => {
            (acc[item.category] = acc[item.category] || []).push(item);
            return acc;
        }, {});

        const categoryTitles = {
            'canon': 'Canon Darlings',
            'once_dated': 'Once Dated',
            'implied': 'Implied Fondness',
            'unrequited': 'Unrequited Crush',
            'au_lovers': 'Lovers In Another Life',
            'au_exes': 'Exes In Another Life'
        };

        const categoryOrder = ['canon', 'once_dated', 'implied', 'unrequited', 'au_lovers', 'au_exes'];

        let html = '';
        for (const category of categoryOrder) {
            if (grouped[category]) {
                html += `
                    <div class="love-category glass-card">
                        <h2 class="section-title">${categoryTitles[category]}</h2>
                        <div class="love-grid">
                            ${grouped[category].map(interest => `
                                <div class="love-card">
                                    <img src="${interest.partner.profile_image || '/static/images/default-avatar.jpg'}" 
                                         alt="${interest.partner.name}"
                                         class="love-avatar"
                                         onerror="this.src='/static/images/default-avatar.jpg'">
                                    <div class="love-info">
                                        <a href="/profile/${interest.partner.id}" class="love-name">${interest.partner.name}</a>
                                        ${interest.description ? `<p class="love-description">${interest.description}</p>` : ''}
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
            }
        }

        container.innerHTML = html;

    } catch (error) {
        container.innerHTML = '<p class="error-state">Failed to load love interests.</p>';
        throw error;
    }
}

async function loadGallery() {
    const container = document.getElementById('gallery-grid');
    const loader = document.getElementById('gallery-loader');

    if (typeof initGallery === 'function') {
        initGallery(characterId);
    } else {
        container.innerHTML = '<p class="empty-state">Gallery functionality not available.</p>';
    }
}

function setupModals() {

    document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
        backdrop.addEventListener('click', () => {
            backdrop.closest('.modal').classList.remove('active');
        });
    });

    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', () => {
            btn.closest('.modal').classList.remove('active');
        });
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal.active').forEach(modal => {
                modal.classList.remove('active');
            });
        }
    });
}

async function openEventModal(eventId) {
    try {
        const event = await fetchAPI(`/events/${eventId}`);
        const modal = document.getElementById('event-modal');

        modal.querySelector('#modal-era').textContent = event.era_display || event.era;
        modal.querySelector('#modal-title').textContent = event.title;
        modal.querySelector('#modal-date').textContent = formatDate(event.event_date);

        const imagesContainer = modal.querySelector('#modal-images');
        imagesContainer.innerHTML = (event.images && event.images.length > 0)
            ? event.images.map(img => `<img src="${img}" alt="${event.title}" loading="lazy">`).join('')
            : '';

        const descContainer = modal.querySelector('#modal-description');
        descContainer.innerHTML = event.full_description || `<p>${event.summary || ''}</p>`;

        modal.classList.add('active');

    } catch (error) {
        console.error('Error loading event:', error);
        showNotification('Failed to load event details', 'error');
    }
}

function setupScrollAnimations() {

    gsap.utils.toArray('.glass-card').forEach(card => {
        gsap.from(card, {
            opacity: 0,
            y: 50,
            duration: 1,
            scrollTrigger: {
                trigger: card,
                start: 'top 85%',
                toggleActions: 'play none none reverse',
            }
        });
    });
}

function applyCharacterTheme() {
    const root = document.documentElement;

    if (currentCharacter.color_primary) {
        root.style.setProperty('--accent', currentCharacter.color_primary);

        const hex = currentCharacter.color_primary.replace('#', '');
        const r = parseInt(hex.substr(0, 2), 16);
        const g = parseInt(hex.substr(2, 2), 16);
        const b = parseInt(hex.substr(4, 2), 16);
        root.style.setProperty('--accent-rgb', `${r}, ${g}, ${b}`);
    }
}

if (typeof formatDate === 'undefined') {
    window.formatDate = function(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };
}

if (typeof parseMarkdown === 'undefined') {
    window.parseMarkdown = function(content) {

        return content
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/\n\n/g, '</p><p>')
            .replace(/\n/g, '<br>');
    };
}
