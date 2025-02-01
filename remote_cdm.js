export class RemoteCdm {
    constructor(security_level, host, secret, device_name, proxy = null) {
        this.security_level = security_level;
        this.host = host;
        this.secret = secret;
        this.device_name = device_name;
        this.proxy = proxy;  // Optional proxy parameter
    }

    static from_object(obj) {
        return new RemoteCdm(
            obj.security_level,
            obj.host,
            obj.secret,
            obj.device_name ?? obj.name,
            obj.proxy ?? null  // Handle proxy from object if present
        );
    }

    get_name() {
        const type = this.security_level;
        return `[${type}] ${this.host}/${this.device_name}`;
    }

    async fetch_with_proxy(url, options) {
        // If proxy is set, prepend proxy URL to the original host URL
        if (this.proxy) {
            options.headers = {
                ...options.headers,
                'X-Forwarded-For': this.proxy, // Optional: Forward the proxy information
            };
            url = `${this.proxy}${url}`;
        }
        const response = await fetch(url, options);
        return response;
    }

    async get_license_challenge(pssh) {
        const license_request = await this.fetch_with_proxy(`${this.host}/api/playready/extension`, {
            method: "POST",
            headers: {
                "content-type": "application/json",
                "X-API-KEY": this.secret,
            },
            body: JSON.stringify({
                action: "Challenge?",
                pssh: pssh,
            }),
        });
        console.log(
            "[PlayreadyProxy]",
            "REMOTE_CDM",
            "GET_LICENSE_CHALLENGE",
            license_request.status
        );
        const license_request_json = await license_request.json();

        return license_request_json.data;
    }

    async get_keys(license_challenge) {
        const keys = await this.fetch_with_proxy(`${this.host}/api/playready/extension`, {
            method: "POST",
            headers: {
                "content-type": "application/json",
                "X-API-KEY": this.secret,
            },
            body: JSON.stringify({
                action: "Keys?",
                license: license_challenge,
            }),
        });
        console.log("[PlayreadyProxy]", "REMOTE_CDM", "GET_KEYS", keys.status);

        return await keys.json();
    }
}