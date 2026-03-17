// ── Alpine.js dashboard component ───────────────────────

function dashboard() {
  return {

    // ── Server data ───────────────────────────────────────

    phases: [],
    tasks: [],
    decisionLog: [],
    contributors: [],

    // ── UI-only state ─────────────────────────────────────

    openPhases: [],

    creatingPhase: false,
    editingPhase: null,
    editPhaseData: {},
    newPhase: { name: '' },

    addingTaskPhase: null,
    editingTask: null,
    editTaskData: {},
    confirmingDelete: null,
    newTask: { text: '', deadlineDate: '', notes: '', needsDecision: false, contributors: [] },

    newLogEntry: '',
    newContributor: '',
    managingContributors: false,

    // ── Shared constants ────────────────────────────────────

    decisionStatuses: [
      { v: 'open',      l: 'Ouvert',  i: '\u25C7' },
      { v: 'discussed', l: 'Discuté', i: '\u25C8' },
      { v: 'decided',   l: 'Décidé',  i: '\u25C6' },
    ],

    // ── Cancel all editing ────────────────────────────────

    cancelAllEditing() {
      this.editingPhase = null;
      this.editingTask = null;
      this.addingTaskPhase = null;
      this.creatingPhase = false;
      this.confirmingDelete = null;
      this.managingContributors = false;
    },

    // ── Computed ──────────────────────────────────────────

    renderMarkdown(text) {
      if (!text) return '';
      return DOMPurify.sanitize(marked.parse(text, { breaks: true }));
    },

    formatDate(dateStr) {
      if (!dateStr) return '';
      return new Date(dateStr + 'T00:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
    },

    get releaseDate() {
      const task = this.tasks.find(t => t.isReleaseDate);
      return task ? task.deadlineDate : '';
    },

    get formattedReleaseDate() {
      if (!this.releaseDate) return '';
      return this.formatDate(this.releaseDate);
    },

    get daysLeft() {
      if (!this.releaseDate) return 0;
      return daysUntil(this.releaseDate);
    },

    get globalProgress() {
      if (!this.tasks.length) return 0;
      const done = this.tasks.filter(t => t.done).length;
      return Math.round(done / this.tasks.length * 100);
    },

    // ── Data loading ─────────────────────────────────────

    loadData() {
      const data = window.__INITIAL_DATA__ || { phases: [], tasks: [], decisionLog: [], contributors: [] };
      this.phases = data.phases;
      this.tasks = data.tasks;
      this.decisionLog = data.decisionLog;
      this.contributors = data.contributors || [];
      this.sortPhases();
      this.rebuildNextTaskCache();
    },

    // ── API helpers ──────────────────────────────────────

    async api(method, path, body) {
      const opts = { method, headers: { 'Content-Type': 'application/json' } };
      if (body) opts.body = JSON.stringify(body);
      const res = await fetch(window.__API_BASE__ + '/' + path, opts);
      return res.json();
    },

    // ── Phases ───────────────────────────────────────────

    async createPhase() {
      const phase = await this.api('POST', 'phases', this.newPhase);
      this.phases.push(phase);
      this.creatingPhase = false;
      this.newPhase = { name: '' };
    },

    async savePhase(id) {
      const { name } = this.editPhaseData;
      const updated = await this.api('PUT', `phases/${id}`, { name });
      const idx = this.phases.findIndex(p => p.id === id);
      if (idx >= 0) this.phases[idx] = updated;
      this.editingPhase = null;
    },

    async deletePhase(id) {
      if (this.confirmingDelete !== 'phase-' + id) {
        this.confirmingDelete = 'phase-' + id;
        return;
      }
      await this.api('DELETE', `phases/${id}`);
      this.phases = this.phases.filter(p => p.id !== id);
      this.tasks = this.tasks.filter(t => t.phase !== id);
      this.confirmingDelete = null;
      this.rebuildNextTaskCache();
    },

    // ── Tasks ────────────────────────────────────────────

    phaseTasks(phaseId) {
      return this.tasks
        .filter(t => t.phase === phaseId)
        .sort((a, b) => {
          if (!a.deadlineDate) return 1;
          if (!b.deadlineDate) return -1;
          return a.deadlineDate.localeCompare(b.deadlineDate);
        });
    },

    _nextTaskCache: {},

    rebuildNextTaskCache() {
      const map = {};
      for (const phase of this.phases) {
        map[phase.id] = this.tasks
          .filter(t => t.phase === phase.id && !t.done && t.deadlineDate)
          .sort((a, b) => new Date(a.deadlineDate) - new Date(b.deadlineDate))[0] || null;
      }
      this._nextTaskCache = map;
    },

    sortPhases() {
      const earliest = {};
      for (const t of this.tasks) {
        if (t.deadlineDate && (!earliest[t.phase] || t.deadlineDate < earliest[t.phase])) {
          earliest[t.phase] = t.deadlineDate;
        }
      }
      this.phases.sort((a, b) => {
        const da = earliest[a.id] || '\uffff';
        const db = earliest[b.id] || '\uffff';
        return da.localeCompare(db);
      });
    },

    nextTask(phaseId) {
      return this._nextTaskCache[phaseId] ?? null;
    },

    async toggleTask(task) {
      task.done = !task.done;
      await this.api('PUT', `tasks/${task.id}`, { done: task.done });
      this.rebuildNextTaskCache();
    },

    async createTask(phaseId) {
      const payload = { ...this.newTask, phase: phaseId };
      if (payload.needsDecision) {
        payload.decisions = [{ status: 'open', notes: '' }];
      }
      delete payload.needsDecision;
      const task = await this.api('POST', 'tasks', payload);
      this.tasks.push(task);
      this.addingTaskPhase = null;
      this.newTask = { text: '', deadlineDate: '', notes: '', needsDecision: false, contributors: [] };
      this.sortPhases();
      this.rebuildNextTaskCache();
    },

    async saveTask(id) {
      const { text, deadlineDate, notes, decisions } = this.editTaskData;
      const payload = { text, deadlineDate, notes, decisions: decisions || [] };
      const updated = await this.api('PUT', `tasks/${id}`, payload);
      const idx = this.tasks.findIndex(t => t.id === id);
      if (idx >= 0) this.tasks[idx] = updated;
      this.editingTask = null;
      this.sortPhases();
      this.rebuildNextTaskCache();
    },

    async deleteTask(id) {
      await this.api('DELETE', `tasks/${id}`);
      this.tasks = this.tasks.filter(t => t.id !== id);
      this.editingTask = null;
      this.confirmingDelete = null;
      this.sortPhases();
      this.rebuildNextTaskCache();
    },

    async updateTaskDecision(task, index, newStatus) {
      if (task.decisions[index].status === newStatus) return;
      task.decisions[index].status = newStatus;
      await this.api('PUT', `tasks/${task.id}`, { decisions: task.decisions });
    },

    // ── Decision helpers ─────────────────────────────────

    decisionIcon(status) {
      return (this.decisionStatuses.find(s => s.v === status) || this.decisionStatuses[0]).i;
    },

    decisionLabel(status) {
      return (this.decisionStatuses.find(s => s.v === status) || this.decisionStatuses[0]).l;
    },

    phaseOpenDecisions(phaseId) {
      return this.tasks
        .filter(t => t.phase === phaseId && !t.done)
        .reduce((sum, t) => sum + (t.decisions || []).filter(d => d.status !== 'decided').length, 0);
    },

    // ── Decision log ─────────────────────────────────────

    async addLogEntry() {
      if (!this.newLogEntry.trim()) return;
      const entry = await this.api('POST', 'decision-log', { text: this.newLogEntry.trim() });
      this.decisionLog.push(entry);
      this.newLogEntry = '';
    },

    // ── Contributors ────────────────────────────────────

    phaseContributors(phaseId) {
      const names = new Set();
      for (const t of this.tasks) {
        if (t.phase === phaseId) {
          for (const c of (t.contributors || [])) names.add(c);
        }
      }
      return [...names].sort();
    },

    async toggleContributor(task, name) {
      if (!task.contributors) task.contributors = [];
      const idx = task.contributors.indexOf(name);
      if (idx >= 0) task.contributors.splice(idx, 1);
      else task.contributors.push(name);
      await this.api('PUT', `tasks/${task.id}`, { contributors: task.contributors });
    },

    toggleNewTaskContributor(name) {
      if (!this.newTask.contributors) this.newTask.contributors = [];
      const idx = this.newTask.contributors.indexOf(name);
      if (idx >= 0) this.newTask.contributors.splice(idx, 1);
      else this.newTask.contributors.push(name);
    },

    async addContributor() {
      const name = this.newContributor.trim();
      if (!name) return;
      await this.api('POST', 'contributors', { name });
      this.contributors.push(name);
      this.newContributor = '';
    },

    async removeContributor(name) {
      await this.api('DELETE', `contributors/${encodeURIComponent(name)}`);
      this.contributors = this.contributors.filter(c => c !== name);
      for (const t of this.tasks) {
        if (t.contributors) t.contributors = t.contributors.filter(c => c !== name);
      }
    },

    // ── Phase display helpers ────────────────────────────

    phasePeriod(phaseId) {
      const dates = this.tasks
        .filter(t => t.phase === phaseId && t.deadlineDate)
        .map(t => t.deadlineDate)
        .sort();
      if (!dates.length) return '';
      const fmt = (iso) => {
        const d = new Date(iso + 'T00:00:00');
        return { month: d.toLocaleDateString('fr-FR', { month: 'long' }), year: d.getFullYear() };
      };
      const first = fmt(dates[0]);
      const last = fmt(dates[dates.length - 1]);
      if (first.month === last.month && first.year === last.year) return first.month;
      const suffix = last.year !== first.year ? ' ' + last.year : '';
      return first.month + ' → ' + last.month + suffix;
    },

    togglePhase(phaseId) {
      const idx = this.openPhases.indexOf(phaseId);
      if (idx >= 0) this.openPhases.splice(idx, 1);
      else this.openPhases.push(phaseId);
    },

    phaseDaysLeft(phaseId) {
      const next = this.nextTask(phaseId);
      if (!next) return Infinity;
      return daysUntil(next.deadlineDate);
    },

    phaseCountdown(phaseId) {
      if (!this.nextTask(phaseId)) return '';
      const days = this.phaseDaysLeft(phaseId);
      if (days < 0) return 'J+' + Math.abs(days);
      if (days === 0) return 'Auj.';
      return 'J-' + days;
    },

    urgencyColor(phaseId) {
      return urgencyTier(this.phaseDaysLeft(phaseId)).text;
    },

    urgencyBadge(phaseId) {
      return urgencyTier(this.phaseDaysLeft(phaseId)).badge;
    },

    phaseUrgencyGlow(phaseId) {
      if (!this.nextTask(phaseId)) return this.phaseTasks(phaseId).length ? 'urgency-glow-done' : '';
      return urgencyTier(this.phaseDaysLeft(phaseId)).glow;
    },

    taskUrgencyColor(task) {
      if (!task.deadlineDate) return 'text-cod-muted';
      const tier = urgencyTier(daysUntil(task.deadlineDate));
      return tier.text === 'text-cod-green' ? 'text-cod-muted' : tier.text;
    },

    phaseProgress(phaseId) {
      const tasks = this.phaseTasks(phaseId);
      const done = tasks.filter(t => t.done).length;
      return tasks.length ? Math.round(done / tasks.length * 100) : 0;
    },

    phaseStats(phaseId) {
      const tasks = this.phaseTasks(phaseId);
      const done = tasks.filter(t => t.done).length;
      return done + '/' + tasks.length;
    },
  };
}
