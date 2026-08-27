import React, { useMemo, useCallback } from 'react';
import { ReactFlow, Controls, Background, useNodesState, useEdgesState, MarkerType } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

// Custom node component to render a nice department card
const DepartmentNode = ({ data }) => {
  return (
    <div className={`px-4 py-2 shadow-md rounded-md bg-white dark:bg-zinc-900 border-2 ${data.active ? 'border-yellow-500' : 'border-zinc-200 dark:border-zinc-800'}`}>
      <div className="flex items-center gap-2">
        <div className="font-bold text-zinc-900 dark:text-zinc-100">{data.label}</div>
      </div>
      <div className="text-sm mt-1 text-zinc-500 dark:text-zinc-400">
        {data.valueLabel}: <span className={`font-bold ${data.active ? 'text-yellow-500' : 'text-zinc-900 dark:text-zinc-100'}`}>{data.value}</span>
      </div>
    </div>
  );
};

const nodeTypes = {
  department: DepartmentNode,
};

export const FloorMap = ({ floorStatus }) => {
  const { orders = [], activeTables = 0, waiterCalls = 0 } = floorStatus || {};

  const qrOrders = orders.filter(o => o.origin === 'QR_MENU' && ['DRAFT', 'PENDING_PAYMENT'].includes(o.status)).length;
  const posOrders = orders.filter(o => o.origin === 'POS' && ['PENDING_VERIFICATION'].includes(o.status)).length;
  const kitchenOrders = orders.filter(o => o.status === 'PROCESSING').length;
  const readyOrders = orders.filter(o => o.status === 'READY').length;
  const servedOrders = orders.filter(o => o.status === 'SERVED').length;

  const initialNodes = [
    {
      id: 'qr',
      type: 'department',
      position: { x: 50, y: 50 },
      data: { label: 'QR Portal', valueLabel: 'Pending', value: qrOrders, active: qrOrders > 0 },
    },
    {
      id: 'pos',
      type: 'department',
      position: { x: 50, y: 200 },
      data: { label: 'POS System', valueLabel: 'Pending', value: posOrders, active: posOrders > 0 },
    },
    {
      id: 'kitchen',
      type: 'department',
      position: { x: 350, y: 125 },
      data: { label: 'Kitchen (KDS)', valueLabel: 'Preparing', value: kitchenOrders, active: kitchenOrders > 0 },
    },
    {
      id: 'waiters',
      type: 'department',
      position: { x: 350, y: 275 },
      data: { label: 'Wait Staff', valueLabel: 'Active Calls', value: waiterCalls, active: waiterCalls > 0 },
    },
    {
      id: 'tables',
      type: 'department',
      position: { x: 650, y: 125 },
      data: { label: 'Dining Area', valueLabel: 'Ready/Occupied', value: `${readyOrders} / ${activeTables}`, active: readyOrders > 0 || activeTables > 0 },
    },
    {
      id: 'checkout',
      type: 'department',
      position: { x: 950, y: 125 },
      data: { label: 'Checkout', valueLabel: 'Served', value: servedOrders, active: servedOrders > 0 },
    },
  ];

  const initialEdges = [
    { id: 'e-qr-kitchen', source: 'qr', target: 'kitchen', animated: qrOrders > 0, style: { stroke: qrOrders > 0 ? '#eab308' : '#cbd5e1', strokeWidth: 2 } },
    { id: 'e-pos-kitchen', source: 'pos', target: 'kitchen', animated: posOrders > 0, style: { stroke: posOrders > 0 ? '#eab308' : '#cbd5e1', strokeWidth: 2 } },
    { id: 'e-kitchen-tables', source: 'kitchen', target: 'tables', animated: kitchenOrders > 0, style: { stroke: kitchenOrders > 0 ? '#eab308' : '#cbd5e1', strokeWidth: 2 } },
    { id: 'e-waiters-tables', source: 'waiters', target: 'tables', animated: waiterCalls > 0, style: { stroke: waiterCalls > 0 ? '#eab308' : '#cbd5e1', strokeWidth: 2 } },
    { id: 'e-tables-checkout', source: 'tables', target: 'checkout', animated: readyOrders > 0, style: { stroke: readyOrders > 0 ? '#eab308' : '#cbd5e1', strokeWidth: 2 } },
  ];

  const [nodes, setNodes] = useNodesState(initialNodes);
  const [edges, setEdges] = useEdgesState(initialEdges);

  React.useEffect(() => {
    setNodes((nds) =>
      nds.map((n) => {
        const matchingNode = initialNodes.find((inNode) => inNode.id === n.id);
        return { ...n, data: matchingNode.data };
      })
    );
    setEdges((eds) =>
      eds.map((e) => {
        const matchingEdge = initialEdges.find((inEdge) => inEdge.id === e.id);
        return { ...e, animated: matchingEdge.animated, style: matchingEdge.style };
      })
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [floorStatus]);

  return (
    <div className="bg-zinc-50 dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-zinc-800 h-[60vh] w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        attributionPosition="bottom-right"
      >
        <Background color="#ccc" gap={16} />
        <Controls />
      </ReactFlow>
    </div>
  );
};
