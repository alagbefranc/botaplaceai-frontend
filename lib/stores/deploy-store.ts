"use client";

import { create } from "zustand";

export interface DeployedAgent {
  id: string;
  name: string;
  voice: string;
  channels: string[];
  tools: string[];
  widgetCode: string;
  phoneNumber: string;
}

interface DeployState {
  isDeployDrawerOpen: boolean;
  deployedAgent: DeployedAgent | null;
  openDeployDrawer: (agent: DeployedAgent) => void;
  closeDeployDrawer: () => void;
}

export const useDeployStore = create<DeployState>((set) => ({
  isDeployDrawerOpen: false,
  deployedAgent: null,
  openDeployDrawer: (agent) =>
    set({
      isDeployDrawerOpen: true,
      deployedAgent: agent,
    }),
  closeDeployDrawer: () =>
    set({
      isDeployDrawerOpen: false,
    }),
}));
