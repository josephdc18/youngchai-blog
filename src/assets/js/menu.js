const menuBtn = document.getElementById('menu-btn');
const mobileMenu = document.getElementById('mobile-menu');
const menuIconContainer = document.getElementById('menu-icon-container');
const navbar = document.getElementById('navbar');
const searchBtn = document.getElementById('search-btn');
const searchBtnMobile = document.getElementById('search-btn-mobile');
const searchOverlay = document.getElementById('search-overlay');
const searchCloseBtn = document.getElementById('search-close');
const searchInput = document.getElementById('search-input');
const searchResults = document.getElementById('search-results');
const searchEmpty = document.getElementById('search-empty');

let scrollLockCount = 0;
let searchPosts = [];

function lockScroll() {
    scrollLockCount += 1;
    document.body.classList.add('no-scroll');
}

function unlockScroll() {
    scrollLockCount = Math.max(0, scrollLockCount - 1);
    if (scrollLockCount === 0) {
        document.body.classList.remove('no-scroll');
    }
}

function escapeHTML(value = '') {
    return value.replace(/[&<>"']/g, (char) => {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;',
        };
        return map[char] || char;
    });
}

function setMenuState(isOpen) {
    if (!menuBtn || !mobileMenu || !menuIconContainer) return;

    menuBtn.setAttribute('aria-expanded', isOpen);
    mobileMenu.setAttribute('aria-hidden', !isOpen);

    if (isOpen) {
        mobileMenu.classList.remove('hidden');
        requestAnimationFrame(() => mobileMenu.classList.remove('opacity-0'));
        menuIconContainer.innerHTML = '<i data-lucide="x" width="20" height="20"></i>';
        lockScroll();
    } else {
        mobileMenu.classList.add('opacity-0');
        setTimeout(() => mobileMenu.classList.add('hidden'), 200);
        menuIconContainer.innerHTML = '<i data-lucide="menu" width="20" height="20"></i>';
        unlockScroll();
    }

    if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons();
    }
}

function toggleMenu() {
    const isOpen = menuBtn.getAttribute('aria-expanded') === 'true';
    setMenuState(!isOpen);
}

if (menuBtn) {
    menuBtn.addEventListener('click', toggleMenu);
}

if (mobileMenu) {
    mobileMenu.addEventListener('click', (event) => {
        if (event.target.matches('a')) {
            setMenuState(false);
        }
    });
}

document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
        if (searchOverlay && !searchOverlay.classList.contains('hidden')) {
            closeSearch();
            return;
        }
        setMenuState(false);
    }
});

function handleNavbarScroll() {
    if (!navbar) return;
    if (window.scrollY > 16) {
        navbar.classList.add('scrolled');
    } else {
        navbar.classList.remove('scrolled');
    }
}

handleNavbarScroll();
window.addEventListener('scroll', handleNavbarScroll);

function loadSearchData() {
    const script = document.getElementById('post-search-data');
    if (script) {
        try {
            searchPosts = JSON.parse(script.textContent || '[]');
        } catch (error) {
            searchPosts = [];
        }
    }
}

function renderSearchResults(items) {
    if (!searchResults || !searchEmpty) return;
    if (!items.length) {
        searchResults.innerHTML = '';
        searchEmpty.style.display = 'block';
        return;
    }
    searchEmpty.style.display = 'none';
    const markup = items.slice(0, 8).map((post) => {
        const safeTitle = escapeHTML(post.title || '');
        const safeDescription = escapeHTML(post.description || '');
        const safeCategory = escapeHTML(post.category || 'POST');
        return `<li>
            <a href="${post.url}">
                <span class="search-result-meta">${safeCategory}</span>
                <span class="search-result-title">${safeTitle}</span>
                <span class="post-excerpt" style="font-size:0.9rem;color:#6b7280;">${safeDescription}</span>
            </a>
        </li>`;
    }).join('');
    searchResults.innerHTML = markup;
}

function filterPosts(query) {
    if (!query) {
        renderSearchResults(searchPosts.slice(0, 6));
        return;
    }
    const normalized = query.toLowerCase();
    const matches = searchPosts.filter((post) => {
        return (post.title && post.title.toLowerCase().includes(normalized)) ||
            (post.description && post.description.toLowerCase().includes(normalized)) ||
            (post.category && post.category.toLowerCase().includes(normalized));
    });
    renderSearchResults(matches);
}

function openSearch() {
    if (!searchOverlay) return;
    searchOverlay.classList.remove('hidden');
    searchOverlay.setAttribute('aria-hidden', 'false');
    lockScroll();
    if (searchInput) {
        searchInput.value = '';
        searchInput.focus();
    }
    filterPosts('');
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons();
    }
}

function closeSearch() {
    if (!searchOverlay) return;
    searchOverlay.classList.add('hidden');
    searchOverlay.setAttribute('aria-hidden', 'true');
    if (searchEmpty) {
        searchEmpty.style.display = 'none';
    }
    unlockScroll();
}

function toggleSearch() {
    if (!searchOverlay) return;
    if (searchOverlay.classList.contains('hidden')) {
        openSearch();
    } else {
        closeSearch();
    }
}

function initSearch() {
    loadSearchData();
    if (!searchOverlay) return;
    // Toggle search on button click (can open and close)
    if (searchBtn) {
        searchBtn.addEventListener('click', toggleSearch);
    }
    if (searchBtnMobile) {
        searchBtnMobile.addEventListener('click', toggleSearch);
    }
    if (searchCloseBtn) {
        searchCloseBtn.addEventListener('click', closeSearch);
    }
    searchOverlay.addEventListener('click', (event) => {
        if (event.target === searchOverlay) {
            closeSearch();
        }
    });
    if (searchInput) {
        searchInput.addEventListener('input', (event) => {
            filterPosts(event.target.value || '');
        });
    }
}

initSearch();

// Sticky sidebar fallback for browsers that don't support CSS sticky well
function initStickySidebar() {
    const stickyWrapper = document.querySelector('.sticky-wrapper');
    if (!stickyWrapper || window.innerWidth < 1024) return;
    
    const sidebar = stickyWrapper.closest('.sidebar-col');
    if (!sidebar) return;
    
    // Ensure the sticky wrapper has proper styles
    stickyWrapper.style.position = 'sticky';
    stickyWrapper.style.top = '8rem';
    
    // Ensure sidebar doesn't stretch
    sidebar.style.alignSelf = 'start';
}

// Run on load and resize
initStickySidebar();
window.addEventListener('resize', initStickySidebar);

// Mobile Navigation Accordions
function initMobileNavAccordions() {
    const toggleButtons = document.querySelectorAll('.mobile-subnav-toggle');
    
    toggleButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const navGroup = btn.closest('.mobile-nav-group');
            const subnav = navGroup.querySelector('.mobile-subnav');
            
            if (!subnav) return;
            
            const isExpanded = btn.getAttribute('aria-expanded') === 'true';
            
            if (isExpanded) {
                subnav.classList.add('collapsed');
                btn.classList.remove('open');
                btn.setAttribute('aria-expanded', 'false');
            } else {
                subnav.classList.remove('collapsed');
                btn.classList.add('open');
                btn.setAttribute('aria-expanded', 'true');
            }
            
            // Re-create Lucide icons
            if (window.lucide && typeof window.lucide.createIcons === 'function') {
                window.lucide.createIcons();
            }
        });
    });
}

initMobileNavAccordions();
