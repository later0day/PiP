import { type JSX, useState } from "react";
import { setMode } from "./theme/bootTheme";
import {
  LoadingState,
  ThinkingState,
  StreamingText,
  ToolChips,
  TaskRows,
  ContextCards,
  DiffTable,
  CodeBlock,
  ChatComposer,
  PromptBar,
  ApprovalCard,
  SelectionActions,
  SearchList,
  SidebarNav,
  RecommendationCard,
  InsightCards,
  FineTuneCard,
  RecordsTable,
  FilterTable,
  Flowchart,
} from "./components";
import styles from "./Gallery.module.css";

// Gallery — mounts all 20 landed beautifului components for dual-theme
// verification. Throwaway harness (not the production shell).
const ENTRIES: { name: string; node: JSX.Element }[] = [
  { name: "1. LoadingState", node: <LoadingState /> },
  { name: "2. ThinkingState", node: <ThinkingState /> },
  { name: "3. StreamingText", node: <StreamingText /> },
  { name: "4. ApprovalCard", node: <ApprovalCard /> },
  { name: "5. ToolChips", node: <ToolChips /> },
  { name: "6. TaskRows", node: <TaskRows /> },
  { name: "7. ChatComposer", node: <ChatComposer /> },
  { name: "8. PromptBar", node: <PromptBar /> },
  { name: "9. RecommendationCard", node: <RecommendationCard /> },
  { name: "10. ContextCards", node: <ContextCards /> },
  { name: "11. DiffTable", node: <DiffTable /> },
  { name: "12. RecordsTable", node: <RecordsTable /> },
  { name: "13. FilterTable", node: <FilterTable /> },
  { name: "14. SidebarNav", node: <SidebarNav /> },
  { name: "15. SearchList", node: <SearchList /> },
  { name: "16. Flowchart", node: <Flowchart /> },
  { name: "17. InsightCards", node: <InsightCards /> },
  { name: "18. CodeBlock", node: <CodeBlock /> },
  { name: "19. FineTuneCard", node: <FineTuneCard /> },
  { name: "20. SelectionActions", node: <SelectionActions /> },
];

export function Gallery(): JSX.Element {
  const [dark, setDark] = useState(false);

  const toggle = (): void => {
    const next = !dark;
    setDark(next);
    setMode(next ? "dsh-dark" : "dsh-light");
  };

  return (
    <div className={styles.page}>
      <header className={styles.bar}>
        <h1 className={styles.title}>beautifului × DSH — 20 components</h1>
        <button type="button" className={styles.toggle} onClick={toggle}>
          {dark ? "☀ Light" : "🌙 Dark"}
        </button>
      </header>
      <div className={styles.grid}>
        {ENTRIES.map((e) => (
          <section key={e.name} className={styles.cell}>
            <div className={styles.cellHead}>{e.name}</div>
            <div className={styles.cellBody}>{e.node}</div>
          </section>
        ))}
      </div>
    </div>
  );
}
