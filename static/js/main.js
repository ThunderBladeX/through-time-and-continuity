// Global configuration
const API_BASE = '/api';

// Utility: Fetch wrapper
async function fetchAPI(endpoint, options = {}) {
    const token = localStorage.getItem('admin_token');
    const headers = {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
        ...options.headers
    };

    if (options.isFormData) {
        delete headers['Content-Type'];
    }

    try {
        const response = await fetch(`${API_BASE}${endpoint}`, {
            ...options,
            headers,
            body: options.isFormData ? options.body : (options.body ? JSON.stringify(options.body) : null)
        });

        if (response.status === 401) {
            // Token is invalid or expired. Log the user out.
            localStorage.removeItem('admin_token');
            showNotification('Your session has expired. Please log in again.', 'error');
            // Give the notification time to show before reloading
            setTimeout(() => {
                window.location.reload();
            }, 2000);
            // Throw an error to stop the original function from continuing
            throw new Error('Session expired');
        }

        if (!response.ok) {
            let errorMessage = `HTTP error! status: ${response.status}`;
            try {
                const errorBody = await response.json();
                errorMessage = errorBody.error || errorBody.message || errorMessage;
            } catch (e) {
                // Response was not JSON, stick with the original error
            }
            throw new Error(errorMessage);
        }

        // Handle empty responses (like from a DELETE request)
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.indexOf("application/json") !== -1) {
            return await response.json();
        } else {
            return {}; // Return empty object for non-json responses
        }

    } catch (error) {
        // Avoid showing a generic error if we've already handled the session expiration
        if (error.message !== 'Session expired') {
            console.error('API Error:', error);
            }
        throw error;
    }
}

// Utility: Format date
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

// Utility: Debounce
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Utility: Show notification
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 90px;
        right: 20px;
        padding: 1rem 1.5rem;
        background: ${type === 'error' ? '#ef4444' : type === 'success' ? '#10b981' : '#3b82f6'};
        color: white;
        border-radius: 8px;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
        z-index: 10000;
        animation: slideIn 0.3s ease;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Add notification animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(400px);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(400px);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// Modal utilities
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }
}

// Setup modal close handlers
document.addEventListener('DOMContentLoaded', () => {
    // Close modals on overlay click
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            const modal = e.target.closest('.modal');
            if (modal) {
                modal.classList.remove('active');
                document.body.style.overflow = '';
            }
        });
    });
    
    // Close modals on close button click
    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', () => {
            const modal = btn.closest('.modal');
            if (modal) {
                modal.classList.remove('active');
                document.body.style.overflow = '';
            }
        });
    });
    
    // Close modals on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal.active').forEach(modal => {
                modal.classList.remove('active');
                document.body.style.overflow = '';
            });
        }
    });
});

// Lazy loading for images
function setupLazyLoading() {
    const imageObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                img.src = img.dataset.src;
                img.classList.remove('lazy');
                observer.unobserve(img);
            }
        });
    });
    
    document.querySelectorAll('img.lazy').forEach(img => {
        imageObserver.observe(img);
    });
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

// Era tooltip
function setupEraTooltips() {
    const tooltip = document.getElementById('era-tooltip');
    if (!tooltip) return;
    
    const eraDescriptions = {
        'pre-52': 'Classic: The original DC timeline before the 2011 reboot',
        'new-52': 'New 52: DC Comics reboot starting in 2011',
        'rebirth': 'Rebirth: Restoration of legacy and hope starting in 2016',
        'infinite-frontier': 'Infinite Frontier: Omniverse storytelling post-2021',
        'elseworlds': 'Elseworlds: Non-canon alternate reality stories',
        'post-crisis': 'Post-Crisis: Following Crisis on Infinite Earths (1985-2011)',
        'future-state': 'Future State: Dystopian future timeline'
    };
    
    document.addEventListener('mouseover', (e) => {
        const badge = e.target.closest('.era-badge');
        if (badge) {
            const era = badge.dataset.era;
            if (era && eraDescriptions[era]) {
                tooltip.textContent = eraDescriptions[era];
                tooltip.classList.add('active');
                updateTooltipPosition(e);
            }
        }
    });
    
    document.addEventListener('mousemove', (e) => {
        if (tooltip.classList.contains('active')) {
            updateTooltipPosition(e);
        }
    });
    
    document.addEventListener('mouseout', (e) => {
        const badge = e.target.closest('.era-badge');
        if (badge) {
            tooltip.classList.remove('active');
        }
    });
    
    function updateTooltipPosition(e) {
        tooltip.style.left = e.pageX + 10 + 'px';
        tooltip.style.top = e.pageY + 10 + 'px';
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    setupLazyLoading();
    setupEraTooltips();
});

// Export utilities for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        fetchAPI,
        formatDate,
        debounce,
        showNotification,
        openModal,
        closeModal,
        setupLazyLoading
    };
}
