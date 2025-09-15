chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    (async () => {
        if (msg.cmd === "get") {
            const data = await chrome.storage.local.get(msg.id);
            sendResponse(data[msg.id] || "");
        }
        if (msg.cmd === "set") {
            await chrome.storage.local.set({ [msg.id]: msg.text });
            sendResponse({ ok: true });
        }
        if (msg.cmd === "delete") {
            await chrome.storage.local.remove(msg.id);
            sendResponse({ ok: true });
        }
    })();
    return true;
});
