// options.js
document.getElementById("export").onclick = () => {
    chrome.storage.local.get(null, (data) => {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "discord-notes-export.json";
        a.click();
        URL.revokeObjectURL(url);
        document.getElementById("status").textContent = "Notes exported.";
    });
};

document.getElementById("import").onclick = () => {
    document.getElementById("file").click();
};

document.getElementById("file").onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
        try {
            const notes = JSON.parse(reader.result);
            // Optional: validate structure here
            chrome.storage.local.set(notes, () => {
                document.getElementById("status").textContent = "Notes imported.";
            });
        } catch (err) {
            console.error(err);
            document.getElementById("status").textContent = "Invalid JSON file.";
        }
    };
    reader.readAsText(file);
};
