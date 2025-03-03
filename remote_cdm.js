export class RemoteCdm {
    constructor(security_level, host, secret, device_name, proxy = null) {
        this.security_level = security_level;
        this.host = host;
        this.secret = secret;
        this.device_name = device_name;
        this.proxy = proxy;
    }

    static from_object(obj) {
        return new RemoteCdm(
            obj.security_level,
            obj.host,
            obj.secret,
            obj.device_name ?? obj.name,
            obj.proxy ?? null
        );
    }

    get_name() {
        return `[PlayReady] ${this.host}/${this.device_name}`;
    }

    async fetch_with_proxy(url, options) {
        if (this.proxy) {
            options.headers = {
                ...options.headers,
                "X-Forwarded-For": this.proxy,
            };
            url = `${this.proxy}${url}`;
        }

        console.log(`[PlayReadyProxy] Fetching: ${options.method} ${url}`);
        console.log(`[PlayReadyProxy] Headers:`, options.headers);
        if (options.body) console.log(`[PlayReadyProxy] Body:`, options.body);

        try {
            const response = await fetch(url, options);
            console.log(`[PlayReadyProxy] Response Status: ${response.status}`);

            if (!response.ok) {
                console.error(`[PlayReadyProxy] Request failed: ${url} [${response.status}]`);
                const errorText = await response.text();
                console.error(`[PlayReadyProxy] Error Response:`, errorText);
                throw new Error(`Request failed with status ${response.status}`);
            }

            return response;
        } catch (error) {
            console.error(`[PlayReadyProxy] Network Error:`, error);
            throw error;
        }
    }

    async open() {
        console.log("[PlayReadyProxy] Opening PlayReady session...");

        const open_request = await this.fetch_with_proxy(
            `${this.host}/api/playready/${this.device_name}/open`,
            {
                method: "GET",
                headers: { "X-API-KEY": this.secret },
            }
        );

        console.log("[PlayReadyProxy]", "REMOTE_CDM", "OPEN", open_request.status);
        const response = await open_request.json();
        console.log("[PlayReadyProxy] Open Response:", response);

        return response.responseData.session_id;
    }

    async close(session_id) {
        console.log("[PlayReadyProxy] Closing PlayReady session:", session_id);

        await this.fetch_with_proxy(
            `${this.host}/api/playready/${this.device_name}/close/${session_id}`,
            {
                method: "GET",
                headers: { "X-API-KEY": this.secret },
            }
        );

        console.log("[PlayReadyProxy]", "REMOTE_CDM", "CLOSE", session_id);
    }

    async get_license_challenge(session_id, pssh) {
        console.log("[PlayReadyProxy] Requesting License Challenge...");
        console.log("[PlayReadyProxy] SESSION_ID:", session_id);
        console.log("[PlayReadyProxy] PSSH:", pssh);
    
        const license_request = await this.fetch_with_proxy(
            `${this.host}/api/playready/${this.device_name}/get_challenge`,  // URL CORRETTO
            {
                method: "POST",
                headers: {
                    "content-type": "application/json",
                    "X-API-KEY": this.secret,
                },
                body: JSON.stringify({
                    session_id: session_id,
                    pssh: pssh,
                }),
            }
        );
    
        console.log("[PlayReadyProxy]", "REMOTE_CDM", "GET_LICENSE_CHALLENGE", license_request.status);
        const response = await license_request.json();
        console.log("[PlayReadyProxy] License Challenge Response:", response);
    
        return response.responseData.challenge_b64;
    }

    async get_keys(session_id, license_b64) {
        console.log("[PlayReadyProxy] Requesting Decryption Keys...");
        console.log("[PlayReadyProxy] SESSION_ID:", session_id);
        console.log("[PlayReadyProxy] License (Base64):", license_b64);

        const keys_request = await this.fetch_with_proxy(
            `${this.host}/api/playready/${this.device_name}/get_keys`,
            {
                method: "POST",
                headers: {
                    "content-type": "application/json",
                    "X-API-KEY": this.secret,
                },
                body: JSON.stringify({
                    session_id: session_id,
                    license_b64: license_b64,
                }),
            }
        );

        console.log("[PlayReadyProxy]", "REMOTE_CDM", "GET_KEYS", keys_request.status);
        const response = await keys_request.json();
        console.log("[PlayReadyProxy] Keys Response:", response);

        return response.responseData.keys;
    }
}
