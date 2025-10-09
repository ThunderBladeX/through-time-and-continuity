function parseMarkdown(markdown) {
    if (!markdown) return '';
    
    let html = markdown;
    
    // Escape HTML to prevent XSS
    html = escapeHtml(html);
    
    // Code blocks (```)
    html = html.replace(/```([^\n]*)\n([\s\S]*?)```/g, (match, lang, code) => {
        return `<pre><code class="language-${lang}">${code.trim()}</code></pre>`;
    });
    
    // Inline code (`)
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    
    // Headers (# ## ### #### ##### ######)
    html = html.replace(/^######\s+(.+)$/gm, '<h6>$1</h6>');
    html = html.replace(/^#####\s+(.+)$/gm, '<h5>$1</h5>');
    html = html.replace(/^####\s+(.+)$/gm, '<h4>$1</h4>');
    html = html.replace(/^###\s+(.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^##\s+(.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^#\s+(.+)$/gm, '<h1>$1</h1>');
    
    // Blockquotes (>)
    html = html.replace(/^>\s+(.+)$/gm, '<blockquote>$1</blockquote>');
    
    // Horizontal rule (---)
    html = html.replace(/^---$/gm, '<hr>');
    
    // Bold (**text** or __text__)
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');
    
    // Italic (*text* or _text_)
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
    html = html.replace(/_(.+?)_/g, '<em>$1</em>');
    
    // Strikethrough (~~text~~)
    html = html.replace(/~~(.+?)~~/g, '<del>$1</del>');
    
    // Links ([text](url))
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    
    // Images (![alt](url))
    html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" loading="lazy">');
    
    // Unordered lists (- item or * item)
    html = processLists(html);
    
    // Line breaks (two spaces at end of line)
    html = html.replace(/  \n/g, '<br>\n');
    
    // Paragraphs (double line break)
    html = processParagraphs(html);
    
    return html;
}

function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

function processLists(html) {
    const lines = html.split('\n');
    let inList = false;
    let listType = null; // 'ul' or 'ol'
    let result = [];
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const ulMatch = line.match(/^[-*]\s+(.+)$/);
        const olMatch = line.match(/^(\d+)\.\s+(.+)$/);
        
        if (ulMatch) {
            if (!inList || listType !== 'ul') {
                if (inList) result.push(`</${listType}>`);
                result.push('<ul>');
                inList = true;
                listType = 'ul';
            }
            result.push(`<li>${ulMatch[1]}</li>`);
        } else if (olMatch) {
            if (!inList || listType !== 'ol') {
                if (inList) result.push(`</${listType}>`);
                result.push('<ol>');
                inList = true;
                listType = 'ol';
            }
            result.push(`<li>${olMatch[2]}</li>`);
        } else {
            if (inList) {
                result.push(`</${listType}>`);
                inList = false;
                listType = null;
            }
            result.push(line);
        }
    }
    
    if (inList) {
        result.push(`</${listType}>`);
    }
    
    return result.join('\n');
}

function processParagraphs(html) {
    const lines = html.split('\n');
    let result = [];
    let inParagraph = false;
    let paragraphContent = [];
    
    // Tags that should not be wrapped in paragraphs
    const blockTags = ['<h1', '<h2', '<h3', '<h4', '<h5', '<h6', '<ul', '<ol', '<pre', '<blockquote', '<hr', '<div'];
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        // Check if line starts with a block tag
        const isBlockTag = blockTags.some(tag => line.startsWith(tag));
        const isEmpty = line === '';
        
        if (isBlockTag) {
            // Close current paragraph if any
            if (inParagraph) {
                result.push(`<p>${paragraphContent.join(' ')}</p>`);
                paragraphContent = [];
                inParagraph = false;
            }
            result.push(line);
        } else if (isEmpty) {
            // Empty line closes paragraph
            if (inParagraph) {
                result.push(`<p>${paragraphContent.join(' ')}</p>`);
                paragraphContent = [];
                inParagraph = false;
            }
        } else {
            // Regular content line
            if (!inParagraph) {
                inParagraph = true;
            }
            paragraphContent.push(line);
        }
    }
    
    // Close final paragraph if any
    if (inParagraph) {
        result.push(`<p>${paragraphContent.join(' ')}</p>`);
    }
    
    return result.join('\n');
}

// Live preview for markdown editor
function setupMarkdownPreview(editorId, previewId) {
    const editor = document.getElementById(editorId);
    const preview = document.getElementById(previewId);
    
    if (!editor || !preview) return;
    
    // Initial render
    preview.innerHTML = parseMarkdown(editor.value);
    
    // Live update
    editor.addEventListener('input', debounce(() => {
        preview.innerHTML = parseMarkdown(editor.value);
    }, 300));
}

// Markdown toolbar helpers for admin
function insertMarkdown(textarea, before, after = '') {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = textarea.value.substring(start, end);
    const replacement = before + selectedText + after;
    
    textarea.value = textarea.value.substring(0, start) + replacement + textarea.value.substring(end);
    
    // Set cursor position
    const newCursorPos = start + before.length + selectedText.length;
    textarea.setSelectionRange(newCursorPos, newCursorPos);
    textarea.focus();
    
    // Trigger input event for preview
    textarea.dispatchEvent(new Event('input'));
}

// Markdown toolbar actions
const markdownActions = {
    bold: (textarea) => insertMarkdown(textarea, '**', '**'),
    italic: (textarea) => insertMarkdown(textarea, '*', '*'),
    heading: (textarea) => insertMarkdown(textarea, '## ', ''),
    link: (textarea) => {
        const url = prompt('Enter URL:');
        if (url) insertMarkdown(textarea, '[', `](${url})`);
    },
    list: (textarea) => insertMarkdown(textarea, '- ', ''),
    code: (textarea) => insertMarkdown(textarea, '`', '`'),
    codeBlock: (textarea) => insertMarkdown(textarea, '```\n', '\n```'),
    quote: (textarea) => insertMarkdown(textarea, '> ', '')
};

// Setup markdown toolbar
function setupMarkdownToolbar(textareaId, toolbarId) {
    const textarea = document.getElementById(textareaId);
    const toolbar = document.getElementById(toolbarId);
    
    if (!textarea || !toolbar) return;
    
    // Create toolbar buttons
    const buttons = [
        { action: 'bold', icon: 'B', title: 'Bold (Ctrl+B)' },
        { action: 'italic', icon: 'I', title: 'Italic (Ctrl+I)' },
        { action: 'heading', icon: 'H', title: 'Heading' },
        { action: 'link', icon: '🔗', title: 'Link' },
        { action: 'list', icon: '•', title: 'List' },
        { action: 'code', icon: '</>', title: 'Code' },
        { action: 'codeBlock', icon: '{ }', title: 'Code Block' },
        { action: 'quote', icon: '"', title: 'Quote' }
    ];
    
    toolbar.innerHTML = buttons.map(btn => `
        <button type="button" 
                class="toolbar-btn" 
                data-action="${btn.action}"
                title="${btn.title}">
            ${btn.icon}
        </button>
    `).join('');
    
    // Add click handlers
    toolbar.querySelectorAll('.toolbar-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const action = btn.dataset.action;
            if (markdownActions[action]) {
                markdownActions[action](textarea);
            }
        });
    });
    
    // Keyboard shortcuts
    textarea.addEventListener('keydown', (e) => {
        if (e.ctrlKey || e.metaKey) {
            switch(e.key) {
                case 'b':
                    e.preventDefault();
                    markdownActions.bold(textarea);
                    break;
                case 'i':
                    e.preventDefault();
                    markdownActions.italic(textarea);
                    break;
                case 'k':
                    e.preventDefault();
                    markdownActions.link(textarea);
                    break;
            }
        }
    });
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        parseMarkdown,
        setupMarkdownPreview,
        setupMarkdownToolbar,
        markdownActions
    };
}
