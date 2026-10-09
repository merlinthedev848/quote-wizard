/**
 * @file toast.js
 * @description Accessible, non-blocking notification toast utility.
 */

class ToastManager {
  constructor() {
    this.container = null;
    this.ensureContainer();
  }

  ensureContainer() {
    if (typeof document === "undefined") return;
    let container = document.getElementById("toast-container");
    if (!container) {
      container = document.createElement("div");
      container.id = "toast-container";
      container.className = "toast-container";
      container.setAttribute("aria-live", "polite");
      container.setAttribute("aria-atomic", "true");
      document.body.appendChild(container);
    }
    this.container = container;
  }

  /**
   * Show a toast message.
   * @param {string} message - Message text
   * @param {"info"|"success"|"warning"|"error"} type - Severity type
   * @param {number} duration - Display time in ms
   */
  show(message, type = "info", duration = 4000) {
    this.ensureContainer();
    if (!this.container) return;

    const toast = document.createElement("div");
    toast.className = `toast-card toast-${type}`;
    toast.setAttribute("role", type === "error" ? "alert" : "status");

    const iconMap = {
      info: `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`,
      success: `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`,
      warning: `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`,
      error: `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`
    };

    const iconHtml = iconMap[type] || iconMap.info;
    const safeText = document.createTextNode(message);

    const iconSpan = document.createElement("span");
    iconSpan.className = "toast-icon-wrap";
    iconSpan.innerHTML = iconHtml;

    const textSpan = document.createElement("span");
    textSpan.className = "toast-text";
    textSpan.appendChild(safeText);

    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "toast-close-btn";
    closeBtn.setAttribute("aria-label", "Dismiss notification");
    closeBtn.innerHTML = "&times;";

    toast.appendChild(iconSpan);
    toast.appendChild(textSpan);
    toast.appendChild(closeBtn);

    const dismiss = () => {
      toast.classList.add("toast-leaving");
      toast.addEventListener("animationend", () => {
        toast.remove();
      }, { once: true });
    };

    closeBtn.addEventListener("click", dismiss);
    this.container.appendChild(toast);

    if (duration > 0) {
      setTimeout(dismiss, duration);
    }
  }

  info(msg, dur) { this.show(msg, "info", dur); }
  success(msg, dur) { this.show(msg, "success", dur); }
  warning(msg, dur) { this.show(msg, "warning", dur); }
  error(msg, dur) { this.show(msg, "error", dur); }
}

export const toast = new ToastManager();
