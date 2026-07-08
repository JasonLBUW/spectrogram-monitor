# 48 kHz Spectrogram Monitor

A static browser app that captures shared system/tab audio, plays it back as a monitor feed, and draws a scrolling spectrogram up to 48 kHz when the browser provides a 96 kHz or higher audio path.

## Run locally

Serve the folder with any static file server. Browser audio capture APIs require
a secure context, but `localhost` is allowed for local development.

```sh
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

## Host on GitHub Pages

1. Create a GitHub repository.
2. Copy these files into the repository root.
3. Push to GitHub.
4. In the repository settings, enable GitHub Pages from the main branch.

## Browser limitation

Browsers cannot silently capture the computer's audio output. You must use the screen/window/tab sharing prompt and enable audio sharing there. Chrome and Edge are usually the most reliable for this.

To see real content up to 48 kHz, the capture path must provide at least a 96 kHz sample rate. If the browser gives 48 kHz audio, the app can only display up to 24 kHz. For fully reliable 96 kHz or 192 kHz instrumentation capture, use an OS loopback device or a small native app that sends PCM/FLAC data to the browser.
