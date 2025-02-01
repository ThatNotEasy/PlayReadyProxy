import {
    uint8ArrayToBase64,
    SettingsManager,
    RemoteCDMManager,
    PSSHFromKID,
    stringToUTF16LEBytes,
} from "./util.js";
import { RemoteCdm } from "./remote_cdm.js";

let manifests = new Map();
let requests = new Map();
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



async function generateChallengeRemote(body, sendResponse) {
    try {
        // Decode the base64-encoded body into a binary string
        const binaryString = decodeBase64(body); // Use the decodeBase64 function
        const byteArray = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            byteArray[i] = binaryString.charCodeAt(i);
        }

        // Decode using UTF-16LE encoding
        const decoder = new TextDecoder("utf-16le");
        var xmlString = decoder.decode(byteArray);
        var xmlDecoded;

        // Extract the Challenge element from the XML string
        const challengeRegex = /<Challenge[^>]*>([\s\S]*?)<\/Challenge>/i;
        const challengeMatch = challengeRegex.exec(xmlString);
        var encoding;

        if (challengeMatch) {
            const challengeContent = challengeMatch[1].trim();
            const encodingRegex = /<Challenge[^>]*encoding="([^"]+)"[^>]*>/i;
            const encodingMatch = encodingRegex.exec(xmlString);
            encoding = encodingMatch ? encodingMatch[1] : null;

            // If encoding is base64encoded, decode the challenge content
            if (encoding === "base64encoded") {
                const challengeBinaryString = decodeBase64(challengeContent); // Use the decodeBase64 function
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

        // Extract the KID element
        const kidRegex = /<KID>([^<]+)<\/KID>/i;
        const kidMatch = kidRegex.exec(xmlDecoded);
        var kidBase64;
        if (kidMatch) {
            kidBase64 = kidMatch[1].trim();
        } else {
            console.log("[PlayreadyProxy]", "NO_KID_IN_CHALLENGE");
            sendResponse(body);
            return;
        }

        // Get PSSH from KID
        const pssh = PSSHFromKID(kidBase64);
        if (!pssh) {
            console.log("[PlayreadyProxy]", "NO_PSSH_DATA_IN_CHALLENGE");
            sendResponse(body);
            return;
        }

        // Fetch the selected remote CDM and load it
        const selected_remote_cdm_name = await RemoteCDMManager.getSelectedRemoteCDM();
        if (!selected_remote_cdm_name) {
            sendResponse(body);
            return;
        }

        const selected_remote_cdm = await RemoteCDMManager.loadRemoteCDM(selected_remote_cdm_name);

        let remoteCdmObj;
        try {
            // Check if the selected_remote_cdm is Base64-encoded XML
            if (selected_remote_cdm.startsWith("PD94bWwgdm")) {
                const decodedString = decodeBase64(selected_remote_cdm); // Use the decodeBase64 function
                const parser = new DOMParser();
                const xmlDoc = parseXML(decodedString); // Use parseXML function

                // Convert the XML document into a RemoteCdm object
                remoteCdmObj = RemoteCdm.from_xml(xmlDoc);
            } else {
                // Otherwise, parse as JSON
                remoteCdmObj = JSON.parse(selected_remote_cdm);
            }
        } catch (e) {
            console.error("Error parsing remote CDM:", e);
            sendResponse(body);
            return;
        }

        const remote_cdm = RemoteCdm.from_object(remoteCdmObj);

        // Get the license challenge
        const challenge = await remote_cdm.get_license_challenge(pssh);

        // Replace the challenge content in the original XML with the new challenge
        const newXmlString = xmlString.replace(
            /(<Challenge[^>]*>)([\s\S]*?)(<\/Challenge>)/i,
            `$1${challenge}$3`
        );

        // Convert the new XML string to UTF-16LE and then to base64
        const utf16leBytes = stringToUTF16LEBytes(newXmlString);
        const responseBase64 = uint8ArrayToBase64(utf16leBytes);

        // Send the base64-encoded response
        sendResponse(responseBase64);
    } catch (error) {
        console.error("Error in generateChallengeRemote:", error);
        sendResponse(body);
    }
}


async function parseLicenseRemote(body, sendResponse, tab_url) {
    const response = atob(body);

    const selected_remote_cdm_name =
        await RemoteCDMManager.getSelectedRemoteCDM();
    if (!selected_remote_cdm_name) {
        sendResponse();
        return;
    }

    const selected_remote_cdm = JSON.parse(
        await RemoteCDMManager.loadRemoteCDM(selected_remote_cdm_name)
    );
    const remote_cdm = RemoteCdm.from_object(selected_remote_cdm);

    const returned_keys = await remote_cdm.get_keys(btoa(response));

    if (returned_keys.length === 0) {
        sendResponse();
        return;
    }

    const keys = returned_keys.map((s) => {
        return {
            k: s.key,
            kid: s.key_id,
        };
    });

    console.log("[PlayreadyProxy]", "KEYS", JSON.stringify(keys), tab_url);

    const log = {
        type: "PLAYREADY",
        keys: keys,
        url: tab_url,
        timestamp: Math.floor(Date.now() / 1000),
        manifests: manifests.has(tab_url) ? manifests.get(tab_url) : [],
    };
    logs.push(log);
    sendResponse();
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    (async () => {
        const tab_url = sender.tab ? sender.tab.url : null;

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
                            sendResponse
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
