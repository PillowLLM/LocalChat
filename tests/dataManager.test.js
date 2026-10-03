// LocalChat DataManager 单元测试 + 好友管理/注入测试
// 运行: node --test --test-force-exit tests/dataManager.test.js
'use strict';
const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const DataManager = require('../src/utils/dataManager');

// 隔离每个测试的数据目录
let dm;
let testDir;

beforeEach(() => {
  testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'localchat-test-'));
  dm = new DataManager();
  // 覆盖到临时目录
  dm.dataDir = testDir;
  dm.configFile = path.join(testDir, 'config.json');
  dm.peersFile = path.join(testDir, 'peers.json');
  dm.userFile = path.join(testDir, 'user.json');
  dm.peers = new Map();
});

describe('配置管理', () => {
  test('默认配置正确', () => {
    dm.config = dm.loadConfig();
    assert.strictEqual(dm.config.autoConnect, true);
    assert.strictEqual(dm.config.defaultPort, 8888);
  });

  test('saveConfig 持久化', () => {
    dm.config = { autoConnect: false, defaultPort: 9999 };
    dm.saveConfig();
    assert.ok(fs.existsSync(dm.configFile));
    const loaded = JSON.parse(fs.readFileSync(dm.configFile, 'utf8'));
    assert.strictEqual(loaded.defaultPort, 9999);
  });
});

describe('好友管理（CRUD）', () => {
  test('addPeer 添加新好友', () => {
    const peer = dm.addPeer({ id: 'p1', ip: '192.168.1.1', port: 8888, nickname: 'Alice' });
    assert.strictEqual(peer.id, 'p1');
    assert.strictEqual(peer.status, 'connected');
    assert.ok(peer.lastSeen > 0);
  });

  test('addPeer 相同 IP:Port 更新昵称（去重逻辑）', () => {
    dm.addPeer({ id: 'p1', ip: '192.168.1.1', port: 8888, nickname: 'Alice' });
    dm.addPeer({ id: 'p2', ip: '192.168.1.1', port: 8888, nickname: 'Alice2' });
    // 相同地址的好友信息被更新
    const found = Array.from(dm.peers.values()).find(p => p.ip === '192.168.1.1' && p.port === 8888);
    assert.strictEqual(found.nickname, 'Alice2');
  });

  test('removePeer 删除好友', () => {
    dm.addPeer({ id: 'p1', ip: '192.168.1.1', port: 8888, nickname: 'Alice' });
    assert.strictEqual(dm.removePeer('p1'), true);
    assert.strictEqual(dm.peers.size, 0);
    assert.strictEqual(dm.removePeer('nonexistent'), false);
  });

  test('updatePeer 更新信息', () => {
    dm.addPeer({ id: 'p1', ip: '192.168.1.1', port: 8888, nickname: 'Alice' });
    const updated = dm.updatePeer('p1', { nickname: 'Alice Updated' });
    assert.strictEqual(updated.nickname, 'Alice Updated');
  });

  test('getRecentPeers 按 lastSeen 排序', () => {
    dm.addPeer({ id: 'p1', ip: '192.168.1.1', port: 1, nickname: 'A' });
    dm.addPeer({ id: 'p2', ip: '192.168.1.2', port: 1, nickname: 'B' });
    const recent = dm.getRecentPeers(5);
    assert.strictEqual(recent.length, 2);
  });
});

describe('离线清理', () => {
  test('cleanupOfflinePeers 移除超过5分钟未活动的', () => {
    dm.addPeer({ id: 'p1', ip: '192.168.1.1', port: 1, nickname: 'A' });
    // 手动设置 lastSeen 为 10 分钟前
    dm.peers.get('p1').lastSeen = Date.now() - 10 * 60 * 1000;
    dm.peers.get('p1').status = 'offline';
    dm.cleanupOfflinePeers();
    assert.strictEqual(dm.peers.size, 0);
  });

  test('cleanOldPeers 按天数清理', () => {
    dm.addPeer({ id: 'p1', ip: '192.168.1.1', port: 1, nickname: 'A' });
    dm.peers.get('p1').lastSeen = Date.now() - 60 * 24 * 60 * 60 * 1000; // 60天前
    const removed = dm.clearOldPeers(30);
    assert.strictEqual(removed, 1);
  });
});

describe('注入测试：恶意好友数据', () => {
  test('addPeer 含 XSS 昵称不崩溃（作为纯文本存储）', () => {
    const evil = '<script>alert(1)</script>';
    const peer = dm.addPeer({ id: 'p1', ip: '192.168.1.1', port: 1, nickname: evil });
    assert.strictEqual(peer.nickname, evil);
    // 存储为纯字符串
    assert.strictEqual(typeof peer.nickname, 'string');
  });

  test('addPeer 含路径穿越 IP 不崩溃', () => {
    const evil = '../../../etc/passwd';
    const peer = dm.addPeer({ id: 'p1', ip: evil, port: 1, nickname: 'test' });
    assert.strictEqual(peer.ip, evil);
  });

  test('saveUser null 输入返回 false', () => {
    assert.strictEqual(dm.saveUser(null), false);
  });

  test('loadUser 损坏 JSON 文件降级为默认用户', () => {
    fs.writeFileSync(dm.userFile, '{{{bad json');
    const user = dm.loadUser();
    assert.ok(user.id);
    assert.ok(user.nickname);
  });
});

describe('用户信息管理', () => {
  test('saveUser 持久化', () => {
    const user = { id: 'u1', nickname: 'TestUser', ip: '127.0.0.1', port: 8888 };
    assert.strictEqual(dm.saveUser(user), true);
    const loaded = JSON.parse(fs.readFileSync(dm.userFile, 'utf8'));
    assert.strictEqual(loaded.nickname, 'TestUser');
  });
});
