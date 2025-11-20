function renderGalleryImages(images, container) {
    if (!images || !container) return;

    container.innerHTML = images.map(img => `
        <div class="gallery-item" onclick="openGalleryModal('${img.url}', '${img.caption || ''}')">
            <img src="${img.url}" alt="${img.caption || 'Gallery Image'}" loading="lazy" class="gallery-thumb">
            ${img.caption ? `<div class="gallery-caption-overlay">${img.caption}</div>` : ''}
        </div>
    `).join('');

    if (typeof gsap !== 'undefined') {
        gsap.utils.toArray('.gallery-item').forEach((item, i) => {
            gsap.from(item, {
                opacity: 0,
                y: 20,
                duration: 0.5,
                delay: i * 0.05,
                scrollTrigger: {
                    trigger: item,
                    start: 'top 95%'
                }
            });
        });
    }
}

function openGalleryModal(src, caption) {
    let modal = document.getElementById('gallery-modal');
    
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'gallery-modal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-overlay"></div>
            <div class="modal-content gallery-modal-content">
                <button class="modal-close">×</button>
                <img id="gallery-modal-img" src="" alt="">
                <p id="gallery-modal-caption"></p>
            </div>
        `;
        document.body.appendChild(modal);
        
        modal.querySelector('.modal-overlay').onclick = () => modal.classList.remove('active');
        modal.querySelector('.modal-close').onclick = () => modal.classList.remove('active');
    }

    const img = modal.querySelector('#gallery-modal-img');
    const cap = modal.querySelector('#gallery-modal-caption');
    
    img.src = src;
    cap.textContent = caption;
    modal.classList.add('active');
}

window.renderGalleryImages = renderGalleryImages;
window.openGalleryModal = openGalleryModal;
