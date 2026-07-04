// App State
const state = {
    updates: [],
    selectedUpdate: null,
    activeFilter: 'all',
    searchQuery: '',
    selectedHashtags: ['#BigQuery', '#GoogleCloud']
};

// DOM Elements
const elements = {
    btnRefresh: document.getElementById('btn-refresh'),
    spinnerIcon: document.getElementById('spinner-icon'),
    feedSubtitle: document.getElementById('feed-subtitle'),
    searchInput: document.getElementById('search-input'),
    filterTags: document.querySelectorAll('.filter-tag'),
    notesContainer: document.getElementById('notes-container'),
    composerCard: document.getElementById('composer-card'),
    composerPlaceholder: document.getElementById('composer-placeholder'),
    composerActive: document.getElementById('composer-active'),
    btnClearSelection: document.getElementById('btn-clear-selection'),
    previewNoteTitle: document.getElementById('preview-note-title'),
    previewNoteDate: document.getElementById('preview-note-date'),
    tweetTextarea: document.getElementById('tweet-textarea'),
    charProgress: document.getElementById('char-progress'),
    charCounter: document.getElementById('char-counter'),
    hashtagBtns: document.querySelectorAll('.hashtag-btn'),
    btnTweet: document.getElementById('btn-tweet'),
    toast: document.getElementById('toast'),
    toastMessage: document.getElementById('toast-message')
};

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    fetchReleaseNotes();
    setupEventListeners();
});

// Setup Events
function setupEventListeners() {
    // Refresh button
    elements.btnRefresh.addEventListener('click', fetchReleaseNotes);

    // Search input
    elements.searchInput.addEventListener('input', (e) => {
        state.searchQuery = e.target.value.toLowerCase();
        renderUpdates();
    });

    // Filter tags
    elements.filterTags.forEach(tag => {
        tag.addEventListener('click', () => {
            elements.filterTags.forEach(t => t.classList.remove('active'));
            tag.classList.add('active');
            state.activeFilter = tag.dataset.filter;
            renderUpdates();
        });
    });

    // Clear selection
    elements.btnClearSelection.addEventListener('click', clearSelection);

    // Tweet textarea typing
    elements.tweetTextarea.addEventListener('input', () => {
        updateCharCount();
    });

    // Hashtag toggles
    elements.hashtagBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tag = btn.dataset.hashtag;
            btn.classList.toggle('active');
            
            if (btn.classList.contains('active')) {
                if (!state.selectedHashtags.includes(tag)) {
                    state.selectedHashtags.push(tag);
                }
            } else {
                state.selectedHashtags = state.selectedHashtags.filter(t => t !== tag);
            }
            
            regenerateDraftTweet();
        });
    });

    // Tweet action
    elements.btnTweet.addEventListener('click', shareOnTwitter);
}

// Fetch data from backend
async function fetchReleaseNotes() {
    try {
        setLoadingState(true);
        const response = await fetch('/api/release-notes');
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.status === 'success') {
            state.updates = data.entries;
            elements.feedSubtitle.textContent = `Last updated: ${data.updated || 'Recently'} • ${state.updates.length} updates loaded`;
            renderUpdates();
        } else {
            showToast(data.message || 'Failed to fetch release notes.');
        }
    } catch (error) {
        console.error('Error fetching release notes:', error);
        showToast(error.message || 'Network error fetching release notes.');
    } finally {
        setLoadingState(false);
    }
}

// Set Loading States
function setLoadingState(isLoading) {
    if (isLoading) {
        elements.spinnerIcon.classList.add('spinning');
        elements.btnRefresh.disabled = true;
        elements.notesContainer.innerHTML = `
            <div class="skeleton-card"></div>
            <div class="skeleton-card"></div>
            <div class="skeleton-card"></div>
        `;
    } else {
        elements.spinnerIcon.classList.remove('spinning');
        elements.btnRefresh.disabled = false;
    }
}

// Filter and Render updates
function renderUpdates() {
    elements.notesContainer.innerHTML = '';
    
    const filtered = state.updates.filter(update => {
        // Category Filter
        const type = update.type.toLowerCase();
        let matchesCategory = false;
        
        if (state.activeFilter === 'all') {
            matchesCategory = true;
        } else if (state.activeFilter === 'feature') {
            matchesCategory = type.includes('feature') || type.includes('new');
        } else if (state.activeFilter === 'changed') {
            matchesCategory = type.includes('changed') || type.includes('change') || type.includes('update');
        } else if (state.activeFilter === 'deprecated') {
            matchesCategory = type.includes('deprecated') || type.includes('deprecation');
        } else if (state.activeFilter === 'fixed') {
            matchesCategory = type.includes('fixed') || type.includes('fix') || type.includes('resolved');
        }
        
        // Search Filter
        const cleanContent = stripHtml(update.content).toLowerCase();
        const matchesSearch = update.date.toLowerCase().includes(state.searchQuery) ||
                             update.type.toLowerCase().includes(state.searchQuery) ||
                             cleanContent.includes(state.searchQuery);
                             
        return matchesCategory && matchesSearch;
    });

    if (filtered.length === 0) {
        elements.notesContainer.innerHTML = `
            <div class="composer-placeholder" style="grid-column: 1/-1; padding: 4rem 1rem;">
                <span class="material-symbols-outlined placeholder-icon" style="font-size: 3rem; width: 64px; height: 64px;">search_off</span>
                <h3>No updates found</h3>
                <p>Try adjusting your search terms or selecting a different filter category.</p>
            </div>
        `;
        return;
    }

    filtered.forEach(update => {
        const card = createNoteCard(update);
        elements.notesContainer.appendChild(card);
    });
}

// Create Card Element
function createNoteCard(update) {
    const card = document.createElement('article');
    card.className = `note-card ${state.selectedUpdate && state.selectedUpdate.id === update.id ? 'selected' : ''}`;
    card.dataset.id = update.id;
    
    // Determine badge class
    const typeLower = update.type.toLowerCase();
    let badgeClass = 'badge-general';
    if (typeLower.includes('feature') || typeLower.includes('new')) badgeClass = 'badge-feature';
    else if (typeLower.includes('change') || typeLower.includes('update')) badgeClass = 'badge-changed';
    else if (typeLower.includes('deprecated')) badgeClass = 'badge-deprecated';
    else if (typeLower.includes('fix') || typeLower.includes('resolved')) badgeClass = 'badge-fixed';

    card.innerHTML = `
        <div class="note-card-header">
            <div class="note-meta">
                <span class="note-date">${update.date}</span>
                <span class="badge ${badgeClass}">${update.type}</span>
            </div>
            <div class="select-indicator">
                <span class="material-symbols-outlined">check</span>
            </div>
        </div>
        <div class="note-content-body">
            ${update.content}
        </div>
        <div class="note-card-actions">
            <button class="btn-card-tweet" title="Select and Draft Tweet">
                <svg class="twitter-icon" viewBox="0 0 24 24" aria-hidden="true">
                    <path fill="currentColor" d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"></path>
                </svg>
                <span>Draft Tweet</span>
            </button>
        </div>
    `;

    // Click handler to select card
    card.addEventListener('click', (e) => {
        // Prevent selection toggling if clicking a link inside the card
        if (e.target.tagName === 'A' || e.target.closest('a')) return;
        
        selectUpdate(update);
    });

    return card;
}

// Select Update
function selectUpdate(update) {
    state.selectedUpdate = update;
    
    // Highlight correct card visually
    document.querySelectorAll('.note-card').forEach(card => {
        if (card.dataset.id === update.id) {
            card.classList.add('selected');
        } else {
            card.classList.remove('selected');
        }
    });

    // Populate and show composer
    elements.composerPlaceholder.classList.add('hidden');
    elements.composerActive.classList.remove('hidden');
    
    elements.previewNoteTitle.textContent = `BigQuery ${update.type}`;
    elements.previewNoteDate.textContent = update.date;

    // Reset default hashtags in UI
    elements.hashtagBtns.forEach(btn => {
        const tag = btn.dataset.hashtag;
        if (state.selectedHashtags.includes(tag)) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    regenerateDraftTweet();
}

// Clear Selection
function clearSelection() {
    state.selectedUpdate = null;
    document.querySelectorAll('.note-card').forEach(card => card.classList.remove('selected'));
    elements.composerActive.classList.add('hidden');
    elements.composerPlaceholder.classList.remove('hidden');
}

// Regenerate draft tweet content
function regenerateDraftTweet() {
    if (!state.selectedUpdate) return;
    
    const update = state.selectedUpdate;
    const header = `BigQuery ${update.type} (${update.date}): `;
    const link = update.link || "https://cloud.google.com/bigquery/docs/release-notes";
    const tagsString = state.selectedHashtags.join(' ');
    
    // Parse HTML to plain text
    let plainBody = stripHtml(update.content).trim().replace(/\s+/g, ' ');
    
    // Twitter URL shortening standard (23 characters per URL)
    const urlPlaceholderLen = 23;
    
    // Calculate space limit
    // Header + space + body + space + tags + space + link
    const metadataLen = header.length + 1 + (tagsString ? tagsString.length + 1 : 0) + urlPlaceholderLen;
    const availableBodyLen = 280 - metadataLen;
    
    if (plainBody.length > availableBodyLen) {
        plainBody = plainBody.substring(0, availableBodyLen - 3) + "...";
    }
    
    const tweetText = `${header}${plainBody}${tagsString ? ' ' + tagsString : ''} ${link}`;
    elements.tweetTextarea.value = tweetText;
    updateCharCount();
}

// Real-time character count tracking (accurate to Twitter url shortener rule)
function updateCharCount() {
    const text = elements.tweetTextarea.value;
    
    // Regex for URLs
    const urlRegex = /https?:\/\/[^\s]+/g;
    const urls = text.match(urlRegex) || [];
    
    // Calculate length replacing actual URLs with 23 characters
    let length = text.replace(urlRegex, '').length;
    length += urls.length * 23;

    elements.charCounter.textContent = `${length} / 280`;

    // Visuals for character limit
    const percent = Math.min((length / 280) * 100, 100);
    elements.charProgress.style.width = `${percent}%`;
    
    // Class toggling based on limits
    elements.charProgress.className = 'progress-bar-fill';
    elements.charCounter.className = '';
    
    if (length > 280) {
        elements.charProgress.classList.add('danger');
        elements.charCounter.classList.add('danger');
        elements.btnTweet.disabled = true;
    } else if (length > 250) {
        elements.charProgress.classList.add('warning');
        elements.charCounter.classList.add('warning');
        elements.btnTweet.disabled = false;
    } else {
        elements.btnTweet.disabled = false;
    }
}

// Redirect to Twitter Intent
function shareOnTwitter() {
    if (elements.btnTweet.disabled || !state.selectedUpdate) return;
    
    const tweetText = elements.tweetTextarea.value;
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`;
    
    // Open Twitter Web Intent in a new tab
    window.open(twitterUrl, '_blank', 'noopener,noreferrer');
}

// Helper: Strip HTML tags
function stripHtml(html) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return doc.body.textContent || "";
}

// Helper: Show Error Toast
let toastTimeout;
function showToast(message) {
    elements.toastMessage.textContent = message;
    elements.toast.classList.remove('hidden');
    
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
        elements.toast.classList.add('hidden');
    }, 4000);
}
