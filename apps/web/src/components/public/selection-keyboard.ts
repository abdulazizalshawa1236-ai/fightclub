import type { KeyboardEvent } from 'react';

export function selectChoice<T>(
  event: KeyboardEvent<HTMLElement>,
  choices: T[],
  selected: T,
  change: (choice: T) => void,
  rtl = false,
  verticalStep = 1,
): void {
  const forward = rtl ? 'ArrowLeft' : 'ArrowRight';
  const backward = rtl ? 'ArrowRight' : 'ArrowLeft';
  const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button'));
  const focused = event.target instanceof Element ? event.target.closest('button') : null;
  const focusedIndex = focused ? buttons.indexOf(focused) : -1;
  const index = focusedIndex >= 0 ? focusedIndex : choices.indexOf(selected);
  let next: number;
  if (event.key === 'Home') next = 0;
  else if (event.key === 'End') next = choices.length - 1;
  else if (event.key === forward) next = (index + 1) % choices.length;
  else if (event.key === backward) next = (index - 1 + choices.length) % choices.length;
  else if (event.key === 'ArrowDown') next = (index + verticalStep) % choices.length;
  else if (event.key === 'ArrowUp') next = (index - verticalStep + choices.length) % choices.length;
  else return;
  const choice = choices[next];
  if (choice === undefined) return;
  event.preventDefault();
  change(choice);
  buttons[next]?.focus();
}
