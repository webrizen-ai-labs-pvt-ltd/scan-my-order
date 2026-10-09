import React from 'react';
import { usePos } from './pos-layout';
import { PosClassicPage } from './pos-classic-page';
import { PosTerminalPage } from './pos-terminal-page';

/** "New order": the classic billing screen or the modern picture menu, as set in store settings */
export const PosNewOrderPage = () => {
  const { store } = usePos();
  return store?.posLayout === 'MODERN' ? <PosTerminalPage /> : <PosClassicPage />;
};
