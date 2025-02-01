import { SettingsManager } from "../../util.js";

document
    .getElementById("fileInput")
    .addEventListener("change", async (event) => {
        const file = event.target.files[0];
        await SettingsManager.loadRemoteCDM(file).then(() => {
            window.close();
        });
    });
