# Producer - Focus Mode Extension 🎯

A powerful Chrome extension designed to boost productivity by blocking distracting websites and specific URLs during focus sessions.

## Features

- **Smart Blocking**: Block entire domains or specific URLs
- **Granular Control**: Allow specific pages or even certain URL parameters on otherwise blocked domains
- **Beautiful UI**: Modern, gradient-based popup interface
- **Focus Sessions**: Toggle focus mode with a single click
- **Real-time Stats**: Track blocked sites and session statistics
- **Motivational Blocking**: Encouraging messages when sites are blocked

## Installation

1. **Download the Extension Files**

   - Save all the provided files in a folder called `producer-extension`
   - You'll need: `manifest.json`, `popup.html`, `popup.js`, `background.js`, `content.js`, `rules.json`

2. **Load into Chrome**

   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top right)
   - Click "Load unpacked" and select your `producer-extension` folder
   - The extension should now appear in your extensions bar

3. **Create Icon Files (Optional)**
   - Create an `icons` folder in your extension directory
   - Add icon files: `icon16.png`, `icon32.png`, `icon48.png`, `icon128.png`
   - Or remove the icons section from manifest.json if you don't want custom icons

## How to Use

1. Click the **Producer** extension icon in your toolbar
2. Click **Start Producing** to begin a focus session
3. Add websites or URLs you want to block
4. Sites will be blocked until you stop the focus session

## Adding Block Rules

### Block Entire Domain

- Select **Block Domain**
- Enter a domain like `youtube.com` or `reddit.com`
- This blocks the entire website and all its pages

### Block Specific URLs

- Select **Block Specific URL**
- Enter specific paths like `youtube.com/feed/trending`
- This blocks only that page/section

### Allow Specific URLs

- Select **Allow Specific URL**
- Enter URLs you want to allow on otherwise blocked domains
- Example: Block `youtube.com` but allow `youtube.com/playlist?list=WL`

### **Allow Specific URL Parameters**

- Fine-tune allowed pages based on their query parameters
- Example:

  - Block `youtube.com/watch` (all videos)
  - **Allow only videos in a specific playlist:**

    ```
    URL: youtube.com/watch
    allowParams: ?list=PL123456789
    ```

  - Now all videos outside that playlist will be blocked, but the playlist is allowed

## Usage Examples

**Block all YouTube videos except from Watch Later playlist**

1. Add rule: **Block Specific URL** → `youtube.com`
2. Add rule: **Allow Parameter** = key `list` value `WL`

**Block Instagram but allow direct inbox**

1. Add rule: **Block Domain** → `instagram.com`
2. Add rule: **Allow Specific URL** → `instagram.com/direct/inbox`

**Block X (Twitter) general feed but allow your communities**

1. Add rule: **Block Specific URL** → `x.com`
2. Add rule: **Allow Specific URL** → `x.com/{username}/communities`

## File Structure

```
producer-extension/
├── manifest.json         # Extension configuration
├── popup.html            # Extension popup interface
├── popup.js              # Popup functionality
├── background.js         # Background service worker
├── content.js            # Content script for blocking
├── rules.json            # Declarative net request rules
├── icon.png              # Popup icon image
└── README.md
```

## Technical Details

- **Manifest Version**: 3 (latest Chrome extension standard)
- **Permissions**: Storage, activeTab, declarativeNetRequest, tabs
- **Blocking Method**: Content script injection with beautiful block pages
- **Storage**: Chrome local storage for persistence
- **Architecture**: Service worker background script with popup interface

## Features Overview

- ✅ Block entire domains
- ✅ Block specific URLs/paths
- ✅ Whitelist specific URLs on blocked domains
- ✅ Whitelist based on URL parameters
- ✅ Real-time session statistics
- ✅ Beautiful, modern UI
- ✅ Motivational block pages
- ✅ Easy toggle on/off
- ✅ Persistent settings
- ✅ Session block counting

## Troubleshooting

**Extension not working?**

- Make sure Developer mode is enabled
- Check that all files are in the correct folder
- Reload the extension after making changes

**Sites not being blocked?**

- Ensure focus mode is activated (green indicator)
- Check that your block rules are correctly formatted
- Try refreshing the page after adding rules

**Can't access needed sites?**

- Use **Allow Specific URL** or **Allow Parameter** rules to whitelist important pages
- Turn off focus mode temporarily if needed
- Check your rules for conflicts

## Contributing

This extension is designed to be simple and effective. Feel free to modify the code to suit your specific needs!

## License

Open source — feel free to use and modify as needed.
