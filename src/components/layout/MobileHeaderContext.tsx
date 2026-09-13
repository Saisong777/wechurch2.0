import { createContext } from 'react';

export const MobileHeaderContext = createContext<{
  actionsTarget: HTMLDivElement | null;
  setActionsTarget: (element: HTMLDivElement | null) => void;
} | null>(null);
