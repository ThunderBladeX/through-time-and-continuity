import * as THREE from 'three';

const pathParts = window.location.pathname.split('/');
const characterId = pathParts[pathParts.length - 1];
const urlParams = new URLSearchParams(window.location.search);
const highlightEventId = urlParams.get('event');

let currentCharacter = null;
let scene, camera, renderer, particles;
let lenis;

document.addEventListener('DOMContentLoaded', () => {
    initSmoothScroll();
    initThreeBackground();
    loadCharacter();
    setupNavigation();
    setupMobileNavigation();
    setupScrollAnimations();
    setupContributionButtons();
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

    if (typeof ScrollTrigger !== 'undefined') {
        lenis.on('scroll', ScrollTrigger.update);
        gsap.ticker.add((time) => {
            lenis.raf(time * 1000);
        });
        gsap.ticker.lagSmoothing(0);
    }
}

function initThreeBackground() {
    const canvas = document.getElementById('bg-canvas');
    if (!canvas) return;

    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
    );
    camera.position.z = 5;

    renderer = new THREE.WebGLRenderer({
        canvas: canvas,
        alpha: true,
        antialias: true
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    createParticles();

    const ambientLight = new THREE.AmbientLight(0x3b82f6, 0.3);
    scene.add(ambientLight);

    const pointLight1 = new THREE.PointLight(0x8b5cf6, 1, 100);
    pointLight1.position.set(5, 5, 5);
    scene.add(pointLight1);

    const pointLight2 = new THREE.PointLight(0x3b82f6, 0.8, 100);
    pointLight2.position.set(-5, -5, 5);
    scene.add(pointLight2);

    animate();

    window.addEventListener('resize', onWindowResize);

    document.addEventListener('mousemove', onMouseMove);
}

function createParticles() {
    const geometry = new THREE.BufferGeometry();
    const particleCount = 2500;
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);

    const color1 = new THREE.Color(0x3b82f6);
    const color2 = new THREE.Color(0x8b5cf6);

    for (let i = 0; i < particleCount * 3; i += 3) {
        positions[i] = (Math.random() - 0.5) * 50;
        positions[i + 1] = (Math.random() - 0.5) * 50;
        positions[i + 2] = (Math.random() - 0.5) * 50;

        const mixedColor = color1.clone().lerp(color2, Math.random());
        colors[i] = mixedColor.r;
        colors[i + 1] = mixedColor.g;
        colors[i + 2] = mixedColor.b;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
        size: 0.05,
        vertexColors: true,
        transparent: true,
        opacity: 0.6,
        blending: THREE.AdditiveBlending,
        sizeAttenuation: true
    });

    particles = new THREE.Points(geometry, material);
    scene.add(particles);
}

function animate() {
    requestAnimationFrame(animate);

    if (particles) {
        particles.rotation.y += 0.0002;
        particles.rotation.x += 0.0001;
    }

    renderer.render(scene, camera);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function onMouseMove(event) {
    if (particles) {
        const mouseX = (event.clientX / window.innerWidth) * 2 - 1;
        const mouseY = -(event.clientY / window.innerHeight) * 2 + 1;

        gsap.to(particles.rotation, {
            x: mouseY * 0.3,
            y: mouseX * 0.3,
            duration: 2,
            ease: 'power2.out'
        });
    }
}

async function loadCharacter() {
    if (!characterId || isNaN(characterId)) {
        window.location.href = '/characters';
        return;
    }

    try {
        const character = await fetchAPI(`/characters/${characterId}`);
        currentCharacter = character;

        const charName = currentCharacter.full_name || currentCharacter.name || 'Unknown';

        document.getElementById('page-title').textContent = `${charName} - Periaphe`;
        document.title = `${charName} - Periaphe`;

        applyCharacterTheme(currentCharacter);
        loadCharacterInfo();
        loadBioSections(currentCharacter.bio_sections || []);

        setTimeout(() => {
            animateTimelineOnScroll();
        }, 100);

    } catch (error) {
        console.error('Error loading character:', error);
        showNotification('Failed to load character', 'error');
        setTimeout(() => window.location.href = '/characters', 2000);
    }
}

function loadCharacterInfo() {
    const charName = currentCharacter.name || 'Unknown';
    const imageSrc = currentCharacter.profile_image || '/static/images/default-avatar.jpg';

    const profileImg = document.getElementById('profile-image');
    if (profileImg) {
        profileImg.src = imageSrc;
        profileImg.alt = charName;
        profileImg.onerror = function() { this.src = '/static/images/default-avatar.jpg'; };
    }

    const charNameEl = document.getElementById('character-name');
    if (charNameEl) charNameEl.textContent = charName;

    const quoteEl = document.getElementById('character-quote');
    if (currentCharacter.quote && quoteEl) {
        quoteEl.textContent = `"${currentCharacter.quote}"`;
    }

    const mobileProfileImg = document.getElementById('mobile-profile-image');
    if (mobileProfileImg) {
        mobileProfileImg.src = imageSrc;
        mobileProfileImg.alt = charName;
        mobileProfileImg.onerror = function() { this.src = '/static/images/default-avatar.jpg'; };
    }

    const mobileCharNameEl = document.getElementById('mobile-character-name');
    if (mobileCharNameEl) mobileCharNameEl.textContent = charName;

    const mobileQuoteEl = document.getElementById('mobile-character-quote');
    if (currentCharacter.quote && mobileQuoteEl) {
        mobileQuoteEl.textContent = currentCharacter.quote;
    }

    const familyName = (currentCharacter.family && currentCharacter.family.name) || 'Unknown';
    const stats = [
        { label: 'Alias', value: currentCharacter.nickname },
        { label: 'Birthday', value: currentCharacter.birthday ? formatDate(currentCharacter.birthday) : null },
        { label: 'Family', value: familyName }
    ].filter(stat => stat.value);

    const statsContainer = document.getElementById('quick-stats');
    if (statsContainer) {
        statsContainer.innerHTML = stats.map(stat => `
            <div class="stat-card">
                <div class="stat-label">${stat.label}</div>
                <div class="stat-value">${stat.value}</div>
            </div>
        `).join('');
    }

    const mobileStatsContainer = document.getElementById('mobile-quick-stats');
    if (mobileStatsContainer) {
        mobileStatsContainer.innerHTML = stats.map(stat => `
            <div class="mobile-stat-card">
                <div class="mobile-stat-label">${stat.label}</div>
                <div class="mobile-stat-value">${stat.value}</div>
            </div>
        `).join('');
    }

    if (localStorage.getItem('admin_token')) {
        addQuickEditButton();
    }
}

function loadBioSections(sections) {
    const identitySection = document.getElementById('bio-identity');
    const additionalSections = document.getElementById('additional-bio-sections');
    const mobileIdentitySection = document.getElementById('mobile-bio-identity');
    const mobileAdditionalSections = document.getElementById('mobile-additional-bio-sections');

    const identityItems = [
        { label: 'Full Name', value: currentCharacter.full_name },
    ].filter(item => item.value);

    const desktopBioHTML = identityItems.map(item => `
        <div class="bio-item">
            <div class="bio-label">${item.label}</div>
            <div class="bio-value">${item.value}</div>
        </div>
    `).join('');

    if (identitySection) identitySection.innerHTML = desktopBioHTML;

    const mobileBioHTML = identityItems.map(item => `
        <div class="mobile-bio-item">
            <div class="mobile-bio-label">${item.label}</div>
            <div class="mobile-bio-value">${item.value}</div>
        </div>
    `).join('');

    if (mobileIdentitySection) mobileIdentitySection.innerHTML = mobileBioHTML;

    if (sections && sections.length > 0) {
        sections.sort((a, b) => a.display_order - b.display_order);

        const desktopSectionsHTML = sections.map(section => `
            <div class="bio-section" data-section-id="${section.id}">
                <h2 class="section-header">${section.section_title}</h2>
                <div class="bio-content" data-raw-content="${encodeURIComponent(section.content)}">
                    ${parseMarkdown(section.content)}
                </div>
            </div>
        `).join('');

        if (additionalSections) additionalSections.innerHTML = desktopSectionsHTML;

        const mobileSectionsHTML = sections.map(section => `
            <div class="mobile-bio-section-card" data-section-id="${section.id}">
                <h2 class="mobile-bio-section-header">${section.section_title}</h2>
                <div class="mobile-bio-content" data-raw-content="${encodeURIComponent(section.content)}">
                    ${parseMarkdown(section.content)}
                </div>
            </div>
        `).join('');

        if (mobileAdditionalSections) mobileAdditionalSections.innerHTML = mobileSectionsHTML;
    }
}

function setupNavigation() {
    const navButtons = document.querySelectorAll('.nav-pill');

    navButtons.forEach(button => {
        button.addEventListener('click', () => {
            const section = button.dataset.section;
            const targetSection = document.getElementById(section);

            if (targetSection) {
                lenis.scrollTo(targetSection, {
                    offset: -100,
                    duration: 1.5
                });

                navButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');

                if (!targetSection.dataset.loaded) {
                    switch(section) {
                        case 'timeline':
                            loadTimeline();
                            break;
                        case 'relationships':
                            loadRelationships();
                            break;
                        case 'love-interests':
                            loadLoveInterests();
                            break;
                        case 'gallery':
                            loadGallery();
                            break;
                    }
                    targetSection.dataset.loaded = 'true';
                }
            }
        });
    });

    if (typeof ScrollTrigger !== 'undefined') {
        document.querySelectorAll('.content-section').forEach(section => {
            ScrollTrigger.create({
                trigger: section,
                start: 'top center',
                end: 'bottom center',
                onEnter: () => updateActiveNav(section.id),
                onEnterBack: () => updateActiveNav(section.id)
            });
        });
    }
}

function setupMobileNavigation() {
    const mobileTabs = document.querySelectorAll('.mobile-nav-tab');

    mobileTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const tabName = tab.dataset.tab;
            switchMobileTab(tabName);
        });
    });
}

function switchMobileTab(tabName) {

    document.querySelectorAll('.mobile-nav-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.tab === tabName);
    });

    document.querySelectorAll('.mobile-tab-content').forEach(content => {
        content.classList.remove('active');
    });

    const targetContent = document.getElementById(`mobile-${tabName}`);
    if (targetContent) {
        targetContent.classList.add('active');

        if (!targetContent.dataset.loaded) {
            switch(tabName) {
                case 'timeline':
                    loadMobileTimeline();
                    break;
                case 'relationships':
                    loadMobileRelationships();
                    break;
                case 'love-interests':
                    loadMobileLoveInterests();
                    break;
                case 'gallery':
                    loadMobileGallery();
                    break;
            }
            targetContent.dataset.loaded = 'true';
        }
    }
}

function updateActiveNav(sectionId) {
    document.querySelectorAll('.nav-pill').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.section === sectionId);
    });
}

function setupScrollAnimations() {
    if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;

    gsap.registerPlugin(ScrollTrigger);

    gsap.utils.toArray('.bio-item').forEach((item, i) => {
        gsap.from(item, {
            scrollTrigger: {
                trigger: item,
                start: 'top 85%',
                toggleActions: 'play none none reverse'
            },
            opacity: 0,
            y: 40,
            duration: 0.8,
            delay: i * 0.1,
            ease: 'power3.out'
        });
    });

    gsap.utils.toArray('.relationship-card').forEach((card, i) => {
        gsap.from(card, {
            scrollTrigger: {
                trigger: card,
                start: 'top 85%',
                toggleActions: 'play none none reverse'
            },
            opacity: 0,
            x: -40,
            duration: 0.8,
            delay: i * 0.08,
            ease: 'power3.out'
        });
    });

    gsap.utils.toArray('.love-interest-card').forEach((card, i) => {
        gsap.from(card, {
            scrollTrigger: {
                trigger: card,
                start: 'top 85%',
                toggleActions: 'play none none reverse'
            },
            opacity: 0,
            scale: 0.9,
            duration: 0.8,
            delay: i * 0.08,
            ease: 'back.out(1.4)'
        });
    });

    gsap.utils.toArray('.section-title').forEach(title => {
        gsap.to(title, {
            scrollTrigger: {
                trigger: title,
                start: 'top bottom',
                end: 'bottom top',
                scrub: 1
            },
            y: -60,
            ease: 'none'
        });
    });

    gsap.utils.toArray('.gallery-item').forEach((item, i) => {
        gsap.from(item, {
            scrollTrigger: {
                trigger: item,
                start: 'top 90%',
                toggleActions: 'play none none reverse'
            },
            opacity: 0,
            scale: 0.8,
            duration: 0.6,
            delay: i * 0.05,
            ease: 'power2.out'
        });
    });
}

function animateTimelineOnScroll() {
    if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;

    gsap.utils.toArray('.timeline-event').forEach((event, i) => {
        gsap.to(event, {
            scrollTrigger: {
                trigger: event,
                start: 'top 85%',
                toggleActions: 'play none none reverse'
            },
            opacity: 1,
            x: 0,
            duration: 1,
            delay: i * 0.12,
            ease: 'power3.out'
        });
    });
}

async function loadTimeline() {
    const timelineList = document.getElementById('timeline-list');
    if (!timelineList) return;

    try {
        const events = await fetchAPI(`/characters/${characterId}/timeline`);

        if (events && events.length > 0) {
            events.sort((a, b) => new Date(b.event_date) - new Date(a.event_date));
            timelineList.innerHTML = events.map(event => createTimelineEvent(event)).join('');
            setupEventModals();
            animateTimelineOnScroll();

            if (highlightEventId) {
                setTimeout(() => {
                    const eventCard = document.querySelector(`[data-event-id="${highlightEventId}"]`);
                    if (eventCard) {
                        lenis.scrollTo(eventCard, { offset: -150, duration: 2 });
                        setTimeout(() => {
                            gsap.to(eventCard, {
                                boxShadow: '0 0 40px rgba(59, 130, 246, 1)',
                                duration: 0.8,
                                repeat: 3,
                                yoyo: true
                            });
                        }, 2000);
                    }
                }, 500);
            }
        } else {
            timelineList.innerHTML = '<p class="empty-state">No timeline events yet.</p>';
        }
    } catch (error) {
        console.error('Error loading timeline:', error);
        timelineList.innerHTML = '<p class="error-state">Failed to load timeline.</p>';
    }
}

function createTimelineEvent(event) {
    const eraDisplay = event.era_display || getEraName(event.era);
    return `
        <div class="timeline-event" data-event-id="${event.id}">
            <div class="event-card" data-era="${event.era}">
                <div class="event-header">
                    <span class="era-badge" data-era="${event.era}">${eraDisplay}</span>
                    <span class="event-date">${formatDate(event.event_date)}</span>
                </div>
                <h3 class="event-title">${event.title}</h3>
                <p class="event-summary">${event.summary || ''}</p>
            </div>
        </div>
    `;
}

function setupEventModals() {
    document.querySelectorAll('.event-card').forEach(card => {
        card.addEventListener('click', () => {
            const eventId = card.closest('.timeline-event').dataset.eventId;
            openEventModal(eventId);
        });
    });
}

async function openEventModal(eventId) {
    try {
        const event = await fetchAPI(`/events/${eventId}`);
        const eraDisplay = event.era_display || getEraName(event.era);

        const modal = document.getElementById('event-modal');
        if (!modal) return;

        modal.querySelector('#modal-era-badge').dataset.era = event.era;
        modal.querySelector('#modal-era-badge').textContent = eraDisplay;
        modal.querySelector('#modal-event-title').textContent = event.title;
        modal.querySelector('#modal-event-date').textContent = formatDate(event.event_date);

        const imagesContainer = modal.querySelector('#modal-event-images');
        imagesContainer.innerHTML = (event.images && event.images.length > 0)
            ? event.images.map(imgUrl => `<img src="${imgUrl}" alt="${event.title}" loading="lazy">`).join('')
            : '';

        const descContainer = modal.querySelector('#modal-event-description');
        descContainer.innerHTML = event.full_description || `<p>${event.summary || ''}</p>`;

        openModal('event-modal');
    } catch (error) {
        console.error('Error loading event details:', error);
        showNotification('Failed to load event details', 'error');
    }
}

async function loadRelationships() {
    const relationshipsList = document.getElementById('relationships-list');
    if (!relationshipsList) return;

    try {
        const relationships = await fetchAPI(`/characters/${characterId}/relationships`);

        if (relationships && relationships.length > 0) {
            relationshipsList.innerHTML = relationships.map(rel => `
                <div class="relationship-card" 
                     data-type="${rel.type || ''}"
                     data-related-character-id="${rel.related_character_id}"
                     onclick="window.location.href='/profile/${rel.related_character_id}'">
                    <img src="${rel.related_character_image || '/static/images/default-avatar.jpg'}" 
                         alt="${rel.related_character_name || 'Character'}"
                         class="relationship-avatar"
                         onerror="this.src='/static/images/default-avatar.jpg'">
                    <div class="relationship-info">
                        <div class="relationship-name">${rel.related_character_name || 'Unknown'}</div>
                        <div class="relationship-status">${rel.status || ''}</div>
                    </div>
                </div>
            `).join('');
        } else {
            relationshipsList.innerHTML = '<p class="empty-state">No relationships defined yet.</p>';
        }
    } catch (error) {
        console.error('Error loading relationships:', error);
        relationshipsList.innerHTML = '<p class="error-state">Failed to load relationships.</p>';
    }
}

async function loadLoveInterests() {
    const container = document.getElementById('love-interests-content');
    if (!container) return;

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

        let contentHTML = '';
        for (const category of categoryOrder) {
            if (grouped[category]) {
                contentHTML += `
                    <div class="love-interest-section">
                        <h2 class="section-header">${categoryTitles[category]}</h2>
                        <div class="love-interest-grid">
                            ${grouped[category].map(createLoveInterestCard).join('')}
                        </div>
                    </div>
                `;
            }
        }

        container.innerHTML = contentHTML;
    } catch (error) {
        console.error('Error loading love interests:', error);
        container.innerHTML = '<p class="error-state">Failed to load love interests.</p>';
    }
}

function createLoveInterestCard(interest) {
    const partner = interest.partner;
    const partnerName = partner.name || 'Unknown';
    const partnerImage = partner.profile_image || '/static/images/default-avatar.jpg';
    const partnerId = partner.id;

    return `
        <div class="love-interest-card">
            <img src="${partnerImage}" alt="${partnerName}" class="love-interest-pfp" 
                 onerror="this.src='/static/images/default-avatar.jpg'">
            <div class="love-interest-details">
                <a href="/profile/${partnerId}" class="love-interest-name">${partnerName}</a>
                ${interest.description ? `<p class="love-interest-desc">${interest.description}</p>` : ''}
            </div>
        </div>
    `;
}

function loadGallery() {
    if (typeof initGallery === 'function') {
        initGallery(characterId);
    }
}

async function loadMobileTimeline() {
    const timelineList = document.getElementById('mobile-timeline-list');
    if (!timelineList) return;

    try {
        const events = await fetchAPI(`/characters/${characterId}/timeline`);

        if (events && events.length > 0) {
            events.sort((a, b) => new Date(b.event_date) - new Date(a.event_date));
            timelineList.innerHTML = events.map(event => createMobileTimelineEvent(event)).join('');
            setupMobileEventModals();
        } else {
            timelineList.innerHTML = '<p class="mobile-empty-state">No timeline events yet.</p>';
        }
    } catch (error) {
        console.error('Error loading mobile timeline:', error);
        timelineList.innerHTML = '<p class="mobile-error-state">Failed to load timeline.</p>';
    }
}

function createMobileTimelineEvent(event) {
    const eraDisplay = event.era_display || getEraName(event.era);
    return `
        <div class="mobile-timeline-event" data-event-id="${event.id}">
            <div class="mobile-event-card" data-era="${event.era}">
                <div class="mobile-event-header">
                    <span class="era-badge" data-era="${event.era}">${eraDisplay}</span>
                    <span class="mobile-event-date">${formatDate(event.event_date)}</span>
                </div>
                <h3 class="mobile-event-title">${event.title}</h3>
                <p class="mobile-event-summary">${event.summary || ''}</p>
            </div>
        </div>
    `;
}

function setupMobileEventModals() {
    document.querySelectorAll('.mobile-event-card').forEach(card => {
        card.addEventListener('click', () => {
            const eventId = card.closest('.mobile-timeline-event').dataset.eventId;
            openEventModal(eventId);
        });
    });
}

async function loadMobileRelationships() {
    const relationshipsList = document.getElementById('mobile-relationships-list');
    if (!relationshipsList) return;

    try {
        const relationships = await fetchAPI(`/characters/${characterId}/relationships`);

        if (relationships && relationships.length > 0) {
            relationshipsList.innerHTML = relationships.map(rel => `
                <div class="mobile-relationship-card" 
                     data-type="${rel.type || ''}"
                     data-related-character-id="${rel.related_character_id}"
                     onclick="window.location.href='/profile/${rel.related_character_id}'">
                    <img src="${rel.related_character_image || '/static/images/default-avatar.jpg'}" 
                         alt="${rel.related_character_name || 'Character'}"
                         class="mobile-relationship-avatar"
                         onerror="this.src='/static/images/default-avatar.jpg'">
                    <div class="mobile-relationship-info">
                        <div class="mobile-relationship-name">${rel.related_character_name || 'Unknown'}</div>
                        <div class="mobile-relationship-status">${rel.status || ''}</div>
                    </div>
                </div>
            `).join('');
        } else {
            relationshipsList.innerHTML = '<p class="mobile-empty-state">No relationships defined yet.</p>';
        }
    } catch (error) {
        console.error('Error loading mobile relationships:', error);
        relationshipsList.innerHTML = '<p class="mobile-error-state">Failed to load relationships.</p>';
    }
}

async function loadMobileLoveInterests() {
    const container = document.getElementById('mobile-love-interests-content');
    if (!container) return;

    try {
        const interests = await fetchAPI(`/characters/${characterId}/love-interests`);

        if (!interests || interests.length === 0) {
            container.innerHTML = '<p class="mobile-empty-state">No love interests defined yet.</p>';
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

        let contentHTML = '';
        for (const category of categoryOrder) {
            if (grouped[category]) {
                contentHTML += `
                    <div class="mobile-love-section">
                        <h2 class="mobile-love-section-header">${categoryTitles[category]}</h2>
                        <div class="mobile-love-grid">
                            ${grouped[category].map(createMobileLoveInterestCard).join('')}
                        </div>
                    </div>
                `;
            }
        }

        container.innerHTML = contentHTML;
    } catch (error) {
        console.error('Error loading mobile love interests:', error);
        container.innerHTML = '<p class="mobile-error-state">Failed to load love interests.</p>';
    }
}

function createMobileLoveInterestCard(interest) {
    const partner = interest.partner;
    const partnerName = partner.name || 'Unknown';
    const partnerImage = partner.profile_image || '/static/images/default-avatar.jpg';
    const partnerId = partner.id;

    return `
        <div class="mobile-love-card">
            <img src="${partnerImage}" alt="${partnerName}" class="mobile-love-pfp" 
                 onerror="this.src='/static/images/default-avatar.jpg'">
            <div class="mobile-love-details">
                <a href="/profile/${partnerId}" class="mobile-love-name">${partnerName}</a>
                ${interest.description ? `<p class="mobile-love-desc">${interest.description}</p>` : ''}
            </div>
        </div>
    `;
}

function loadMobileGallery() {
    if (typeof initGallery === 'function') {
        initGallery(characterId, true); 
    }
}

async function applyCharacterTheme(character) {
    document.body.dataset.characterId = character.id;
    const charName = character.name || 'unknown';
    const cssFileName = charName.toLowerCase().replace(/\s+/g, '-') + '.css';
    const cssPath = `/static/styles/characters/${cssFileName}`;

    const themeLink = document.getElementById('character-theme');
    if (themeLink) {
        const cssExists = await checkFileExists(cssPath);
        if (cssExists) {
            themeLink.href = cssPath;
        } else {
            applyDynamicTheme(character);
        }
    }
}

async function checkFileExists(url) {
    try {
        const response = await fetch(url, { method: 'HEAD' });
        return response.ok;
    } catch (error) {
        return false;
    }
}

function applyDynamicTheme(character) {
    const root = document.documentElement;
    if (character.color_primary) root.style.setProperty('--accent', character.color_primary);
    if (character.color_secondary) root.style.setProperty('--character-secondary', character.color_secondary);
    if (character.color_accent) root.style.setProperty('--character-accent', character.color_accent);
    if (character.color_bg) root.style.setProperty('--bg-primary', character.color_bg);
}

function setupContributionButtons() {
    document.body.addEventListener('mouseover', (e) => {
        const bioItem = e.target.closest('.bio-item');
        const bioSection = e.target.closest('.bio-section');

        let targetElement = null;

        if (bioItem) {
            targetElement = bioItem;
        } else if (bioSection && !bioSection.querySelector('#bio-identity')) {
            targetElement = bioSection;
        }

        if (targetElement && !targetElement.querySelector('.edit-btn')) {
            addEditButton(targetElement);
        }
    });
}

function addEditButton(element) {
    const editBtn = document.createElement('button');
    editBtn.className = 'edit-btn';
    editBtn.innerHTML = '✏️';
    editBtn.title = 'Suggest an Edit';
    editBtn.onclick = (e) => {
        e.stopPropagation();
        handleEdit(element);
    };

    element.style.position = 'relative';
    element.appendChild(editBtn);

    element.addEventListener('mouseout', (e) => {
        if (!element.contains(e.relatedTarget)) {
            editBtn.remove();
        }
    }, { once: true });
}

function handleEdit(element) {
    if (element.classList.contains('bio-item')) {
        editBioItem(element);
    } else if (element.classList.contains('bio-section')) {
        const sectionId = element.dataset.sectionId;
        editBioSection(element, sectionId);
    }
}

function editBioItem(element) {
    const valueEl = element.querySelector('.bio-value');
    const currentValue = valueEl.textContent;
    const label = element.querySelector('.bio-label').textContent;

    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentValue;
    input.className = 'inline-edit-input';

    valueEl.innerHTML = '';
    valueEl.appendChild(input);
    input.focus();
    input.select();

    const save = async () => {
        const newValue = input.value;
        if (newValue !== currentValue && newValue.trim() !== '') {
            try {
                await submitPendingEdit({
                    type: 'character',
                    record_id: characterId,
                    field: label.toLowerCase().replace(/\s+/g, '_'),
                    old_value: currentValue,
                    new_value: newValue
                });
                showNotification('Edit submitted for approval', 'success');
            } catch (error) {
                showNotification('Failed to submit edit', 'error');
            }
        }
        valueEl.textContent = currentValue;
    };

    input.addEventListener('blur', save);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            input.blur();
        }
        if (e.key === 'Escape') {
            e.preventDefault();
            input.removeEventListener('blur', save);
            valueEl.textContent = currentValue;
        }
    });
}

function editBioSection(element, sectionId) {
    const modal = document.getElementById('bio-edit-modal');
    const form = document.getElementById('bio-edit-form');
    if (!modal || !form) return;

    const currentTitle = element.querySelector('.section-header').textContent;
    const contentDiv = element.querySelector('.bio-content');
    const rawContent = contentDiv.dataset.rawContent ? decodeURIComponent(contentDiv.dataset.rawContent) : '';

    form.elements['section_id'].value = sectionId;
    form.elements['old_value_title'].value = currentTitle;
    form.elements['old_value_content'].value = rawContent;
    form.elements['new_value_title'].value = currentTitle;
    form.elements['new_value_content'].value = rawContent;

    const handleSubmit = async (e) => {
        e.preventDefault();
        const newTitle = form.elements['new_value_title'].value;
        const newContent = form.elements['new_value_content'].value;
        let editsSubmitted = 0;

        if (newTitle.trim() && newTitle !== currentTitle) {
            try {
                await submitPendingEdit({
                    type: 'character_bio',
                    record_id: sectionId,
                    field: 'section_title',
                    old_value: currentTitle,
                    new_value: newTitle
                });
                editsSubmitted++;
            } catch (error) {
                showNotification('Failed to submit title edit', 'error');
            }
        }

        if (newContent.trim() && newContent !== rawContent) {
            try {
                await submitPendingEdit({
                    type: 'character_bio',
                    record_id: sectionId,
                    field: 'content',
                    old_value: rawContent,
                    new_value: newContent
                });
                editsSubmitted++;
            } catch (error) {
                showNotification('Failed to submit content edit', 'error');
            }
        }

        if (editsSubmitted > 0) {
            showNotification('Edit(s) submitted for approval', 'success');
        } else {
            showNotification('No changes were made', 'info');
        }
        closeModal('bio-edit-modal');
    };

    form.onsubmit = handleSubmit;
    openModal('bio-edit-modal');
}

async function submitPendingEdit(editData) {
    return await fetchAPI('/admin/pending-edits', {
        method: 'POST',
        body: editData
    });
}

function addQuickEditButton() {
    const heroSection = document.querySelector('.hero-section');
    if (!heroSection) return;

    const editButton = document.createElement('button');
    editButton.className = 'quick-edit-btn';
    editButton.innerHTML = '⚙️ Edit Character';
    editButton.style.cssText = `
        position: absolute;
        bottom: 2rem;
        right: 2rem;
        padding: 0.875rem 1.75rem;
        background: rgba(59, 130, 246, 0.2);
        border: 1px solid var(--accent);
        border-radius: 50px;
        color: var(--accent);
        font-weight: 600;
        cursor: pointer;
        backdrop-filter: blur(20px);
        transition: all 0.3s ease;
        z-index: 10;
    `;

    editButton.onmouseover = () => {
        editButton.style.background = 'var(--accent)';
        editButton.style.color = 'white';
        editButton.style.transform = 'translateY(-4px)';
        editButton.style.boxShadow = '0 8px 24px rgba(59, 130, 246, 0.4)';
    };

    editButton.onmouseout = () => {
        editButton.style.background = 'rgba(59, 130, 246, 0.2)';
        editButton.style.color = 'var(--accent)';
        editButton.style.transform = 'translateY(0)';
        editButton.style.boxShadow = 'none';
    };

    editButton.onclick = () => {
        window.location.href = `/admin?edit=character&id=${characterId}`;
    };

    heroSection.appendChild(editButton);
}

function getEraName(eraId) {
    const eraNames = {
        'pre-52': 'Classic',
        'new-52': 'New 52',
        'rebirth': 'Rebirth',
        'infinite-frontier': 'Infinite Frontier',
        'elseworlds': 'Elseworlds',
        'post-crisis': 'Post-Crisis',
        'future-state': 'Future State'
    };
    return eraNames[eraId] || eraId;
}

if (typeof setupEraTooltips === 'function') {
    setupEraTooltips();
}
