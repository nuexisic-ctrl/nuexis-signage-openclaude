export interface ModalEntry {
  id: string;
}

declare global {
  interface Window {
    __nuexisModalStack?: ModalEntry[];
  }
}

// Helper to safely get the stack in client environments
const getStack = (): ModalEntry[] => {
  if (typeof window === 'undefined') return [];
  if (!window.__nuexisModalStack) {
    window.__nuexisModalStack = [];
  }
  return window.__nuexisModalStack;
};

export const modalStack = {
  push: (id: string) => {
    const stack = getStack();
    if (!stack.some(entry => entry.id === id)) {
      stack.push({ id });
    }
  },
  
  pop: (id: string) => {
    if (typeof window === 'undefined') return;
    if (!window.__nuexisModalStack) return;
    window.__nuexisModalStack = window.__nuexisModalStack.filter(entry => entry.id !== id);
  },
  
  isTop: (id: string): boolean => {
    const stack = getStack();
    if (stack.length === 0) return false;
    return stack[stack.length - 1].id === id;
  },

  hasActiveChildOf: (id: string): boolean => {
    const stack = getStack();
    const index = stack.findIndex(entry => entry.id === id);
    if (index === -1) return false;
    return index < stack.length - 1;
  }
};
