export type Preparation = { enabled: boolean; activeEnvironment: string | null };
export type SavedEnvironment = { id: string; name: string; organization: string; materials: any[] };
const text = (value: unknown): string => typeof value === 'string' ? value.trim() : value && typeof value === 'object' ? text((value as any).name) : '';

/** Use the material's own taxonomy. Publishers stay distinct within each exam. */
export function environmentFor(material: any): Omit<SavedEnvironment, 'materials'> {
  const meta = material.libraryMeta || {};
  const organization = text(material.organization) || text(meta.organization) || text(material.university);
  const exam = text(material.exam) || text(meta.exam) || text(material.examType);
  const name = exam || text(material.title) || text(material.name) || 'Your material';
  // Personal uploads without an exam retain their individual identity and document structure.
  const identity = exam ? [text(material.organization?.id) || organization, exam].join(':') : `material:${material.id}`;
  return { id: identity.toLowerCase(), name, organization };
}
export function savedEnvironments(materials: any[]): SavedEnvironment[] {
  const groups = new Map<string, SavedEnvironment>();
  for (const material of materials) {
    if (!material.questions?.length) continue;
    const environment = environmentFor(material);
    if (!groups.has(environment.id)) groups.set(environment.id, { ...environment, materials: [] });
    groups.get(environment.id)!.materials.push(material);
  }
  return [...groups.values()];
}
export function publisherName(material: any): string {
  return text(material.publisher) || text(material.libraryMeta?.publisher) || text(material.manufacturer) || (material.sourceSessionId ? 'Your upload' : 'Saved material');
}
export function normalizePreparation(raw: unknown): Preparation {
  const value = raw as { enabled?: boolean; activeEnvironment?: unknown } | null;
  return { enabled: value?.enabled === true, activeEnvironment: typeof value?.activeEnvironment === 'string' ? value.activeEnvironment : null };
}
