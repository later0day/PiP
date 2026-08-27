import { type JSX, useCallback, useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import {
  ASK_USER_OTHER_TEXT_MAX_LENGTH,
  type AskUserQuestion,
  type AskUserSubmission,
  type PendingAskUser,
} from "@shared/apiTypes";
import {
  answeredCount,
  loadAskDraft,
  saveAskDraft,
  toSubmission,
  unansweredQuestions,
  type AskDraftAnswer,
  type AskDraftAnswers,
} from "@client/askDrafts";
import styles from "./AskUserCard.module.css";

// Phase 4b: the open ask_user question set, data-bound. Ports the legacy
// AskUserCard interaction (radio/checkbox options + a "Custom" free-text branch,
// per-question answered state, browser-local draft persistence, and a
// partial-submit confirmation) into React on the DSH skin. The daemon owns
// whether the ask is open; this card owns only the local draft. Record/outcome
// mode is rendered by the read path — this is the live answerable surface.

const OTHER_VALUE = "__pi_web_other__";

export interface AskUserCardProps {
  ask: PendingAskUser;
  /** Machine-scoped session cache key used by the ask draft store. */
  draftSessionId: string;
  onSubmit: (askId: string, submission: AskUserSubmission) => void | Promise<void>;
}

function isOtherSelected(question: AskUserQuestion, answer: AskDraftAnswer | undefined): boolean {
  if (answer?.otherText === undefined) return false;
  return question.multiple === true || answer.values.length === 0;
}

export function AskUserCard({ ask, draftSessionId, onSubmit }: AskUserCardProps): JSX.Element {
  const [answers, setAnswers] = useState<AskDraftAnswers>({});
  const [confirmingPartial, setConfirmingPartial] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const fieldsetRefs = useRef<(HTMLFieldSetElement | null)[]>([]);

  // Reset local draft state whenever the ask identity changes (a status refresh
  // re-projects the same open ask as a new object and must not wipe the draft).
  useEffect(() => {
    setAnswers(draftSessionId === "" ? {} : loadAskDraft(draftSessionId, ask.askId));
    setConfirmingPartial(false);
    setSubmitting(false);
  }, [ask.askId, draftSessionId]);

  const count = answeredCount(ask.questions, answers);
  const unanswered = useMemo(() => unansweredQuestions(ask.questions, answers), [ask.questions, answers]);

  const setAnswer = useCallback(
    (question: AskUserQuestion, answer: AskDraftAnswer) => {
      setAnswers((current) => {
        const next: AskDraftAnswers =
          answer.values.length === 0 && answer.otherText === undefined
            ? Object.fromEntries(Object.entries(current).filter(([id]) => id !== question.id))
            : { ...current, [question.id]: answer };
        if (draftSessionId !== "") saveAskDraft(draftSessionId, ask.askId, next);
        return next;
      });
      setConfirmingPartial(false);
    },
    [ask.askId, draftSessionId],
  );

  const changeOption = (question: AskUserQuestion, value: string, checked: boolean): void => {
    if (question.multiple !== true) {
      if (checked) setAnswer(question, { values: [value] });
      return;
    }
    const current = answers[question.id];
    const values = checked
      ? [...new Set([...(current?.values ?? []), value])]
      : (current?.values ?? []).filter((selected) => selected !== value);
    setAnswer(question, {
      values,
      ...(current?.otherText === undefined ? {} : { otherText: current.otherText }),
    });
  };

  const changeOther = (question: AskUserQuestion, checked: boolean): void => {
    const current = answers[question.id];
    if (question.multiple === true) {
      setAnswer(question, {
        values: [...(current?.values ?? [])],
        ...(checked ? { otherText: current?.otherText ?? "" } : {}),
      });
    } else if (checked) {
      setAnswer(question, {
        values: [],
        otherText: isOtherSelected(question, current) ? current?.otherText ?? "" : "",
      });
    }
  };

  const changeOtherText = (question: AskUserQuestion, text: string): void => {
    const current = answers[question.id];
    setAnswer(question, {
      values: [...(current?.values ?? [])],
      otherText: text.slice(0, ASK_USER_OTHER_TEXT_MAX_LENGTH),
    });
  };

  const submitAnswers = useCallback(() => {
    if (submitting) return;
    setSubmitting(true);
    const askId = ask.askId;
    void Promise.resolve()
      .then(() => onSubmit(askId, toSubmission(ask.questions, answers)))
      .catch(() => {
        // The controller owns the visible transport error; keep the card + draft.
      })
      .finally(() => {
        setSubmitting(false);
      });
  }, [ask.askId, ask.questions, answers, onSubmit, submitting]);

  const handleSubmit = (event: React.FormEvent): void => {
    event.preventDefault();
    if (submitting) return;
    if (unanswered.length > 0) {
      setConfirmingPartial(true);
      return;
    }
    submitAnswers();
  };

  const focusQuestion = (index: number): void => {
    if (index < 0) return;
    const fieldset = fieldsetRefs.current[index];
    const control = fieldset?.querySelector<HTMLElement>("input, textarea");
    (control ?? fieldset)?.focus();
  };

  return (
    <article className={styles.card} aria-labelledby="ask-user-heading">
      <header className={styles.header}>
        <h2 id="ask-user-heading" className={styles.title}>
          提问
        </h2>
        <span className={styles.headerStatus} role="status" aria-live="polite" aria-atomic="true">
          已回答 {count} / {ask.questions.length}
        </span>
      </header>
      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.questions}>
          {ask.questions.map((question, index) => {
            const answer = answers[question.id];
            const answered = answeredCount([question], answers) === 1;
            const freeTextOnly = question.options.length === 0;
            const customSelected = freeTextOnly || isOtherSelected(question, answer);
            const inputType = question.multiple === true ? "checkbox" : "radio";
            const groupName = `ask-user:${ask.askId}:${question.id}`;
            return (
              <fieldset
                key={question.id}
                ref={(el) => {
                  fieldsetRefs.current[index] = el;
                }}
                className={clsx(styles.question, answered && styles.answered)}
                tabIndex={-1}
              >
                <legend className={styles.legend}>
                  <span className={styles.questionNumber}>{index + 1}.</span>
                  <span>{question.question}</span>
                </legend>
                {question.detail !== undefined && <p className={styles.questionDetail}>{question.detail}</p>}
                <div className={styles.options}>
                  {question.options.map((option) => (
                    <label key={option.value} className={styles.option}>
                      <input
                        type={inputType}
                        name={groupName}
                        value={option.value}
                        checked={answer?.values.includes(option.value) === true}
                        onChange={(event) => { changeOption(question, option.value, event.target.checked); }}
                      />
                      <span className={styles.optionCopy}>
                        <span className={styles.optionLabel}>{option.label}</span>
                        {option.detail !== undefined && <span className={styles.optionDetail}>{option.detail}</span>}
                      </span>
                    </label>
                  ))}
                  {!freeTextOnly && (
                    <label className={styles.option}>
                      <input
                        type={inputType}
                        name={groupName}
                        value={OTHER_VALUE}
                        checked={customSelected}
                        onChange={(event) => { changeOther(question, event.target.checked); }}
                      />
                      <span className={styles.optionCopy}>
                        <span className={styles.optionLabel}>自定义</span>
                      </span>
                    </label>
                  )}
                  {customSelected && (
                    <label className={styles.otherAnswer}>
                      <span>自定义回答</span>
                      <textarea
                        rows={3}
                        maxLength={ASK_USER_OTHER_TEXT_MAX_LENGTH}
                        value={answer?.otherText ?? ""}
                        onChange={(event) => { changeOtherText(question, event.target.value); }}
                      />
                    </label>
                  )}
                </div>
              </fieldset>
            );
          })}
        </div>
        <footer className={styles.formFooter}>
          {confirmingPartial && unanswered.length > 0 ? (
            <div className={styles.partialConfirmation} role="group" aria-label="确认部分回答">
              <p className={styles.partialText}>
                <strong>未回答即发送：</strong>{" "}
                {unanswered.map((question, index) => (
                  <span key={question.id}>
                    {index === 0 ? "" : ", "}
                    <button
                      type="button"
                      className={styles.questionJump}
                      onClick={() => { focusQuestion(ask.questions.indexOf(question)); }}
                    >
                      {question.question}
                    </button>
                  </span>
                ))}
                ?
              </p>
              <div className={styles.confirmationActions}>
                <button
                  type="button"
                  className={styles.secondaryAction}
                  onClick={() => {
                    setConfirmingPartial(false);
                    const firstUnanswered = unanswered[0];
                    if (firstUnanswered !== undefined) focusQuestion(ask.questions.indexOf(firstUnanswered));
                  }}
                >
                  继续编辑
                </button>
                <button
                  type="button"
                  className={styles.primaryAction}
                  disabled={submitting}
                  onClick={submitAnswers}
                >
                  {submitting ? "发送中…" : "仍然发送"}
                </button>
              </div>
            </div>
          ) : (
            <button type="submit" className={styles.primaryAction} disabled={submitting}>
              {submitting ? "发送中…" : "发送回答"}
            </button>
          )}
        </footer>
      </form>
    </article>
  );
}
