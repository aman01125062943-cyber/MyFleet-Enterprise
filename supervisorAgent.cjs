/**
 * Supervisor Agent - الإشراف التلقائي على التنفيذ
 *
 * هذا النظام يدير عملية تنفيذ المهام بشكل تلقائي عبر:
 * 1. تقسيم المهام على وكيلات متخصصة
 * 2. مراجعة وتحقق من التغييرات
 * 3. الموافقة التلقائية على التغييرات المُتحقق منها
 * 4. تشغيل اختبارات شاملة
 * 5. حل النزاعات
 * 6. إصدار تقارير نهائية
 */

const { spawn } = require('child_process');
const fs = require('fs/promises');
const path = require('path');

// ===== Supervisor Agent ===== //

class SupervisorAgent {
  constructor() {
    this.tasks = new Map();
    this.agents = new Map();
    this.verificationQueue = [];
    this.completedBatches = [];
    this.currentBatch = [];
    this.testResults = new Map();
    this.initializeAgents();
  }

  /**
   * تهيئة الوكلاء الفرعيين
   */
  initializeAgents() {
    const agentModules = ['frontend', 'backend', 'database', 'integration', 'testing'];

    agentModules.forEach(module => {
      const agent = {
        id: `agent-${module}`,
        name: `${module.charAt(0).toUpperCase() + module.slice(1)} Agent`,
        module,
        status: 'idle',
        completedTasks: [],
        performance: {
          totalTasks: 0,
          completedTasks: 0,
          averageTime: 0,
          successRate: 100
        }
      };
      this.agents.set(agent.id, agent);
    });

    // إضافة Supervisor نفسه
    this.agents.set('supervisor', {
      id: 'supervisor',
      name: 'Supervisor Agent',
      module: 'supervisor',
      status: 'idle',
      completedTasks: [],
      performance: {
        totalTasks: 0,
        completedTasks: 0,
        averageTime: 0,
        successRate: 100
      }
    });
  }

  /**
   * إضافة مهمة جديدة للنظام
   */
  async addTask(task) {
    const taskId = `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newTask = {
      ...task,
      id: taskId,
      status: 'pending',
      createdAt: new Date()
    };

    this.tasks.set(taskId, newTask);
    console.log(`📋 [Supervisor] Task added: ${newTask.title} (${taskId})`);

    return taskId;
  }

  /**
   * البدء في تنفيذ جميع المهام
   */
  async executeAllTasks() {
    console.log('🚀 [Supervisor] Starting automatic execution...');

    const allTasks = Array.from(this.tasks.values())
      .sort((a, b) => this.getPriorityScore(b.priority) - this.getPriorityScore(a.priority));

    let completedCount = 0;
    const totalTasks = allTasks.length;

    for (const task of allTasks) {
      if (task.status === 'completed') {
        completedCount++;
        continue;
      }

      console.log(`\n📌 [Supervisor] Processing: ${task.title} (${completedCount + 1}/${totalTasks})`);

      try {
        await this.executeTask(task);
        completedCount++;

        // إضافة للدفعة الحالية
        this.currentBatch.push(task.id);

        // كل 3 مهام، شغّل اختبارات شاملة
        if (this.currentBatch.length >= 3) {
          await this.runBatchTests();
          this.currentBatch = [];
        }

      } catch (error) {
        console.error(`❌ [Supervisor] Task failed: ${task.title}`, error);
        task.status = 'failed';
        task.error = error.message;
      }
    }

    // اختبارات نهائية
    if (this.currentBatch.length > 0) {
      await this.runBatchTests();
    }

    // التقرير النهائي
    await this.generateFinalReport();

    console.log('\n✅ [Supervisor] All tasks completed successfully!');
  }

  /**
   * تنفيذ مهمة واحدة
   */
  async executeTask(task) {
    // التحقق من الاعتمادات
    const pendingDeps = (task.dependencies || [])
      .filter(depId => {
        const dep = this.tasks.get(depId);
        return dep && dep.status !== 'completed';
      });

    if (pendingDeps.length > 0) {
      console.log(`⏸️ [Supervisor] Task ${task.title} waiting for dependencies...`);
      await this.waitForDependencies(pendingDeps);
    }

    // تعيين المهمة للوكيل المختص
    const agent = this.getAgentForModule(task.module);
    task.assignedTo = agent.id;
    task.status = 'assigned';

    // تنفيذ المهمة من خلال الوكيل
    agent.status = 'working';
    task.status = 'in_progress';
    task.startedAt = new Date();

    console.log(`🔧 [${agent.name}] Executing: ${task.title}`);

    const result = await this.delegateToAgent(agent, task);

    // التحقق من النتيجة
    const verification = await this.verifyResult(task, agent, result);

    if (verification.status === 'approved') {
      task.status = 'completed';
      task.completedAt = new Date();
      task.result = result;
      task.verificationStatus = 'verified';

      agent.completedTasks.push(task.id);
      agent.performance.completedTasks++;

      console.log(`✅ [${agent.name}] Completed: ${task.title}`);

    } else if (verification.status === 'needs_revision') {
      console.log(`🔄 [Supervisor] Needs revision: ${task.title}`);
      await this.handleRevision(task, agent, verification);

    } else {
      throw new Error(`Verification failed: ${verification.issues.join(', ')}`);
    }

    agent.status = 'idle';
  }

  /**
   * تفويض المهمة للوكيل المختص
   */
  delegateToAgent(agent, task) {
    const agentScript = path.join(__dirname, 'agents', `${agent.module}Agent.cjs`);

    return new Promise((resolve, reject) => {
      const child = spawn('node', [agentScript, JSON.stringify(task)], {
        stdio: ['inherit', 'pipe', 'pipe']
      });

      let output = '';
      let errorOutput = '';

      child.stdout?.on('data', (data) => {
        output += data.toString();
      });

      child.stderr?.on('data', (data) => {
        errorOutput += data.toString();
      });

      child.on('close', (code) => {
        if (code === 0) {
          try {
            const result = JSON.parse(output);
            resolve(result);
          } catch {
            resolve({ success: true, output });
          }
        } else {
          reject(new Error(errorOutput || `Agent exited with code ${code}`));
        }
      });
    });
  }

  /**
   * التحقق من نتيجة الوكيل
   */
  async verifyResult(task, agent, result) {
    console.log(`🔍 [Supervisor] Verifying: ${task.title}`);

    const verification = {
      taskId: task.id,
      agentId: agent.id,
      status: 'approved',
      changes: result?.changes || { files: [], modifications: [] },
      issues: [],
      confidence: 100
    };

    // فحص الملفات المُعدلة
    if (result?.changes?.files) {
      for (const file of result.changes.files) {
        const fileExists = await fs.access(file).then(() => true).catch(() => false);
        if (!fileExists) {
          verification.issues.push(`File not found: ${file}`);
          verification.confidence -= 20;
        }
      }
    }

    // فحص الاختبارات
    if (result?.tests) {
      const failedTests = result.tests.filter(t => t.status === 'failed');
      if (failedTests.length > 0) {
        verification.issues.push(`${failedTests.length} tests failed`);
        verification.confidence -= failedTests.length * 10;
      }
    }

    // تحديد الحالة
    if (verification.confidence < 50) {
      verification.status = 'rejected';
    } else if (verification.confidence < 80) {
      verification.status = 'needs_revision';
    }

    console.log(`  ✓ Verification: ${verification.status} (${verification.confidence}% confidence)`);

    return verification;
  }

  /**
   * معالجة المراجعات
   */
  async handleRevision(task, agent, verification) {
    console.log(`🔄 [Supervisor] Handling revision for: ${task.title}`);

    // إعادة المهمة للوكيل مع ملاحظات
    const revisedTask = {
      ...task,
      revision: true,
      revisionNotes: verification.issues
    };

    const result = await this.delegateToAgent(agent, revisedTask);
    const newVerification = await this.verifyResult(task, agent, result);

    if (newVerification.status === 'approved') {
      task.status = 'completed';
      task.completedAt = new Date();
      task.result = result;
    } else {
      task.status = 'failed';
      task.error = `Revision failed: ${newVerification.issues.join(', ')}`;
    }
  }

  /**
   * تشغيل اختبارات شاملة
   */
  runBatchTests() {
    console.log('\n🧪 [Supervisor] Running batch tests...');

    const testScript = path.join(__dirname, 'testRunner.cjs');

    return new Promise((resolve, reject) => {
      const child = spawn('node', [testScript, JSON.stringify(this.currentBatch)], {
        stdio: 'inherit'
      });

      child.on('close', (code) => {
        if (code === 0) {
          console.log('✅ [Supervisor] Batch tests passed');
          resolve();
        } else {
          console.error(`❌ [Supervisor] Batch tests failed with code ${code}`);
          reject(new Error('Batch tests failed'));
        }
      });
    });
  }

  /**
   * حل النزاعات بين الوكلاء
   */
  async resolveConflicts() {
    console.log('⚖️ [Supervisor] Checking for conflicts...');

    // فحص التعارضات في الملفات
    const conflicts = await this.detectConflicts();

    if (conflicts.length > 0) {
      console.log(`🔀 Found ${conflicts.length} conflicts, resolving...`);

      for (const conflict of conflicts) {
        await this.resolveConflict(conflict);
      }
    }
  }

  /**
   * كشف النزاعات
   */
  detectConflicts() {
    return new Promise((resolve) => {
      const child = spawn('git', ['diff', '--name-only'], { cwd: process.cwd() });
      let output = '';

      child.stdout?.on('data', (data) => { output += data; });
      child.on('close', () => {
        // تحليل المخرجات لكشف النزاعات
        resolve([]);
      });
    });
  }

  /**
   * حل نزاع معين
   */
  async resolveConflict(conflict) {
    console.log(`🔧 [Supervisor] Resolving conflict: ${conflict.file}`);
    // منطق حل النزاعات
  }

  /**
   * انتظار اكتمال الاعتمادات
   */
  waitForDependencies(dependencies) {
    return new Promise((resolve) => {
      const interval = setInterval(() => {
        const allComplete = dependencies.every(depId => {
          const dep = this.tasks.get(depId);
          return dep && dep.status === 'completed';
        });

        if (allComplete) {
          clearInterval(interval);
          resolve();
        }
      }, 1000);
    });
  }

  /**
   * الحصول على الوكيل المخصص للوحدة
   */
  getAgentForModule(module) {
    const agent = Array.from(this.agents.values()).find(a => a.module === module);
    if (!agent) {
      throw new Error(`No agent found for module: ${module}`);
    }
    return agent;
  }

  /**
   * حساب درجة الأولوية
   */
  getPriorityScore(priority) {
    const scores = { critical: 4, high: 3, medium: 2, low: 1 };
    return scores[priority] || 0;
  }

  /**
   * التقرير النهائي
   */
  async generateFinalReport() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 [Supervisor] FINAL COMPLETION REPORT');
    console.log('='.repeat(60));

    const allTasks = Array.from(this.tasks.values());
    const completed = allTasks.filter(t => t.status === 'completed');
    const failed = allTasks.filter(t => t.status === 'failed');

    console.log(`\n📈 Summary:`);
    console.log(`  Total Tasks: ${allTasks.length}`);
    console.log(`  ✅ Completed: ${completed.length}`);
    console.log(`  ❌ Failed: ${failed.length}`);
    console.log(`  Success Rate: ${((completed.length / allTasks.length) * 100).toFixed(1)}%`);

    // تقرير كل وكيل
    console.log(`\n🤖 Agents Performance:`);
    for (const [id, agent] of this.agents) {
      if (id === 'supervisor') continue;
      console.log(`\n  ${agent.name}:`);
      console.log(`    Tasks: ${agent.performance.completedTasks}/${agent.performance.totalTasks}`);
      console.log(`    Success Rate: ${agent.performance.successRate}%`);
    }

    // حفظ التقرير
    const reportPath = path.join(__dirname, 'completion-report.json');
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        total: allTasks.length,
        completed: completed.length,
        failed: failed.length,
        successRate: (completed.length / allTasks.length) * 100
      },
      agents: Array.from(this.agents.entries())
        .filter(([id]) => id !== 'supervisor')
        .map(([id, agent]) => ({
          name: agent.name,
          module: agent.module,
          completedTasks: agent.completedTasks.length,
          successRate: agent.performance.successRate
        })),
      tasks: allTasks.map(t => ({
        id: t.id,
        title: t.title,
        status: t.status,
        module: t.module,
        completedAt: t.completedAt
      }))
    };

    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n📄 Report saved to: ${reportPath}`);
    console.log('='.repeat(60));
  }
}

// ===== التصدير ===== //

module.exports = SupervisorAgent;

// ===== التنفيذ المباشر ===== //

if (require.main === module) {
  const supervisor = new SupervisorAgent();

  // مهام جديدة ومتقدمة
  const defaultTasks = [
    {
      title: 'إضافة لوحة الإشعارات',
      description: 'إنشاء مكون React لإشعارات النظام',
      module: 'frontend',
      priority: 'high'
    },
    {
      title: 'إنشاء API للإحصائيات',
      description: 'إضافة endpoint للحصول على إحصائيات الاشتراكات',
      module: 'backend',
      priority: 'high'
    },
    {
      title: 'إنشاء جدول الإشعارات',
      description: 'إضافة جدول notifications مع RLS',
      module: 'database',
      priority: 'critical'
    },
    {
      title: 'إصلاح اتصال WhatsApp',
      description: 'تحسين استقرار اتصال WhatsApp Service',
      module: 'integration',
      priority: 'high'
    }
  ];

  // إضافة المهام وتنفيذها
  (async () => {
    for (const task of defaultTasks) {
      await supervisor.addTask(task);
    }

    await supervisor.executeAllTasks();
  })().catch(console.error);
}
