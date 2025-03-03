async function processMessage(detail) {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(
            {
                type: detail.type,
                body: detail.body,
            },
            (response) => {
                if (chrome.runtime.lastError) {
                    return reject(chrome.runtime.lastError);
                }
                resolve(response);
            }
        );
    });
}

document.addEventListener("response", async (event) => {
    const { detail } = event;
    try {
        const responseData = await processMessage(detail);
        const responseEvent = new CustomEvent("responseReceived", {
            detail: detail.requestId.concat(responseData),
        });
        document.dispatchEvent(responseEvent);
    } catch (error) {
        console.error("Error processing message:", error);
        // Optionally handle the error, maybe notify the user
    }
});