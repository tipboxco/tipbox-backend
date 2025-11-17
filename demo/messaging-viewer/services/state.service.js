// State Management Service
export function createPanelState(side) {
  return {
    baseUrl: 'http://localhost:3000',
    token: null,
    user: null,
    threads: [],
    filteredThreads: [],
    activeThread: null,
    activeThreadItems: [],
    counterpartMap: new Map(),
    socket: null,
    joinedThreads: new Set(),
    supportModalOpen: false,
    tipsModalOpen: false,
    supportChat: null,
    supportChatItems: [],
    typingUsers: new Set(),
    typingThreads: new Map(),
    typingTimeout: null,
    side,
  };
}

export const panels = {
  left: createPanelState('left'),
  right: createPanelState('right'),
};

