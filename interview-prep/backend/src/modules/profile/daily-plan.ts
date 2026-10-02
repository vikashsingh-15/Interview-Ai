/**
 * Single source of truth for turning the four per-section preferences into the
 * concrete section list a session is generated from.
 *
 * Before this existed, onboarding, the preferences PUT and regenerate each
 * tried to keep the plan in sync independently. All three only redistributed
 * counts among sections that already existed, so raising a slider for a section
 * that was never planned (coding, system design, project) silently did nothing.
 */

export interface PlanSection {
  title: string;
  topic: string;
  type: 'technical' | 'system_design' | 'coding' | 'project' | 'behavioral' | 'custom';
  count: number;
}

export interface DailyPlanInput {
  preferences?: Partial<{
    dailyQuestions: number;
    codingCount: number;
    systemDesignCount: number;
    projectQuestions: number;
    codingLanguages: string[];
    focusTopics: string[];
    excludedTopics: string[];
    systemDesignFocus: string[];
  }>;
  /** Confirmed skills, most relevant first. */
  confirmedSkills?: string[];
  /** Confirmed project names. */
  confirmedProjects?: string[];
  currentRole?: string;
  /** Upper bound per section, so one huge number cannot starve the others. */
  maxPerSection?: number;
  /** Upper bound on technical sections, so 20 skills do not create 20 sections. */
  maxTechnicalSections?: number;
}

const SYSTEM_DESIGN_TOPIC: Record<string, string> = {
  hld: 'High-level system design',
  lld: 'Low-level design',
  distributed: 'Distributed systems',
  backend: 'Backend architecture',
  fullstack: 'Full-stack architecture',
  mobile: 'Mobile architecture',
  data: 'Data architecture',
  ml: 'ML system design',
};

/** Split `total` into per-topic counts, cycling through topics in order. */
export function spreadCount(total: number, topics: string[], sections: number): number[] {
  const counts = new Array(Math.max(1, Math.min(sections, topics.length))).fill(0).slice(0, Math.max(0, Math.min(sections, topics.length)));
  if (!counts.length) return [];
  for (let i = 0; i < total; i++) counts[i % counts.length]++;
  return counts;
}

/**
 * Build the full daily plan. Technical questions spread across confirmed skills,
 * system design across the user's design focus, and project questions across
 * confirmed projects. A count of zero produces no section at all.
 */
export function buildDailyPlan(input: DailyPlanInput): PlanSection[] {
  const prefs = input.preferences || {};
  const maxPerSection = Math.max(1, input.maxPerSection ?? 50);
  const maxTechnical = Math.max(1, input.maxTechnicalSections ?? 4);
  const excluded = (prefs.excludedTopics || []).map(t => t.toLowerCase());
  const isExcluded = (topic: string) => excluded.some(t => topic.toLowerCase().includes(t));
  const clamp = (n: number | undefined) => Math.max(0, Math.min(Number.isFinite(n) ? Math.floor(n as number) : 0, maxPerSection));

  // Topic candidates: user focus first, then confirmed skills, then the role.
  // A generic role ("Professional", "Engineer") is not a real practice topic, so
  // it is only a last-resort fallback rather than a section of its own: using it
  // alongside confirmed skills would split the day's questions across a topic
  // the user has no material for.
  const GENERIC = new Set(['professional','engineer','developer','full stack developer',
    'fullstack developer','software engineer','professional experience']);
  const isGenericTopic = (t: string) => GENERIC.has(t.trim().toLowerCase());
  const candidates = [
    ...(prefs.focusTopics || []),
    ...(input.confirmedSkills || []),
  ].filter(Boolean).filter(t => !isExcluded(t));
  const uniqueCandidates = [...new Set(candidates.map(t => t.trim()).filter(Boolean))]
    .filter(t => !isGenericTopic(t));
  // Only fall back to the role when there is genuinely nothing else to practise.
  if (!uniqueCandidates.length && input.currentRole && !isExcluded(input.currentRole))
    uniqueCandidates.push(isGenericTopic(input.currentRole) ? 'Professional experience' : input.currentRole.trim());

  const plan: PlanSection[] = [];

  // Technical: spread across the top skills rather than stacking one topic.
  const technicalTotal = clamp(prefs.dailyQuestions);
  if (technicalTotal > 0) {
    const topics = uniqueCandidates.length ? uniqueCandidates : ['Professional experience'];
    const sectionCount = Math.min(topics.length, maxTechnical, technicalTotal);
    const counts = spreadCount(technicalTotal, topics, sectionCount);
    topics.slice(0, sectionCount).forEach((topic, i) => {
      if (!counts[i]) return;
      plan.push({ title: `${topic} practice`, topic, type: 'technical', count: counts[i] });
    });
  }

  // Coding: one section, on the preferred language when the user set one.
  const codingTotal = clamp(prefs.codingCount);
  if (codingTotal > 0) {
    const language = (prefs.codingLanguages || []).find(l => l && !isExcluded(l));
    const topic = language || uniqueCandidates[0] || 'Algorithms';
    plan.push({ title: `${topic} coding`, topic, type: 'coding', count: codingTotal });
  }

  // System design: spread across the user's design focus areas.
  const designTotal = clamp(prefs.systemDesignCount);
  if (designTotal > 0) {
    const focusTopics = (prefs.systemDesignFocus || [])
      .map(f => SYSTEM_DESIGN_TOPIC[f.toLowerCase()] || f)
      .filter(t => t && !isExcluded(t));
    const topics = focusTopics.length ? focusTopics : ['System design'];
    const sectionCount = Math.min(topics.length, Math.max(1, Math.min(maxTechnical, designTotal)));
    const counts = spreadCount(designTotal, topics, sectionCount);
    topics.slice(0, sectionCount).forEach((topic, i) => {
      if (!counts[i]) return;
      plan.push({ title: `${topic} design`, topic, type: 'system_design', count: counts[i] });
    });
  }

  // Project questions: one section per confirmed project.
  const projectTotal = clamp(prefs.projectQuestions);
  const projects = (input.confirmedProjects || []).filter(p => p && !isExcluded(p));
  if (projectTotal > 0) {
    if (projects.length) {
      const sectionCount = Math.min(projects.length, projectTotal);
      const counts = spreadCount(projectTotal, projects, sectionCount);
      projects.slice(0, sectionCount).forEach((project, i) => {
        if (!counts[i]) return;
        plan.push({ title: `${project} deep dive`, topic: project, type: 'project', count: counts[i] });
      });
    } else {
      // No confirmed project to ground on. Still honour the user's setting by
      // planning portfolio-style prompts on their strongest confirmed skill,
      // which the generator frames as hypothetical rather than as resume claims.
      const topic = uniqueCandidates[0] || 'Professional experience';
      plan.push({ title: `${topic} project design`, topic, type: 'project', count: projectTotal });
    }
  }

  return plan;
}

/** Total questions a plan asks for. */
export function planTotal(plan: PlanSection[]): number {
  return plan.reduce((sum, s) => sum + s.count, 0);
}