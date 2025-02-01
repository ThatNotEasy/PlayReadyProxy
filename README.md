# PlayReady-Proxy

`PlayReady-Proxy` is based on [WidevineProxy2](https://github.com/DevLarLey/WidevineProxy2) and has been re-code to support `PlayReady DRM`, utilizing some code from [WidevineProxy2](https://github.com/DevLarLey/WidevineProxy2) for reuse in `PlayReady DRM`. Additionally, new features such as [DDownloader](https://pypi.org/project/DDownloader/), proxy support, and others (still in development)

## Installation
- Go to this repository [PlayReady-ProxyAPI](https://github.com/ThatNotEasy/PlayReady-ProxyAPI) and perform a `git clone`

```
git clone https://github.com/ThatNotEasy/PlayReady-ProxyAPI
```

- Create a virtual environment by running the following command and activate the virtual environment:

```
python -m venv venv
```

- Wingay

```
venv\Scripts\activate
```

- Linux

```
source venv/bin/activate
```

- Install depencies:

```
pip install -r requirements.txt
```

- Run Flask:

```
flask run
```

- Rename the `.env.example` and `config.ini.example` files to `.env` and `config.ini`:
- Update and place your device `prd` file in the `config.ini`

## Credits & References:
- `WidevineProxy2` A project created by [DevLarLey](https://github.com/DevLARLEY)
- `DDownloader` A Python package for downloading and processing streams, integration with [N_m3u8DL-RE](https://github.com/nilaoda/N_m3u8DL-RE) & [FFmpeg](https://www.ffmpeg.org/)
