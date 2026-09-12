/**
 * Kleine Grammatik-Helfer für Gegenstände in Sätzen. Ein Gegenstand trägt
 * seinen Namen in der Form, in der er im Fahrzeug liegt: "Seilwinde" (eine)
 * oder "Rundschlingen" (mehrere, `plural: true`). Der Artikel wird so
 * gepflegt, wie er zum Namen passt ("die" in beiden Beispielen); das Flag
 * steuert nur das Verb: "Wo ist die Seilwinde?" / "Wo sind die Rundschlingen?".
 */
export interface GrammarSubject {
  name: string;
  article?: string | null;
  plural?: boolean | null;
}

/** "ist" für ein Teil, "sind" für mehrere. */
export function verbIst(subject: Pick<GrammarSubject, "plural">): "ist" | "sind" {
  return subject.plural ? "sind" : "ist";
}

/** "die Seilwinde" – oder nur "Seilwinde", wenn kein Artikel gepflegt ist. */
export function withArticle(subject: GrammarSubject): string {
  return subject.article ? `${subject.article} ${subject.name}` : subject.name;
}

/**
 * Satzanfang der Ortsfrage ohne den Namen ("Wo ist die" / "Wo sind"), damit
 * die UI den Namen separat hervorheben kann.
 */
export function whereIsPrefix(subject: GrammarSubject): string {
  return `Wo ${verbIst(subject)}${subject.article ? ` ${subject.article}` : ""}`;
}

/** "Wo sind die Rundschlingen?" */
export function whereIsQuestion(subject: GrammarSubject): string {
  return `${whereIsPrefix(subject)} ${subject.name}?`;
}

/** "Hier sind die Rundschlingen verstaut" (Auflösung der Ortsfrage). */
export function hereIsStored(subject: GrammarSubject): string {
  return `Hier ${verbIst(subject)} ${withArticle(subject)} verstaut`;
}
