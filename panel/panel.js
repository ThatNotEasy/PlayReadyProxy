import {
    AsyncLocalStorage,
    base64toUint8Array,
    stringToUint8Array,
    RemoteCDMManager,
    SettingsManager,
} from "../util.js";

const key_container = document.getElementById("key-container");

// ================ Main ================
const enabled = document.getElementById("enabled");
enabled.addEventListener("change", async function () {
    await SettingsManager.setEnabled(enabled.checked);
});

const export_button = document.getElementById("export");
export_button.addEventListener("click", async function () {
    const logs = await AsyncLocalStorage.getStorage(null);
    SettingsManager.downloadFile(
        stringToUint8Array(JSON.stringify(logs)),
        "logs.json"
    );
});


// ================ Remote CDM ================
document.getElementById("remoteInput").addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "OPEN_PICKER" });
    window.close();
});

const remote_remove = document.getElementById("remoteRemove");
remote_remove.addEventListener("click", async function () {
    await RemoteCDMManager.removeSelectedRemoteCDM();
    remote_combobox.innerHTML = "";
    await RemoteCDMManager.loadSetAllRemoteCDMs();
    const selected_option =
        remote_combobox.options[remote_combobox.selectedIndex];
    if (selected_option) {
        await RemoteCDMManager.saveSelectedRemoteCDM(selected_option.text);
    } else {
        await RemoteCDMManager.removeSelectedRemoteCDMKey();
    }
});

const remote_download = document.getElementById("remoteDownload");
remote_download.addEventListener("click", async function () {
    const remote_cdm = await RemoteCDMManager.getSelectedRemoteCDM();
    SettingsManager.downloadFile(
        await RemoteCDMManager.loadRemoteCDM(remote_cdm),
        remote_cdm + ".json"
    );
});

const remote_combobox = document.getElementById("remote-combobox");
remote_combobox.addEventListener("change", async function () {
    await RemoteCDMManager.saveSelectedRemoteCDM(
        remote_combobox.options[remote_combobox.selectedIndex].text
    );
});

const local_combobox = document.getElementById("local-combobox");
local_combobox.addEventListener("change", async function () {
    await LocalCDMManager.saveSelectedLocalCDM(
        local_combobox.options[local_combobox.selectedIndex].text
    );
});
// ============================================

// ====================== Proxy Settings ======================

// Get elements
const enableProxy = document.getElementById("enable-proxy");
const proxyConfig = document.getElementById("proxy-config");
const proxyUrlInput = document.getElementById("proxy-url");

// Enable or disable proxy settings
enableProxy.addEventListener("change", async function () {
    const isProxyEnabled = enableProxy.checked;
    if (isProxyEnabled) {
        proxyConfig.style.display = "block";
    } else {
        proxyConfig.style.display = "none";
        await SettingsManager.saveProxyConfig(""); // Clear proxy setting if disabled
    }
    await SettingsManager.setProxyEnabled(isProxyEnabled);
});

// Save proxy URL
proxyUrlInput.addEventListener("input", async function () {
    const proxyUrl = proxyUrlInput.value;
    await SettingsManager.saveProxyConfig(proxyUrl);  // Save the proxy config
});


// ================ Command Options ================
const use_shaka = document.getElementById("use-shaka");
use_shaka.addEventListener("change", async function () {
    await SettingsManager.saveUseShakaPackager(use_shaka.checked);
});

const use_ddownloader = document.getElementById("use-ddownloader");
use_shaka.addEventListener("change", async function () {
    await SettingsManager.saveUseShakaPackager(use_ddownloader.checked);
});

const downloader_name = document.getElementById("downloader-name");
downloader_name.addEventListener("input", async function (event) {
    console.log("input change", event);
    await SettingsManager.saveExecutableName(downloader_name.value);
});
// =================================================

// ================ Keys ================
const clear = document.getElementById("clear");
clear.addEventListener("click", async function () {
    chrome.runtime.sendMessage({ type: "CLEAR" });
    key_container.innerHTML = "";
});

async function createCommand(json, key_string) {
    const metadata = JSON.parse(json);
    const header_string = Object.entries(metadata.headers)
        .map(([key, value]) => `-H "${key}: ${value.replace(/"/g, "'")}"`)
        .join(" ");
    
    // Assuming `metadata.url` is the URL to use, and output is derived from `metadata.id` or some other field
    const output = metadata.id || "output"; // Change this according to how you want to generate the output name.
    
    return `DDownloader -u "${metadata.url}" ${header_string} ${key_string} -o "${output}"`;
}

async function appendLog(result) {
    const key_string = result.keys
        .map((key) => `--key ${key.kid}:${key.k}`)
        .join(" ");

    const logContainer = document.createElement("div");
    logContainer.classList.add("log-container");
    logContainer.innerHTML = `
        <button class="toggleButton">+</button>
        <div class="expandableDiv collapsed">
            <label class="always-visible right-bound">
                URL:<input type="text" class="text-box" value="${result.url}">
            </label>
            <label class="expanded-only right-bound">
            <label class="expanded-only right-bound key-copy">
                <a href="#" title="Click to copy">Keys:</a><input type="text" class="text-box" value="${key_string}">
            </label>
            ${
                result.manifests.length > 0
                    ? `<label class="expanded-only right-bound manifest-copy">
                <a href="#" title="Click to copy">Manifest:</a><select id="manifest" class="text-box"></select>
            </label>
            <label class="expanded-only right-bound command-copy">
                <a href="#" title="Click to copy">Cmd:</a><input type="text" id="command" class="text-box">
            </label>`
                    : ""
            }
        </div>`;

    const keysInput = logContainer.querySelector(".key-copy");
    keysInput.addEventListener("click", () => {
        navigator.clipboard.writeText(key_string);
    });

    if (result.manifests.length > 0) {
        const command = logContainer.querySelector("#command");

        const select = logContainer.querySelector("#manifest");
        select.addEventListener("change", async () => {
            command.value = await createCommand(select.value, key_string);
        });
        result.manifests.forEach((manifest) => {
            const option = new Option(
                `[${manifest.type}] ${manifest.url}`,
                JSON.stringify(manifest)
            );
            select.add(option);
        });
        command.value = await createCommand(select.value, key_string);

        const manifest_copy = logContainer.querySelector(".manifest-copy");
        manifest_copy.addEventListener("click", () => {
            navigator.clipboard.writeText(JSON.parse(select.value).url);
        });

        const command_copy = logContainer.querySelector(".command-copy");
        command_copy.addEventListener("click", () => {
            navigator.clipboard.writeText(command.value);
        });
    }

    const toggleButtons = logContainer.querySelector(".toggleButton");
    toggleButtons.addEventListener("click", function () {
        const expandableDiv = this.nextElementSibling;
        if (expandableDiv.classList.contains("collapsed")) {
            toggleButtons.innerHTML = "-";
            expandableDiv.classList.remove("collapsed");
            expandableDiv.classList.add("expanded");
        } else {
            toggleButtons.innerHTML = "+";
            expandableDiv.classList.remove("expanded");
            expandableDiv.classList.add("collapsed");
        }
    });

    key_container.appendChild(logContainer);
}

chrome.storage.onChanged.addListener(async (changes, areaName) => {
    if (areaName === "local") {
        for (const [key, values] of Object.entries(changes)) {
            await appendLog(values.newValue);
        }
    }
});

function checkLogs() {
    chrome.runtime.sendMessage({ type: "GET_LOGS" }, (response) => {
        if (response) {
            response.forEach(async (result) => {
                await appendLog(result);
            });
        }
    });
}

document.addEventListener("DOMContentLoaded", async function () {
    enabled.checked = await SettingsManager.getEnabled();
    use_shaka.checked = await SettingsManager.getUseShakaPackager();
    downloader_name.value = await SettingsManager.getExecutableName();
    await RemoteCDMManager.loadSetAllRemoteCDMs();
    await RemoteCDMManager.selectRemoteCDM(
        await RemoteCDMManager.getSelectedRemoteCDM()
    );
    checkLogs();
});

document.addEventListener("DOMContentLoaded", async function () {
    const isProxyEnabled = await SettingsManager.getProxyEnabled();
    enableProxy.checked = isProxyEnabled;
    if (isProxyEnabled) {
        proxyConfig.style.display = "block";
    }

    const savedProxyUrl = await SettingsManager.getProxy();
    const savedProxyPort = await SettingsManager.getProxyPort();
    
    // Combine the proxy URL and port (if available)
    if (savedProxyUrl && savedProxyPort) {
        proxyUrlInput.value = `${savedProxyUrl}:${savedProxyPort}`;
    } else {
        proxyUrlInput.value = savedProxyUrl || '';
    }
});

// ======================================
