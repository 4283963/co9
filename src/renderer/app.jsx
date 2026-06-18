const { useState, useEffect } = React;
const { ipcRenderer } = window.require('electron');

function App() {
  const [nodes, setNodes] = useState([]);
  const [podSpec, setPodSpec] = useState({
    name: 'my-app',
    cpu: 1,
    memory: 1,
    nodeSelector: {},
    tolerations: [],
    affinity: {}
  });
  const [scheduling, setScheduling] = useState(false);
  const [scheduleResult, setScheduleResult] = useState(null);
  const [activeTab, setActiveTab] = useState('basic');
  const [selectorKey, setSelectorKey] = useState('');
  const [selectorValue, setSelectorValue] = useState('');
  const [tolerationKey, setTolerationKey] = useState('');
  const [tolerationValue, setTolerationValue] = useState('');
  const [tolerationOperator, setTolerationOperator] = useState('Equal');
  const [showLog, setShowLog] = useState(false);

  useEffect(() => {
    loadNodes();
  }, []);

  const loadNodes = async () => {
    const initialNodes = await ipcRenderer.invoke('get-initial-nodes');
    setNodes(initialNodes);
  };

  const handleSchedule = async () => {
    setScheduling(true);
    setScheduleResult(null);
    try {
      const result = await ipcRenderer.invoke('schedule-pod', podSpec);
      setScheduleResult(result);
      setNodes(result.nodes);
      setShowLog(true);
    } catch (error) {
      console.error('调度失败:', error);
    } finally {
      setScheduling(false);
    }
  };

  const handleReset = async () => {
    const resetNodes = await ipcRenderer.invoke('reset-simulation');
    setNodes(resetNodes);
    setScheduleResult(null);
    setShowLog(false);
  };

  const addNodeSelector = () => {
    if (selectorKey && selectorValue) {
      setPodSpec({
        ...podSpec,
        nodeSelector: {
          ...podSpec.nodeSelector,
          [selectorKey]: selectorValue
        }
      });
      setSelectorKey('');
      setSelectorValue('');
    }
  };

  const removeNodeSelector = (key) => {
    const newSelector = { ...podSpec.nodeSelector };
    delete newSelector[key];
    setPodSpec({ ...podSpec, nodeSelector: newSelector });
  };

  const addToleration = () => {
    if (tolerationKey) {
      setPodSpec({
        ...podSpec,
        tolerations: [
          ...podSpec.tolerations,
          {
            key: tolerationKey,
            operator: tolerationOperator,
            value: tolerationOperator === 'Equal' ? tolerationValue : undefined
          }
        ]
      });
      setTolerationKey('');
      setTolerationValue('');
    }
  };

  const removeToleration = (index) => {
    const newTolerations = [...podSpec.tolerations];
    newTolerations.splice(index, 1);
    setPodSpec({ ...podSpec, tolerations: newTolerations });
  };

  const quickPreset = (preset) => {
    if (preset === 'aliyun') {
      setPodSpec({
        ...podSpec,
        nodeSelector: { 'cloud-provider': 'aliyun' },
        tolerations: [{ key: 'dedicated', operator: 'Equal', value: 'aliyun' }]
      });
    } else if (preset === 'private') {
      setPodSpec({
        ...podSpec,
        nodeSelector: { 'cloud-provider': 'private' },
        tolerations: [{ key: 'dedicated', operator: 'Equal', value: 'private' }]
      });
    } else if (preset === 'any') {
      setPodSpec({
        ...podSpec,
        nodeSelector: {},
        tolerations: [
          { key: 'dedicated', operator: 'Equal', value: 'aliyun' },
          { key: 'dedicated', operator: 'Equal', value: 'private' }
        ]
      });
    } else if (preset === 'clear') {
      setPodSpec({
        ...podSpec,
        nodeSelector: {},
        tolerations: [],
        affinity: {}
      });
    }
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>☸️ K8s 调度器模拟沙盒</h1>
        <p>学习 Pod 如何被调度到不同的集群节点</p>
      </header>

      <div className="main-content">
        <div className="left-panel">
          <div className="panel-card">
            <h2>📋 Pod 需求配置</h2>

            <div className="quick-presets">
              <button className="preset-btn" onClick={() => quickPreset('aliyun')}>
                阿里云
              </button>
              <button className="preset-btn" onClick={() => quickPreset('private')}>
                私有云
              </button>
              <button className="preset-btn" onClick={() => quickPreset('any')}>
                任意节点
              </button>
              <button className="preset-btn clear" onClick={() => quickPreset('clear')}>
                清空
              </button>
            </div>

            <div className="tabs">
              <button
                className={`tab-btn ${activeTab === 'basic' ? 'active' : ''}`}
                onClick={() => setActiveTab('basic')}
              >
                基础配置
              </button>
              <button
                className={`tab-btn ${activeTab === 'selector' ? 'active' : ''}`}
                onClick={() => setActiveTab('selector')}
              >
                节点选择器
              </button>
              <button
                className={`tab-btn ${activeTab === 'toleration' ? 'active' : ''}`}
                onClick={() => setActiveTab('toleration')}
              >
                污点容忍
              </button>
            </div>

            {activeTab === 'basic' && (
              <div className="tab-content">
                <div className="form-group">
                  <label>Pod 名称</label>
                  <input
                    type="text"
                    value={podSpec.name}
                    onChange={(e) => setPodSpec({ ...podSpec, name: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>CPU 需求: {podSpec.cpu} 核</label>
                  <input
                    type="range"
                    min="0.5"
                    max="8"
                    step="0.5"
                    value={podSpec.cpu}
                    onChange={(e) => setPodSpec({ ...podSpec, cpu: parseFloat(e.target.value) })}
                  />
                  <div className="range-labels">
                    <span>0.5</span>
                    <span>8</span>
                  </div>
                </div>

                <div className="form-group">
                  <label>内存需求: {podSpec.memory} Gi</label>
                  <input
                    type="range"
                    min="0.5"
                    max="16"
                    step="0.5"
                    value={podSpec.memory}
                    onChange={(e) => setPodSpec({ ...podSpec, memory: parseFloat(e.target.value) })}
                  />
                  <div className="range-labels">
                    <span>0.5</span>
                    <span>16</span>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'selector' && (
              <div className="tab-content">
                <div className="form-group">
                  <label>添加 nodeSelector</label>
                  <div className="input-row">
                    <input
                      type="text"
                      placeholder="键 (如 cloud-provider)"
                      value={selectorKey}
                      onChange={(e) => setSelectorKey(e.target.value)}
                    />
                    <input
                      type="text"
                      placeholder="值 (如 aliyun)"
                      value={selectorValue}
                      onChange={(e) => setSelectorValue(e.target.value)}
                    />
                    <button className="add-btn" onClick={addNodeSelector}>
                      +
                    </button>
                  </div>
                </div>

                <div className="selector-list">
                  {Object.entries(podSpec.nodeSelector).map(([key, value]) => (
                    <div key={key} className="selector-item">
                      <span className="selector-key">{key}</span>
                      <span className="selector-arrow">→</span>
                      <span className="selector-value">{value}</span>
                      <button
                        className="remove-btn"
                        onClick={() => removeNodeSelector(key)}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>

                <div className="hint">
                  <p>💡 可用节点标签:</p>
                  <ul>
                    <li><code>cloud-provider: aliyun | private</code></li>
                    <li><code>region: cn-hangzhou | on-premise</code></li>
                    <li><code>disk-type: ssd | hdd</code></li>
                  </ul>
                </div>
              </div>
            )}

            {activeTab === 'toleration' && (
              <div className="tab-content">
                <div className="form-group">
                  <label>添加 Toleration</label>
                  <div className="input-row">
                    <input
                      type="text"
                      placeholder="键 (如 dedicated)"
                      value={tolerationKey}
                      onChange={(e) => setTolerationKey(e.target.value)}
                    />
                    <select
                      value={tolerationOperator}
                      onChange={(e) => setTolerationOperator(e.target.value)}
                    >
                      <option value="Equal">Equal</option>
                      <option value="Exists">Exists</option>
                    </select>
                    {tolerationOperator === 'Equal' && (
                      <input
                        type="text"
                        placeholder="值 (如 aliyun)"
                        value={tolerationValue}
                        onChange={(e) => setTolerationValue(e.target.value)}
                      />
                    )}
                    <button className="add-btn" onClick={addToleration}>
                      +
                    </button>
                  </div>
                </div>

                <div className="selector-list">
                  {podSpec.tolerations.map((tol, index) => (
                    <div key={index} className="selector-item">
                      <span className="selector-key">{tol.key}</span>
                      <span className="selector-arrow">{tol.operator}</span>
                      <span className="selector-value">{tol.value || '-'}</span>
                      <button
                        className="remove-btn"
                        onClick={() => removeToleration(index)}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>

                <div className="hint">
                  <p>💡 节点污点:</p>
                  <ul>
                    <li>节点 A: <code>dedicated=aliyun:NoSchedule</code></li>
                    <li>节点 B: <code>dedicated=private:NoSchedule</code></li>
                  </ul>
                </div>
              </div>
            )}

            <div className="action-buttons">
              <button
                className="schedule-btn"
                onClick={handleSchedule}
                disabled={scheduling}
              >
                {scheduling ? '⏳ 调度中...' : '🚀 执行调度'}
              </button>
              <button className="reset-btn" onClick={handleReset}>
                🔄 重置模拟
              </button>
            </div>
          </div>

          {showLog && scheduleResult && (
            <div className="panel-card log-panel">
              <div className="log-header">
                <h2>📊 调度日志</h2>
                <button
                  className={`status-badge ${scheduleResult.success ? 'success' : 'error'}`}
                >
                  {scheduleResult.success ? '✓ 调度成功' : '✗ 调度失败'}
                </button>
              </div>
              <div className="log-content">
                {scheduleResult.evaluationLog.map((log, idx) => (
                  <LogEntry key={idx} log={log} />
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="right-panel">
          <div className="nodes-container">
            {nodes.map((node) => (
              <NodeCard
                key={node.id}
                node={node}
                isSelected={scheduleResult && scheduleResult.selectedNode === node.id}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function LogEntry({ log }) {
  const [expanded, setExpanded] = useState(false);

  const getPhaseColor = (phase) => {
    const colors = {
      '调度开始': '#3498db',
      '预选阶段': '#f39c12',
      '预选完成': '#27ae60',
      '优选阶段': '#9b59b6',
      '优选完成': '#27ae60',
      '绑定完成': '#16a085',
      '调度失败': '#e74c3c'
    };
    return colors[phase] || '#7f8c8d';
  };

  return (
    <div className="log-entry">
      <div
        className="log-phase"
        style={{ borderColor: getPhaseColor(log.phase) }}
        onClick={() => log.checks || log.scoreDetails ? setExpanded(!expanded) : null}
      >
        <span
          className="phase-label"
          style={{ backgroundColor: getPhaseColor(log.phase) }}
        >
          {log.phase}
        </span>
        <span className="log-message">
          {log.message || `${log.node}: ${log.passed ? '通过' : '未通过'}`}
        </span>
        {(log.checks || log.scoreDetails || log.ranking) && (
          <span className="expand-icon">{expanded ? '▲' : '▼'}</span>
        )}
      </div>

      {expanded && log.checks && (
        <div className="log-details">
          <table className="check-table">
            <thead>
              <tr>
                <th>检查项</th>
                <th>需求</th>
                <th>可用</th>
                <th>结果</th>
              </tr>
            </thead>
            <tbody>
              {log.checks.map((check, i) => (
                <tr key={i} className={check.passed ? 'passed' : 'failed'}>
                  <td>{check.check}</td>
                  <td>{check.required}</td>
                  <td>{check.available}</td>
                  <td>{check.passed ? '✓' : '✗'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {expanded && log.scoreDetails && (
        <div className="log-details">
          <div className="score-summary">
            <strong>综合得分: {log.finalScore} 分</strong>
          </div>
          <table className="score-table">
            <thead>
              <tr>
                <th>评分项</th>
                <th>得分</th>
                <th>权重</th>
                <th>说明</th>
              </tr>
            </thead>
            <tbody>
              {log.scoreDetails.map((detail, i) => (
                <tr key={i}>
                  <td>{detail.name}</td>
                  <td>{detail.score}</td>
                  <td>×{detail.weight}</td>
                  <td>{detail.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {expanded && log.ranking && (
        <div className="log-details">
          <div className="ranking">
            {log.ranking.map((rank, i) => (
              <div key={i} className={`rank-item rank-${i + 1}`}>
                {rank}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function NodeCard({ node, isSelected }) {
  const cpuUsage = (node.usedCPU / node.totalCPU) * 100;
  const memoryUsage = (node.usedMemory / node.totalMemory) * 100;

  const getProviderIcon = (provider) => {
    return provider === 'aliyun' ? '☁️' : '🏠';
  };

  const getProviderClass = (provider) => {
    return provider === 'aliyun' ? 'aliyun' : 'private';
  };

  return (
    <div className={`node-card ${getProviderClass(node.provider)} ${isSelected ? 'selected' : ''}`}>
      <div className="node-header">
        <span className="provider-icon">{getProviderIcon(node.provider)}</span>
        <h3>{node.name}</h3>
        {isSelected && (
          <span className="selected-badge">✓ 已选中</span>
        )}
      </div>

      <div className="node-resources">
        <div className="resource-item">
          <div className="resource-label">
            <span>💻 CPU</span>
            <span>{node.usedCPU} / {node.totalCPU} 核</span>
          </div>
          <div className="progress-bar">
            <div
              className="progress-fill cpu"
              style={{ width: `${cpuUsage}%` }}
            />
          </div>
        </div>

        <div className="resource-item">
          <div className="resource-label">
            <span>🧠 内存</span>
            <span>{node.usedMemory} / {node.totalMemory} Gi</span>
          </div>
          <div className="progress-bar">
            <div
              className="progress-fill memory"
              style={{ width: `${memoryUsage}%` }}
            />
          </div>
        </div>
      </div>

      <div className="node-labels">
        <h4>🏷️ 节点标签</h4>
        <div className="labels-grid">
          {Object.entries(node.labels).map(([key, value]) => (
            <span key={key} className="label-tag">
              {key}={value}
            </span>
          ))}
        </div>
      </div>

      <div className="pods-area">
        <h4>📦 运行中的 Pod ({node.pods.length})</h4>
        <div className="pods-container">
          {node.pods.length === 0 ? (
            <div className="empty-pods">暂无 Pod</div>
          ) : (
            node.pods.map((pod) => (
              <PodBlock key={pod.id} pod={pod} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function PodBlock({ pod }) {
  const podColors = [
    '#3498db', '#e74c3c', '#2ecc71', '#f39c12',
    '#9b59b6', '#1abc9c', '#e67e22', '#34495e'
  ];
  const colorIndex = parseInt(pod.id.split('-')[1]) % podColors.length;
  const podColor = podColors[colorIndex];

  return (
    <div
      className="pod-block"
      style={{ borderColor: podColor, backgroundColor: `${podColor}15` }}
    >
      <div className="pod-header">
        <span
          className="pod-status-dot"
          style={{ backgroundColor: pod.status === 'Running' ? '#2ecc71' : '#f39c12' }}
        />
        <span className="pod-name">{pod.name}</span>
      </div>
      <div className="pod-resources">
        <span>💻 {pod.cpu} 核</span>
        <span>🧠 {pod.memory} Gi</span>
      </div>
      <div className="pod-status">{pod.status}</div>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
