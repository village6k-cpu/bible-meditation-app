import { useLayoutEffect, useRef } from 'preact/hooks';

/** 본문 안에 또 스크롤 창을 만들지 않는다. 페이지 하나가 끝까지 스크롤된다. */
export function WritingArea({value, label, placeholder, onInput}: {
  value: string; label: string; placeholder: string; onInput: (text: string) => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => { el.style.height = '0px'; el.style.height = `${el.scrollHeight}px`; };
    fit();
    const observer = new ResizeObserver(() => {
      if (el.clientWidth !== width) { width = el.clientWidth; fit(); }
    });
    let width = el.clientWidth;
    observer.observe(el);
    return () => observer.disconnect();
  }, [value]);
  return <textarea ref={ref} class="writing-text" aria-label={label} rows={18}
    value={value} placeholder={placeholder} onInput={e=>onInput(e.currentTarget.value)}/>;
}
