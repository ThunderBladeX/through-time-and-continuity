// Gallery state
let galleryImages = [];
let galleryPage = 1;
let galleryLoading = false;
let galleryHasMore = true;
const IMAGES_PER_PAGE = 20;

// Initialize gallery
async function initGallery(characterId) {
    galleryImages = [];
    galleryPage = 1;
    galleryHasMore = true;
    
    // Detect if mobile
    const isMobile = window.innerWidth <= 768;
    
    if (isMobile) {
        initMobileGallery(characterId);
    } else {
        initDesktopGallery(characterId);
    }
}

// Desktop: Masonry layout with infinite scroll
async function initDesktopGallery(characterId) {
    const masonryGrid = document.getElementById('gallery-masonry');
    if (!masonryGrid) return;
    
    // Load first batch
    await loadMoreImages(characterId);
    
    // Setup infinite scroll
    setupInfiniteScroll(characterId);
}

// Mobile: Stacked layout with pagination
async function initMobileGallery(characterId) {
    const mobileGallery = document.getElementById('mobile-gallery');
    if (!mobileGallery) return;
    
    // Create stacked container
    const stackContainer = document.createElement('div');
    stackContainer.className = 'mobile-gallery-stack';
    stackContainer.id = 'mobile-gallery-stack';
    mobileGallery.appendChild(stackContainer);
    
    // Load first page
    await loadGalleryPage(characterId, 1);
    
    // Setup pagination controls
    setupMobilePagination(characterId);
}

// Load more images for desktop
async function loadMoreImages(characterId) {
    if (galleryLoading || !galleryHasMore) return;
    
    galleryLoading = true;
    const loader = document.querySelector('.gallery-loader');
    if (loader) loader.classList.add('active');
    
    try {
        // Use correct API endpoint - backend returns formatted array
        const newImages = await fetchAPI(`/characters/${characterId}/gallery?page=${galleryPage}&limit=${IMAGES_PER_PAGE}`);
        
        if (!newImages || newImages.length < IMAGES_PER_PAGE) {
            galleryHasMore = false;
        }
        
        if (newImages && newImages.length > 0) {
            galleryImages = [...galleryImages, ...newImages];
            renderDesktopImages(newImages);
            galleryPage++;
        } else if (galleryPage === 1) {
            // First page and no images
            const grid = document.getElementById('gallery-masonry');
            if (grid) grid.innerHTML = '<p class="empty-state">No gallery images yet.</p>';
        }
        
    } catch (error) {
        console.error('Error loading gallery images:', error);
        showNotification('Failed to load images', 'error');
    } finally {
        galleryLoading = false;
        if (loader) loader.classList.remove('active');
    }
}

// Render images in masonry layout
function renderDesktopImages(images) {
    const masonryGrid = document.getElementById('gallery-masonry');
    if (!masonryGrid) return;
    
    images.forEach(image => {
        const item = document.createElement('div');
        item.className = 'gallery-item';
        // Backend returns {url, alt} format
        const imageUrl = image.url || image.image_url || '';
        const imageAlt = image.alt || image.alt_text || image.caption || '';
        
        if (imageUrl) {
            const img = document.createElement('img');
            img.dataset.src = imageUrl;
            img.alt = imageAlt;
            img.className = 'lazy';
            img.onerror = function() { this.parentElement.style.display = 'none'; };
            
            // Add click handler for lightbox
            item.addEventListener('click', () => openLightbox(imageUrl, imageAlt));
            
            item.appendChild(img);
            masonryGrid.appendChild(item);
        }
    });
    
    // Initialize lazy loading for new images
    if (typeof setupLazyLoading === 'function') {
        setupLazyLoading();
    }
}

// Setup infinite scroll
function setupInfiniteScroll(characterId) {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting && !galleryLoading && galleryHasMore) {
                loadMoreImages(characterId);
            }
        });
    }, {
        rootMargin: '200px'
    });
    
    const loader = document.querySelector('.gallery-loader');
    if (loader) observer.observe(loader);
}

// Mobile: Load specific page
async function loadGalleryPage(characterId, page) {
    const stackContainer = document.getElementById('mobile-gallery-stack');
    if (!stackContainer) return;
    
    galleryLoading = true;
    stackContainer.innerHTML = '<div class="loading-state"><div class="spinner"></div></div>';
    
    try {
        // Use correct API endpoint
        const images = await fetchAPI(`/characters/${characterId}/gallery?page=${page}&limit=10`);
        
        galleryImages = images || [];
        galleryPage = page;
        galleryHasMore = images && images.length === 10;
        
        if (!images || images.length === 0) {
            stackContainer.innerHTML = '<p class="empty-state">No images yet.</p>';
            return;
        }
        
        stackContainer.innerHTML = images.map((image, index) => {
            const imageUrl = image.url || image.image_url || '';
            const imageAlt = image.alt || image.alt_text || image.caption || '';
            return `
                <div class="mobile-gallery-item" onclick="openLightbox('${imageUrl}', '${imageAlt}')">
                    <img src="${imageUrl}" alt="${imageAlt}" loading="lazy" onerror="this.parentElement.style.display='none'">
                </div>
            `;
        }).join('');
        
        updatePaginationInfo(page, galleryHasMore);
        
    } catch (error) {
        console.error('Error loading gallery page:', error);
        stackContainer.innerHTML = '<p class="error-state">Failed to load images.</p>';
    } finally {
        galleryLoading = false;
    }
}

// Setup mobile pagination
function setupMobilePagination(characterId) {
    const prevBtn = document.getElementById('prev-page');
    const nextBtn = document.getElementById('next-page');
    
    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            if (galleryPage > 1 && !galleryLoading) {
                loadGalleryPage(characterId, galleryPage - 1);
            }
        });
    }
    
    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            if (galleryHasMore && !galleryLoading) {
                loadGalleryPage(characterId, galleryPage + 1);
            }
        });
    }
}

// Update pagination info
function updatePaginationInfo(page, hasMore) {
    const prevBtn = document.getElementById('prev-page');
    const nextBtn = document.getElementById('next-page');
    const pageInfo = document.getElementById('page-info');
    
    if (prevBtn) {
        prevBtn.disabled = page === 1;
    }
    
    if (nextBtn) {
        nextBtn.disabled = !hasMore;
    }
    
    if (pageInfo) {
        pageInfo.textContent = `Page ${page}`;
    }
}

// Open lightbox for full image view
function openLightbox(imageUrl, imageAlt) {
    if (!imageUrl) return;
    
    // Create lightbox modal
    const lightbox = document.createElement('div');
    lightbox.className = 'lightbox-modal';
    lightbox.innerHTML = `
        <div class="lightbox-overlay"></div>
        <div class="lightbox-content">
            <button class="lightbox-close">×</button>
            <img src="${imageUrl}" alt="${imageAlt || ''}" onerror="this.src='/static/images/default-avatar.jpg'">
            ${imageAlt ? `<p class="lightbox-caption">${imageAlt}</p>` : ''}
        </div>
    `;
    
    document.body.appendChild(lightbox);
    document.body.style.overflow = 'hidden';
    
    // Setup close handlers
    lightbox.querySelector('.lightbox-close').addEventListener('click', closeLightbox);
    lightbox.querySelector('.lightbox-overlay').addEventListener('click', closeLightbox);
    
    // Keyboard navigation
    const handleKeypress = (e) => {
        if (e.key === 'Escape') closeLightbox();
    };
    
    document.addEventListener('keydown', handleKeypress);
    lightbox.dataset.keypressHandler = 'true';
}

// Close lightbox
function closeLightbox() {
    const lightbox = document.querySelector('.lightbox-modal');
    if (lightbox) {
        lightbox.remove();
        document.body.style.overflow = '';
        
        // Remove keypress handler
        if (lightbox.dataset.keypressHandler) {
            document.removeEventListener('keydown', handleKeypress);
        }
    }
}

// Add lightbox styles
const lightboxStyles = document.createElement('style');
lightboxStyles.textContent = `
    .lightbox-modal {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 9999;
        display: flex;
        align-items: center;
        justify-content: center;
        animation: fadeIn 0.3s ease;
    }
    
    .lightbox-overlay {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.95);
        backdrop-filter: blur(10px);
    }
    
    .lightbox-content {
        position: relative;
        max-width: 90vw;
        max-height: 90vh;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 1rem;
    }
    
    .lightbox-content img {
        max-width: 100%;
        max-height: 80vh;
        object-fit: contain;
        border-radius: 8px;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
    }
    
    .lightbox-close {
        position: absolute;
        top: -50px;
        right: 0;
        width: 40px;
        height: 40px;
        background: rgba(255, 255, 255, 0.1);
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 50%;
        color: white;
        font-size: 2rem;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.3s ease;
    }
    
    .lightbox-close:hover {
        background: rgba(255, 255, 255, 0.2);
        transform: rotate(90deg);
    }
    
    .lightbox-caption {
        color: rgba(255, 255, 255, 0.8);
        text-align: center;
        max-width: 600px;
        font-size: 0.9rem;
    }
    
    .lightbox-nav {
        display: flex;
        gap: 1rem;
    }
    
    .lightbox-prev,
    .lightbox-next {
        padding: 0.75rem 1.5rem;
        background: rgba(255, 255, 255, 0.1);
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 8px;
        color: white;
        cursor: pointer;
        transition: all 0.3s ease;
        font-weight: 500;
    }
    
    .lightbox-prev:hover:not(:disabled),
    .lightbox-next:hover:not(:disabled) {
        background: rgba(255, 255, 255, 0.2);
        transform: translateY(-2px);
    }
    
    .lightbox-prev:disabled,
    .lightbox-next:disabled {
        opacity: 0.3;
        cursor: not-allowed;
    }
    
    @media (max-width: 768px) {
        .lightbox-content img {
            max-height: 70vh;
        }
        
        .lightbox-close {
            top: -40px;
            width: 36px;
            height: 36px;
            font-size: 1.5rem;
        }
        
        .lightbox-nav {
            flex-direction: column;
            width: 100%;
        }
        
        .lightbox-prev,
        .lightbox-next {
            width: 100%;
        }
    }
`;
document.head.appendChild(lightboxStyles);

// Preload adjacent images for smooth navigation
function preloadAdjacentImages(currentIndex) {
    if (currentIndex > 0) {
        const prevImg = new Image();
        prevImg.src = galleryImages[currentIndex - 1].image_url;
    }
    if (currentIndex < galleryImages.length - 1) {
        const nextImg = new Image();
        nextImg.src = galleryImages[currentIndex + 1].image_url;
    }
}

// Export for use in profile.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        initGallery
    };
}
