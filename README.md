# PlayReady-Proxy

`PlayReady-Proxy` is based on [WidevineProxy2](https://github.com/DevLarLey/WidevineProxy2) and has been re-code to support `PlayReady DRM`, utilizing some code from [WidevineProxy2](https://github.com/DevLarLey/WidevineProxy2) for reuse in `PlayReady DRM`. Additionally, new features such as [DDownloader](https://pypi.org/project/DDownloader/), proxy support, and others (still in development)

## How To Use?
- Load config templates for Remote CDM, See [example](https://github.com/ThatNotEasy/PlayReady-Proxy/blob/main/config/local.json)
- Go to this repository [PlayReady-ProxyAPI](https://github.com/ThatNotEasy/PlayReady-ProxyAPI)

## Footprints Notes:
- For your information, this extension can only be used with `PlayReady-ProxyAPI` because some features are still in development. Additionally, certain services do not provide proper keys by default, meaning they require a `unique PSSH`.

## Credits & References:
- `WidevineProxy2` A project created by [DevLarLey](https://github.com/DevLARLEY)
- `DDownloader` A Python package for downloading and processing streams, integration with [N_m3u8DL-RE](https://github.com/nilaoda/N_m3u8DL-RE) & [FFmpeg](https://www.ffmpeg.org/)
