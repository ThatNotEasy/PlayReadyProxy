import { RemoteCdm } from "./remote_cdm.js";

export class AsyncSyncStorage {
    static async setStorage(items) {
        return new Promise((resolve, reject) => {
            chrome.storage.sync.set(items, () => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError));
                } else {
                    resolve();
                }
            });
        });
    }

    static async getStorage(keys) {
        return new Promise((resolve, reject) => {
            chrome.storage.sync.get(keys, (result) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError));
                } else {
                    resolve(result);
                }
            });
        });
    }

    static async removeStorage(keys) {
        return new Promise((resolve, reject) => {
            chrome.storage.sync.remove(keys, (result) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError));
                } else {
                    resolve(result);
                }
            });
        });
    }
}

export class AsyncLocalStorage {
    static async setStorage(items) {
        return new Promise((resolve, reject) => {
            chrome.storage.local.set(items, () => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError));
                } else {
                    resolve();
                }
            });
        });
    }

    static async getStorage(keys) {
        return new Promise((resolve, reject) => {
            chrome.storage.local.get(keys, (result) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError));
                } else {
                    resolve(result);
                }
            });
        });
    }

    static async removeStorage(keys) {
        return new Promise((resolve, reject) => {
            chrome.storage.local.remove(keys, (result) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError));
                } else {
                    resolve(result);
                }
            });
        });
    }
}

export class RemoteCDMManager {
    static async saveRemoteCDM(name, obj) {
        const result = await AsyncSyncStorage.getStorage(["remote_cdms"]);
        const array =
            result.remote_cdms === undefined ? [] : result.remote_cdms;
        array.push(name);
        await AsyncSyncStorage.setStorage({ remote_cdms: array });
        await AsyncSyncStorage.setStorage({ [name]: obj });
    }

    static async loadRemoteCDM(name) {
        const result = await AsyncSyncStorage.getStorage([name]);
        return JSON.stringify(result[name] || {});
    }

    static setRemoteCDM(name, value) {
        const remote_combobox = document.getElementById("remote-combobox");
        const remote_element = document.createElement("option");

        remote_element.text = name;
        remote_element.value = value;

        remote_combobox.appendChild(remote_element);
    }

    static async loadSetAllRemoteCDMs() {
        const result = await AsyncSyncStorage.getStorage(["remote_cdms"]);
        const array = result.remote_cdms || [];
        for (const item of array) {
            this.setRemoteCDM(item, await this.loadRemoteCDM(item));
        }
    }

    static async saveSelectedRemoteCDM(name) {
        await AsyncSyncStorage.setStorage({ selected_remote_cdm: name });
    }

    static async getSelectedRemoteCDM() {
        const result = await AsyncSyncStorage.getStorage([
            "selected_remote_cdm",
        ]);
        return result["selected_remote_cdm"] || "";
    }

    static async selectRemoteCDM(name) {
        document.getElementById("remote-combobox").value =
            await this.loadRemoteCDM(name);
    }

    static async removeSelectedRemoteCDM() {
        const selected_remote_cdm_name =
            await RemoteCDMManager.getSelectedRemoteCDM();

        const result = await AsyncSyncStorage.getStorage(["remote_cdms"]);
        const array =
            result.remote_cdms === undefined ? [] : result.remote_cdms;

        const index = array.indexOf(selected_remote_cdm_name);
        if (index > -1) {
            array.splice(index, 1);
        }

        await AsyncSyncStorage.setStorage({ remote_cdms: array });
        await AsyncSyncStorage.removeStorage([selected_remote_cdm_name]);
    }

    static async removeSelectedRemoteCDMKey() {
        await AsyncSyncStorage.removeStorage(["selected_remote_cdm"]);
    }
}

export class SettingsManager {
    static async setEnabled(enabled) {
        await AsyncSyncStorage.setStorage({ enabled: enabled });
    }

    static async getEnabled() {
        const result = await AsyncSyncStorage.getStorage(["enabled"]);
        return result["enabled"] === undefined ? false : result["enabled"];
    }

    static downloadFile(content, filename) {
        const blob = new Blob([content], { type: "application/octet-stream" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    static async saveDarkMode(dark_mode) {
        await AsyncSyncStorage.setStorage({ dark_mode: dark_mode });
    }

    static async getDarkMode() {
        const result = await AsyncSyncStorage.getStorage(["dark_mode"]);
        return result["dark_mode"] || false;
    }

    static async loadRemoteCDM(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async function (loaded) {
                const result = loaded.target.result;

                let json_file = void 0;
                try {
                    json_file = JSON.parse(result);
                } catch {
                    resolve();
                    return;
                }

                console.log("LOADED DEVICE:", json_file);
                const remote_cdm = new RemoteCdm(
                    json_file.security_level,
                    json_file.host,
                    json_file.key,
                    json_file.device_name
                );
                const device_name = remote_cdm.get_name();
                console.log("NAME:", device_name);

                if (
                    (await RemoteCDMManager.loadRemoteCDM(device_name)) === "{}"
                ) {
                    await RemoteCDMManager.saveRemoteCDM(
                        device_name,
                        json_file
                    );
                }

                await RemoteCDMManager.saveSelectedRemoteCDM(device_name);
                resolve();
            };
            reader.readAsText(file);
        });
    }

    static async saveSelectedDeviceType(selected_type) {
        await AsyncSyncStorage.setStorage({ device_type: selected_type });
    }

    static async getSelectedDeviceType() {
        const result = await AsyncSyncStorage.getStorage(["device_type"]);
        return result["device_type"] || "WVD";
    }

    static async getSelectedDeviceType_PRD() {
        const result = await AsyncSyncStorage.getStorage(["device_type"]);
        return result["device_type"] || "PRD";
    }

    static async saveUseShakaPackager(use_shaka) {
        await AsyncSyncStorage.setStorage({ use_shaka: use_shaka });
    }
    
    static async saveUseDDownloader(use_ddownloader) {
        await AsyncSyncStorage.setStorage({ use_ddownloader: use_ddownloader });
    }
    
    static async getUseShakaPackager() {
        const result = await AsyncSyncStorage.getStorage(["use_shaka"]);
        return result["use_shaka"] ?? true;
    }
    
    static async getUseDDownloader() {
        const result = await AsyncSyncStorage.getStorage(["use_ddownloader"]);
        return result["use_ddownloader"] ?? true;
    }
    
    static async saveExecutableName(exe_name) {
        await AsyncSyncStorage.setStorage({ exe_name: exe_name });
    }
    
    static async getExecutableName() {
        const result = await AsyncSyncStorage.getStorage(["exe_name"]);
        return result["exe_name"] ?? "DDownloader";
    }

    // Proxy methods
    static async setProxy(proxyAddress) {
        await AsyncSyncStorage.setStorage({ proxyAddress: proxyAddress });
    }

    // Get the proxy address
    static async getProxy() {
        const result = await AsyncSyncStorage.getStorage(["proxyAddress"]);
        return result["proxyAddress"] || null;  // Ensure null is returned if proxyAddress is not found
    }

    // Save the proxy enabled status (whether proxy is on or off)
    static async setProxyEnabled(enabled) {
        await AsyncSyncStorage.setStorage({ proxyEnabled: enabled });
    }

    // Get the proxy enabled status
    static async getProxyEnabled() {
        const result = await AsyncSyncStorage.getStorage(["proxyEnabled"]);
        return result["proxyEnabled"] !== undefined ? result["proxyEnabled"] : false;  // Default to false if not found
    }

    // Save the proxy port
    static async saveProxy(port) {
        await AsyncSyncStorage.setStorage({ proxyPort: port });
    }

    // Get the proxy port
    static async getProxyPort() {
        const result = await AsyncSyncStorage.getStorage(["proxyPort"]);
        return result["proxyPort"] || null;  // Return null if proxyPort is not found
    }

    // Save both the proxy address and port together
    static async saveProxyConfig(proxyAddress) {
        await SettingsManager.setProxy(proxyAddress);  // Save the proxy address
        const proxyPort = proxyAddress.split(":")[1];   // Extract the port from the address if available
        if (proxyPort) {
            await SettingsManager.saveProxy(proxyPort);  // Save the port if it's present
        } else {
            await SettingsManager.saveProxy("");  // Clear the port if not available
        }
    }

    // Get both proxy URL and port together (optional convenience method)
    static async getProxyConfig() {
        const proxyUrl = await SettingsManager.getProxy();
        const proxyPort = await SettingsManager.getProxyPort();
        return proxyUrl && proxyPort ? `${proxyUrl}:${proxyPort}` : proxyUrl || '';
    }
}


export function intToUint8Array(num) {
    const buffer = new ArrayBuffer(4);
    const view = new DataView(buffer);
    view.setUint32(0, num, false);
    return new Uint8Array(buffer);
}

export function compareUint8Arrays(arr1, arr2) {
    if (arr1.length !== arr2.length) return false;
    return Array.from(arr1).every((value, index) => value === arr2[index]);
}

export function uint8ArrayToHex(buffer) {
    return Array.prototype.map
        .call(buffer, (x) => x.toString(16).padStart(2, "0"))
        .join("");
}

export function uint8ArrayToString(uint8array) {
    return String.fromCharCode.apply(null, uint8array);
}

export function uint8ArrayToBase64(uint8array) {
    return btoa(String.fromCharCode.apply(null, uint8array));
}

export function stringToUint8Array(string) {
    return Uint8Array.from(string.split("").map((x) => x.charCodeAt()));
}

export function stringToHex(string) {
    return string
        .split("")
        .map((c) => c.charCodeAt(0).toString(16).padStart(2, "0"))
        .join("");
}

export function PSSHFromKID(kidBase64) {
    const kidBytes = base64toUint8Array(kidBase64);

    const kidBase64ForHeader = btoa(String.fromCharCode(...kidBytes));
    const wrmHeaderXml =
        `<WRMHEADER xmlns="http://schemas.microsoft.com/DRM/2007/03/PlayReadyHeader" version="4.0.0.0"><DATA><PROTECTINFO><KEYLEN>16</KEYLEN><ALGID>AESCTR</ALGID></PROTECTINFO><KID>${kidBase64ForHeader}</KID></DATA></WRMHEADER>`.trim();

    const wrmHeaderBytes = stringToUTF16LEBytes(wrmHeaderXml);

    const playReadyObjectLength = 2 + 2 + wrmHeaderBytes.length;
    const playReadyObjectBuffer = new ArrayBuffer(playReadyObjectLength);
    const playReadyObjectView = new DataView(playReadyObjectBuffer);
    let offset = 0;

    playReadyObjectView.setUint16(offset, 0x0001, true);
    offset += 2;

    playReadyObjectView.setUint16(offset, wrmHeaderBytes.length, true);
    offset += 2;

    new Uint8Array(playReadyObjectBuffer).set(wrmHeaderBytes, offset);

    const recordCount = 1;
    const recordListLength = 2 + playReadyObjectLength;
    const recordListBuffer = new ArrayBuffer(recordListLength);
    const recordListView = new DataView(recordListBuffer);
    offset = 0;

    recordListView.setUint16(offset, recordCount, true);
    offset += 2;

    new Uint8Array(recordListBuffer).set(
        new Uint8Array(playReadyObjectBuffer),
        offset
    );

    const systemIDHex = "9a04f07998404286ab92e65be0885f95";
    const systemIDBytes = hexStringToUint8Array(systemIDHex);

    const psshSize = 4 + 4 + 4 + 16 + 4 + recordListLength;
    const psshBuffer = new ArrayBuffer(psshSize);
    const psshView = new DataView(psshBuffer);
    const psshUint8Array = new Uint8Array(psshBuffer);
    offset = 0;

    psshView.setUint32(offset, psshSize, false);
    offset += 4;

    psshUint8Array.set([0x70, 0x73, 0x73, 0x68], offset);
    offset += 4;

    psshView.setUint32(offset, 0, false);
    offset += 4;

    psshUint8Array.set(systemIDBytes, offset);
    offset += 16;

    psshView.setUint32(offset, recordListLength, false);
    offset += 4;

    psshUint8Array.set(new Uint8Array(recordListBuffer), offset);

    return uint8ArrayToBase64(psshUint8Array);
}

export function base64toUint8Array(base64_string) {
    return Uint8Array.from(atob(base64_string), (c) => c.charCodeAt(0));
}

export function stringToUTF16LEBytes(str) {
    const bytes = new Uint8Array(str.length * 2);
    for (let i = 0; i < str.length; i++) {
        const code = str.charCodeAt(i);
        bytes[i * 2] = code & 0xff;
        bytes[i * 2 + 1] = (code >> 8) & 0xff;
    }
    return bytes;
}

export function hexStringToUint8Array(hexString) {
    const bytes = new Uint8Array(hexString.length / 2);
    for (let i = 0; i < bytes.length; i++) {
        bytes[i] = parseInt(hexString.substr(i * 2, 2), 16);
    }
    return bytes;
}
