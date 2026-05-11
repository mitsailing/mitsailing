import { describe, expect, it, vi } from 'vitest';
import { EventAnswerType } from '@/generated/prisma/enums';

vi.mock('server-only', () => ({}));

const {
  MAX_EVENT_REGISTRATION_TEXT_ANSWER_LENGTH,
  parsePublicEventRegistrationAnswersFromForm,
} = await import('@/libs/mit-sailing/eventRegistrationAnswerValidation');

describe('parsePublicEventRegistrationAnswersFromForm', () => {
  it('accepts valid text answer', () => {
    const fd = new FormData();
    fd.set('question_q1', '  hello  ');
    const result = parsePublicEventRegistrationAnswersFromForm(
      [
        {
          id: 'q1',
          required: true,
          answerType: EventAnswerType.text,
          options: [],
        },
      ],
      fd
    );
    expect(result).toEqual({
      ok: true,
      answers: [{ questionId: 'q1', value: 'hello' }],
    });
  });

  it('rejects text over max length', () => {
    const fd = new FormData();
    fd.set(
      'question_q1',
      'x'.repeat(MAX_EVENT_REGISTRATION_TEXT_ANSWER_LENGTH + 1)
    );
    const result = parsePublicEventRegistrationAnswersFromForm(
      [
        {
          id: 'q1',
          required: true,
          answerType: EventAnswerType.text,
          options: [],
        },
      ],
      fd
    );
    expect(result).toEqual({ ok: false, code: 'answers_invalid' });
  });

  it('accepts select value in options', () => {
    const fd = new FormData();
    fd.set('question_q1', 'Beta');
    const result = parsePublicEventRegistrationAnswersFromForm(
      [
        {
          id: 'q1',
          required: true,
          answerType: EventAnswerType.select,
          options: ['Alpha', 'Beta'],
        },
      ],
      fd
    );
    expect(result).toEqual({
      ok: true,
      answers: [{ questionId: 'q1', value: 'Beta' }],
    });
  });

  it('rejects select value not in options', () => {
    const fd = new FormData();
    fd.set('question_q1', 'Gamma');
    const result = parsePublicEventRegistrationAnswersFromForm(
      [
        {
          id: 'q1',
          required: false,
          answerType: EventAnswerType.select,
          options: ['Alpha', 'Beta'],
        },
      ],
      fd
    );
    expect(result).toEqual({ ok: false, code: 'answers_invalid' });
  });

  it('accepts boolean checkbox true', () => {
    const fd = new FormData();
    fd.set('question_q1', 'true');
    const result = parsePublicEventRegistrationAnswersFromForm(
      [
        {
          id: 'q1',
          required: true,
          answerType: EventAnswerType.checkbox,
          options: [],
        },
      ],
      fd
    );
    expect(result).toEqual({
      ok: true,
      answers: [{ questionId: 'q1', value: 'true' }],
    });
  });

  it('accepts required boolean checkbox with hidden false and checked true', () => {
    const fd = new FormData();
    fd.append('question_q1', 'false');
    fd.append('question_q1', 'true');
    const result = parsePublicEventRegistrationAnswersFromForm(
      [
        {
          id: 'q1',
          required: true,
          answerType: EventAnswerType.checkbox,
          options: [],
        },
      ],
      fd
    );
    expect(result).toEqual({
      ok: true,
      answers: [{ questionId: 'q1', value: 'true' }],
    });
  });

  it('accepts required boolean checkbox when checkbox precedes hidden in form data', () => {
    const fd = new FormData();
    fd.append('question_q1', 'true');
    fd.append('question_q1', 'false');
    const result = parsePublicEventRegistrationAnswersFromForm(
      [
        {
          id: 'q1',
          required: true,
          answerType: EventAnswerType.checkbox,
          options: [],
        },
      ],
      fd
    );
    expect(result).toEqual({
      ok: true,
      answers: [{ questionId: 'q1', value: 'true' }],
    });
  });

  it('rejects boolean checkbox tampered value', () => {
    const fd = new FormData();
    fd.set('question_q1', 'on');
    const result = parsePublicEventRegistrationAnswersFromForm(
      [
        {
          id: 'q1',
          required: true,
          answerType: EventAnswerType.checkbox,
          options: [],
        },
      ],
      fd
    );
    expect(result).toEqual({ ok: false, code: 'answers_invalid' });
  });

  it('rejects boolean checkbox with more than two same-name entries', () => {
    const fd = new FormData();
    fd.append('question_q1', 'false');
    fd.append('question_q1', 'true');
    fd.append('question_q1', 'false');
    const result = parsePublicEventRegistrationAnswersFromForm(
      [
        {
          id: 'q1',
          required: true,
          answerType: EventAnswerType.checkbox,
          options: [],
        },
      ],
      fd
    );
    expect(result).toEqual({ ok: false, code: 'answers_invalid' });
  });

  it('rejects boolean checkbox with duplicated true entries', () => {
    const fd = new FormData();
    fd.append('question_q1', 'true');
    fd.append('question_q1', 'true');
    const result = parsePublicEventRegistrationAnswersFromForm(
      [
        {
          id: 'q1',
          required: false,
          answerType: EventAnswerType.checkbox,
          options: [],
        },
      ],
      fd
    );
    expect(result).toEqual({ ok: false, code: 'answers_invalid' });
  });

  it('requires boolean checkbox when marked required', () => {
    const fd = new FormData();
    const result = parsePublicEventRegistrationAnswersFromForm(
      [
        {
          id: 'q1',
          required: true,
          answerType: EventAnswerType.checkbox,
          options: [],
        },
      ],
      fd
    );
    expect(result).toEqual({ ok: false, code: 'questions_required' });
  });

  it('requires boolean checkbox when only hidden false is posted', () => {
    const fd = new FormData();
    fd.set('question_q1', 'false');
    const result = parsePublicEventRegistrationAnswersFromForm(
      [
        {
          id: 'q1',
          required: true,
          answerType: EventAnswerType.checkbox,
          options: [],
        },
      ],
      fd
    );
    expect(result).toEqual({ ok: false, code: 'questions_required' });
  });

  it('skips optional boolean checkbox when only false is posted', () => {
    const fd = new FormData();
    fd.set('question_q1', 'false');
    const result = parsePublicEventRegistrationAnswersFromForm(
      [
        {
          id: 'q1',
          required: false,
          answerType: EventAnswerType.checkbox,
          options: [],
        },
      ],
      fd
    );
    expect(result).toEqual({ ok: true, answers: [] });
  });

  it('accepts multi checkbox subset and sorts stored json', () => {
    const fd = new FormData();
    fd.append('question_q1', 'b');
    fd.append('question_q1', 'a');
    const result = parsePublicEventRegistrationAnswersFromForm(
      [
        {
          id: 'q1',
          required: true,
          answerType: EventAnswerType.checkbox,
          options: ['a', 'b', 'c'],
        },
      ],
      fd
    );
    expect(result).toEqual({
      ok: true,
      answers: [{ questionId: 'q1', value: '["a","b"]' }],
    });
  });

  it('rejects multi checkbox value outside options', () => {
    const fd = new FormData();
    fd.append('question_q1', 'a');
    fd.append('question_q1', 'z');
    const result = parsePublicEventRegistrationAnswersFromForm(
      [
        {
          id: 'q1',
          required: true,
          answerType: EventAnswerType.checkbox,
          options: ['a', 'b'],
        },
      ],
      fd
    );
    expect(result).toEqual({ ok: false, code: 'answers_invalid' });
  });
});
