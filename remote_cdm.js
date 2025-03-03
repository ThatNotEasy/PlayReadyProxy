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

        try {
            const response = await fetch(url, options);

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Request failed with status ${response.status}: ${errorText}`);
            }

            return response;
        } catch (error) {
            throw error;
        }
    }

    async open() {
        const open_request = await this.fetch_with_proxy(
            `${this.host}/api/playready/${this.device_name}/open`,
            {
                method: "GET",
                headers: { "X-API-KEY": this.secret },
            }
        );

        const response = await open_request.json();
        return response.responseData.session_id;
    }

    async close(session_id) {
        await this.fetch_with_proxy(
            `${this.host}/api/playready/${this.device_name}/close/${session_id}`,
            {
                method: "GET",
                headers: { "X-API-KEY": this.secret },
            }
        );
    }

    async get_license_challenge(session_id, pssh) {
        const license_request = await this.fetch_with_proxy(
            `${this.host}/api/playready/${this.device_name}/get_challenge`,
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

        const response = await license_request.json();
        return response.responseData.challenge_b64;
    }

    async get_keys(session_id, license_b64) {
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

        const response = await keys_request.json();
        return response.responseData.keys;
    }
}
