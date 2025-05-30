// Stagewise Development Toolbar - Working Version
// Only loads in development mode

(function () {
  // Check if we're in development mode - expanded to include ngrok and other dev indicators
  const hostname = window.location.hostname;
  const isDevelopment =
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname.includes("dev") ||
    hostname.includes("ngrok") ||
    hostname.includes("tunnel") ||
    hostname.includes("localhost.run") ||
    hostname.includes("localtunnel") ||
    // Also check for development based on other indicators
    window.location.port === "3000" ||
    window.location.search.includes("dev=true") ||
    // Check if we're in a development environment
    (typeof window.process !== "undefined" &&
      window.process.env &&
      window.process.env.NODE_ENV === "development");

  console.log("[Stagewise] 🔍 Hostname:", hostname);
  console.log("[Stagewise] 🔍 Full URL:", window.location.href);
  console.log("[Stagewise] 🔍 Development mode check:", isDevelopment);

  if (!isDevelopment) {
    console.log(
      "[Stagewise] ❌ Not in development mode, skipping toolbar load",
    );
    return; // Don't load in production
  }

  console.log("[Stagewise] 🚀 Loading development toolbar...");

  // Polyfill process object for browser compatibility
  if (typeof window.process === "undefined") {
    window.process = {
      env: {
        NODE_ENV: "development",
      },
    };
  }

  // Wait for DOM to be ready
  function initStagewise() {
    // Load CSS first
    const cssLink = document.createElement("link");
    cssLink.rel = "stylesheet";
    cssLink.href = "/node_modules/@stagewise/toolbar/dist/index.css";
    document.head.appendChild(cssLink);

    // Enhanced stagewise configuration with more visible feedback
    const stagewiseConfig = {
      plugins: [
        {
          name: "kambo-context",
          description: "Provides context for Kambo Klarity forms and calendar",
          shortInfoForPrompt: () => {
            return "This is a Kambo Klarity web application with forms and calendar functionality";
          },
          mcp: null,
          actions: [
            {
              name: "Log Element Info",
              description: "Logs information about the selected element",
              execute: (element) => {
                console.log("🎯 Selected element:", element);
                console.log("🎯 Element tag:", element.tagName);
                console.log("🎯 Element classes:", element.className);
                console.log(
                  "🎯 Element text:",
                  element.textContent?.substring(0, 100),
                );

                // Visual feedback
                element.style.outline = "3px solid #ff6b6b";
                setTimeout(() => {
                  element.style.outline = "";
                }, 2000);
              },
            },
            {
              name: "Highlight Element",
              description: "Highlights the selected element",
              execute: (element) => {
                element.style.backgroundColor = "yellow";
                element.style.transition = "background-color 0.3s";
                setTimeout(() => {
                  element.style.backgroundColor = "";
                }, 3000);
              },
            },
          ],
        },
      ],
    };

    // Load the ES module (we know this works from the test)
    import("/node_modules/@stagewise/toolbar/dist/index.js")
      .then((module) => {
        console.log("[Stagewise] ✅ ES Module loaded successfully");

        if (module.initToolbar) {
          module.initToolbar(stagewiseConfig);
          console.log("[Stagewise] 🎉 Toolbar initialized successfully!");
          console.log(
            "[Stagewise] 💡 Try hovering over elements and clicking them",
          );
          console.log(
            "[Stagewise] 💡 Look for selection highlights and context menus",
          );

          // Add a visible indicator that stagewise is active
          const indicator = document.createElement("div");
          indicator.innerHTML = "🎯 Stagewise Active";
          indicator.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            background: #4CAF50;
            color: white;
            padding: 8px 12px;
            border-radius: 4px;
            font-family: Arial, sans-serif;
            font-size: 12px;
            z-index: 10000;
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
          `;
          document.body.appendChild(indicator);

          // Remove indicator after 5 seconds
          setTimeout(() => {
            indicator.remove();
          }, 5000);
        } else {
          console.error("[Stagewise] ❌ initToolbar function not found");
        }
      })
      .catch((error) => {
        console.error("[Stagewise] ❌ Failed to load ES module:", error);
      });
  }

  // Initialize when DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initStagewise);
  } else {
    initStagewise();
  }
})();
