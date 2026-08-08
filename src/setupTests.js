import '@testing-library/jest-dom';
import { vi } from 'vitest';

window.scrollTo = vi.fn();
if (!window.PointerEvent) {
  window.PointerEvent = class PointerEvent extends MouseEvent {
    constructor(type, properties = {}) {
      super(type, properties);
      Object.defineProperty(this, 'pointerId', { value: properties.pointerId || 0 });
      Object.defineProperty(this, 'pointerType', { value: properties.pointerType || 'mouse' });
    }
  };
}
