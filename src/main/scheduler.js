const initialNodes = [
  {
    id: 'node-a',
    name: '节点 A (阿里云)',
    provider: 'aliyun',
    region: 'cn-hangzhou',
    totalCPU: 8,
    totalMemory: 16,
    usedCPU: 0,
    usedMemory: 0,
    labels: {
      'cloud-provider': 'aliyun',
      'region': 'cn-hangzhou',
      'zone': 'cn-hangzhou-e',
      'disk-type': 'ssd',
      'network': 'high-speed'
    },
    taints: [
      { key: 'dedicated', value: 'aliyun', effect: 'NoSchedule' }
    ],
    pods: []
  },
  {
    id: 'node-b',
    name: '节点 B (私有云)',
    provider: 'private',
    region: 'on-premise',
    totalCPU: 16,
    totalMemory: 32,
    usedCPU: 0,
    usedMemory: 0,
    labels: {
      'cloud-provider': 'private',
      'region': 'on-premise',
      'zone': 'dc-1',
      'disk-type': 'hdd',
      'security': 'high'
    },
    taints: [
      { key: 'dedicated', value: 'private', effect: 'NoSchedule' }
    ],
    pods: []
  }
];

let nodes = JSON.parse(JSON.stringify(initialNodes));

function getInitialNodes() {
  return JSON.parse(JSON.stringify(nodes));
}

function resetSimulation() {
  nodes = JSON.parse(JSON.stringify(initialNodes));
  return getInitialNodes();
}

function predicateCheck(podSpec, node) {
  const logs = [];
  let passed = true;

  logs.push({
    phase: '预选',
    check: 'CPU 资源检查',
    required: `${podSpec.cpu} 核`,
    available: `${node.totalCPU - node.usedCPU} 核`,
    passed: false
  });
  if (node.usedCPU + podSpec.cpu > node.totalCPU) {
    logs[logs.length - 1].reason = 'CPU 资源不足';
    passed = false;
  } else {
    logs[logs.length - 1].passed = true;
  }

  logs.push({
    phase: '预选',
    check: '内存资源检查',
    required: `${podSpec.memory} Gi`,
    available: `${node.totalMemory - node.usedMemory} Gi`,
    passed: false
  });
  if (node.usedMemory + podSpec.memory > node.totalMemory) {
    logs[logs.length - 1].reason = '内存资源不足';
    passed = false;
  } else {
    logs[logs.length - 1].passed = true;
  }

  logs.push({
    phase: '预选',
    check: '节点选择器匹配',
    required: JSON.stringify(podSpec.nodeSelector || {}),
    available: JSON.stringify(node.labels),
    passed: false
  });
  const selectorMatch = checkNodeSelector(podSpec.nodeSelector, node.labels);
  if (!selectorMatch) {
    logs[logs.length - 1].reason = '节点标签不匹配 nodeSelector';
    passed = false;
  } else {
    logs[logs.length - 1].passed = true;
  }

  logs.push({
    phase: '预选',
    check: '污点容忍度检查',
    required: JSON.stringify(podSpec.tolerations || []),
    available: JSON.stringify(node.taints),
    passed: false
  });
  const tolerationMatch = checkTolerations(podSpec.tolerations, node.taints);
  if (!tolerationMatch) {
    logs[logs.length - 1].reason = 'Pod 没有容忍节点的污点';
    passed = false;
  } else {
    logs[logs.length - 1].passed = true;
  }

  return { passed, logs };
}

function checkNodeSelector(selector, labels) {
  if (!selector || Object.keys(selector).length === 0) {
    return true;
  }
  for (const [key, value] of Object.entries(selector)) {
    if (labels[key] !== value) {
      return false;
    }
  }
  return true;
}

function checkTolerations(tolerations, taints) {
  if (!tolerations || tolerations.length === 0) {
    return taints.length === 0;
  }
  for (const taint of taints) {
    if (taint.effect === 'NoSchedule') {
      const tolerated = tolerations.some(tol =>
        tol.key === taint.key &&
        (tol.operator === 'Exists' || (tol.operator === 'Equal' && tol.value === taint.value))
      );
      if (!tolerated) {
        return false;
      }
    }
  }
  return true;
}

function priorityScore(podSpec, node) {
  const scores = [];
  let totalScore = 0;

  const cpuRemaining = node.totalCPU - node.usedCPU - podSpec.cpu;
  const cpuRatio = cpuRemaining / node.totalCPU;
  const cpuScore = Math.round(cpuRatio * 100);
  scores.push({ name: 'CPU 剩余资源', score: cpuScore, weight: 2, description: `剩余 ${cpuRemaining} 核 (${(cpuRatio * 100).toFixed(1)}%)` });

  const memoryRemaining = node.totalMemory - node.usedMemory - podSpec.memory;
  const memoryRatio = memoryRemaining / node.totalMemory;
  const memoryScore = Math.round(memoryRatio * 100);
  scores.push({ name: '内存剩余资源', score: memoryScore, weight: 2, description: `剩余 ${memoryRemaining} Gi (${(memoryRatio * 100).toFixed(1)}%)` });

  let affinityScore = 50;
  let affinityDesc = '无亲和性配置';
  if (podSpec.affinity && podSpec.affinity.nodeAffinity) {
    affinityScore = calculateAffinityScore(podSpec.affinity.nodeAffinity, node);
    affinityDesc = affinityScore > 50 ? '匹配亲和性规则' : '不匹配亲和性规则';
  }
  scores.push({ name: '节点亲和性', score: affinityScore, weight: 3, description: affinityDesc });

  const podCount = node.pods.length;
  const podDensityScore = Math.max(0, 100 - podCount * 10);
  scores.push({ name: 'Pod 密度均衡', score: podDensityScore, weight: 1, description: `当前运行 ${podCount} 个 Pod` });

  for (const item of scores) {
    totalScore += item.score * item.weight;
  }

  const totalWeight = scores.reduce((sum, s) => sum + s.weight, 0);
  const finalScore = Math.round(totalScore / totalWeight);

  return { finalScore, details: scores };
}

function calculateAffinityScore(affinity, node) {
  let score = 50;

  if (affinity.preferredDuringSchedulingIgnoredDuringExecution) {
    for (const pref of affinity.preferredDuringSchedulingIgnoredDuringExecution) {
      const match = checkMatchExpressions(pref.preference.matchExpressions, node.labels);
      if (match) {
        score += pref.weight * 10;
      }
    }
  }

  if (affinity.requiredDuringSchedulingIgnoredDuringExecution) {
    const match = checkNodeSelectorTerms(
      affinity.requiredDuringSchedulingIgnoredDuringExecution.nodeSelectorTerms,
      node.labels
    );
    if (!match) {
      score = 0;
    }
  }

  return Math.min(100, score);
}

function checkMatchExpressions(expressions, labels) {
  if (!expressions) return true;

  for (const expr of expressions) {
    const labelValue = labels[expr.key];
    switch (expr.operator) {
      case 'In':
        if (!expr.values.includes(labelValue)) return false;
        break;
      case 'NotIn':
        if (expr.values.includes(labelValue)) return false;
        break;
      case 'Exists':
        if (!labelValue) return false;
        break;
      case 'DoesNotExist':
        if (labelValue) return false;
        break;
    }
  }
  return true;
}

function checkNodeSelectorTerms(terms, labels) {
  if (!terms || terms.length === 0) return true;

  return terms.some(term => checkMatchExpressions(term.matchExpressions, labels));
}

function schedulePod(podSpec) {
  const result = {
    success: false,
    podId: `pod-${Date.now()}`,
    selectedNode: null,
    evaluationLog: [],
    nodes: []
  };

  const pod = {
    id: result.podId,
    name: podSpec.name || `pod-${Date.now()}`,
    cpu: podSpec.cpu,
    memory: podSpec.memory,
    labels: podSpec.labels || {},
    status: 'Pending'
  };

  result.evaluationLog.push({
    phase: '调度开始',
    message: `开始调度 Pod: ${pod.name}`,
    timestamp: new Date().toISOString()
  });

  const predicateResults = [];
  for (const node of nodes) {
    const predicate = predicateCheck(podSpec, node);
    predicateResults.push({
      nodeId: node.id,
      nodeName: node.name,
      passed: predicate.passed,
      logs: predicate.logs
    });
    result.evaluationLog.push({
      phase: '预选阶段',
      node: node.name,
      passed: predicate.passed,
      checks: predicate.logs
    });
  }

  const filteredNodes = predicateResults
    .filter(p => p.passed)
    .map(p => nodes.find(n => n.id === p.nodeId));

  if (filteredNodes.length === 0) {
    result.evaluationLog.push({
      phase: '调度失败',
      message: '没有节点通过预选阶段，Pod 无法调度'
    });
    result.nodes = getInitialNodes();
    return result;
  }

  result.evaluationLog.push({
    phase: '预选完成',
    message: `${filteredNodes.length} 个节点通过预选，进入优选阶段`,
    candidates: filteredNodes.map(n => n.name)
  });

  const priorityResults = [];
  for (const node of filteredNodes) {
    const priority = priorityScore(podSpec, node);
    priorityResults.push({
      nodeId: node.id,
      nodeName: node.name,
      finalScore: priority.finalScore,
      details: priority.details
    });
    result.evaluationLog.push({
      phase: '优选阶段',
      node: node.name,
      finalScore: priority.finalScore,
      scoreDetails: priority.details
    });
  }

  priorityResults.sort((a, b) => b.finalScore - a.finalScore);
  const selected = priorityResults[0];

  result.evaluationLog.push({
    phase: '优选完成',
    message: `节点 ${selected.nodeName} 得分最高 (${selected.finalScore} 分)，被选中`,
    ranking: priorityResults.map((p, i) => `${i + 1}. ${p.nodeName}: ${p.finalScore} 分`)
  });

  const targetNode = nodes.find(n => n.id === selected.nodeId);
  targetNode.usedCPU += podSpec.cpu;
  targetNode.usedMemory += podSpec.memory;
  pod.status = 'Running';
  targetNode.pods.push(pod);

  result.success = true;
  result.selectedNode = selected.nodeId;
  result.pod = pod;
  result.nodes = getInitialNodes();

  result.evaluationLog.push({
    phase: '绑定完成',
    message: `Pod ${pod.name} 已成功绑定到 ${targetNode.name}`,
    pod: pod,
    node: targetNode.name
  });

  return result;
}

module.exports = {
  getInitialNodes,
  resetSimulation,
  schedulePod
};
