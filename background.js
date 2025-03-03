import {
    decodeBase64,
    uint8ArrayToBase64,
    SettingsManager,
    RemoteCDMManager,
    PSSHFromKID,
    stringToUTF16LEBytes,
} from "./util.js";
import { RemoteCdm } from "./remote_cdm.js";

let manifests = new Map();
let requests = new Map();
const sessions = new Map();
let logs = [];


chrome.webRequest.onBeforeSendHeaders.addListener(
    function (details) {
        if (details.method === "GET") {
            if (!requests.has(details.url)) {
                const headers = details.requestHeaders
                    .filter(
                        (item) =>
                            !(
                                item.name.startsWith("sec-ch-ua") ||
                                item.name.startsWith("Sec-Fetch") ||
                                item.name.startsWith("Accept-") ||
                                item.name.startsWith("Host") ||
                                item.name === "Connection"
                            )
                    )
                    .reduce((acc, item) => {
                        acc[item.name] = item.value;
                        return acc;
                    }, {});
                requests.set(details.url, headers);
            }
        }
    },
    { urls: ["<all_urls>"] },
    [
        "requestHeaders",
        chrome.webRequest.OnSendHeadersOptions.EXTRA_HEADERS,
    ].filter(Boolean)
);



async function generateChallengeRemote(body, sendResponse, tab_url) {
    try {
        console.log("[PlayReadyProxy] generateChallengeRemote called with tab_url:", tab_url);
        if (!tab_url) {
            console.error("[PlayReadyProxy] No tab_url provided, cannot store session");
            sendResponse(body);
            return;
        }

        const binaryString = decodeBase64(body);
        const byteArray = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            byteArray[i] = binaryString.charCodeAt(i);
        }

        const decoder = new TextDecoder("utf-16le");
        let xmlString = decoder.decode(byteArray);
        let xmlDecoded;

        const challengeRegex = /<Challenge[^>]*>([\s\S]*?)<\/Challenge>/i;
        const challengeMatch = challengeRegex.exec(xmlString);
        let encoding;

        if (challengeMatch) {
            const challengeContent = challengeMatch[1].trim();
            const encodingRegex = /<Challenge[^>]*encoding="([^"]+)"[^>]*>/i;
            const encodingMatch = encodingRegex.exec(xmlString);
            encoding = encodingMatch ? encodingMatch[1] : null;

            if (encoding === "base64encoded") {
                const challengeBinaryString = decodeBase64(challengeContent);
                const challengeByteArray = new Uint8Array(challengeBinaryString.length);
                for (let i = 0; i < challengeBinaryString.length; i++) {
                    challengeByteArray[i] = challengeBinaryString.charCodeAt(i);
                }
                const utf8Decoder = new TextDecoder("utf-8");
                xmlDecoded = utf8Decoder.decode(challengeByteArray);
            }
        } else {
            console.error("Challenge element not found in XML.");
            sendResponse(body);
            return;
        }

        const kidRegex = /<KID>([^<]+)<\/KID>/i;
        const kidMatch = kidRegex.exec(xmlDecoded);
        let kidBase64;
        if (kidMatch) {
            kidBase64 = kidMatch[1].trim();
        } else {
            console.log("[PlayReadyProxy]", "NO_KID_IN_CHALLENGE");
            sendResponse(body);
            return;
        }

        const pssh = PSSHFromKID(kidBase64);
        if (!pssh) {
            console.log("[PlayReadyProxy]", "NO_PSSH_DATA_IN_CHALLENGE");
            sendResponse(body);
            return;
        }

        const selected_remote_cdm_name = await RemoteCDMManager.getSelectedRemoteCDM();
        if (!selected_remote_cdm_name) {
            sendResponse(body);
            return;
        }

        const selected_remote_cdm = await RemoteCDMManager.loadRemoteCDM(selected_remote_cdm_name);

        let remoteCdmObj;
        try {
            // Assume the remote CDM is always in JSON format
            remoteCdmObj = JSON.parse(selected_remote_cdm);
        } catch (e) {
            console.error("Error parsing remote CDM:", e);
            sendResponse(body);
            return;
        }

        const remote_cdm = RemoteCdm.from_object(remoteCdmObj);
        const session_id = await remote_cdm.open();
        if (!session_id) {
            console.error("[PlayReadyProxy] Failed to open session.");
            sendResponse(body);
            return;
        }

        console.log("[PlayReadyProxy]", "SESSION_ID", session_id);
        console.log("[PlayReadyProxy] Storing session_id", session_id, "for tab_url", tab_url);
        sessions.set(tab_url, session_id);

        const challenge = await remote_cdm.get_license_challenge(session_id, pssh);
        const newXmlString = xmlString.replace(
            /(<Challenge[^>]*>)([\s\S]*?)(<\/Challenge>)/i,
            `$1${challenge}$3`
        );

        const utf16leBytes = stringToUTF16LEBytes(newXmlString);
        const responseBase64 = uint8ArrayToBase64(utf16leBytes);

        sendResponse(responseBase64);
    } catch (error) {
        console.error("Error in generateChallengeRemote:", error);
        sendResponse(body);
    }
}


async function parseLicenseRemote(body, sendResponse, tab_url) {
    try {
        console.log("[PlayReadyProxy] parseLicenseRemote called with tab_url:", tab_url);
        if (!tab_url) {
            console.error("[PlayReadyProxy] No tab_url provided, cannot retrieve session");
            sendResponse();
            return;
        }
        
        const license_b64 = body;
        console.log("[PlayReadyProxy] Current sessions:", 
                  [...sessions.entries()].map(([url, id]) => ({ url, id })));

        const selected_remote_cdm_name = await RemoteCDMManager.getSelectedRemoteCDM();
        if (!selected_remote_cdm_name) {
            console.error("[PlayReadyProxy] No remote CDM selected.");
            sendResponse();
            return;
        }

        const selected_remote_cdm = await RemoteCDMManager.loadRemoteCDM(selected_remote_cdm_name);
        let remoteCdmObj;

        try {
            remoteCdmObj = JSON.parse(selected_remote_cdm);
        } catch (e) {
            console.error("[PlayReadyProxy] Error parsing remote CDM JSON:", e);
            sendResponse();
            return;
        }

        const remote_cdm = RemoteCdm.from_object(remoteCdmObj);
        if (!sessions.has(tab_url)) {
            console.error("[PlayReadyProxy] No previous session found for URL:", tab_url);
            
            console.error("[PlayReadyProxy] Cannot process license without challenge first");
            sendResponse();
            return;
        }
        
        const session_id = sessions.get(tab_url);
        console.log("[PlayReadyProxy] Using existing SESSION_ID", session_id, "for tab_url", tab_url);

        const returned_keys = await remote_cdm.get_keys(session_id, license_b64);
        if (!returned_keys || returned_keys.length === 0) {
            console.log("[PlayReadyProxy] No keys returned.");
            sendResponse();
            return;
        }

        const keys = returned_keys.map((s) => ({
            k: s.key,
            kid: s.key_id,
        }));

        console.log("[PlayReadyProxy]", "KEYS", JSON.stringify(keys), tab_url);

        const log = {
            type: "PLAYREADY",
            keys: keys,
            url: tab_url,
            timestamp: Math.floor(Date.now() / 1000),
            manifests: manifests.has(tab_url) ? manifests.get(tab_url) : [],
        };
        logs.push(log);

        await remote_cdm.close(session_id);
        sessions.delete(tab_url);

        sendResponse();
    } catch (error) {
        console.error("[PlayReadyProxy] Error in parseLicenseRemote:", error);
        sendResponse();
    }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    (async () => {
        const tab_url = sender.tab ? sender.tab.url : null;
        console.log("[PlayReadyProxy] Received message type:", message.type, "for tab_url:", tab_url);

        switch (message.type) {
            case "REQUEST":
                if (!(await SettingsManager.getEnabled())) {
                    sendResponse(message.body);
                    manifests.clear();
                    return;
                }

                try {
                    JSON.parse(atob(message.body));
                    sendResponse(message.body);
                    return;
                } catch {
                    if (message.body) {
                        await generateChallengeRemote(
                            message.body,
                            sendResponse,
                            tab_url
                        );
                    }
                }
                break;

            case "RESPONSE":
                if (!(await SettingsManager.getEnabled())) {
                    sendResponse(message.body);
                    manifests.clear();
                    return;
                }

                try {
                    await parseClearKey(message.body, sendResponse, tab_url);
                    return;
                } catch (e) {
                    console.log("[PlayReadyProxy] parseClearKey failed, trying parseLicenseRemote", e);
                    await parseLicenseRemote(
                        message.body,
                        sendResponse,
                        tab_url
                    );
                    return;
                }
            case "GET_LOGS":
                sendResponse(logs);
                break;
            case "OPEN_PICKER_LOCAL":
                chrome.windows.create({
                    url: "picker/filePickerLocal.html",
                    type: "popup",
                    width: 300,
                    height: 200,
                });
                break;
            case "OPEN_PICKER":
                chrome.windows.create({
                    url: "picker/filePicker.html",
                    type: "popup",
                    width: 300,
                    height: 200,
                });
                break;
            case "CLEAR":
                logs = [];
                manifests.clear();
                sessions.clear();
                break;
            case "MANIFEST":
                const parsed = JSON.parse(message.body);
                const element = {
                    type: parsed.type,
                    url: parsed.url,
                    headers: requests.has(parsed.url)
                        ? requests.get(parsed.url)
                        : [],
                };

                if (!manifests.has(tab_url)) {
                    manifests.set(tab_url, [element]);
                } else {
                    let elements = manifests.get(tab_url);
                    if (!elements.some((e) => e.url === parsed.url)) {
                        elements.push(element);
                        manifests.set(tab_url, elements);
                    }
                }
                sendResponse();
        }
    })();
    return true;
});