class ProducerBackground {
  constructor() {
    this.rules = [];
    this.isActive = false;
    this.sessionBlocks = 0;
    this.sessionStartTime = null;
    this.focusedTime = 0; // persisted cumulative total
    this.focusedTimeBase = 0; // snapshot of cumulative total at session start
    this.timerInterval = null;

    this.init();
  }

  // Helper: single source of truth for both timers
  getTimes() {
    const sessionElapsed = this.sessionStartTime
      ? Math.floor((Date.now() - this.sessionStartTime) / 1000)
      : 0;

    // If session is running, total focused is base + elapsed; else it's the stored total
    const totalFocused = this.sessionStartTime
      ? this.focusedTimeBase + sessionElapsed
      : this.focusedTime;

    return { sessionElapsed, totalFocused };
  }

  async init() {
    // Load saved state
    await this.loadState();

    // Set up listeners
    this.setupListeners();

    // Restore timer if was active - improved logic
    if (this.isActive) {
      this.ensureTimerRunning();
    }
  }

  async loadState() {
    try {
      const data = await chrome.storage.local.get([
        "rules",
        "isActive",
        "sessionBlocks",
        "sessionStartTime",
        "focusedTime",
      ]);
      this.rules = data.rules || [];
      this.isActive = data.isActive || false;
      this.sessionBlocks = data.sessionBlocks || 0;
      this.sessionStartTime = data.sessionStartTime || null;
      this.focusedTime = data.focusedTime || 0;

      // Make the session base reflect the persisted focused total
      this.focusedTimeBase = this.focusedTime;
    } catch (error) {
      console.error("Failed to load state:", error);
    }
  }

  async saveTimerState() {
    try {
      await chrome.storage.local.set({
        sessionStartTime: this.sessionStartTime,
        focusedTime: this.focusedTime,
      });
    } catch (error) {
      console.error("Failed to save timer state:", error);
    }
  }

  ensureTimerRunning() {
    if (!this.isActive) {
      this.stopTimer();
      return;
    }

    // If we think we should be active but don't have a session start time,
    // or if we don't have a timer interval running, start it
    if (!this.sessionStartTime || !this.timerInterval) this.startTimer();
  }

  setupListeners() {
    // Listen for messages from popup
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.action === "reloadAffectedTabs") {
        const { rulesBefore, rulesAfter, isActiveBefore, isActiveAfter } =
          message;

        chrome.tabs.query({}, (tabs) => {
          tabs.forEach((tab) => {
            if (
              !tab.id ||
              !tab.url ||
              tab.url.startsWith("chrome://") ||
              tab.url.startsWith("chrome-extension://")
            )
              return;

            // Check block status before and after
            const wasBlocked = this.shouldBlockUrlWith(
              rulesBefore,
              isActiveBefore,
              tab.url
            );
            const isBlocked = this.shouldBlockUrlWith(
              rulesAfter,
              isActiveAfter,
              tab.url
            );

            // Reload only if the status changes
            if (wasBlocked !== isBlocked) {
              chrome.tabs.reload(tab.id);
            }
          });
        });
      }

      this.handleMessage(message, sender, sendResponse);
      return true; // Keep message channel open for async responses
    });

    // Reset session blocks when extension is restarted
    chrome.runtime.onStartup.addListener(() => {
      this.sessionBlocks = 0;
      chrome.storage.local.set({ sessionBlocks: 0 });
    });

    // Handle service worker lifecycle in manifest v3
    chrome.runtime.onSuspend?.addListener(() => {
      if (this.isActive && this.sessionStartTime) {
        // Save current focused time before suspension
        const { totalFocused } = this.getTimes();
        this.focusedTime = totalFocused;
        this.saveTimerState();
      }
    });
  }

  async handleMessage(message, sender, sendResponse) {
    switch (message.action) {
      case "updateRules":
        this.rules = message.rules;
        this.isActive = message.isActive;
        break;

      case "startTimer":
        this.startTimer();
        break;

      case "stopTimer":
        this.stopTimer();
        break;

      case "ensureTimerRunning":
        this.ensureTimerRunning();
        sendResponse({ success: true });
        break;

      case "getTimerState": {
        const { sessionElapsed, totalFocused } = this.getTimes();
        const response = {
          sessionTime: sessionElapsed,
          focusedTime: totalFocused,
        };
        sendResponse(response);
        break;
      }

      case "clearTimers":
        this.focusedTime = 0;

        if (this.sessionStartTime) {
          this.sessionStartTime = Date.now();
          this.focusedTimeBase = 0;
        } else {
          this.focusedTimeBase = 0;
        }

        await this.saveTimerState();

        // Immediately push zeroed values to popup
        this.notifyPopup("timerUpdate", {
          sessionTime: 0,
          focusedTime: 0,
        });
        break;

      case "resetSessionBlocks":
        this.sessionBlocks = 0;
        chrome.storage.local.set({ sessionBlocks: 0 });
        // Notify popup of the reset
        this.notifyPopup("updateBlockCount", { count: 0 });
        break;

      case "checkBlock":
        const shouldBlock = this.shouldBlockUrl(message.url);
        sendResponse({ shouldBlock });
        break;

      case "reportBlock":
        this.sessionBlocks++;
        chrome.storage.local.set({ sessionBlocks: this.sessionBlocks });
        // Notify popup if it's open
        this.notifyPopup("updateBlockCount", { count: this.sessionBlocks });
        break;

      case "getMotivationalQuote":
        this.fetchMotivationalQuote()
          .then((quote) => {
            sendResponse({ success: true, quote });
          })
          .catch((error) => {
            console.error("Fetching error: ", error);
            sendResponse({
              success: true,
              quote: "Stay positive and keep pushing forward!",
            });
          });
        return true; // Keep message channel open for async response
    }
  }

  startTimer() {
    // Clear any existing interval first
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }

    // If we don't have a session start time, create one
    if (!this.sessionStartTime) {
      this.sessionStartTime = Date.now();
      this.focusedTimeBase = this.focusedTime; // cumulative prior to this session
    } else {
      // We already have a session start time, just ensure the base is correct
      this.focusedTimeBase = this.focusedTime;
    }

    this.saveTimerState();

    this.timerInterval = setInterval(() => {
      const { sessionElapsed, totalFocused } = this.getTimes();

      // Push a consistent view to the popup
      this.notifyPopup("timerUpdate", {
        sessionTime: sessionElapsed,
        focusedTime: totalFocused,
      });

      // Persist cumulative total once per minute
      if (sessionElapsed > 0 && sessionElapsed % 60 === 0) {
        this.focusedTime = totalFocused; // roll forward the stored total
        this.saveTimerState();
      }
    }, 1000);
  }

  stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }

    // Finalize the cumulative total for this session
    const { sessionElapsed, totalFocused } = this.getTimes();
    this.focusedTime = totalFocused;

    this.sessionStartTime = null;
    this.saveTimerState();
  }

  getCurrentSessionTime() {
    if (!this.sessionStartTime) return 0;
    return Math.floor((Date.now() - this.sessionStartTime) / 1000);
  }

  shouldBlockUrl(url) {
    if (!this.isActive || !url) return false;

    const cleanUrl = this.cleanUrl(url);

    // Check regular allow rules first (they take precedence)
    const allowRules = this.rules.filter((rule) => rule.type === "allow");
    for (const rule of allowRules) {
      if (this.matchesRule(cleanUrl, rule)) {
        return false; // Explicitly allowed
      }
    }

    // Check if URL would be blocked by domain/url rules
    const blockRules = this.rules.filter(
      (rule) => rule.type === "domain" || rule.type === "url"
    );

    let wouldBeBlocked = false;
    for (const rule of blockRules) {
      if (this.matchesRule(cleanUrl, rule)) {
        wouldBeBlocked = true;
        break;
      }
    }

    // If URL would be blocked, check for allowParam exceptions
    if (wouldBeBlocked) {
      const allowParamRules = this.rules.filter(
        (rule) => rule.type === "allowParam"
      );
      for (const rule of allowParamRules) {
        if (this.matchesParamRule(url, rule)) {
          return false; // Allowed by parameter rule
        }
      }
      return true; // Blocked and no parameter exception found
    }

    return false; // Not blocked
  }

  // To check if the URL should be refreshed or not
  shouldBlockUrlWith(rules, isActive, url) {
    const oldRules = this.rules;
    const oldIsActive = this.isActive;

    this.rules = rules;
    this.isActive = isActive;
    const result = this.shouldBlockUrl(url);

    this.rules = oldRules;
    this.isActive = oldIsActive;
    return result;
  }

  matchesRule(url, rule) {
    const ruleUrl = rule.url.toLowerCase();
    const checkUrl = url.toLowerCase();

    switch (rule.type) {
      case "domain":
        // Block entire domain and all subdomains
        const hostname = new URL("https://" + url).hostname.replace(
          /^www\./,
          ""
        );
        return hostname === ruleUrl || hostname.endsWith("." + ruleUrl);

      case "url":
        // Block only the specific URL - exact match for base domain or exact path match
        try {
          const urlObj = new URL("https://" + checkUrl);
          const ruleObj = new URL("https://" + ruleUrl);

          // If rule is just a domain (no path or just "/"), only block the exact base domain
          if (ruleObj.pathname === "/" || ruleObj.pathname === "") {
            return (
              urlObj.hostname === ruleObj.hostname &&
              (urlObj.pathname === "/" || urlObj.pathname === "")
            );
          }

          // Otherwise, exact URL match including path
          return checkUrl === ruleUrl;
        } catch (error) {
          // Fallback to simple string comparison if URL parsing fails
          return checkUrl === ruleUrl;
        }

      case "allow":
        // Allow rules should match the URL and its subpaths
        return checkUrl === ruleUrl || checkUrl.startsWith(ruleUrl);

      default:
        return false;
    }
  }

  matchesParamRule(url, rule) {
    try {
      const urlObj = new URL(url);
      const paramValue = urlObj.searchParams.get(rule.paramKey);

      // Parameter must exist
      if (paramValue === null) {
        return false;
      }

      // If rule has no specific value requirement, any value is allowed
      if (!rule.paramValue || rule.paramValue === "") {
        return true;
      }

      // Check if parameter value matches exactly
      return paramValue === rule.paramValue;
    } catch (error) {
      console.error("Error parsing URL for parameter matching:", error);
      return false;
    }
  }

  cleanUrl(url) {
    try {
      const urlObj = new URL(url);
      return (urlObj.hostname + urlObj.pathname + urlObj.search).replace(
        /^www\./,
        ""
      );
    } catch {
      return url.replace(/^https?:\/\//, "").replace(/^www\./, "");
    }
  }

  async fetchMotivationalQuote() {
    try {
      const response = await fetch(
        "https://api.forismatic.com/api/1.0/?method=getQuote&format=json&lang=en"
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data.quoteText;
    } catch (error) {
      console.error("ERROR: ", error.message);
    }

    return "Stay positive and keep pushing forward!";
  }

  notifyPopup(action, data) {
    // Try to send message to popup if it's open
    chrome.runtime.sendMessage({ action, ...data }).catch(() => {
      // Popup is closed, ignore error
    });
  }
}

// Initialize background script
new ProducerBackground();
