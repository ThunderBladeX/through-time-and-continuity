// Escapes HTML special characters in a string to prevent XSS attacks
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

// Parses a Markdown string into an HTML string
function parseMarkdown(markdown) {
    if (!markdown) return '';

    // The processing order is crucial for correctness.
    // 1. Escape HTML initially to prevent XSS.

    let html = markdown;

    // 2. Code blocks (```) - Process first to prevent their content from being parsed.
    html = html.replace(/```([a-z]*)\n([\s\S]*?)```/g, (match, lang, code) => {
        const escapedCode = escapeHtml(code);
        const languageClass = lang ? `language-${lang}` : '';
        return `<pre><code class="${languageClass}">${escapedCode.trim()}</code></pre>`;
    });

    // 3. Blockquotes (>) - Improved to handle multi-line blocks.
    html = html.replace(/^(> .+\n?)+/gm, (match) => {
        const content = match.split('\n')
            .map(line => line.replace(/^> ?/, ''))
            .join('\n')
            .trim();
        // Recursively parse the content inside the blockquote for other markdown elements.
        return `<blockquote>${parseMarkdown(content)}</blockquote>`;
    });

    // 4. Headers (# to ######) - Consolidated into a single, more efficient regex.
    html = html.replace(/^ *(#{1,6})\s+(.+?)\s*#*$/gm, (match, hashes, content) => {
        const level = hashes.length;
        return `<h${level}>${content}</h${level}>`;
    });


    // 5. Horizontal rule (---, ***, ___)
    html = html.replace(/^(?:---|\*\*\*|___)\s*$/gm, '<hr>');
    
    // 6. Lists - Defer to a dedicated function for complex logic.
    html = processLists(html);

    // 7. Inline elements
    // The order here is important: from most specific to least specific.
    
    // Images: ![alt](src)
    html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, src) =>
        `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" loading="lazy">`);

    // Links: [text](href)
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, text, href) =>
        `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${text}</a>`);
    
    // Bold and Italic (***text*** or ___text___)
    html = html.replace(/(\*\*\*|___)(.+?)\1/g, '<strong><em>$2</em></strong>');
    
    // Bold (**text** or __text__)
    html = html.replace(/(\*\*|__)(.+?)\1/g, '<strong>$2</strong>');
    
    // Italic (*text* or _text_)
    html = html.replace(/(\*|_)(.+?)\1/g, '<em>$2</em>');

    // Strikethrough (~~text~~)
    html = html.replace(/~~(.+?)~~/g, '<del>$1</del>');
    
    // Inline code (`)
    html = html.replace(/`([^`]+)`/g, (match, code) => `<code>${escapeHtml(code)}</code>`);

    // 8. Line breaks (two spaces at end of line)
    html = html.replace(/ {2,}\n/g, '<br>\n');

    // 9. Paragraphs (wrap remaining text blocks)
    html = processParagraphs(html);

    return html.trim();
}

// Processes markdown lists, including nested lists
function processLists(text) {
    // Handles nested lists by tracking indentation.
    const listRegex = /^( *)([-*]|\d+\.)\s+(.*)/;
    const lines = text.split('\n');
    let html = '';
    const stack = []; // To track list type ('ul' or 'ol') and indentation level

    for (const line of lines) {
        const match = line.match(listRegex);

        if (match) {
            const indent = match[1].length;
            const marker = match[2];
            const content = match[3];
            const listType = marker.match(/\d/) ? 'ol' : 'ul';

            // Close nested lists if we de-dent
            while (stack.length > 0 && indent < stack[stack.length - 1].indent) {
                html += `</${stack.pop().type}>`;
            }

            // Start a new list if needed
            if (stack.length === 0 || indent > stack[stack.length - 1].indent || listType !== stack[stack.length - 1].type) {
                html += `<${listType}>`;
                stack.push({ type: listType, indent: indent });
            }

            html += `<li>${content}</li>`;
        } else {
            // Not a list item, so close all open lists
            while (stack.length > 0) {
                html += `</${stack.pop().type}>`;
            }
            html += `\n${line}`;
        }
    }

    // Close any remaining open lists at the end of the file
    while (stack.length > 0) {
        html += `</${stack.pop().type}>`;
    }

    return html;
}

// Wraps text blocks in <p> tags, avoiding block-level elements
function processParagraphs(html) {
    // Split the content into blocks separated by one or more blank lines.
    const blocks = html.split(/\n{2,}/);
    
    return blocks.map(block => {
        if (!block) return '';
        
        block = block.trim();
        
        // Don't wrap existing block-level elements in a <p> tag.
        const isBlockElement = /^(<h[1-6]|<ul|<ol|<pre|<blockquote|<hr|<div)/.test(block);
        
        if (isBlockElement) {
            return block;
        }
        
        // Wrap the block in a <p> tag, and replace single newlines with <br>
        return `<p>${block.replace(/\n/g, '<br>')}</p>`;
    }).join('\n\n');
}

// Sets up a live preview for a Markdown editor
function setupMarkdownPreview(editorId, previewId) {
    const editor = document.getElementById(editorId);
    const preview = document.getElementById(previewId);

    if (!editor || !preview) {
        console.error("Editor or preview element not found.");
        return;
    }

    const renderPreview = () => {
        preview.innerHTML = parseMarkdown(editor.value);
    };

    // Initial render
    renderPreview();

    // Live update with debounce to avoid excessive re-renders
    editor.addEventListener('input', debounce(renderPreview, 250));
}

// Inserts markdown syntax into a textarea at the cursor position
function insertMarkdown(textarea, before, after = '') {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = textarea.value.substring(start, end);
    const replacement = before + selectedText + after;

    textarea.setSelectionRange(start, end);
    document.execCommand('insertText', false, replacement);

    // Set cursor position after insertion
    const newCursorPos = start + before.length;
    textarea.setSelectionRange(newCursorPos, newCursorPos + selectedText.length);
    textarea.focus();

    // Trigger input event for live preview to update
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
}

// An object containing markdown toolbar actions
const markdownActions = {
    bold: (textarea) => insertMarkdown(textarea, '**', '**'),
    italic: (textarea) => insertMarkdown(textarea, '*', '*'),
    heading: (textarea) => insertMarkdown(textarea, '## ', ''),
    link: (textarea) => {
        const url = prompt('Enter URL:');
        if (url) {
            if (textarea.selectionStart === textarea.selectionEnd) {
                 insertMarkdown(textarea, `[link text](${url})`);
            } else {
                 insertMarkdown(textarea, '[', `](${url})`);
            }
        }
    },
    list: (textarea) => insertMarkdown(textarea, '\n- ', ''),
    code: (textarea) => insertMarkdown(textarea, '`', '`'),
    codeBlock: (textarea) => insertMarkdown(textarea, '\n```\n', '\n```'),
    quote: (textarea) => insertMarkdown(textarea, '\n> ', '')
};

// Creates and attaches event listeners for a Markdown toolbar
function setupMarkdownToolbar(textareaId, toolbarId) {
    const textarea = document.getElementById(textareaId);
    const toolbar = document.getElementById(toolbarId);

    if (!textarea || !toolbar) {
        console.error("Textarea or toolbar element not found.");
        return;
    }

    const buttons = [
        { action: 'bold', icon: '<b>B</b>', title: 'Bold (Ctrl+B)' },
        { action: 'italic', icon: '<i>I</i>', title: 'Italic (Ctrl+I)' },
        { action: 'heading', icon: '<b>H</b>', title: 'Heading' },
        { action: 'link', icon: '🔗', title: 'Link (Ctrl+K)' },
        { action: 'list', icon: '•', title: 'List' },
        { action: 'code', icon: '<code>&lt;/&gt;</code>', title: 'Code' },
        { action: 'codeBlock', icon: '<code>{}</code>', title: 'Code Block' },
        { action: 'quote', icon: '❞', title: 'Quote' }
    ];

    toolbar.innerHTML = buttons.map(btn => `
        <button type="button" 
                class="toolbar-btn" 
                data-action="${btn.action}"
                title="${btn.title}"
                aria-label="${btn.title}">
            ${btn.icon}
        </button>
    `).join('');

    toolbar.addEventListener('click', (e) => {
        const button = e.target.closest('.toolbar-btn');
        if (button) {
            const action = button.dataset.action;
            if (markdownActions[action]) {
                markdownActions[action](textarea);
            }
        }
    });

    // Keyboard shortcuts
    textarea.addEventListener('keydown', (e) => {
        if (e.ctrlKey || e.metaKey) {
            let handled = true;
            switch (e.key.toLowerCase()) {
                case 'b':
                    markdownActions.bold(textarea);
                    break;
                case 'i':
                    markdownActions.italic(textarea);
                    break;
                case 'k':
                    markdownActions.link(textarea);
                    break;
                default:
                    handled = false;
            }
            if (handled) {
                e.preventDefault();
            }
        }
    });
}

// Exports for use in a modular environment
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        parseMarkdown,
        setupMarkdownPreview,
        setupMarkdownToolbar,
        markdownActions,
        escapeHtml
    };
}
