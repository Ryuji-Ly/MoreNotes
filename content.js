// === Logger
function log(...args) {
    console.log("[MORE NOTES]", ...args);
}

// === Wait for an element to appear
function waitForElement(selector, root = document) {
    return new Promise((resolve) => {
        const found = root.querySelector(selector);
        if (found) return resolve(found);
        const observer = new MutationObserver(() => {
            const el = root.querySelector(selector);
            if (el) {
                observer.disconnect();
                resolve(el);
            }
        });
        observer.observe(root, { childList: true, subtree: true });
    });
}

// === Extract user ID from avatar
function extractUserId(panel) {
    const avatar = panel.querySelector('img[src*="avatars/"]');
    const match = avatar?.src.match(/avatars\/(\d+)/);
    const userId = match?.[1];
    log("Extracted user ID:", userId);
    return userId || null;
}

// === Enhance note icon buttons
function setupNoteIcons() {
    const modified = new WeakSet();

    const observer = new MutationObserver(async () => {
        const icons = document.querySelectorAll(
            'button[aria-label^="Add Note"], button[aria-label^=""]'
        );

        for (const btn of icons) {
            if (modified.has(btn)) continue;

            const panel = btn.closest('[role="dialog"]') || document;
            const userId = extractUserId(panel);
            if (!userId) continue;

            const note = await chrome.runtime.sendMessage({ cmd: "get", id: userId });
            if (!note?.trim()) continue;

            log("↪ Enhancing icon for user", userId);
            modified.add(btn);

            const svg = btn.querySelector("svg");
            if (svg) {
                svg.innerHTML = `
                <path fill="currentColor" fill-rule="evenodd" d="M5 2a3 3 0 0 0-3 3v14a3 3 0 0 0 3 3h14a3 3 0 0 0 3-3V5a3 3 0 0 0-3-3H5Zm1 4a1 1 0 0 0 0 2h5a1 1 0 1 0 0-2H6Zm-1 6a1 1 0 0 1 1-1h12a1 1 0 1 1 0 2H6a1 1 0 0 1-1-1Zm1 4a1 1 0 1 0 0 2h12a1 1 0 1 0 0-2H6Z" clip-rule="evenodd" class=""></path>
        `;
            }

            const reset = new MutationObserver(() => {
                if (!document.body.contains(btn)) {
                    modified.delete(btn);
                    reset.disconnect();
                }
            });
            reset.observe(document.body, { childList: true, subtree: true });
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });
}

function overrideDiscordTooltips() {
    const tooltipObserver = new MutationObserver(async (mutations) => {
        for (const mutation of mutations) {
            for (const node of mutation.addedNodes) {
                if (!(node instanceof HTMLElement)) continue;

                // Find tooltip container
                const tooltip = node.matches('[class*="tooltip"]')
                    ? node
                    : node.querySelector('[class*="tooltip"]');
                if (!tooltip) continue;

                // Match the content div that contains the actual text
                const contentDiv = tooltip.querySelector('[class*="tooltipContent"]');
                if (!contentDiv || !contentDiv.textContent.includes("Add Note")) continue;

                const panel = document.querySelector('[role="dialog"]') || document;
                const userId = extractUserId(panel);
                if (!userId) continue;

                const note = await chrome.runtime.sendMessage({ cmd: "get", id: userId });
                if (!note?.trim()) return;

                log("Replacing tooltip content with local note:", note);

                contentDiv.textContent = note;
                contentDiv.style.whiteSpace = "pre-wrap";

                const iconElement = document.querySelector(
                    '[aria-label^="Add Note"], [aria-label$="note"]'
                );
                log("Attempting tooltip reposition");

                const tooltipBox = tooltip.querySelector('[class*="tooltipContent"]');
                const pointer = tooltip.querySelector('[class*="tooltipPointer"]');
                const pointerBg = tooltip.querySelector('[class*="tooltipPointerBg"]');

                if (!tooltipBox || !iconElement) return;

                const iconRect = iconElement.getBoundingClientRect();
                const tooltipRect = tooltip.getBoundingClientRect();
                const screenPadding = 8;

                tooltip.style.transform = "none";
                tooltip.style.opacity = "1";
                tooltip.style.transition = "none";
                tooltip.style.position = "fixed";
                tooltip.style.zIndex = "9999";

                let left = iconRect.left + iconRect.width / 2 - tooltipRect.width / 2;
                let top = iconRect.top - tooltipRect.height - 6;

                left = Math.max(
                    screenPadding,
                    Math.min(left, window.innerWidth - tooltipRect.width - screenPadding)
                );

                tooltip.style.left = `${left}px`;
                tooltip.style.top = `${top}px`;

                if (pointer) pointer.style.left = "50%";
                if (pointerBg) pointerBg.style.left = "50%";

                log(`Tooltip centered at (${left}px, ${top}px)`);
            }
        }
    });

    tooltipObserver.observe(document.body, {
        childList: true,
        subtree: true,
    });
}

// === Main note watcher
(async function watchNoteEditor() {
    setupNoteIcons();
    overrideDiscordTooltips();
    const processedNoteDialogs = new Set();

    const observer = new MutationObserver(async () => {
        const dialogs = document.querySelectorAll('[role="dialog"]');
        for (const dialog of dialogs) {
            if (processedNoteDialogs.has(dialog)) continue;

            const textarea = dialog.querySelector(
                'textarea[class*="note"], textarea[class*="textarea"]'
            );
            if (!textarea) continue;

            processedNoteDialogs.add(dialog);
            log("Note textarea opened");

            const userId = extractUserId(dialog);
            if (!userId) continue;

            const discordNote = textarea.value.trim();
            if (discordNote) {
                log("Saving existing Discord note to local:", discordNote);
                await chrome.runtime.sendMessage({ cmd: "set", id: userId, text: discordNote });
            }

            const storedNote = await chrome.runtime.sendMessage({ cmd: "get", id: userId });
            log("Injecting local note:", storedNote);
            textarea.value = storedNote;
            textarea.dispatchEvent(new Event("input", { bubbles: true }));

            let timer;
            textarea.addEventListener(
                "input",
                () => {
                    clearTimeout(timer);
                    timer = setTimeout(() => {
                        chrome.runtime.sendMessage({
                            cmd: "set",
                            id: userId,
                            text: textarea.value,
                        });
                        log("Saved local edit for user:", userId, "→", textarea.value);
                    }, 400);
                },
                { passive: true }
            );
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });
})();

// === Heartbeat
setInterval(() => {
    if (window.location.hostname.includes("discord.com")) {
        const manifest = chrome.runtime.getManifest();
        log(`Extension active on Discord web (v${manifest.version})`);
    }
}, 5000);
