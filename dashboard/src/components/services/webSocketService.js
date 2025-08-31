// components/services/webSocketService.js
export class WebSocketService {
  constructor() {
    this.callbacks = new Map();
    this.pollInterval = null;
    this.isPolling = false;
    this.isDestroyed = false;
  }

  subscribe(key, callback) {
    if (this.isDestroyed) return;
    this.callbacks.set(key, callback);
  }

  unsubscribe(key) {
    this.callbacks.delete(key);
  }

  startPolling(fetchRunningScans) {
    // Prevent multiple polling instances
    if (this.isPolling || this.pollInterval || this.isDestroyed) {
      console.log("Polling already active or service destroyed");
      return;
    }
    
    this.isPolling = true;
    console.log("Starting polling for running scans...");

    const poll = async () => {
      try {
        if (this.isDestroyed) {
          this.stopPolling();
          return;
        }

        const hasRunning = await fetchRunningScans();
        
        if (!hasRunning) {
          console.log("No running scans, stopping polling");
          this.stopPolling();
          return;
        }
        
        // Trigger callbacks safely
        this.callbacks.forEach((callback, key) => {
          try {
            callback({ type: "poll_update", timestamp: Date.now() });
          } catch (error) {
            console.error(`Error in callback ${key}:`, error);
            // Remove problematic callback
            this.callbacks.delete(key);
          }
        });
        
      } catch (error) {
        console.error("Error during polling:", error);
        this.stopPolling();
      }
    };

    this.pollInterval = setInterval(poll, 5000);
  }

  stopPolling() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    this.isPolling = false;
    console.log("Polling stopped");
  }

  cleanup() {
    this.isDestroyed = true;
    this.stopPolling();
    this.callbacks.clear();
    console.log("WebSocket service cleaned up");
  }
}