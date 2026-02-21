// Shared client-side utilities

export function escapeHtml(s: string): string {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

export function showToast(toast: HTMLElement, duration: number): void {
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('quest-toast-show'));
  setTimeout(() => {
    toast.classList.add('quest-toast-hide');
    toast.addEventListener('animationend', () => toast.remove());
    setTimeout(() => { if (toast.parentNode) toast.remove(); }, 2000);
  }, duration);
}
