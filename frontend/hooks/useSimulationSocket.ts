'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useSimulationStore } from './useSimulationStore';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8001';
const RECONNECT_DELAY = 3000;

export function useSimulationSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);

  const {
    setConnected,
    setConnecting,
    setRunning,
    updateFromBackend,
    addEvent,
    agentType,
    scenario,
    setAgentType: storeSetAgentType,
    setScenario: storeSetScenario,
  } = useSimulationStore();

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    setConnecting(true);
    const wsUrl = WS_URL.endsWith('/ws') ? WS_URL : `${WS_URL}/ws`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      if (!mountedRef.current) return;
      setConnected(true);
      setConnecting(false);
      addEvent({
        time: new Date().toLocaleTimeString(),
        type: 'success',
        icon: '🔗',
        message: 'WebSocket connected to simulation server',
      });
    };

    ws.onclose = () => {
      if (!mountedRef.current) return;
      setConnected(false);
      setConnecting(false);
      // Auto-reconnect
      if (mountedRef.current) {
        reconnectTimer.current = setTimeout(() => {
          if (mountedRef.current) connect();
        }, RECONNECT_DELAY);
      }
    };

    ws.onerror = () => {
      if (!mountedRef.current) return;
      setConnected(false);
      setConnecting(false);
    };

    ws.onmessage = (event: MessageEvent) => {
      if (!mountedRef.current) return;
      try {
        const message = JSON.parse(event.data);

        switch (message.type) {
          case 'connection_established':
            if (message.data) updateFromBackend(message.data);
            break;

          case 'state_update':
            if (message.data) updateFromBackend(message.data);
            break;

          case 'simulation_started':
            setRunning(true);
            addEvent({
              time: new Date().toLocaleTimeString(),
              type: 'success',
              icon: '▶',
              message: `Simulation started: ${message.data?.task_id || 'unknown'}`,
            });
            break;

          case 'simulation_stopped':
            setRunning(false);
            addEvent({
              time: new Date().toLocaleTimeString(),
              type: 'info',
              icon: '⏸',
              message: 'Simulation stopped',
            });
            break;

          case 'episode_complete':
            setRunning(false);
            addEvent({
              time: new Date().toLocaleTimeString(),
              type: 'success',
              icon: '🏁',
              message: `Episode complete — ${message.data?.steps || 0} steps`,
            });
            break;

          case 'error':
            addEvent({
              time: new Date().toLocaleTimeString(),
              type: 'danger',
              icon: '❌',
              message: message.data?.message || 'Unknown error',
            });
            break;
        }
      } catch (e) {
        console.error('Failed to parse WS message:', e);
      }
    };

    wsRef.current = ws;
  }, [setConnected, setConnecting, setRunning, updateFromBackend, addEvent]);

  // Connect on mount
  useEffect(() => {
    mountedRef.current = true;
    connect();

    return () => {
      mountedRef.current = false;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (wsRef.current) {
        wsRef.current.onclose = null; // Prevent reconnect on intentional close
        wsRef.current.close();
      }
    };
  }, [connect]);

  // ── Command API ─────────────────────────────────────────
  const sendCommand = useCallback((command: string, params: Record<string, any> = {}) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ command, ...params }));
    }
  }, []);

  const startSimulation = useCallback(() => {
    sendCommand('start', {
      task_id: scenario,
      agent_type: agentType,
    });
  }, [sendCommand, scenario, agentType]);

  const stopSimulation = useCallback(() => {
    sendCommand('stop');
  }, [sendCommand]);

  const setAgentType = useCallback((type: 'ppo' | 'rule_based') => {
    storeSetAgentType(type);
    sendCommand('set_agent_type', { agent_type: type });
  }, [sendCommand, storeSetAgentType]);

  const selectScenario = useCallback((scenarioId: string) => {
    storeSetScenario(scenarioId);
    sendCommand('select_scenario', { scenario_id: scenarioId });
  }, [sendCommand, storeSetScenario]);

  const injectDisturbance = useCallback((disturbanceType: string, payload: any = {}) => {
    sendCommand('inject_disturbance', { disturbance_type: disturbanceType, payload });
    useSimulationStore.getState().addEvent({
      time: new Date().toLocaleTimeString(),
      type: 'warning',
      icon: '⚡',
      message: `Disturbance injected: ${disturbanceType.replace(/_/g, ' ')}`,
    });
  }, [sendCommand]);

  return {
    startSimulation,
    stopSimulation,
    setAgentType,
    setAgentTypeCommand: setAgentType,
    selectScenario,
    injectDisturbance,
    triggerDisturbance: injectDisturbance,
    sendCommand,
  };
}
